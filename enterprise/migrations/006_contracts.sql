-- ============================================================================
-- Migration 006 — Contracts module
-- Tracks service/maintenance contracts between the company and its customers.
-- Each contract has a value, dates, payment terms, and renewal status.
-- The killer feature: surfacing contracts approaching expiry (renewal alerts).
-- ============================================================================

create table public.contracts (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  customer_id       uuid not null references public.customers(id) on delete cascade,

  contract_number   text,                          -- e.g., "C-2026-001"
  service_type      text,                          -- e.g., "صيانة تكييف", "صيانة أسانسير"
  description       text,

  start_date        date not null,
  end_date          date not null,

  contract_value    numeric(12, 2),
  payment_terms     text                           -- monthly | quarterly | annual | one_time
                    check (
                      payment_terms is null
                      or payment_terms in ('monthly', 'quarterly', 'annual', 'one_time')
                    ),

  status            text not null default 'active'
                    check (status in ('active', 'expired', 'renewed', 'cancelled')),

  assigned_to       uuid references public.employees(id) on delete set null,
  notes             text,

  created_at        timestamp with time zone default now() not null,
  updated_at        timestamp with time zone default now() not null,

  check (end_date >= start_date)
);

create index idx_contracts_company       on public.contracts(company_id);
create index idx_contracts_customer      on public.contracts(customer_id);
create index idx_contracts_end_date      on public.contracts(company_id, end_date);
create index idx_contracts_status        on public.contracts(company_id, status);

create trigger contracts_set_updated_at
  before update on public.contracts
  for each row execute function public.tg_set_updated_at();

-- RLS — scoped to caller's company
alter table public.contracts enable row level security;

create policy "view_contracts_in_own_company"
  on public.contracts for select
  using (company_id = public.current_company_id());

create policy "manage_contracts_in_own_company"
  on public.contracts for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
