-- ============================================================================
-- Migration 004 — Customers module (CRM half)
-- Each company tracks its own customers. Linkable to employees via assigned_to.
-- Statuses follow simplified sales pipeline: lead -> active -> won/lost.
-- ============================================================================

create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,

  -- Identity
  full_name        text not null,          -- person name OR company name
  contact_name     text,                   -- secondary contact when type=company
  type             text not null default 'individual'
                   check (type in ('individual', 'company')),

  -- Contact
  phone            text,
  email            text,

  -- Pipeline
  status           text not null default 'lead'
                   check (status in ('lead', 'active', 'won', 'lost')),
  assigned_to      uuid references public.employees(id) on delete set null,
  estimated_value  numeric(12, 2),
  source           text,                   -- whatsapp / facebook / referral / walkin / other
  notes            text,

  created_at       timestamp with time zone default now() not null,
  updated_at       timestamp with time zone default now() not null
);

create index idx_customers_company        on public.customers(company_id);
create index idx_customers_company_status on public.customers(company_id, status);
create index idx_customers_assigned       on public.customers(assigned_to);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.tg_set_updated_at();

alter table public.customers enable row level security;

create policy "view_customers_in_own_company"
  on public.customers for select
  using (company_id = public.current_company_id());

create policy "manage_customers_in_own_company"
  on public.customers for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
