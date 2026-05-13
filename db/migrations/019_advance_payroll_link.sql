-- ============================================================================
-- Migration 019 -- Auto-link advances to payroll deductions.
--
-- Before this migration, advance_requests recorded amount + installments
-- but the value was never automatically pulled into the next month's
-- payroll. HR had to remember "this employee took 5000 ج over 5 months,
-- subtract 1000 ج each month" and type it manually. The workflow looked
-- broken because the data captured was decoupled from where it should be
-- applied.
--
-- This migration adds `compute_advance_deduction_for_month(employee, year,
-- month)`: given the target payroll month, it sums the per-installment
-- amount for every "open" advance for that employee (status='paid', and
-- the count of approved-or-paid payroll periods between paid_at and the
-- target month is less than the installment count).
--
-- The function is referentially transparent -- it never writes state and
-- can be re-evaluated at any time, so deleting / regenerating a payroll
-- period self-corrects without manual cleanup. The trade-off is that it
-- assumes one installment per payroll period; that's the universal
-- Egyptian SMB pattern (monthly salary, monthly deduction).
-- ============================================================================

create or replace function public.compute_advance_deduction_for_month(
  p_employee_id uuid,
  p_year        integer,
  p_month       integer
) returns numeric
language sql
stable
security definer
set search_path = public
as $$
  -- Open advances = paid + still have remaining installments
  -- "Installments deducted so far" = how many approved/paid payroll
  -- periods exist for this employee strictly after the advance was
  -- paid, up to and including the target month.
  with target as (
    select (p_year * 100 + p_month) as ym_int
  ),
  open_advances as (
    select
      ar.id,
      ar.amount,
      ar.installments,
      ar.paid_at,
      (extract(year from ar.paid_at)::int * 100
       + extract(month from ar.paid_at)::int) as paid_ym_int
    from public.advance_requests ar
    where ar.employee_id = p_employee_id
      and ar.status = 'paid'
      and ar.paid_at is not null
  ),
  with_count as (
    select
      oa.id,
      oa.amount,
      oa.installments,
      -- count of payroll periods this employee has been included in,
      -- approved or paid, AFTER the advance was issued, up to and
      -- including the target month
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
  select coalesce(
    sum(
      case
        when months_deducted < installments
          then round(amount / installments, 2)
        else 0
      end
    ),
    0
  )::numeric
  from with_count;
$$;

grant execute on function public.compute_advance_deduction_for_month(uuid, integer, integer) to authenticated;


-- Per-employee, per-advance breakdown used by the payslip detail page
-- so the employee sees "loan deduction: 1000 ج -- قسط 3/5 من سلفة بتاريخ
-- 2026-02-14". Returns one row per open advance contributing to a
-- target month.
create or replace function public.list_advance_deductions_for_month(
  p_employee_id uuid,
  p_year        integer,
  p_month       integer
) returns table (
  advance_id        uuid,
  advance_paid_at   timestamptz,
  amount            numeric,
  installments      integer,
  installment_index integer,  -- 1-based: 1 = first installment, 2 = second...
  installment_amount numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select (p_year * 100 + p_month) as ym_int
  ),
  open_advances as (
    select
      ar.id,
      ar.amount,
      ar.installments,
      ar.paid_at,
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
$$;

grant execute on function public.list_advance_deductions_for_month(uuid, integer, integer) to authenticated;
