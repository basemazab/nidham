-- ============================================================================
-- Migration 050 — Application-level encryption for sensitive PII
-- ============================================================================
--
-- Closes P0 #7 from PRODUCTION_READINESS_AUDIT.md §5. Supabase already
-- encrypts the underlying disk (AWS EBS, AES-256) — but the threat we're
-- addressing here is APPLICATION-level exposure:
--
--   1) A rogue super-admin SELECT'ing the employees table
--   2) A DB backup leaking through a misconfigured S3 bucket
--   3) Internal Supabase staff with raw DB access
--   4) A future migration that accidentally COPIES the table somewhere
--      less protected
--
-- Strategy:
--   • Keep the original column NAMES (so we don't have to rename FKs
--     across 20+ tables that reference employees).
--   • Add `*_encrypted bytea` shadow columns for the 4 most-sensitive
--     fields: national_id, bank_account_number, bank_name,
--     social_insurance_number.
--   • A BEFORE INSERT/UPDATE trigger encrypts the plaintext into the
--     shadow column and CLEARS the plaintext column. So plaintext is
--     never persisted past the trigger fire.
--   • A view `employees_with_pii` re-exposes the decrypted values for
--     read paths that need them (payslip, tax cert, bank export).
--   • App writes stay UNCHANGED — they write to the plaintext column,
--     the trigger does the rest. App reads of PII switch to the view.
--
-- ──────────────────────────────────────────────────────────────────────
-- SETUP — required ONCE before this migration runs
-- ──────────────────────────────────────────────────────────────────────
--
-- Supabase Vault stores the encryption key. We can't use `ALTER DATABASE
-- ... SET app.encryption_key` on managed Supabase — the postgres role
-- in the SQL Editor lacks the SET permission. Vault is the supported
-- path: a built-in extension, available on every Supabase plan.
--
-- 1) Generate a 32-byte random key. On any machine:
--      openssl rand -hex 32
--    (PowerShell:
--      -join ((1..64) | %{ (Get-Random -Maximum 16).ToString('x') })
--    )
--
-- 2) In the Supabase SQL Editor, run ONCE — paste your key:
--
--      select vault.create_secret(
--        'PASTE-YOUR-64-CHAR-HEX-KEY-HERE',
--        'app_encryption_key',
--        'Symmetric key for pgp_sym_encrypt of PII columns (mig 050)'
--      );
--
--    If you previously created the secret and want to rotate, use
--    `vault.update_secret(id, ...)` instead — `create_secret` errors on
--    a duplicate name.
--
-- 3) Then run THIS migration file.
--
-- 🔐 STORE THE KEY SAFELY OUTSIDE SUPABASE TOO. Losing it = losing every
--    employee's national_id + bank info forever. Best practice: a copy
--    in 1Password + a printed sealed envelope in a safe.
--
-- ──────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;
create extension if not exists supabase_vault;


-- ----------------------------------------------------------------------------
-- 1) Helper functions — read the key from Vault, then encrypt/decrypt
-- ----------------------------------------------------------------------------
--
-- vault.decrypted_secrets is a built-in Supabase view that exposes
-- `decrypted_secret` (the plaintext key we stored). It's restricted to
-- the service role + SECURITY DEFINER functions — which is exactly the
-- access pattern we want.

-- Private helper — read the symmetric key from Vault by name. Errors
-- loudly if the secret is missing so a botched setup fails fast rather
-- than silently swallowing every encrypt call.
create or replace function public._pii_key()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  select decrypted_secret
    into v_key
    from vault.decrypted_secrets
   where name = 'app_encryption_key'
   limit 1;
  if v_key is null or length(v_key) < 16 then
    raise exception
      'PII encryption key not configured. Run vault.create_secret(...) — see migration 050 header.';
  end if;
  return v_key;
end;
$$;

-- Lock the key-reader down hard. Only postgres-role functions running
-- as SECURITY DEFINER (the two below) need to call it.
revoke all on function public._pii_key() from public, anon, authenticated;

-- Encrypt plaintext using the Vault-stored key. Returns NULL for NULL/
-- empty input so the trigger logic can leave NULL columns alone.
create or replace function public.pii_encrypt(plaintext text)
returns bytea
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if plaintext is null or length(plaintext) = 0 then
    return null;
  end if;
  return pgp_sym_encrypt(plaintext, public._pii_key());
end;
$$;

-- Decrypt previously-encrypted bytea. Returns NULL for NULL input and
-- a marker string if decryption fails (wrong key, corrupted ciphertext)
-- so a botched key rotation doesn't crash payroll reports.
create or replace function public.pii_decrypt(ciphertext bytea)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if ciphertext is null then
    return null;
  end if;
  begin
    return pgp_sym_decrypt(ciphertext, public._pii_key());
  exception when others then
    -- Hard-fail-mode would crash payslip rendering for one bad row.
    -- Soft-fail: return an ASCII sentinel so the UI can show "تعذّر
    -- فك تشفير هذه البيانة - راجع المدير" rather than blowing up.
    -- ASCII keeps the value Supabase-SQL-Editor-safe when echoed.
    return 'decryption-error';
  end;
end;
$$;

-- Lock these down: only owners (postgres, the table owner) can execute.
-- The trigger + view run with SECURITY DEFINER so they don't need
-- per-caller execute privileges.
revoke all on function public.pii_encrypt(text)   from public, anon, authenticated;
revoke all on function public.pii_decrypt(bytea)  from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 2) Add encrypted shadow columns to employees
-- ----------------------------------------------------------------------------
alter table public.employees
  add column if not exists national_id_encrypted              bytea,
  add column if not exists bank_account_number_encrypted      bytea,
  add column if not exists bank_name_encrypted                bytea,
  add column if not exists social_insurance_number_encrypted  bytea;

-- Single-line ASCII comments — multi-line `'foo ' || 'bar'` concatenation
-- inside COMMENT ON tripped a syntax error in Supabase's SQL Editor for
-- one operator. Cheaper to keep these flat than to debug the editor.
comment on column public.employees.national_id_encrypted is 'pgp_sym_encrypt of national_id. Read via employees_with_pii view.';
comment on column public.employees.bank_account_number_encrypted is 'pgp_sym_encrypt of bank_account_number.';
comment on column public.employees.bank_name_encrypted is 'pgp_sym_encrypt of bank_name.';
comment on column public.employees.social_insurance_number_encrypted is 'pgp_sym_encrypt of social_insurance_number.';


-- ----------------------------------------------------------------------------
-- 3) Trigger — encrypt on write, clear plaintext column
-- ----------------------------------------------------------------------------
--
-- Fires BEFORE INSERT OR UPDATE on employees. Logic per column:
--
--   if plaintext column is NOT NULL AND is being changed:
--     encrypted column ← pii_encrypt(plaintext)
--     plaintext column ← NULL
--
-- The "is being changed" check on UPDATE is important: it lets HR clear
-- a value (set to NULL deliberately) without re-encrypting the existing
-- value. NEW.col IS DISTINCT FROM OLD.col handles NULL semantics
-- correctly.
create or replace function public.tg_encrypt_employee_pii()
returns trigger
language plpgsql
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

drop trigger if exists employees_encrypt_pii on public.employees;
create trigger employees_encrypt_pii
  before insert or update of national_id, bank_account_number, bank_name, social_insurance_number
  on public.employees
  for each row execute function public.tg_encrypt_employee_pii();


-- ----------------------------------------------------------------------------
-- 4) One-time data migration — encrypt existing plaintext rows
-- ----------------------------------------------------------------------------
--
-- Iterates over every row that has a plaintext PII value AND an empty
-- encrypted shadow. Idempotent — safe to re-run if it gets interrupted
-- (the WHERE clause skips already-migrated rows).
--
-- Encryption runs in a separate UPDATE per column so a row with 4 sensitive
-- fields gets 4 inserts into the WAL — fine for the scale we're at, and
-- it keeps the per-statement transaction small.
update public.employees
   set national_id_encrypted = pii_encrypt(national_id),
       national_id           = null
 where national_id is not null
   and national_id_encrypted is null;

update public.employees
   set bank_account_number_encrypted = pii_encrypt(bank_account_number),
       bank_account_number           = null
 where bank_account_number is not null
   and bank_account_number_encrypted is null;

update public.employees
   set bank_name_encrypted = pii_encrypt(bank_name),
       bank_name           = null
 where bank_name is not null
   and bank_name_encrypted is null;

update public.employees
   set social_insurance_number_encrypted = pii_encrypt(social_insurance_number),
       social_insurance_number           = null
 where social_insurance_number is not null
   and social_insurance_number_encrypted is null;


-- ----------------------------------------------------------------------------
-- 5) View — employees_with_pii — adds decrypted PII alongside everything else
-- ----------------------------------------------------------------------------
--
-- The view does SELECT e.* (so any new column added to employees in a
-- future migration automatically appears) PLUS the decrypted PII fields
-- under DIFFERENT names with the _dec suffix:
--
--   employees_with_pii.national_id_dec               (decrypted text)
--   employees_with_pii.bank_account_number_dec       (decrypted text)
--   employees_with_pii.bank_name_dec                 (decrypted text)
--   employees_with_pii.social_insurance_number_dec   (decrypted text)
--
-- The plaintext columns (employees.national_id, etc.) still exist on the
-- table but are ALWAYS NULL after the encryption trigger fires. The view
-- exposes them as part of `e.*` for backwards compatibility — querying
-- them returns NULL, which is the correct signal to switch the read to
-- the _dec variant.
--
-- IMPORTANT: this view inherits RLS from the underlying employees table
-- because we declare it SECURITY INVOKER (Postgres 15+ default, set
-- explicitly here for clarity). The caller's role is what RLS sees.
--
-- Read paths that need PII (payslip, tax cert, bank export, forms,
-- employee detail page) should SELECT from employees_with_pii and read
-- the _dec columns. All other read paths can keep using employees.
create or replace view public.employees_with_pii
with (security_invoker = true)
as
select
  e.*,
  pii_decrypt(e.national_id_encrypted)             as national_id_dec,
  pii_decrypt(e.bank_account_number_encrypted)     as bank_account_number_dec,
  pii_decrypt(e.bank_name_encrypted)               as bank_name_dec,
  pii_decrypt(e.social_insurance_number_encrypted) as social_insurance_number_dec
from public.employees e;

comment on view public.employees_with_pii is 'Employees with decrypted PII. Use *_dec columns for plaintext reads (payslip / tax cert / bank export / forms). RLS inherited from employees.';


-- ----------------------------------------------------------------------------
-- 6) Known limitations introduced by this migration
-- ----------------------------------------------------------------------------
--
-- pgp_sym_encrypt is non-deterministic by design — same plaintext encrypts
-- to a different ciphertext every call. Two side-effects:
--
-- A) The duplicate-employee detector from migration 033
--    (count_duplicate_employee_groups + find_duplicate_employees) groups
--    by `national_id`. After this migration `national_id` is always NULL
--    on the underlying table, so the RPC will no longer flag national-ID
--    duplicates. It DOES still detect duplicates by employee_code, email,
--    and phone — which is the more common case for HR cleanup. A future
--    migration can rewrite the RPC to decrypt-and-group via the view
--    (O(N) decrypts — fine at SMB scale).
--
-- B) Audit log (mig 018 + 022 redaction): the existing redactor already
--    strips `national_id` from before_data / after_data JSON. Since the
--    column is now NULL on the table, the redactor has nothing to strip
--    — but the encrypted column `national_id_encrypted` IS captured as
--    bytea in the audit. That's strictly LESS leak than before (you'd
--    need the encryption key to read it). No fix required, just noted.
--
-- C) Excel import + AI-agent create flows still write to the plaintext
--    columns. The trigger encrypts them on the way in — no changes to
--    those write paths needed.


-- ----------------------------------------------------------------------------
-- 7) Reload PostgREST so the new columns + view are visible immediately
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
