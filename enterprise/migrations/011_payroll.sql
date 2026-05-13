-- ============================================================================
-- Migration 011 — Payroll module (Egyptian compliance)
-- Implements Law 12/2003 + 148/2019 + 2024-2025 income tax brackets.
-- Adds salary structure to employees, payroll periods, and payroll entries.
-- ============================================================================

-- 1. Salary structure fields on employees
alter table public.employees
  add column housing_allowance      numeric(10, 2) default 0,
  add column transport_allowance    numeric(10, 2) default 0,
  add column other_allowances       numeric(10, 2) default 0,
  add column bank_name              text,
  add column bank_account_number    text,
  add column national_id            text,
  add column social_insurance_number text;

-- 2. Payroll periods (one per company per month)
create table public.payroll_periods (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,

  year        integer not null check (year between 2020 and 2099),
  month       integer not null check (month between 1 and 12),

  status      text not null default 'draft'
              check (status in ('draft', 'approved', 'paid', 'cancelled')),
  approved_at timestamp with time zone,
  approved_by uuid references auth.users(id) on delete set null,
  paid_at     timestamp with time zone,

  -- Period config snapshot
  working_days integer not null default 22,

  notes       text,
  created_at  timestamp with time zone default now() not null,
  updated_at  timestamp with time zone default now() not null,

  unique (company_id, year, month)
);

create index idx_payroll_periods_company on public.payroll_periods(company_id);
create index idx_payroll_periods_date    on public.payroll_periods(company_id, year, month);

create trigger payroll_periods_set_updated_at
  before update on public.payroll_periods
  for each row execute function public.tg_set_updated_at();

-- 3. Payroll entries (one per employee per period)
create table public.payroll_entries (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  period_id     uuid not null references public.payroll_periods(id) on delete cascade,
  employee_id   uuid not null references public.employees(id) on delete cascade,

  -- Snapshot of attendance for the period (calculated from attendance table)
  attended_days       numeric(4, 1) not null default 0,
  half_day_days       numeric(4, 1) not null default 0,
  leave_days          numeric(4, 1) not null default 0,
  absent_days         numeric(4, 1) not null default 0,

  -- Earnings (snapshot from employee at time of payroll generation)
  basic_salary         numeric(10, 2) not null default 0,
  housing_allowance    numeric(10, 2) not null default 0,
  transport_allowance  numeric(10, 2) not null default 0,
  other_allowances     numeric(10, 2) not null default 0,
  bonuses              numeric(10, 2) not null default 0,
  overtime             numeric(10, 2) not null default 0,
  gross_salary         numeric(10, 2) not null default 0,

  -- Deductions
  absence_deduction    numeric(10, 2) not null default 0,
  social_insurance     numeric(10, 2) not null default 0,
  income_tax           numeric(10, 2) not null default 0,
  loan_deduction       numeric(10, 2) not null default 0,
  other_deductions     numeric(10, 2) not null default 0,
  total_deductions     numeric(10, 2) not null default 0,

  -- Result
  net_salary           numeric(10, 2) not null default 0,

  notes                text,
  created_at           timestamp with time zone default now() not null,
  updated_at           timestamp with time zone default now() not null,

  unique (period_id, employee_id)
);

create index idx_payroll_entries_company  on public.payroll_entries(company_id);
create index idx_payroll_entries_period   on public.payroll_entries(period_id);
create index idx_payroll_entries_employee on public.payroll_entries(employee_id);

create trigger payroll_entries_set_updated_at
  before update on public.payroll_entries
  for each row execute function public.tg_set_updated_at();

-- 4. RLS — scoped to company
alter table public.payroll_periods enable row level security;
alter table public.payroll_entries enable row level security;

create policy "view_payroll_periods_in_own_company"
  on public.payroll_periods for select
  using (company_id = public.current_company_id());

create policy "manage_payroll_periods_in_own_company"
  on public.payroll_periods for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "view_payroll_entries_in_own_company"
  on public.payroll_entries for select
  using (company_id = public.current_company_id());

create policy "manage_payroll_entries_in_own_company"
  on public.payroll_entries for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
