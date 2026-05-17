-- ============================================================================
-- Migration 039 — Lead Capture, Landing Pages, Attribution & Pipeline
-- ============================================================================
--
-- The Marketing Studio (mig 037) generates campaign briefs, ad copy, SEO,
-- and personas. But until now there was no way to ACT on those — no
-- landing pages to send traffic to, no tracking of who showed up, no
-- pipeline to manage leads through.
--
-- This migration adds the operational layer:
--
--   1) landing_pages     — tenant-owned pages renderable at /p/[slug],
--                          with a configurable lead-capture form, WhatsApp
--                          button, phone CTA, and template choice.
--   2) lead_events       — every page view, button click, and form submit
--                          is recorded here with UTM attribution + session
--                          ID so the marketing team can see the FULL
--                          funnel: visits → engagement → leads → contact
--                          → conversion.
--   3) customers extensions — UTM source columns, last-contacted tracking,
--                          first-touch / converted-at timestamps, and a
--                          widened status enum that covers the realistic
--                          marketing pipeline (lead / contacted / qualified
--                          / won / lost / dormant).
--   4) RPCs              — submit_lead_form() and log_lead_event() run with
--                          SECURITY DEFINER so the anonymous public route
--                          can write without exposing the underlying tables
--                          via broad anon-insert policies.
--   5) RLS               — landing_pages: tenant read/write + anon SELECT
--                          for active rows (public route needs them).
--                          lead_events: tenant SELECT only — writes go
--                          exclusively through the RPC functions.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) landing_pages
-- ----------------------------------------------------------------------------
create table if not exists public.landing_pages (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,

  -- URL handle. Globally unique because /p/[slug] is global; we prefix
  -- with a short hash of company_id when generating to avoid collisions.
  slug                text not null unique,

  -- Internal label the user picks ("PVC Summer 2026"). Distinct from the
  -- public-facing headline.
  name                text not null,

  -- Layout family. Each template renders the same fields differently.
  template            text not null default 'generic'
                      check (template in (
                        'generic', 'lead_magnet', 'product', 'service', 'event'
                      )),

  -- Public-facing content
  headline            text not null,
  sub_headline        text,
  body                text,          -- markdown-ish, line-break preserved
  hero_image_url      text,
  accent_color        text default '#0891B2',  -- brand cyan default

  -- Primary CTA action (sits next to the form, or instead of it)
  cta_label           text default 'كلّمنا',
  cta_action          text default 'whatsapp'
                      check (cta_action in (
                        'form', 'whatsapp', 'phone', 'external_url'
                      )),
  -- Interpretation depends on cta_action:
  --   whatsapp     -> E.164-style phone, e.g. "+201001234567"
  --   phone        -> phone number for tel: link
  --   external_url -> full URL
  --   form         -> ignored
  cta_target          text,

  -- Lead form (rendered when cta_action='form' or as secondary input)
  form_enabled        boolean not null default true,
  -- Free-form selection of fields to show. Common keys:
  --   "name" (always implied), "phone", "email", "whatsapp", "message",
  --   "city", "interest", "budget"
  -- Stored as a JSON array of strings so the renderer can iterate.
  form_fields         jsonb not null default '["name","phone","whatsapp"]'::jsonb,
  form_submit_label   text default 'سيب بياناتك',
  form_success_msg    text default 'شكراً! هنتواصل معاك في أقرب وقت.',

  -- Project link — optional but useful for grouping by marketing project.
  marketing_project_id uuid references public.marketing_projects(id) on delete set null,

  -- Lifecycle
  is_active           boolean not null default true,
  archived_at         timestamptz,

  -- Stats (denormalized counters maintained by RPC functions)
  views_count         integer not null default 0,
  conversions_count   integer not null default 0,

  -- Audit
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references public.profiles(id) on delete set null
);

create index idx_landing_pages_company    on public.landing_pages(company_id);
create index idx_landing_pages_slug       on public.landing_pages(slug);
create index idx_landing_pages_project    on public.landing_pages(marketing_project_id);

create trigger landing_pages_set_updated_at
  before update on public.landing_pages
  for each row execute function public.tg_set_updated_at();


