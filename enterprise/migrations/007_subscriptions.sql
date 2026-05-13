-- ============================================================================
-- Migration 007 — Subscriptions
-- One subscription per tenant company. Auto-created on signup with a 14-day
-- trial. Used to track Nidham's own monetization (who's on what plan, MRR,
-- renewal alerts, etc.).
-- ============================================================================

create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid unique not null references public.companies(id) on delete cascade,

  plan            text not null default 'trial'
                  check (plan in ('trial', 'basic', 'pro', 'enterprise')),
  status          text not null default 'trial'
                  check (status in ('trial', 'active', 'past_due', 'cancelled', 'expired')),

  starts_at       date not null default current_date,
  ends_at         date not null,

  monthly_value   numeric(10, 2),                -- effective monthly price in EGP
  invoiced_until  date,                          -- last paid period end
  notes           text,                          -- admin-only notes

  created_at      timestamp with time zone default now() not null,
  updated_at      timestamp with time zone default now() not null
);

create index idx_subscriptions_status   on public.subscriptions(status);
create index idx_subscriptions_ends_at  on public.subscriptions(ends_at);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.tg_set_updated_at();

-- RLS — each company can view its OWN subscription only
alter table public.subscriptions enable row level security;

create policy "view_own_subscription"
  on public.subscriptions for select
  using (company_id = public.current_company_id());

-- Note: Updates to subscriptions are done by the SaaS admin (Basem) via
-- Supabase Dashboard / service_role, not through the app. So no insert/update
-- policies are defined for normal users — they can only read their own.

-- =========================================================================
-- Update the new-user trigger to also provision a 14-day trial subscription
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id   uuid;
  v_company_name text;
  v_full_name    text;
begin
  v_company_name := coalesce(
    new.raw_user_meta_data->>'company_name',
    'شركة بدون اسم'
  );
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  insert into public.companies (name, created_by)
  values (v_company_name, new.id)
  returning id into v_company_id;

  insert into public.profiles (id, company_id, full_name, role)
  values (new.id, v_company_id, v_full_name, 'admin');

  -- 14-day free trial
  insert into public.subscriptions (company_id, plan, status, starts_at, ends_at)
  values (
    v_company_id,
    'trial',
    'trial',
    current_date,
    current_date + interval '14 days'
  );

  return new;
end;
$$;

-- Backfill subscriptions for any existing companies that don't have one
insert into public.subscriptions (company_id, plan, status, starts_at, ends_at)
select
  c.id,
  'trial',
  'trial',
  current_date,
  current_date + interval '14 days'
from public.companies c
where not exists (
  select 1 from public.subscriptions s where s.company_id = c.id
);
