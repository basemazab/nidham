-- ============================================================================
-- Migration 061 — Fix PII encryption trigger missing SECURITY DEFINER
-- ============================================================================
--
-- Migration 050 (PII encryption) introduced a BEFORE INSERT/UPDATE trigger on
-- `employees` that encrypts plaintext PII into the `*_encrypted` shadow
-- columns. The trigger calls helper functions `pii_encrypt()` / `pii_decrypt()`
-- which were correctly REVOKEd from `authenticated` (since random HR sessions
-- should never encrypt or decrypt arbitrary bytes directly).
--
-- The plan, per the comment block on line 150-152 of migration 050, was:
--
--   "Lock these down: only owners (postgres, the table owner) can execute.
--    The trigger + view run with SECURITY DEFINER so they don't need
--    per-caller execute privileges."
--
-- The view (employees_with_pii) IS declared with security_invoker = true,
-- and pii_decrypt itself is SECURITY DEFINER, so the read path works.
--
-- BUG: the trigger function `tg_encrypt_employee_pii` was created WITHOUT
-- `security definer`. It runs as the calling session (authenticated user),
-- which lacks EXECUTE on pii_encrypt(). The moment HR saves an employee
-- with any PII field non-null, the trigger fires, hits pii_encrypt(), and
-- Postgres returns:
--
--     ERROR: permission denied for function pii_encrypt
--     SQLSTATE: 42501
--
-- which `arabicizeDbError()` (src/lib/i18n.ts:49) maps to:
--
--     "ملكش صلاحية على العملية دي"
--
-- ...so HR sees a "permission denied" toast and assumes their role is wrong,
-- when really every save of any employee with PII has been failing.
--
-- Repro that confirmed this in production (Nidham deployed at
-- nidham-seven.vercel.app, 50+ employees on Basem's account):
--   1) Open /dashboard/employees/<any active employee>
--   2) Click "حفظ بيانات الموظف العامة"
--   3) Toast appears: "⚠️ ملكش صلاحية على العملية دي"
--
-- ----------------------------------------------------------------------------
-- FIX
-- ----------------------------------------------------------------------------
-- Re-declare `tg_encrypt_employee_pii` with `SECURITY DEFINER` AND a locked
-- `search_path`. That last part matters: SECURITY DEFINER functions without a
-- pinned search_path are a classic privilege-escalation footgun (an attacker
-- creates a malicious `public.pii_encrypt` shadow earlier in the search_path).
-- We pin to `public, extensions` because pgcrypto types live in extensions and
-- our own helpers live in public.
--
-- Function ownership: CREATE OR REPLACE preserves the existing owner, which
-- in Supabase is the `postgres` superuser by default. That's exactly who we
-- want as the SECURITY DEFINER principal — postgres has EXECUTE on
-- pii_encrypt regardless of the REVOKE on authenticated.
--
-- No trigger DROP/CREATE is needed: the trigger binds to the function by
-- name, and the body is what changed.
-- ============================================================================

create or replace function public.tg_encrypt_employee_pii()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if (tg_op = 'INSERT' or new.national_id is distinct from coalesce(old.national_id, null)) then
    if new.national_id is not null then
      new.national_id_encrypted := pii_encrypt(new.national_id);
      new.national_id := null;
    end if;
  end if;

  if (tg_op = 'INSERT' or new.bank_account_number is distinct from coalesce(old.bank_account_number, null)) then
    if new.bank_account_number is not null then
      new.bank_account_number_encrypted := pii_encrypt(new.bank_account_number);
      new.bank_account_number := null;
    end if;
  end if;

  if (tg_op = 'INSERT' or new.bank_name is distinct from coalesce(old.bank_name, null)) then
    if new.bank_name is not null then
      new.bank_name_encrypted := pii_encrypt(new.bank_name);
      new.bank_name := null;
    end if;
  end if;

  if (tg_op = 'INSERT' or new.social_insurance_number is distinct from coalesce(old.social_insurance_number, null)) then
    if new.social_insurance_number is not null then
      new.social_insurance_number_encrypted := pii_encrypt(new.social_insurance_number);
      new.social_insurance_number := null;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.tg_encrypt_employee_pii() is
  'BEFORE-trigger that moves plaintext PII into *_encrypted shadow columns. Runs SECURITY DEFINER so it can call pii_encrypt(), which is revoked from authenticated. Fixed in migration 061.';

-- The trigger itself is unchanged from migration 050 — re-binding is just
-- defensive in case the function signature was tampered with manually
-- (e.g. by a DBA debugging). Idempotent.
drop trigger if exists employees_encrypt_pii on public.employees;
create trigger employees_encrypt_pii
  before insert or update of national_id, bank_account_number, bank_name, social_insurance_number
  on public.employees
  for each row execute function public.tg_encrypt_employee_pii();