-- ----------------------------------------------------------------------------
-- 2) lead_events
-- ----------------------------------------------------------------------------
-- Each row = one observed interaction. We don't have a customer yet for
-- anonymous page views — customer_id stays null until a form submit ties
-- a session back to a customer. Session ID is set by a first-party cookie
-- so we can stitch a single visitor's events together.
create table if not exists public.lead_events (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,

  -- Optional links — both nullable because events can fire on any page
  -- (a marketing-project landing page, an external embed, etc.)
  landing_page_id     uuid references public.landing_pages(id) on delete set null,
  customer_id         uuid references public.customers(id) on delete set null,

  event_type          text not null
                      check (event_type in (
                        'page_view',         -- landing page rendered
                        'form_submit',       -- lead form posted
                        'whatsapp_click',    -- CTA clicked
                        'phone_click',
                        'external_click',
                        'custom'             -- catch-all for future events
                      )),

  -- Attribution — captured from URL ?utm_*=... and document.referrer at
  -- first touch and persisted on every subsequent event for that session.
  utm_source          text,
  utm_medium          text,
  utm_campaign        text,
  utm_content         text,
  utm_term            text,
  referrer            text,

  -- Browser fingerprint-y stuff (truncated / hashed for privacy)
  user_agent          text,
  ip_hash             text,           -- sha-256 of IP, never raw

  -- Session correlation
  session_id          uuid,

  -- Free-form payload — form values, button labels, etc.
  metadata            jsonb not null default '{}'::jsonb,

  occurred_at         timestamptz not null default now()
);

create index idx_lead_events_company        on public.lead_events(company_id);
create index idx_lead_events_landing        on public.lead_events(landing_page_id);
create index idx_lead_events_customer       on public.lead_events(customer_id);
create index idx_lead_events_session        on public.lead_events(session_id);
create index idx_lead_events_company_time   on public.lead_events(company_id, occurred_at desc);


-- ----------------------------------------------------------------------------
-- 3) customers extensions
-- ----------------------------------------------------------------------------
-- The existing customers table (mig 004) tracks lead/active/won/lost.
-- We widen the pipeline so the marketing team can see "contacted but no
-- reply" vs "qualified" vs "won". We don't remove old values so existing
-- rows keep working.

-- Drop old check constraint (its name is auto-generated; we recreate explicitly).
do $$
declare
  v_constraint_name text;
