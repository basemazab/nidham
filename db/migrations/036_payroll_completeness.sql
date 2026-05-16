-- ============================================================================
-- Migration 036 — Payroll completeness pass
--
-- Adds the missing infrastructure that turns the payroll module from
-- "calculates correctly" into "runs a real Egyptian SMB end-to-end":
--
--   1) Bank info on employees (for the WPS/SIF transfer file export)
--   2) Cancel/reopen audit fields on payroll_periods
--   3) End-of-service gratuity snapshot on payroll_entries
--   4) Bonus reason field on payroll_entries (so bulk-bonus runs are auditable)
--   5) RPC: ytd_payroll_totals() — year-to-date roll-up for the dashboard
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Employees: bank info for WPS / SIF transfer file
-- ----------------------------------------------------------------------------
alter table public.employees
  add column if not exists bank_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_iban text,
  add column if not exists payment_method text default 'cash'
    check (payment_method in ('cash', 'bank', 'instapay'));

comment on column public.employees.bank_name is
  'Bank name as on the salary transfer instructions (e.g. "CIB", "NBE", "Alex Bank").';
comment on column public.employees.bank_account_number is
  'Local bank account number — used in the SIF file when payment_method = bank.';
comment on column public.employees.bank_iban is
  'IBAN (EG...) — preferred over account number where the bank supports it.';
comment on column public.employees.payment_method is
  'How the employee receives their salary: cash, bank (SIF transfer), or instapay (mobile wallet).';


-- ----------------------------------------------------------------------------
-- 2. Payroll periods: cancellation audit + reopen counter
-- ----------------------------------------------------------------------------
alter table public.payroll_periods
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text,
  add column if not exists reopened_count integer not null default 0,
  add column if not exists last_reopened_at timestamptz,
  add column if not exists last_reopened_by uuid references auth.users(id) on delete set null;

comment on column public.payroll_periods.cancelled_at is
  'Timestamp when an HR admin cancelled the period (after status was set to "cancelled"). Distinct from the natural progression draft -> approved -> paid.';
comment on column public.payroll_periods.reopened_count is
  'How many times this period has been reopened (paid -> approved or approved -> draft). Spike here = HR is fighting the data; investigate.';


-- ----------------------------------------------------------------------------
-- 3. Payroll entries: EOS snapshot + bonus reason
-- ----------------------------------------------------------------------------
alter table public.payroll_entries
  add column if not exists eos_gratuity numeric(12,2) not null default 0,
  add column if not exists bonus_reason text;

comment on column public.payroll_entries.eos_gratuity is
  'End-of-service gratuity included with this final paycheck. Only > 0 when the employee was terminated mid-cycle. Computed via the compute_eos_gratuity() RPC introduced in migration 031.';
comment on column public.payroll_entries.bonus_reason is
  'Free-form Arabic note attached to a bonus (e.g. "عيدية الفطر", "مكافأة إنجاز مشروع"). Surfaced on the payslip + bulk-bonus audit log.';


-- ----------------------------------------------------------------------------
-- 4. Bulk bonus audit log
-- ----------------------------------------------------------------------------
-- Captures every bulk-bonus run so HR has a paper trail of who got what
-- and why. The per-entry bonuses themselves live in payroll_entries.bonuses;
-- this table is the AGGREGATE record of the operation that created them.
create table if not exists public.bulk_bonus_runs (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  period_id       uuid not null references public.payroll_periods(id) on delete cascade,
  amount_each     numeric(12,2) not null,
  reason          text not null,
  recipients_count integer not null,
  total_amount    numeric(12,2) not null,
  applied_by      uuid references auth.users(id) on delete set null,
  applied_at      timestamptz not null default now()
);

create index if not exists idx_bulk_bonus_runs_period
  on public.bulk_bonus_runs(period_id, applied_at desc);

alter table public.bulk_bonus_runs enable row level security;

drop policy if exists "bulk_bonus_select_own_company" on public.bulk_bonus_runs;
create policy "bulk_bonus_select_own_company"
  on public.bulk_bonus_runs for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "bulk_bonus_modify_hr" on public.bulk_bonus_runs;
create policy "bulk_bonus_modify_hr"
  on public.bulk_bonus_runs for all
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  )
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );


-- ----------------------------------------------------------------------------
-- 5. ytd_payroll_totals() — year-to-date roll-up for the dashboard
-- ----------------------------------------------------------------------------
-- One row per (company, year) with totals for net, gross, deductions,
-- and the number of approved/paid periods so far. Drives the YTD KPI
-- cards at the top of /dashboard/payroll.
create or replace function public.ytd_payroll_totals(p_year integer default null)
returns table (
  year                integer,
  periods_count       bigint,
  paid_periods_count  bigint,
  employees_total     bigint,
  gross_total         numeric,
  net_total           numeric,
  deductions_total    numeric,
  insurance_total     numeric,
  tax_total           numeric,
  bonuses_total       numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with target_year as (
    select coalesce(p_year, extract(year from now())::integer) as y
  ),
  periods as (
    select id, status, year
    from public.payroll_periods, target_year
    where company_id = public.current_company_id()
      and year = target_year.y
  )
  select
    (select y from target_year),
    (select count(*) from periods),
    (select count(*) from periods where status = 'paid'),
    coalesce((select count(*) from public.payroll_entries e
              where e.period_id in (select id from periods)), 0),
    coalesce((select sum(gross_salary) from public.payroll_entries
              where period_id in (select id from periods)), 0),
    coalesce((select sum(net_salary) from public.payroll_entries
              where period_id in (select id from periods)), 0),
    coalesce((select sum(total_deductions) from public.payroll_entries
              where period_id in (select id from periods)), 0),
    coalesce((select sum(social_insurance) from public.payroll_entries
              where period_id in (select id from periods)), 0),
    coalesce((select sum(income_tax) from public.payroll_entries
              where period_id in (select id from periods)), 0),
    coalesce((select sum(bonuses) from public.payroll_entries
              where period_id in (select id from periods)), 0);
$$;

grant execute on function public.ytd_payroll_totals(integer) to authenticated;


-- ----------------------------------------------------------------------------
-- 6. employee_tax_certificate() — Form 41 annual tax certificate data
-- ----------------------------------------------------------------------------
-- Builds the annual totals an employee needs for their tax filing:
-- total gross, total social insurance, total income tax, paid in the
-- chosen year. The UI renders this as a printable نموذج 41.
create or replace function public.employee_tax_certificate(
  p_employee_id uuid,
  p_year integer
)
returns table (
  employee_id       uuid,
  employee_name     text,
  national_id       text,
  year              integer,
  periods_count     bigint,
  gross_total       numeric,
  insurance_total   numeric,
  tax_total         numeric,
  bonuses_total     numeric,
  net_total         numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.full_name,
    e.national_id,
    p_year,
    count(en.id),
    coalesce(sum(en.gross_salary), 0),
    coalesce(sum(en.social_insurance), 0),
    coalesce(sum(en.income_tax), 0),
    coalesce(sum(en.bonuses), 0),
    coalesce(sum(en.net_salary), 0)
  from public.employees e
  left join public.payroll_entries en on en.employee_id = e.id
  left join public.payroll_periods pp on pp.id = en.period_id
    and pp.year = p_year
    and pp.status in ('approved', 'paid')
  where e.id = p_employee_id
    and e.company_id = public.current_company_id()
  group by e.id, e.full_name, e.national_id;
$$;

grant execute on function public.employee_tax_certificate(uuid, integer)
  to authenticated;


notify pgrst, 'reload schema';
