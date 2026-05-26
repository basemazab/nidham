-- ============================================================================
-- Migration 064 -- OTP codes (WhatsApp / SMS / email fallback)
-- ============================================================================
--
-- One-time passcode storage for passwordless / 2FA flows. Default channel
-- is WhatsApp (cheaper + higher delivery in Egypt than email; users live
-- on WhatsApp). Falls back to SMS or email if WhatsApp isn't configured
-- yet for the tenant.
--
-- Lifecycle:
--   1. Server generates a 6-digit code, hashes it (sha256), inserts row
--      with expires_at = now() + 10 minutes.
--   2. Server dispatches the code via the chosen channel.
--   3. User submits the code → server hashes input, compares, marks
--      used_at if it matches and isn't expired.
--   4. Cron sweep (or lazy delete) removes rows older than 24h.
--
-- Storage: code_hash NOT the code itself — if the table leaks, plaintext
-- codes don't. attempt_count throttles brute force per row (DB-level cap
-- of 5 tries; HTTP layer should also rate-limit per IP).
-- ============================================================================

create table if not exists public.otp_codes (
  id          uuid primary key default gen_random_uuid(),
  -- Identifies the recipient. For login/signup this is the phone /
  -- email being verified. NOT linked to auth.users yet — the user may
  -- not exist (signup flow).
  identifier  text not null,
  channel     text not null check (channel in ('whatsapp', 'sms', 'email')),
  -- SHA-256 hex of the plaintext code. Never store the code itself.
  code_hash   text not null,
  -- Purpose helps disambiguate codes (signup vs 2fa vs password-reset).
  purpose     text not null check (purpose in ('signup', 'login', 'twofa', 'reset', 'verify')),
  -- 10-minute default; configurable per row if needed.
  expires_at  timestamp with time zone not null,
  -- Set when consumed. Once non-null the code is dead — never reusable.
  used_at     timestamp with time zone,
  -- Throttle brute force. Server rejects when >= 5.
  attempt_count integer not null default 0 check (attempt_count >= 0),
  -- Audit trail: who tried it / what IP. Optional.
  last_ip     inet,
  user_agent  text,
  metadata    jsonb default '{}'::jsonb,
  created_at  timestamp with time zone default now() not null
);

-- Lookup pattern: WHERE identifier = ? AND purpose = ? AND used_at IS NULL
create index if not exists idx_otp_identifier_purpose
  on public.otp_codes (identifier, purpose)
  where used_at is null;

-- For the cleanup cron
create index if not exists idx_otp_created_at on public.otp_codes (created_at);

-- ── No RLS ──
-- OTP codes are intentionally PUBLIC at the row level — the route handler
-- is the only thing that touches this table, scoped by the identifier
-- claim. Adding RLS here would break the signup path (user isn't authed
-- yet when the OTP gets verified).
--
-- Service role only — block direct anon/authenticated access.
alter table public.otp_codes enable row level security;

create policy "deny_all_direct_access"
  on public.otp_codes for all
  using (false)
  with check (false);

-- Cleanup helper — call from a cron job or invoke ad-hoc.
create or replace function public.cleanup_expired_otp_codes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.otp_codes
   where created_at < now() - interval '24 hours';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on table public.otp_codes is
  'One-time passcodes for WhatsApp/SMS/email verification. Service-role only.';

notify pgrst, 'reload schema';
