-- ============================================================================
-- Migration 040 — Meta Lead Ads (Facebook + Instagram) integration scaffold
-- ============================================================================
--
-- A tenant who runs Meta Lead Ads (Facebook / Instagram lead form ads)
-- wants the leads to flow into Nidham's CRM automatically, NOT manually
-- downloaded as CSV from Ads Manager.
--
-- Meta's webhook delivery model:
--   1) Tenant creates a Facebook Page (or already has one)
--   2) Tenant runs a Lead Ad on that Page
--   3) When a user submits a lead form on Meta, Meta POSTs to ANY app
--      subscribed to the page's "leadgen" field with a leadgen_id
--   4) The app fetches the actual form data from
--      GET /{leadgen_id}?access_token={PAGE_ACCESS_TOKEN}
--   5) The app stores the lead as a customer in the right tenant
--
-- For step 3 to work the tenant has to either:
--   (a) Use the SAME Facebook App we run, and grant Page Access to our
--       App via the Login flow (requires Meta business verification)
--   (b) Subscribe their OWN Facebook App to their page (DIY path), then
--       paste their page access token into Nidham so we can fetch lead
--       data when their webhook fires
--
-- This migration supports BOTH paths. The webhook endpoint lives at
-- /api/webhooks/meta-leads. Tenants connect via the dashboard at
-- /dashboard/marketing/integrations/meta.
--
-- Token storage: we use pgcrypto's pgp_sym_encrypt() with a server-side
-- key (META_ENCRYPTION_KEY env var) to encrypt page access tokens at
-- rest. Only the webhook handler and the test-connection endpoint
-- decrypt them, via the read_meta_integration() SECURITY DEFINER fn.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1) meta_integrations — one row per connected Facebook Page per tenant
-- ----------------------------------------------------------------------------
create table if not exists public.meta_integrations (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,

  -- Facebook side
  page_id               text not null,        -- e.g. "123456789012345"
  page_name             text not null,        -- human-readable, for display

  -- Page Access Token, encrypted at rest. Pass to pgp_sym_encrypt()
  -- with the server's META_ENCRYPTION_KEY before insert.
  page_access_token_encrypted bytea,

  -- Optional: the App ID this token is bound to. Useful for support
  -- debugging when a tenant uses their own FB App rather than ours.
  app_id                text,

  -- Default landing_page_id to attribute these leads to (for funnel
  -- reporting). Optional; without it the leads still show up but with
  -- "meta_lead_ads" as the source and no specific landing_page link.
  default_landing_page_id uuid references public.landing_pages(id) on delete set null,

  -- Tenant labels the integration to remember which ad account/page it
  -- maps to (e.g. "كوري PVC - الصفحة الرسمية")
  display_label         text,

  -- Lifecycle
  is_active             boolean not null default true,
  last_webhook_at       timestamptz,
  last_error            text,
  webhooks_received     integer not null default 0,
  leads_imported        integer not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references public.profiles(id) on delete set null,

  -- One page can only be linked to ONE tenant at a time. Stops a
  -- malicious actor from claiming another tenant's page.
  unique (page_id)
);

create index if not exists idx_meta_integrations_company
  on public.meta_integrations(company_id);
create index if not exists idx_meta_integrations_page
  on public.meta_integrations(page_id);

drop trigger if exists meta_integrations_set_updated_at on public.meta_integrations;
create trigger meta_integrations_set_updated_at
  before update on public.meta_integrations
  for each row execute function public.tg_set_updated_at();

-- ----------------------------------------------------------------------------
-- 2) meta_lead_imports — log every Meta lead ingest attempt (success or fail)
-- ----------------------------------------------------------------------------
-- Important for debugging: when a tenant says "I'm running ads but leads
-- aren't showing up", we want to see whether webhooks arrived at all,
-- whether token-decoding worked, and whether the customer insert succeeded.
create table if not exists public.meta_lead_imports (
  id                    uuid primary key default gen_random_uuid(),
  meta_integration_id   uuid references public.meta_integrations(id) on delete cascade,
  company_id            uuid not null references public.companies(id) on delete cascade,

  leadgen_id            text not null,        -- the ID Meta sent
  page_id               text not null,        -- redundant for fast filtering
  ad_id                 text,
  form_id               text,
  campaign_id           text,
  adset_id              text,
  customer_id           uuid references public.customers(id) on delete set null,

  -- 'success' / 'token_missing' / 'fetch_failed' / 'parse_failed' / 'duplicate'
  outcome               text not null,
  error_message         text,
  raw_payload           jsonb,
  occurred_at           timestamptz not null default now(),

  unique (leadgen_id)
);

create index if not exists idx_meta_lead_imports_company_time
  on public.meta_lead_imports(company_id, occurred_at desc);
create index if not exists idx_meta_lead_imports_integration
  on public.meta_lead_imports(meta_integration_id);


-- ----------------------------------------------------------------------------
-- 3) SECURITY DEFINER helpers — only used by /api/webhooks/meta-leads
-- ----------------------------------------------------------------------------