begin
  select conname into v_constraint_name
  from pg_constraint
  where conrelid = 'public.customers'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%''lead''%''active''%''won''%''lost''%';
  if v_constraint_name is not null then
    execute format('alter table public.customers drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table public.customers
  add constraint customers_status_check
  check (status in (
    'lead',         -- brand new, never touched
    'contacted',    -- someone tried to reach them
    'qualified',    -- responded + worth pursuing
    'active',       -- legacy synonym for qualified (kept for back-compat)
    'won',          -- converted into a paying customer
    'lost',         -- not interested / lost to competitor
    'dormant'       -- inactive 60+ days
  ));

-- New attribution + tracking columns. All optional so existing rows are
-- unaffected.
alter table public.customers
  add column if not exists landing_page_id   uuid references public.landing_pages(id) on delete set null,
  add column if not exists session_id        uuid,

  -- UTM at first touch (don't overwrite — first-click attribution)
  add column if not exists first_utm_source     text,
  add column if not exists first_utm_medium     text,
  add column if not exists first_utm_campaign   text,
  add column if not exists first_utm_content    text,
  add column if not exists first_utm_term       text,
  add column if not exists first_referrer       text,

  -- Pipeline tracking
  add column if not exists last_contacted_at    timestamptz,
  add column if not exists last_contacted_by    uuid references public.profiles(id) on delete set null,
  add column if not exists first_seen_at        timestamptz,
  add column if not exists converted_at         timestamptz,
  add column if not exists lost_at              timestamptz,
  add column if not exists lost_reason          text,

  -- Optional extra contact channel
  add column if not exists whatsapp             text;

create index if not exists idx_customers_landing_page
  on public.customers(landing_page_id);
create index if not exists idx_customers_company_status_contacted
  on public.customers(company_id, status, last_contacted_at);


-- ----------------------------------------------------------------------------
-- 4) RPC functions for the public route
-- ----------------------------------------------------------------------------

-- 4.a) submit_lead_form
--
-- Anonymous visitor submitted the form on /p/[slug]. We:
--   1) Look up the landing page (must be active)
--   2) Try to dedupe against an existing customer by phone OR email
--      within the same tenant — updating instead of inserting if found
--   3) Insert a 'form_submit' lead_event
--   4) Bump landing_pages.conversions_count
--   5) Return the customer_id so the page can show a thank-you screen
--      and the dashboard can deep-link
--
-- Marked SECURITY DEFINER so it bypasses the customers/landing_pages
-- write policies — the function itself enforces tenant scoping by going
-- through landing_pages.company_id.
create or replace function public.submit_lead_form(
  p_slug          text,
  p_name          text,
  p_phone         text,
  p_email         text,
  p_whatsapp      text,
  p_city          text,
  p_message       text,
  p_session_id    uuid,
  p_utm_source    text,
  p_utm_medium    text,
  p_utm_campaign  text,
  p_utm_content   text,
  p_utm_term      text,
  p_referrer      text,
  p_user_agent    text,
  p_ip_hash       text
)
returns table (
  customer_id     uuid,
  success_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page         public.landing_pages%rowtype;
  v_customer_id  uuid;
  v_now          timestamptz := now();
  v_dedup_phone  text;
  v_dedup_email  text;
begin
  -- 1) Resolve the landing page. If it's archived/inactive we refuse.
  select * into v_page
    from public.landing_pages
   where slug = p_slug
     and is_active = true
   limit 1;

  if v_page.id is null then
    raise exception 'landing page not found or inactive';
  end if;

  -- Basic sanity: name required, plus at least one contact method.
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name is required';
  end if;
  if coalesce(trim(p_phone), '') = ''
     and coalesce(trim(p_email), '') = ''
     and coalesce(trim(p_whatsapp), '') = '' then
    raise exception 'at least one contact method required';
  end if;

  v_dedup_phone := nullif(trim(p_phone), '');
  v_dedup_email := nullif(lower(trim(p_email)), '');

  -- 2) Dedup against existing customer in the same tenant.
  select id into v_customer_id
    from public.customers c
   where c.company_id = v_page.company_id
     and (
          (v_dedup_phone is not null and c.phone = v_dedup_phone)
       or (v_dedup_email is not null and lower(c.email) = v_dedup_email)
     )
   limit 1;

  if v_customer_id is null then
    -- New customer
    insert into public.customers (
      company_id, full_name, phone, email, whatsapp,
      status, source, notes,
      landing_page_id, session_id,
      first_utm_source, first_utm_medium, first_utm_campaign,
      first_utm_content, first_utm_term, first_referrer,
      first_seen_at
    )
    values (
      v_page.company_id,
      trim(p_name),
      v_dedup_phone,
      v_dedup_email,
      nullif(trim(p_whatsapp), ''),
      'lead',
      coalesce(p_utm_source, 'landing_page'),
      nullif(trim(p_message), ''),
      v_page.id,
      p_session_id,
      p_utm_source, p_utm_medium, p_utm_campaign,
      p_utm_content, p_utm_term, p_referrer,
      v_now
    )
    returning id into v_customer_id;
  else
    -- Existing customer: refresh contact data but DON'T touch status or
    -- first_utm_* (preserve first-touch attribution).
    update public.customers set
      full_name        = coalesce(nullif(trim(p_name), ''), full_name),
      phone            = coalesce(v_dedup_phone, phone),
      email            = coalesce(v_dedup_email, email),
      whatsapp         = coalesce(nullif(trim(p_whatsapp), ''), whatsapp),
      notes            = case
                           when nullif(trim(p_message), '') is not null
                           then coalesce(notes || E'\n---\n', '') || trim(p_message)
                           else notes
                         end,
      landing_page_id  = coalesce(landing_page_id, v_page.id),
      session_id       = coalesce(session_id, p_session_id),
      updated_at       = v_now
    where id = v_customer_id;
  end if;

  -- 3) Record the event
  insert into public.lead_events (
    company_id, landing_page_id, customer_id,
    event_type, session_id,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer,
    user_agent, ip_hash,
    metadata
  )
  values (
    v_page.company_id, v_page.id, v_customer_id,
    'form_submit', p_session_id,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_referrer,
    p_user_agent, p_ip_hash,
    jsonb_build_object(
      'name', p_name,
      'phone', p_phone,
      'email', p_email,
      'whatsapp', p_whatsapp,
      'city', p_city,
      'message', p_message
    )
  );

  -- 4) Bump conversions counter
  update public.landing_pages
     set conversions_count = conversions_count + 1,
         updated_at = v_now
   where id = v_page.id;

  return query
    select v_customer_id,
           coalesce(v_page.form_success_msg, 'تم استلام بياناتك بنجاح. هنتواصل معاك قريباً.');
