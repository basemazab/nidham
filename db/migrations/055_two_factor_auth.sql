-- ============================================================================
-- Migration 055 — Two-Factor Authentication (TOTP) for admin role
-- ============================================================================
--
-- Adds the schema + RPCs for TOTP-based 2FA. The actual challenge flow
-- (showing the QR, verifying the 6-digit code, gating login) lives in
-- the app — this migration is the data layer.
--
-- Storage:
--   profiles.two_factor_secret_encrypted bytea
--     The base32-encoded TOTP secret, encrypted with the same Vault key
--     used for PII (mig 050's pii_encrypt). Plaintext never persists
--     after the setup RPC returns.
--
--   profiles.two_factor_enabled boolean default false
--     Off by default. Set to true after the user successfully verifies
--     their first 6-digit code (proving the QR was scanned correctly).
--     Once true, login requires both password + TOTP.
--
--   profiles.two_factor_verified_at timestamptz
--     When the user last completed the 2FA setup challenge. Used by
--     the UI to show "2FA was last set up X days ago" and to drive
--     a re-prompt after some time.
--
-- All three columns are NULLABLE so existing users don't have to do
-- anything until they opt in (or admin-role mandates flips it on).
--
-- Audit reference: PRODUCTION_READINESS_AUDIT.md §4
-- ============================================================================

alter table public.profiles
  add column if not exists two_factor_secret_encrypted bytea,
  add column if not exists two_factor_enabled boolean not null default false,
  add column if not exists two_factor_verified_at timestamptz;

comment on column public.profiles.two_factor_secret_encrypted is
  'Base32 TOTP secret encrypted via pii_encrypt. NULL until user starts 2FA setup.';
comment on column public.profiles.two_factor_enabled is
  'When true, login requires password + TOTP. Flipped on after the first successful 6-digit verification.';
comment on column public.profiles.two_factor_verified_at is
  'Timestamp the user last completed a TOTP challenge (setup or re-verify).';


-- ----------------------------------------------------------------------------
-- RPCs — narrow surface, all scoped to the caller's own profile
-- ----------------------------------------------------------------------------

-- Store a new TOTP secret for the caller. Server generates the secret
-- (TS-side, using otpauth) and calls this. The secret is encrypted via
-- pii_encrypt and the row stamped. enable=false so the user still has
-- to verify the QR before 2FA actually gates their login.
create or replace function public.set_my_totp_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  if p_secret is null or length(p_secret) < 16 then
    raise exception 'invalid TOTP secret';
  end if;

  update public.profiles
     set two_factor_secret_encrypted = pii_encrypt(p_secret),
         two_factor_enabled = false,
         two_factor_verified_at = null
   where id = v_uid;
end;
$$;

revoke all on function public.set_my_totp_secret(text) from public, anon;
grant execute on function public.set_my_totp_secret(text) to authenticated;


-- Fetch the caller's decrypted TOTP secret for verification. Returns
-- NULL if 2FA hasn't been set up yet.
create or replace function public.get_my_totp_secret()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_enc bytea;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  select two_factor_secret_encrypted into v_enc
    from public.profiles
   where id = v_uid;

  if v_enc is null then return null; end if;
  return pii_decrypt(v_enc);
end;
$$;

revoke all on function public.get_my_totp_secret() from public, anon;
grant execute on function public.get_my_totp_secret() to authenticated;


-- After the user enters their first valid 6-digit code, the app calls
-- this to flip the enabled flag. The verification (matching the 6-digit
-- code against the secret) happens TS-side because Postgres doesn't
-- have a TOTP implementation by default.
create or replace function public.enable_my_2fa()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  update public.profiles
     set two_factor_enabled = true,
         two_factor_verified_at = now()
   where id = v_uid
     and two_factor_secret_encrypted is not null;
end;
$$;

revoke all on function public.enable_my_2fa() from public, anon;
grant execute on function public.enable_my_2fa() to authenticated;


-- Turn 2FA off for the caller and wipe the secret. Requires the user to
-- re-prove their password first (the app passes a fresh re-auth token
-- separately; we just trust the auth.uid() is current because Supabase
-- session = recent re-auth).
create or replace function public.disable_my_2fa()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;
  update public.profiles
     set two_factor_enabled = false,
         two_factor_secret_encrypted = null,
         two_factor_verified_at = null
   where id = v_uid;
end;
$$;

revoke all on function public.disable_my_2fa() from public, anon;
grant execute on function public.disable_my_2fa() to authenticated;


notify pgrst, 'reload schema';
