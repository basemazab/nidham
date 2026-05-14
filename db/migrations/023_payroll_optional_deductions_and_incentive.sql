-- ============================================================================
-- Migration 023 -- Per-company opt-in deductions + incentive allowance
--
-- Two changes driven by HR feedback from real Egyptian SMBs:
--
--   1. Most small businesses in Egypt don't file social insurance or
--      withhold income tax (informally cash-paid, or a hybrid where
--      only the formal payroll component gets deductions). The
--      Phase 1 payroll engine assumed both were always on. From this
--      migration onwards, both are per-company toggles, default OFF,
--      so a fresh tenant gets net = gross - manual deductions (no
--      auto-applied insurance, no auto-applied tax) unless they
--      explicitly turn them on from /dashboard/payroll/settings.
--
--   2. Add `incentive_allowance` (حافز) as a recurring monthly
--      compensation component on the employees table. Snapshotted
--      onto payroll_entries the same way the other allowances are.
--      Existing one-time `bonuses` on payroll_entries (مكافأة)
--      stays untouched.
--
-- Both changes are additive + idempotent. Re-running this migration
-- is safe; existing payroll entries are not retroactively
-- recalculated -- only new periods generated AFTER this migration
-- will pick up the new behaviour.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Company-level toggles for tax + social insurance
-- ----------------------------------------------------------------------------

alter table public.companies
  add column if not exists social_insurance_enabled boolean not null default false,
  add column if not exists income_tax_enabled       boolean not null default false;

comment on column public.companies.social_insurance_enabled is
  'When false (default), payroll generator skips the 14% employee social-insurance deduction. Switch on only when the company actually files with NOSI.';

comment on column public.companies.income_tax_enabled is
  'When false (default), payroll generator skips the income-tax brackets. Switch on only when the company files monthly tax returns with ETA.';


-- ----------------------------------------------------------------------------
-- 2. Incentive allowance (حافز) -- recurring monthly compensation
-- ----------------------------------------------------------------------------

alter table public.employees
  add column if not exists incentive_allowance numeric(10, 2) default 0;

comment on column public.employees.incentive_allowance is
  'حافز -- recurring monthly performance incentive. Treated as a normal allowance for gross-salary calculation, snapshotted onto payroll_entries.incentive_allowance at generation time.';

alter table public.payroll_entries
  add column if not exists incentive_allowance numeric(10, 2) not null default 0;

comment on column public.payroll_entries.incentive_allowance is
  'Snapshot of employees.incentive_allowance at the moment the payroll period was generated. Manually editable per-entry without touching the master record.';


-- ----------------------------------------------------------------------------
-- 3. Helper RPC -- read the current company's payroll settings.
--
-- The dashboard server code can read these via a normal SELECT through
-- RLS (companies has view_own_company); the function exists for
-- mobile / external callers that want a single round-trip dump.
-- ----------------------------------------------------------------------------
create or replace function public.get_payroll_settings()
returns table (
  social_insurance_enabled boolean,
  income_tax_enabled       boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(c.social_insurance_enabled, false),
    coalesce(c.income_tax_enabled, false)
  from public.companies c
  where c.id = public.current_company_id()
  limit 1;
$$;

grant execute on function public.get_payroll_settings() to authenticated;


notify pgrst, 'reload schema';
