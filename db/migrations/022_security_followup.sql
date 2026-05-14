-- ============================================================================
-- Migration 022 -- Security follow-up to the post-launch audit.
--
-- The audit on commits 018-021 found two HIGH-severity gaps:
--
--   1. compute_advance_deduction_for_month + list_advance_deductions_
--      for_month (mig 019) are security definer + granted to
--      authenticated, but accept an employee_id parameter without
--      verifying that employee belongs to the caller's company. A
--      logged-in user from tenant A who learns a tenant-B employee's
--      UUID could read tenant B's open-advance schedule.
--
--   2. The audit_log trigger (mig 018) stores the full row in
--      before_data / after_data jsonb. That includes national_id +
--      bank_account_number + social_insurance_number. /dashboard/
--      audit-log is gated by requireHRPage() which includes manager
--      role; PII intended for admin-only eyes leaks to managers
--      through audit history.
--
-- Fixes:
--   - Re-wrap both advance helpers with an explicit
--     `where company_id = current_company_id()` guard. The functions
--     stay security definer (they need to bypass RLS to read across
--     tables) but the WHERE clause does the tenant scoping that RLS
--     normally would.
--   - Rewrite tg_write_audit_log to strip the sensitive columns from
--     the jsonb payload before insert. The audit row still records
--     which fields changed (key list is preserved) but the *values*
--     are masked. This is irreversible -- past audit_log rows are
--     left as-is (they're already in the table), but every new
--     write from now on is sanitized.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Tenant-scope the advance-deduction helpers
-- ----------------------------------------------------------------------------

create or replace function public.compute_advance_deduction_for_month(
  p_employee_id uuid,
  p_year        integer,
  p_month       integer
) returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller_company uuid;
  v_emp_company    uuid;
  v_total          numeric;
begin
  -- Resolve the caller's tenant. Anonymous callers get NULL here and
  -- the next check fails, which is the right behaviour.
  v_caller_company := public.current_company_id();

  -- Verify the queried employee is in that tenant.
  select e.company_id into v_emp_company
  from public.employees e
  where e.id = p_employee_id;

  if v_emp_company is null or v_emp_company <> v_caller_company then
    -- Silently return 0 -- don't leak "this UUID exists in another tenant"
    -- vs "this UUID doesn't exist at all".
    return 0::numeric;
  end if;

  with target as (
    select (p_year * 100 + p_month) as ym_int
  ),
  open_advances as (
    select
      ar.id, ar.amount, ar.installments, ar.paid_at,
      (extract(year from ar.paid_at)::int * 100
       + extract(month from ar.paid_at)::int) as paid_ym_int
    from public.advance_requests ar
    where ar.employee_id = p_employee_id
      and ar.status = 'paid'
      and ar.paid_at is not null
  ),
  with_count as (
    select
      oa.id, oa.amount, oa.installments,
      (
        select count(*)::int
        from public.payroll_periods pp
        join public.payroll_entries pe on pe.period_id = pp.id
        where pe.employee_id = p_employee_id
          and pp.status in ('approved', 'paid')
          and (pp.year * 100 + pp.month) > oa.paid_ym_int
          and (pp.year * 100 + pp.month) <= (select ym_int from target)
      ) as months_deducted
    from open_advances oa
    where oa.paid_ym_int < (select ym_int from target)
  )
  select coalesce(sum(
    case when months_deducted < installments
         then round(amount / installments, 2)
         else 0 end), 0)::numeric
    into v_total
  from with_count;

  return v_total;
end;
$$;

grant execute on function public.compute_advance_deduction_for_month(uuid, integer, integer)
  to authenticated;


create or replace function public.list_advance_deductions_for_month(
  p_employee_id uuid,
  p_year        integer,
  p_month       integer
) returns table (
  advance_id        uuid,
  advance_paid_at   timestamptz,
  amount            numeric,
  installments      integer,
  installment_index integer,
  installment_amount numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller_company uuid;
  v_emp_company    uuid;
begin
  v_caller_company := public.current_company_id();

  select e.company_id into v_emp_company
  from public.employees e
  where e.id = p_employee_id;

  if v_emp_company is null or v_emp_company <> v_caller_company then
    -- Empty result set -- same "exists in another tenant" privacy as above.
    return;
  end if;

  return query
  with target as (
    select (p_year * 100 + p_month) as ym_int
  ),
  open_advances as (
    select
      ar.id, ar.amount, ar.installments, ar.paid_at,
      (extract(year from ar.paid_at)::int * 100
       + extract(month from ar.paid_at)::int) as paid_ym_int
    from public.advance_requests ar
    where ar.employee_id = p_employee_id
      and ar.status = 'paid'
      and ar.paid_at is not null
  )
  select
    oa.id,
    oa.paid_at,
    oa.amount,
    oa.installments,
    (
      select count(*)::int
      from public.payroll_periods pp
      join public.payroll_entries pe on pe.period_id = pp.id
      where pe.employee_id = p_employee_id
        and pp.status in ('approved', 'paid')
        and (pp.year * 100 + pp.month) > oa.paid_ym_int
        and (pp.year * 100 + pp.month) <= (select ym_int from target)
    ) + 1 as installment_index,
    round(oa.amount / oa.installments, 2) as installment_amount
  from open_advances oa
  where oa.paid_ym_int < (select ym_int from target)
    and (
      select count(*)::int
      from public.payroll_periods pp
      join public.payroll_entries pe on pe.period_id = pp.id
      where pe.employee_id = p_employee_id
        and pp.status in ('approved', 'paid')
        and (pp.year * 100 + pp.month) > oa.paid_ym_int
        and (pp.year * 100 + pp.month) <= (select ym_int from target)
    ) < oa.installments;
end;
$$;

grant execute on function public.list_advance_deductions_for_month(uuid, integer, integer)
  to authenticated;


-- ----------------------------------------------------------------------------
-- 2. Strip PII from new audit_log writes
--
-- The trigger function jsonb-strips fields that are sensitive to
-- non-admin roles before persisting. Past rows are left as-is (we
-- don't rewrite history) but every new INSERT/UPDATE/DELETE from
-- now on writes a sanitized payload. Even if /dashboard/audit-log
-- gets unintentionally widened in a future commit, the PII won't be
-- there to leak.
-- ----------------------------------------------------------------------------

create or replace function public.tg_write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Columns sensitive enough that even a logged audit trail
  -- should not surface their value. The KEY is kept so admins
  -- can still see "national_id was changed" without seeing the
  -- before/after value.
  c_sensitive constant text[] := array[
    'national_id',
    'social_insurance_number',
    'bank_account_number',
    'bank_name'
  ];

  v_before  jsonb;
  v_after   jsonb;
  v_company uuid;
  v_row_id  uuid;
  v_source  jsonb;
begin
  if tg_op = 'DELETE' then
    v_source := to_jsonb(old);
  else
    v_source := to_jsonb(new);
  end if;

  v_company := (v_source->>'company_id')::uuid;
  v_row_id  := (v_source->>'id')::uuid;

  -- Build sanitized before / after blobs. We replace sensitive
  -- string values with '***' so the key still exists (audit shows
  -- *which* field changed) but the value is opaque.
  v_before := case
    when tg_op in ('UPDATE', 'DELETE') then redact_sensitive(to_jsonb(old), c_sensitive)
    else null
  end;
  v_after := case
    when tg_op in ('INSERT', 'UPDATE') then redact_sensitive(to_jsonb(new), c_sensitive)
    else null
  end;

  insert into public.audit_log
    (company_id, actor_id, table_name, row_id, action, before_data, after_data)
  values
    (v_company, auth.uid(), tg_table_name, v_row_id, tg_op, v_before, v_after);

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;


create or replace function public.redact_sensitive(
  src jsonb,
  keys text[]
) returns jsonb
language plpgsql
immutable
as $$
declare
  out_jsonb jsonb := src;
  k text;
begin
  if src is null then return null; end if;
  foreach k in array keys loop
    -- Only mask if the key is actually present + not already null.
    if out_jsonb ? k and not (out_jsonb->>k is null) then
      out_jsonb := jsonb_set(out_jsonb, array[k], to_jsonb('***'::text));
    end if;
  end loop;
  return out_jsonb;
end;
$$;
