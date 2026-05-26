-- ============================================================================
-- Migration 065 -- Selfie verification on clock-in / clock-out
-- ============================================================================
--
-- Mobile clock-in already records GPS coords + geofence distance (mig 015).
-- This migration layers a selfie photo on top — used by HR to spot-check
-- buddy-punching for field workers (construction sites, door dealers).
--
-- Storage: photos live in the "attendance-photos" private bucket on
-- Supabase Storage (created via Dashboard or `supabase storage create`).
-- This column just stores the object path, e.g.
--   "company-uuid/employee-uuid/2026-05-26/check-in-1716700800.jpg"
-- The web UI generates short-lived signed URLs for viewing.
-- ============================================================================

alter table public.attendance
  add column if not exists check_in_photo_url  text,
  add column if not exists check_out_photo_url text;

comment on column public.attendance.check_in_photo_url is
  'Object path in attendance-photos bucket for the check-in selfie. Generate signed URL on view.';
comment on column public.attendance.check_out_photo_url is
  'Object path in attendance-photos bucket for the check-out selfie. Generate signed URL on view.';

notify pgrst, 'reload schema';
