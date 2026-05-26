-- ============================================================================
-- Migration 067 — Grant EXECUTE on pii_decrypt to authenticated
-- ============================================================================
--
-- Migration 050 set up PII encryption with two helper functions:
--
--     pii_encrypt(text)  → bytea    SECURITY DEFINER  REVOKE from authenticated
--     pii_decrypt(bytea) → text     SECURITY DEFINER  REVOKE from authenticated
--
-- And a view that uses pii_decrypt:
--
--     create view employees_with_pii with (security_invoker = true)
--     as select e.*, pii_decrypt(e.national_id_encrypted) as national_id_dec, ...
--     from public.employees e;
--
-- The intent of REVOKE was defense-in-depth: even if an authenticated user
-- got hold of arbitrary ciphertext, they shouldn't be able to call
-- pii_decrypt() against it. RLS already blocks them from reading
-- ciphertext outside their own company.
--
-- BUG in production: with `security_invoker = true`, the view runs every
-- pii_decrypt() call as the CALLING user. authenticated has REVOKE, so
-- the call fails silently — Postgres returns NULL for the decrypted
-- column rather than an error (because SELECT with an error in one
-- column expression still returns the row with that column = NULL).
-- HR sees the field empty, types the value, saves, and the trigger
-- correctly stores the new ciphertext — but the NEXT page load reads
-- NULL again. Looked exactly like "saves don't persist."
--
-- Repro from Basem's account:
--   1) Open /dashboard/employees/<id> for any employee
--   2) Type a valid national_id, click save
--   3) Refresh — the field is empty again
--
-- Confirmed cause by querying employees_with_pii from the SQL Editor
-- (which uses the postgres role, NOT authenticated) — there the
-- decrypted values came back correctly. So the encryption side was
-- fine; the read side was broken specifically for authenticated.
--
-- ----------------------------------------------------------------------------
-- FIX
-- ----------------------------------------------------------------------------
-- GRANT EXECUTE on pii_decrypt to authenticated. This is safe because:
--
--   1) pii_decrypt only DECRYPTS ciphertext that the caller already has
--      a row reference to. To "have" ciphertext, the caller must first
--      SELECT it from employees, which is RLS-scoped to their company.
--   2) The encryption key itself is never exposed — pii_decrypt reads it
--      from Vault internally via SECURITY DEFINER.
--   3) Random/forged bytea input returns 'decryption-error' (a sentinel
--      string), not the key or any partial plaintext.
--   4) pii_encrypt stays REVOKEd — the trigger is still the only path
--      to encrypt, so no app code can create new ciphertext outside
--      the standard flow.
--
-- Net effect: the threat model is unchanged (RLS is still the boundary),
-- and the app can now correctly read decrypted PII.
-- ============================================================================

grant execute on function public.pii_decrypt(bytea) to authenticated;

-- Defensive: keep pii_encrypt locked down so authenticated can only
-- encrypt via the BEFORE INSERT/UPDATE trigger (which runs SECURITY
-- DEFINER and bypasses this restriction).
revoke execute on function public.pii_encrypt(text) from authenticated;

comment on function public.pii_decrypt(bytea) is
  'Decrypt previously-encrypted PII. GRANT EXECUTE to authenticated added in mig 067 — RLS on employees remains the real access boundary.';

notify pgrst, 'reload schema';
