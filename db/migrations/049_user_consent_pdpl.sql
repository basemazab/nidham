-- ============================================================================
-- Migration 049 — User consent tracking (PDPL 151/2020 compliance)
-- ============================================================================
--
-- Egyptian Personal Data Protection Law (151/2020) Article 12 requires
-- explicit, recorded consent before processing personal data. This adds
-- two columns to public.profiles so we can:
--
--   1) prove an admin agreed to the privacy policy at signup time
--      (consent_given_at = the timestamp the checkbox was ticked)
--   2) re-prompt them when we publish a materially different version
--      (consent_version = the policy version they originally agreed to)
--
-- This migration is non-destructive: existing rows get NULL on both
-- columns. The signup flow blocks new accounts without consent; existing
-- accounts continue to work until the next planned re-consent prompt.
-- Audit reference: PRODUCTION_READINESS_AUDIT.md §5.
-- ============================================================================

alter table public.profiles
  add column if not exists consent_given_at timestamptz,
  add column if not exists consent_version  text;

comment on column public.profiles.consent_given_at is
  'Timestamp the user agreed to Nidham''s privacy policy. NULL for accounts ' ||
  'created before migration 049 — they''ll be re-prompted on next login.';

comment on column public.profiles.consent_version is
  'Version string of the privacy policy the user originally agreed to ' ||
  '(e.g. "v1.0" or "2026-05-18"). Lets us re-consent users when the ' ||
  'policy materially changes.';

-- Reload PostgREST so the new columns are visible to the API immediately.
notify pgrst, 'reload schema';