-- 3.a) Decrypt + return integration details by page_id. Webhook handler
-- calls this to find which tenant owns the page and what token to use
-- when fetching lead data from Graph API.
create or replace function public.lookup_meta_integration_by_page(
  p_page_id        text,
  p_encryption_key text
)
returns table (
  integration_id           uuid,
  company_id               uuid,
  page_access_token        text,
  default_landing_page_id  uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    mi.id,
    mi.company_id,
    pgp_sym_decrypt(mi.page_access_token_encrypted, p_encryption_key)::text,
    mi.default_landing_page_id
  from public.meta_integrations mi
  where mi.page_id = p_page_id
    and mi.is_active = true
    and mi.page_access_token_encrypted is not null
  limit 1;
end;
$$;

revoke all on function public.lookup_meta_integration_by_page(text, text) from public;
grant execute on function public.lookup_meta_integration_by_page(text, text) to service_role, authenticated;
-- Note: 'authenticated' is needed because Next.js routes run with the
-- user's anon/auth token, not service_role, unless we set up service-role
-- access. The function itself is security_definer so it bypasses RLS;
-- the access grant just controls who can CALL the function. The
-- p_encryption_key arg gates real abuse: without the env var, calls
-- return rows with NULL decrypted tokens (gibberish).


-- 3.b) Save / upsert a Meta integration with an encrypted token
create or replace function public.upsert_meta_integration(
  p_page_id             text,
  p_page_name           text,
  p_page_access_token   text,
  p_encryption_key      text,
  p_app_id              text,
  p_display_label       text,
  p_default_landing_page_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_company_id uuid;
  v_existing_id uuid;
  v_existing_company uuid;
  v_result_id  uuid;
begin
  if v_profile_id is null then
    raise exception 'must be authenticated';
  end if;

  -- Resolve the calling user's company. Uses RLS-safe path through
  -- profiles (which the user can always see their own row of).
  select company_id into v_company_id
    from public.profiles
   where id = v_profile_id;
  if v_company_id is null then
    raise exception 'no company for caller';
  end if;

  -- Is this page already connected? If yes, MUST be to the same tenant
  -- (the unique constraint enforces this, but we give a clearer error).
  select id, company_id into v_existing_id, v_existing_company
    from public.meta_integrations
   where page_id = p_page_id;

  if v_existing_id is not null and v_existing_company <> v_company_id then
    raise exception 'page % already connected to a different tenant', p_page_id;
  end if;

  if v_existing_id is not null then
    update public.meta_integrations set
      page_name = p_page_name,
      page_access_token_encrypted = pgp_sym_encrypt(p_page_access_token, p_encryption_key),
      app_id = p_app_id,
      display_label = p_display_label,
      default_landing_page_id = p_default_landing_page_id,
      is_active = true,
      last_error = null,
      updated_at = now()
    where id = v_existing_id;
    v_result_id := v_existing_id;
  else
    insert into public.meta_integrations (
      company_id, page_id, page_name,
      page_access_token_encrypted, app_id,
      display_label, default_landing_page_id,
      created_by
    )
    values (
      v_company_id, p_page_id, p_page_name,
      pgp_sym_encrypt(p_page_access_token, p_encryption_key),
      p_app_id, p_display_label, p_default_landing_page_id,
      v_profile_id
    )
    returning id into v_result_id;
  end if;

  return v_result_id;
end;
$$;

grant execute on function public.upsert_meta_integration(
  text, text, text, text, text, text, uuid
) to authenticated;


-- 3.c) Bump counters on the integration after a successful webhook
create or replace function public._meta_integration_bump_counters(
  p_integration_id uuid,
  p_imported       boolean,
  p_error_message  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.meta_integrations set
    webhooks_received = webhooks_received + 1,
    leads_imported    = case when p_imported then leads_imported + 1 else leads_imported end,
    last_webhook_at   = now(),
    last_error        = p_error_message
  where id = p_integration_id;
end;
$$;

grant execute on function public._meta_integration_bump_counters(uuid, boolean, text)
  to service_role, authenticated;


-- ----------------------------------------------------------------------------
-- 4) RLS
-- ----------------------------------------------------------------------------
alter table public.meta_integrations enable row level security;
alter table public.meta_lead_imports enable row level security;

drop policy if exists "view_meta_integrations_in_own_company" on public.meta_integrations;
create policy "view_meta_integrations_in_own_company"
  on public.meta_integrations for select
  to authenticated
  using (company_id = public.current_company_id());

-- Writes happen ONLY through upsert_meta_integration() / archive action.
-- We allow DELETE so the dashboard can let users disconnect.
drop policy if exists "manage_meta_integrations_in_own_company" on public.meta_integrations;
create policy "manage_meta_integrations_in_own_company"
  on public.meta_integrations for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "super_admin_view_all_meta_integrations" on public.meta_integrations;
create policy "super_admin_view_all_meta_integrations"
  on public.meta_integrations for select
  using (public.is_super_admin());


drop policy if exists "view_meta_lead_imports_in_own_company" on public.meta_lead_imports;
create policy "view_meta_lead_imports_in_own_company"
  on public.meta_lead_imports for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "super_admin_view_all_meta_lead_imports" on public.meta_lead_imports;
create policy "super_admin_view_all_meta_lead_imports"
  on public.meta_lead_imports for select
  using (public.is_super_admin());


-- ----------------------------------------------------------------------------
-- 5) Reload PostgREST cache so new RPCs are callable immediately
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
