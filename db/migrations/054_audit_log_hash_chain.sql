-- ============================================================================
-- Migration 054 — Tamper-evident audit_log (SHA-256 hash chain)
-- ============================================================================
--
-- Before this migration, `audit_log` rows were RLS-read-only and only
-- the trigger could INSERT — but anyone with DB access (a rogue super-
-- admin who knew the postgres role's password, an attacker who compro-
-- mised Supabase) could UPDATE or DELETE rows directly and erase their
-- tracks.
--
-- This migration adds a SHA-256 hash chain so any tampering becomes
-- detectable:
--
--   row.prev_hash = previous row's row_hash (for the same company_id)
--   row.row_hash  = sha256(prev_hash || actor || table || row_id ||
--                          action || before_data || after_data)
--
-- A verifier function walks the chain and reports the first row whose
-- prev_hash doesn't match the expected previous row, OR whose row_hash
-- doesn't recompute correctly. Either case = tampering happened.
--
-- One-time backfill: every existing row gets a hash chain back-computed
-- from its own data, in insertion order. From this migration onward all
-- new rows extend the chain.
--
-- Note: hashes don't prevent tampering, they detect it. For prevention
-- you'd need a separate append-only store (S3 with Object Lock, etc.).
-- That's an enterprise-tier hardening for a future commit.
-- ============================================================================

create extension if not exists pgcrypto;


-- 1) Add the chain columns
alter table public.audit_log
  add column if not exists prev_hash bytea,
  add column if not exists row_hash  bytea;

create index if not exists idx_audit_log_company_id_asc
  on public.audit_log(company_id, id asc);

comment on column public.audit_log.prev_hash is
  'SHA-256 of the previous audit_log row for the same company_id. NULL for the first row in a tenant chain.';
comment on column public.audit_log.row_hash is
  'SHA-256 hash of this row including prev_hash. Forms a tamper-evident chain.';


-- 2) Helper: compute the canonical payload for one audit row
create or replace function public._audit_payload(
  p_prev_hash    bytea,
  p_actor_id     uuid,
  p_table_name   text,
  p_row_id       uuid,
  p_action       text,
  p_before_data  jsonb,
  p_after_data   jsonb
)
returns text
language sql
immutable
as $$
  select
    coalesce(encode(p_prev_hash, 'hex'), '')   || '|' ||
    coalesce(p_actor_id::text, '')             || '|' ||
    coalesce(p_table_name, '')                 || '|' ||
    coalesce(p_row_id::text, '')               || '|' ||
    coalesce(p_action, '')                     || '|' ||
    coalesce(p_before_data::text, '')          || '|' ||
    coalesce(p_after_data::text, '');
$$;


-- 3) Update the audit trigger to set both hash columns
create or replace function public.tg_write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row        jsonb;
  v_company    uuid;
  v_row_id     uuid;
  v_actor      uuid := auth.uid();
  v_before     jsonb;
  v_after      jsonb;
  v_prev_hash  bytea;
  v_row_hash   bytea;
begin
  -- Same row-shape extraction as before mig 054
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_company := (v_row->>'company_id')::uuid;
  v_row_id  := (v_row->>'id')::uuid;
  v_before  := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_after   := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;

  -- Get the last row's hash for this tenant. The (company_id, id asc)
  -- index makes this an O(1) lookup.
  select row_hash
    into v_prev_hash
    from public.audit_log
   where company_id = v_company
   order by id desc
   limit 1;

  -- Compute this row's hash
  v_row_hash := digest(
    _audit_payload(
      v_prev_hash, v_actor, tg_table_name, v_row_id, tg_op,
      v_before, v_after
    ),
    'sha256'
  );

  insert into public.audit_log
    (company_id, actor_id, table_name, row_id, action,
     before_data, after_data, prev_hash, row_hash)
  values
    (v_company, v_actor, tg_table_name, v_row_id, tg_op,
     v_before, v_after, v_prev_hash, v_row_hash);

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


-- 4) Backfill — compute hashes for every existing row, in insertion order
do $backfill$
declare
  r record;
  v_prev_hash bytea;
  v_curr_hash bytea;
  v_last_company uuid := null;
begin
  for r in
    select *
      from public.audit_log
     where row_hash is null
     order by company_id, id asc
  loop
    -- Reset the chain when we move to a new tenant
    if r.company_id is distinct from v_last_company then
      v_prev_hash := null;
      v_last_company := r.company_id;
    end if;

    v_curr_hash := digest(
      _audit_payload(
        v_prev_hash, r.actor_id, r.table_name, r.row_id, r.action,
        r.before_data, r.after_data
      ),
      'sha256'
    );

    update public.audit_log
       set prev_hash = v_prev_hash,
           row_hash  = v_curr_hash
     where id = r.id;

    v_prev_hash := v_curr_hash;
  end loop;
end
$backfill$;


-- 5) Verifier — walks the chain for one tenant, returns first broken row
create or replace function public.verify_audit_chain(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  r record;
  v_expected_prev bytea;
  v_computed_hash bytea;
  v_first boolean := true;
  v_break_at_id bigint := null;
  v_break_reason text := null;
  v_total bigint := 0;
begin
  for r in
    select *
      from public.audit_log
     where company_id = p_company_id
       and row_hash is not null
     order by id asc
  loop
    v_total := v_total + 1;

    if v_first then
      v_expected_prev := null;
      v_first := false;
    end if;

    if r.prev_hash is distinct from v_expected_prev then
      v_break_at_id := r.id;
      v_break_reason := 'prev_hash mismatch';
      exit;
    end if;

    v_computed_hash := digest(
      _audit_payload(
        v_expected_prev, r.actor_id, r.table_name, r.row_id, r.action,
        r.before_data, r.after_data
      ),
      'sha256'
    );

    if v_computed_hash is distinct from r.row_hash then
      v_break_at_id := r.id;
      v_break_reason := 'row_hash mismatch';
      exit;
    end if;

    v_expected_prev := r.row_hash;
  end loop;

  return jsonb_build_object(
    'valid',         v_break_at_id is null,
    'rows_checked',  v_total,
    'break_at_id',   v_break_at_id,
    'break_reason',  v_break_reason
  );
end;
$$;

comment on function public.verify_audit_chain(uuid) is
  'Walk the audit_log hash chain for one tenant. Returns { valid, rows_checked, break_at_id, break_reason }. Anyone with read access to the tenant can verify.';

grant execute on function public.verify_audit_chain(uuid) to authenticated;


notify pgrst, 'reload schema';
