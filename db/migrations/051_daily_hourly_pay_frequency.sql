-- ============================================================================
-- Migration 051 — Add daily + hourly pay frequencies
-- ============================================================================
--
-- Egyptian SMBs (especially manufacturing + construction) pay workers in
-- four distinct patterns:
--
--   1. monthly  — fixed salary, 26 working days/month (already supported)
--   2. weekly   — fixed weekly wage (already supported)
--   3. daily    — paid per attended day; no salary if no attendance
--   4. hourly   — paid per actual hour worked; transport allowance is
--                 CONDITIONAL on hitting a min-hours threshold per day
--
-- Categories 3 and 4 were missing from migration 026's check constraint.
-- This migration extends the constraint and adds the columns that hourly
-- payroll needs:
--
--   employees.hourly_rate                  numeric — wage per hour
--   employees.transport_threshold_hours    int     — min hours/day to earn
--                                                    the transport allowance
--                                                    (typical: 4-6 hrs at
--                                                    Al-Ittihad). NULL means
--                                                    transport always paid.
--
-- Backwards-compatible: existing monthly/weekly rows are untouched.
-- ============================================================================

-- 1) Expand the pay_frequency check constraint
alter table public.employees
  drop constraint if exists employees_pay_frequency_check;

alter table public.employees
  add constraint employees_pay_frequency_check
  check (pay_frequency in ('monthly', 'weekly', 'daily', 'hourly'));


-- 2) Add the hourly_rate column. NULL for monthly/weekly/daily employees.
alter table public.employees
  add column if not exists hourly_rate numeric(10, 2);

comment on column public.employees.hourly_rate is
  'Wage per hour for pay_frequency=hourly. NULL for other frequencies.';


-- 3) Add the transport_threshold_hours column. Only meaningful for hourly
--    workers; if NULL, transport allowance is paid regardless of hours.
alter table public.employees
  add column if not exists transport_threshold_hours integer
  check (transport_threshold_hours is null or transport_threshold_hours between 1 and 12);

comment on column public.employees.transport_threshold_hours is
  'For hourly employees only: min hours/day to earn the transport allowance. NULL = always paid.';


-- 4) Reload PostgREST so the new columns are visible to the API
notify pgrst, 'reload schema';
