-- ============================================================================
-- Migration 028 -- Tardiness + early-leave on attendance
--
-- The attendance status enum (present / absent / half_day / leave /
-- holiday / weekend) is mutually exclusive, so "present but came 30
-- minutes late" had nowhere to live. HR ended up writing it in notes,
-- which payroll couldn't use.
--
-- This migration adds two numeric columns to public.attendance:
--   tardiness_minutes      how many minutes after the official start
--                          the employee actually arrived. 0 = on time.
--   early_leave_minutes    how many minutes BEFORE the official end the
--                          employee left. 0 = stayed the full day.
--
-- Both are capped at 720 (12h) as a sanity check, and default to 0 so
-- existing rows + the bulk-attendance flow don't have to change.
-- ============================================================================

alter table public.attendance
  add column if not exists tardiness_minutes integer not null default 0,
  add column if not exists early_leave_minutes integer not null default 0;

-- Sanity bounds: between 0 and 12 hours. NOT VALID lets us add the
-- check without scanning existing data; we validate immediately after
-- since the defaults are 0 so every row already satisfies the bound.
alter table public.attendance
  add constraint attendance_tardiness_bounds
    check (tardiness_minutes >= 0 and tardiness_minutes <= 720) not valid;
alter table public.attendance
  validate constraint attendance_tardiness_bounds;

alter table public.attendance
  add constraint attendance_early_leave_bounds
    check (early_leave_minutes >= 0 and early_leave_minutes <= 720) not valid;
alter table public.attendance
  validate constraint attendance_early_leave_bounds;

comment on column public.attendance.tardiness_minutes is
  'How many minutes the employee arrived late today. 0 = on time. Capped at 720.';
comment on column public.attendance.early_leave_minutes is
  'How many minutes the employee left before official end. 0 = stayed full day. Capped at 720.';

notify pgrst, 'reload schema';
