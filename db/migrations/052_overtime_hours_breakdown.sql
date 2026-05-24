-- ============================================================================
-- Migration 052 — Overtime breakdown by hour category
-- ============================================================================
--
-- Egyptian Labor Law 12/2003 Article 85 mandates three distinct overtime
-- rates:
--
--   • Daytime overtime    → 135% of the normal hourly wage (+35%)
--   • Nighttime overtime  → 170% of the normal hourly wage (+70%)
--                           (defined: between 7:00 pm and 7:00 am)
--   • Weekly rest day or  → 200% of the normal hourly wage (+100%)
--     public holiday work
--
-- The codebase before this migration stored only `payroll_entries.overtime`
-- as a single raw money figure, which meant HR had to multiply by the
-- correct premium themselves — and any mistake was permanent and silent.
--
-- This migration adds three HOUR columns so the payroll engine can apply
-- the legally-mandated multiplier itself. The legacy `overtime` column
-- stays (renamed in spirit to "overtime override") so existing rows are
-- not invalidated. The engine prefers the hour columns when populated;
-- otherwise it falls back to the raw `overtime` amount.
--
-- Audit reference: PRODUCTION_READINESS_AUDIT.md §2.3
-- ============================================================================

alter table public.payroll_entries
  add column if not exists overtime_hours_day   numeric(6, 2) not null default 0,
  add column if not exists overtime_hours_night numeric(6, 2) not null default 0,
  add column if not exists overtime_hours_rest  numeric(6, 2) not null default 0;

-- Bound to non-negative and a reasonable monthly cap (744 hrs = 24×31).
alter table public.payroll_entries
  drop constraint if exists payroll_entries_overtime_hours_non_negative,
  add  constraint payroll_entries_overtime_hours_non_negative
       check (
         overtime_hours_day   >= 0 and overtime_hours_day   <= 744 and
         overtime_hours_night >= 0 and overtime_hours_night <= 744 and
         overtime_hours_rest  >= 0 and overtime_hours_rest  <= 744
       );

comment on column public.payroll_entries.overtime_hours_day is
  'Daytime overtime hours. Paid at 135% of the hourly wage per Labor Law Art. 85.';
comment on column public.payroll_entries.overtime_hours_night is
  'Nighttime overtime hours (7pm-7am). Paid at 170% of the hourly wage.';
comment on column public.payroll_entries.overtime_hours_rest is
  'Overtime on the weekly rest day or a public holiday. Paid at 200%.';

notify pgrst, 'reload schema';
