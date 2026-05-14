-- ============================================================================
-- Migration 029 -- Tardiness / early-leave deduction on payroll
--
-- Migration 028 added tardiness_minutes + early_leave_minutes to
-- public.attendance. This migration mirrors that on public.payroll_entries
-- so HR can SEE the deduction as a discrete line on the payslip
-- instead of it being lumped under other_deductions.
--
-- The actual computation lives in src/lib/payroll.ts:
--   per_minute = (monthly_base / working_days) / 480     (480 = 8h workday)
--   tardiness_deduction =
--     (sum_tardiness_minutes + sum_early_leave_minutes) * per_minute
--
-- and the generatePayrollPeriod server action aggregates the minutes
-- from attendance over the period's date range and writes them into
-- the new column.
-- ============================================================================

alter table public.payroll_entries
  add column if not exists tardiness_deduction numeric(10, 2) not null default 0;

comment on column public.payroll_entries.tardiness_deduction is
  'Sum of (tardiness + early_leave) minutes converted to currency at the per-minute rate of the employees daily wage. 0 = no late-arrival/early-departure that month.';

notify pgrst, 'reload schema';
