-- ============================================================================
-- Migration 053 — Leave type on attendance (paid / unpaid / sick)
-- ============================================================================
--
-- Before this migration, attendance.status='leave' could only mean PAID
-- leave (annual, casual, etc.). Egyptian Labour Code has three distinct
-- leave categories that affect payroll differently:
--
--   • Paid leave (annual, casual, hajj, marriage, mourning, etc.)
--     → counted as worked, no deduction
--   • Unpaid leave (إجازة بدون مرتب)
--     → counted as an absence, deducted from salary
--   • Sick leave (إجازة مرضية)
--     → first 90 days: 75% of salary
--       days 91-180:   85% of salary
--       day 181+:      0% (handed to NOSI)
--       (Law 12/2003 Articles 71-72)
--
-- Adding a `leave_type` column lets the payroll engine treat each
-- correctly. Existing rows get NULL (interpreted as the legacy
-- "implicitly paid" behavior — unchanged).
-- ============================================================================

alter table public.attendance
  add column if not exists leave_type text;

alter table public.attendance
  drop constraint if exists attendance_leave_type_check,
  add  constraint attendance_leave_type_check
       check (leave_type is null or leave_type in ('paid', 'unpaid', 'sick'));

comment on column public.attendance.leave_type is
  'When status=leave: paid (default), unpaid (deducted), or sick (Art. 71/72). NULL for non-leave rows = treated as paid for legacy compatibility.';

notify pgrst, 'reload schema';
