-- ============================================================================
-- Migration 042 — Meta Lead Ads ingest RPC (fix for anon-RLS blockage)
-- ============================================================================
--
-- BUG this fixes:
--   The /api/webhooks/meta-leads route (shipped with mig 040) calls
--   createClient() from @/lib/supabase/server, which runs as the ANON
--   role for unauthenticated requests. It then does:
--     - INSERT into public.customers
--     - INSERT into public.meta_lead_imports
--   Both tables have NO insert policy for anon, so every webhook
--   silently failed with PGRST-403 — Meta retried 5 times, gave up,
--   and the tenant got zero leads in their CRM.
--
--   The route already correctly uses SECURITY DEFINER RPCs for
--   lookup_meta_integration_by_page() and _meta_integration_bump_counters(),
--   but the actual customer + audit-log inserts were direct table writes.
--
-- THIS MIGRATION:
--   Adds ingest_meta_lead_v1 — one SECURITY DEFINER function that
--   atomically:
--     1) Dedups against existing customer by phone OR email in the tenant
--     2) Inserts a new customer OR updates the existing one (preserving
--        first-touch UTM attribution)
--     3) Inserts a meta_lead_imports audit row with the right outcome
--     4) Bumps the integration's counters
--
--   The webhook becomes a thin orchestrator: lookup → fetch from Graph
--   → call ingest RPC once. No raw INSERTs from anon land.
-- ============================================================================

create or replace function public.ingest_meta_lead_v1(
  p_integration_id  uuid,
  p_company_id      uuid,
  p_landing_page_id uuid,
  p_leadgen_id      text,
  p_page_id         text,
  p_ad_id           text,
  p_form_id         text,
  p_campaign_id     text,
  p_adset_id        text,
  p_full_name       text,
  p_phone           text,
  p_email           text,
  p_whatsapp        text,
  p_city            text,
  p_message         text,
  p_created_time    timestamptz,
  p_raw_payload     jsonb
)
returns table (
  customer_id uuid,
  outcome     text  -- 'success' | 'duplicate'
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id  uuid;
  v_outcome      text;
  v_dedup_phone  text;
  v_dedup_email  text;
  v_notes        text;
begin
  -- Validate inputs (defensive — caller is the webhook handler, but
  -- definer functions should never trust their args)
  if p_company_id is null then
    raise exception 'company_id required';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'name required';
  end if;
  if coalesce(trim(p_phone), '') = ''
     and coalesce(trim(p_email), '') = ''
     and coalesce(trim(p_whatsapp), '') = '' then
    raise exception 'at least one contact method required';
  end if;

  v_dedup_phone := nullif(trim(p_phone), '');
  v_dedup_email := nullif(lower(trim(p_email)), '');

  -- Dedup: any existing customer in this tenant with matching phone
  -- or email gets the new lead's data folded in, not a duplicate row.
  select id into v_customer_id
    from public.customers c
   where c.company_id = p_company_id
     and (
          (v_dedup_phone is not null and c.phone = v_dedup_phone)
       or (v_dedup_email is not null and lower(c.email) = v_dedup_email)
     )
   limit 1;

  -- Build a useful notes blob — Meta context + the lead's own message.
  v_notes := concat_ws(
    E'\n\n',
    nullif(trim(p_message), ''),
    case when p_city is not null and trim(p_city) <> ''
         then '📍 ' || trim(p_city) end,
    '📥 من Meta Lead Form · ad_id=' || coalesce(p_ad_id, '—')
      || ' · campaign=' || coalesce(p_campaign_id, '—')
  );

  if v_customer_id is null then
    -- New customer
    insert into public.customers (
      company_id, full_name, phone, email, whatsapp,
      status, source, notes,
      landing_page_id,
      first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content,
      first_seen_at
    )
    values (
      p_company_id,
      trim(p_full_name),
      v_dedup_phone,
      v_dedup_email,
      nullif(trim(p_whatsapp), ''),
      'lead',
      'meta_lead_ads',
      v_notes,
      p_landing_page_id,
      'meta_lead_ads',
      'paid_social',
      p_campaign_id,
      coalesce(p_ad_id, p_form_id),
      coalesce(p_created_time, now())
    )
    returning id into v_customer_id;
    v_outcome := 'success';
  else
    -- Existing customer — refresh contact info but DON'T overwrite
    -- first-touch UTM attribution or change their pipeline status.
    update public.customers set
      full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      phone     = coalesce(v_dedup_phone, phone),
      email     = coalesce(v_dedup_email, email),
      whatsapp  = coalesce(nullif(trim(p_whatsapp), ''), whatsapp),
      notes     = coalesce(notes, '') ||
                  case when notes is null or notes = '' then '' else E'\n\n---\n\n' end ||
                  '[Meta Lead Ad · ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ']' ||
                  case when nullif(trim(p_message), '') is not null
                       then E'\n' || trim(p_message) else '' end,
      updated_at = now()
    where id = v_customer_id;
    v_outcome := 'duplicate';
  end if;

  -- Audit log. Use INSERT ... ON CONFLICT DO NOTHING so Meta's retries
  -- (which send the same leadgen_id repeatedly until they get 200) don't
  -- create duplicate audit rows.
  insert into public.meta_lead_imports (
    meta_integration_id, company_id,
    leadgen_id, page_id, ad_id, form_id, campaign_id, adset_id,
    customer_id, outcome, raw_payload
  )
  values (
    p_integration_id, p_company_id,
    p_leadgen_id, p_page_id, p_ad_id, p_form_id, p_campaign_id, p_adset_id,
    v_customer_id, v_outcome, p_raw_payload
  )
  on conflict (leadgen_id) do nothing;

  -- Bump the integration counter (call the existing helper)
  perform public._meta_integration_bump_counters(
    p_integration_id, true, null
  );

  return query select v_customer_id, v_outcome;
