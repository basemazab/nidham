-- ============================================================================
-- Migration 002 — Employees module
-- Adds the employees table + RLS scoped to the user's company, plus a shared
-- updated_at trigger we'll reuse across business tables.
-- ============================================================================

-- 1. Shared updated_at trigger (will also be reused by future tables)
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Employees table — one row per employee, scoped to a company
create table public.employees (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  full_name     text not null,
  job_title     text,
  department    text,
  phone         text,
  email         text,
  hire_date     date,
  basic_salary  numeric(10, 2),
  status        text not null default 'active'
                check (status in ('active', 'on_leave', 'terminated')),
  notes         text,
  created_at    timestamp with time zone default now() not null,
  updated_at    timestamp with time zone default now() not null
);

create index idx_employees_company       on public.employees(company_id);
create index idx_employees_company_status on public.employees(company_id, status);

create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.tg_set_updated_at();

-- 3. RLS — every read & write is constrained to the caller's company
alter table public.employees enable row level security;

create policy "view_employees_in_own_company"
  on public.employees for select
  using (company_id = public.current_company_id());

create policy "manage_employees_in_own_company"
  on public.employees for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