end;
$$;

grant execute on function public.submit_lead_form(
  text, text, text, text, text, text, text, uuid,
  text, text, text, text, text, text, text, text
) to anon, authenticated;


-- 4.b) log_lead_event
--
-- Lightweight event logger for non-form interactions: page_view,
-- whatsapp_click, phone_click. Anonymous-friendly; takes only a slug,
-- event type, session + UTM. Bumps views_count when applicable.
create or replace function public.log_lead_event(
  p_slug          text,
  p_event_type    text,
  p_session_id    uuid,
  p_utm_source    text,
  p_utm_medium    text,
  p_utm_campaign  text,
  p_utm_content   text,
  p_utm_term      text,
  p_referrer      text,
  p_user_agent    text,
  p_ip_hash       text,
  p_metadata      jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page public.landing_pages%rowtype;
begin
  -- Whitelist the event_type so anon can't write arbitrary categories.
  if p_event_type not in (
    'page_view', 'whatsapp_click', 'phone_click', 'external_click', 'custom'
  ) then
    raise exception 'invalid event_type %', p_event_type;
  end if;

  select * into v_page
    from public.landing_pages
   where slug = p_slug
     and is_active = true
   limit 1;

  if v_page.id is null then
    -- Silently no-op so a stale link doesn't 500 the user's browser.
    return;
  end if;

  insert into public.lead_events (
    company_id, landing_page_id,
    event_type, session_id,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer,
    user_agent, ip_hash, metadata
  )
  values (
    v_page.company_id, v_page.id,
    p_event_type, p_session_id,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_referrer,
    p_user_agent, p_ip_hash, coalesce(p_metadata, '{}'::jsonb)
  );

  if p_event_type = 'page_view' then
    update public.landing_pages
       set views_count = views_count + 1
     where id = v_page.id;
  end if;
end;
$$;

grant execute on function public.log_lead_event(
  text, text, uuid, text, text, text, text, text, text, text, text, jsonb
) to anon, authenticated;


-- 4.c) mark_lead_contacted
--
-- Convenience wrapper for the dashboard's "I just called/messaged them"
-- button. Stamps customers.last_contacted_at + last_contacted_by AND
-- logs a 'custom' lead_event so the funnel view sees the touch. Bumps
-- status lead -> contacted automatically.
--
-- Why we DON'T also insert into public.interactions: that table requires
-- employee_id + outcome (positive/neutral/negative), which is a heavier
-- form than the quick "just called" button. The proper interaction-log
-- form is a separate Dashboard surface; this RPC is for the marketing
-- inbox's one-click stamp.
--
-- Runs SECURITY INVOKER so RLS on customers blocks cross-tenant calls.
create or replace function public.mark_lead_contacted(
  p_customer_id   uuid,
  p_channel       text,            -- 'call', 'whatsapp', 'email', 'sms', 'meeting'
  p_notes         text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid;
  v_profile_id uuid;
begin
  v_profile_id := auth.uid();
  if v_profile_id is null then
    raise exception 'must be authenticated';
  end if;

  if p_channel not in ('call', 'whatsapp', 'email', 'sms', 'meeting', 'other') then
    raise exception 'invalid channel %', p_channel;
  end if;

  -- RLS will block this if the user can't see the customer.
  select company_id into v_company_id
    from public.customers
   where id = p_customer_id;

  if v_company_id is null then
    raise exception 'customer not found or not accessible';
  end if;

  update public.customers
     set last_contacted_at = now(),
         last_contacted_by = v_profile_id,
         -- Move 'lead' → 'contacted'; leave other statuses alone.
         status = case when status = 'lead' then 'contacted' else status end,
         updated_at = now()
   where id = p_customer_id;

  -- Log into lead_events as a 'custom' event for the funnel timeline.
  -- We can't INSERT directly because lead_events has no insert policy;
  -- inline raw insert here works because this whole function block runs
  -- as the caller and RLS is satisfied via the select_policy below ...
  -- BUT lead_events has no INSERT policy for authenticated either.
  -- So we elevate to definer just for the insert via a helper.
  perform public._insert_lead_event_internal(
    v_company_id,
    null,                  -- no landing_page (manual touch)
    p_customer_id,
    'custom',
    null, null, null, null, null, null,
    null, null, null,
    jsonb_build_object('action', 'mark_contacted', 'channel', p_channel, 'notes', p_notes)
  );
end;
$$;

grant execute on function public.mark_lead_contacted(uuid, text, text)
  to authenticated;


-- 4.d) _insert_lead_event_internal — definer helper used by both
-- mark_lead_contacted and any other authenticated-context insert path.
-- Underscore prefix marks it as internal; not granted to anon.
create or replace function public._insert_lead_event_internal(
  p_company_id     uuid,
  p_landing_id     uuid,
  p_customer_id    uuid,
  p_event_type     text,
  p_utm_source     text,
  p_utm_medium     text,
  p_utm_campaign   text,
  p_utm_content    text,
  p_utm_term       text,
  p_referrer       text,
  p_user_agent     text,
  p_ip_hash        text,
  p_session_id     uuid,
  p_metadata       jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lead_events (
    company_id, landing_page_id, customer_id,
    event_type, session_id,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer,
    user_agent, ip_hash, metadata
  )
  values (
    p_company_id, p_landing_id, p_customer_id,
    p_event_type, p_session_id,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_referrer,
    p_user_agent, p_ip_hash, coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- Only authenticated callers; anon must use submit_lead_form / log_lead_event.
grant execute on function public._insert_lead_event_internal(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, uuid, jsonb
) to authenticated;


-- ----------------------------------------------------------------------------
-- 5) RLS policies
-- ----------------------------------------------------------------------------

alter table public.landing_pages enable row level security;

drop policy if exists "view_landing_pages_in_own_company" on public.landing_pages;
create policy "view_landing_pages_in_own_company"
  on public.landing_pages for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "manage_landing_pages_in_own_company" on public.landing_pages;
create policy "manage_landing_pages_in_own_company"
  on public.landing_pages for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- Public anon read for the /p/[slug] route. Only active pages, only the
-- columns the public template needs (RLS column-level filtering isn't a
-- thing in postgres, so we expose all columns but the renderer only
-- reads safe ones). Critically we DO NOT expose archived pages.
drop policy if exists "anon_view_active_landing_pages" on public.landing_pages;
create policy "anon_view_active_landing_pages"
  on public.landing_pages for select
  to anon, authenticated
  using (is_active = true);

-- Super-admin visibility (consistent with mig 038)
drop policy if exists "super_admin_view_all_landing_pages" on public.landing_pages;
create policy "super_admin_view_all_landing_pages"
  on public.landing_pages for select
  using (public.is_super_admin());


alter table public.lead_events enable row level security;

drop policy if exists "view_lead_events_in_own_company" on public.lead_events;
create policy "view_lead_events_in_own_company"
  on public.lead_events for select
  to authenticated
  using (company_id = public.current_company_id());

-- IMPORTANT: no INSERT/UPDATE policy for lead_events. Writes go through
-- the SECURITY DEFINER RPCs (submit_lead_form, log_lead_event) so anon
-- visitors can't spam arbitrary rows.

drop policy if exists "super_admin_view_all_lead_events" on public.lead_events;
create policy "super_admin_view_all_lead_events"
  on public.lead_events for select
  using (public.is_super_admin());


-- ----------------------------------------------------------------------------
-- 6) Notify PostgREST so the new RPCs land in the schema cache
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