end;
$$;

revoke all on function public.ingest_meta_lead_v1(
  uuid, uuid, uuid,
  text, text, text, text, text, text,
  text, text, text, text, text, text,
  timestamptz, jsonb
) from public;
grant execute on function public.ingest_meta_lead_v1(
  uuid, uuid, uuid,
  text, text, text, text, text, text,
  text, text, text, text, text, text,
  timestamptz, jsonb
) to anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- record_meta_lead_failure — same purpose as ingest_meta_lead_v1 but for
-- the cases where we COULDN'T ingest (Graph API failed, parse failed,
-- etc.). Logs the failure so the integrations dashboard shows the
-- "last 15 webhook" audit trail accurately.
-- ----------------------------------------------------------------------------
create or replace function public.record_meta_lead_failure(
  p_integration_id uuid,
  p_company_id     uuid,
  p_leadgen_id     text,
  p_page_id        text,
  p_ad_id          text,
  p_form_id        text,
  p_outcome        text,         -- 'token_missing' | 'fetch_failed' | 'parse_failed' | 'insert_failed'
  p_error_message  text,
  p_raw_payload    jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ON CONFLICT prevents duplicate failure rows for Meta's retries.
  insert into public.meta_lead_imports (
    meta_integration_id, company_id,
    leadgen_id, page_id, ad_id, form_id,
    outcome, error_message, raw_payload
  )
  values (
    p_integration_id, p_company_id,
    p_leadgen_id, p_page_id, p_ad_id, p_form_id,
    p_outcome, p_error_message, p_raw_payload
  )
  on conflict (leadgen_id) do update set
    outcome       = excluded.outcome,
    error_message = excluded.error_message,
    raw_payload   = excluded.raw_payload;

  -- Bump counters too (imported=false because this is a failure).
  -- Skip when integration_id is null (orphan webhook, no tenant known)
  if p_integration_id is not null then
    perform public._meta_integration_bump_counters(
      p_integration_id, false, p_error_message
    );
  end if;
end;
$$;

revoke all on function public.record_meta_lead_failure(
  uuid, uuid, text, text, text, text, text, text, jsonb
) from public;
grant execute on function public.record_meta_lead_failure(
  uuid, uuid, text, text, text, text, text, text, jsonb
) to anon, authenticated, service_role;


-- Reload PostgREST so the new RPCs are immediately callable
notify pgrst, 'reload schema';
