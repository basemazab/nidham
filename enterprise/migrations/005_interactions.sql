-- ============================================================================
-- Migration 005 — Interactions (Bridge core)
-- Every interaction between an employee and a customer becomes one row.
-- This is the data that powers Bridge Analytics — the unique value of نِظام:
-- "أحمد ملتزم 95% في الحضور (HR) — بس عميلين هربو منه (CRM)."
-- ============================================================================

create table public.interactions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  employee_id   uuid not null references public.employees(id) on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  date          date not null default current_date,
  type          text not null
                check (type in ('call', 'whatsapp', 'meeting', 'email', 'visit', 'other')),
  outcome       text not null
                check (outcome in ('positive', 'neutral', 'negative')),
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamp with time zone default now() not null,
  updated_at    timestamp with time zone default now() not null
);

create index idx_interactions_company  on public.interactions(company_id);
create index idx_interactions_employee on public.interactions(employee_id);
create index idx_interactions_customer on public.interactions(customer_id);
create index idx_interactions_date     on public.interactions(company_id, date);

create trigger interactions_set_updated_at
  before update on public.interactions
  for each row execute function public.tg_set_updated_at();

alter table public.interactions enable row level security;

create policy "view_interactions_in_own_company"
  on public.interactions for select
  using (company_id = public.current_company_id());

create policy "manage_interactions_in_own_company"
  on public.interactions for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
