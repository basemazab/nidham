-- ============================================================================
-- Migration 027 -- Make advance deduction + accrual cycle-aware
--
-- Migration 026 introduced custom payroll cycle windows (start_date /
-- end_date), but two financial calculators stayed locked on the legacy
-- "year * 100 + month" integer key:
--
--   compute_advance_deduction_for_month(emp, year, month)
--   compute_employee_accrued_net(emp, as_of_date)  -- uses date_trunc('month')
--
-- For Basem's own company (cycle = 21st -> 20th):
--   - The 21-Apr -> 20-May period gets year=2026, month=4 (start_date's
--     calendar month). An advance paid 25-Apr lands in ym_int 202604 too,
--     so the "paid_ym < target_ym" check is false -> the installment is
--     NEVER deducted. Money walks out the door silently.
--   - The Wednesday accrued-net calculator counts attendance from
--     calendar 1-Apr, which has no relationship to the 21-Apr cycle start,
--     producing a number that overstates "what the employee has earned
--     this month" by ~3 weeks.
--
-- This migration replaces both with date-range / cycle-window logic.
--
-- Approach:
--   - Drop the old (uuid, int, int) functions and replace with (uuid, date,
--     date) versions: compute_advance_deduction_for_period and
--     list_advance_deductions_for_period.
--   - Replace compute_employee_accrued_net body to anchor on the
--     company's cycle window (from compute_payroll_cycle_window in
--     migration 026), not date_trunc('month').
--
-- Call sites (src/app/dashboard/payroll/actions.ts) updated to pass
-- p_period_start + p_period_end derived from the payroll_period row.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Drop the deprecated calendar-month variants.
--    (Keeping them as aliases would just invite silent miscalc bugs.)
-- ----------------------------------------------------------------------------
drop function if exists public.compute_advance_deduction_for_month(uuid, integer, integer);
drop function if exists public.list_advance_deductions_for_month(uuid, integer, integer);


-- ----------------------------------------------------------------------------
-- 2. New cycle-aware deduction calculator
--
-- Returns the total deduction that should be subtracted from the given
-- payroll period for this employee, summed across every open advance.
--
-- "Open" = paid + still has remaining installments.
-- "Already deducted" = count of approved/paid payroll_periods this
-- employee was included in, whose start_date is strictly after the
-- advance's paid_at date but strictly BEFORE this period's start_date.
-- That excludes the period currently being computed (so re-running
-- the calc on the same period is idempotent).
-- ----------------------------------------------------------------------------
create or replace function public.compute_advance_deduction_for_period(
  p_employee_id  uuid,
  p_period_start date,
  p_period_end   date
) returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with open_advances as (
    select
      ar.id,
      ar.amount,
      ar.installments,
      ar.paid_at::date as paid_date
    from public.advance_requests ar
    where ar.employee_id = p_employee_id
      and ar.status = 'paid'
      and ar.paid_at is not null
      and ar.paid_at::date < p_period_start
  ),
  with_count as (
    select
      oa.amount,
      oa.installments,
      (
        select count(*)::int
        from public.payroll_periods pp
        join public.payroll_entries pe on pe.period_id = pp.id
        where pe.employee_id = p_employee_id
          and pp.status in ('approved', 'paid')
          and pp.start_date > oa.paid_date
          and pp.start_date < p_period_start
      ) as installments_deducted
    from open_advances oa
  )
  select coalesce(
    sum(
      case when installments_deducted < installments
        then round(amount / installments, 2)
        else 0
      end
    ),
    0
  )::numeric
  from with_count;
$$;

grant execute on function
  public.compute_advance_deduction_for_period(uuid, date, date)
  to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Per-advance breakdown (for the payslip detail page)
-- ----------------------------------------------------------------------------
create or replace function public.list_advance_deductions_for_period(
  p_employee_id  uuid,
  p_period_start date,
  p_period_end   date
) returns table (
  advance_id        uuid,
  advance_paid_at   timestamptz,
  amount            numeric,
  installments      integer,
  installment_index integer,  -- 1-based
  installment_amount numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with open_advances as (
    select
      ar.id,
      ar.amount,
      ar.installments,
      ar.paid_at,
      ar.paid_at::date as paid_date
    from public.advance_requests ar
    where ar.employee_id = p_employee_id
      and ar.status = 'paid'
      and ar.paid_at is not null
      and ar.paid_at::date < p_period_start
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
        and pp.start_date > oa.paid_date
        and pp.start_date < p_period_start
    ) + 1 as installment_index,
    round(oa.amount / oa.installments, 2) as installment_amount
  from open_advances oa
  where (
    select count(*)::int
    from public.payroll_periods pp
    join public.payroll_entries pe on pe.period_id = pp.id
    where pe.employee_id = p_employee_id
      and pp.status in ('approved', 'paid')
      and pp.start_date > oa.paid_date
      and pp.start_date < p_period_start
  ) < oa.installments;
$$;

grant execute on function
  public.list_advance_deductions_for_period(uuid, date, date)
  to authenticated;


-- ----------------------------------------------------------------------------
-- 4. Replace compute_employee_accrued_net to be cycle-aware
--
-- The function signature stays the same: (employee_id, as_of_date) -> table.
-- The internal logic changes:
--   - Cycle start = compute_payroll_cycle_window(as_of_date, 'monthly').cycle_start
--   - Working days = days between cycle_start and cycle_end (28-31 for a
--     calendar-style cycle, exactly 30 or 31 for a 21->20 style)
--   - Attendance summed from cycle_start to as_of_date (inclusive)
--   - Open-advance "months_repaid" counted by start_date comparison
-- ----------------------------------------------------------------------------
create or replace function public.compute_employee_accrued_net(
  p_employee_id uuid,
  p_as_of_date  date default current_date
) returns table (
  full_name              text,
  monthly_base           numeric,
  working_days           integer,
  daily_rate             numeric,
  attended_days          integer,
  half_day_days          integer,
  leave_days             integer,
  absent_days            integer,
  effective_days         numeric,
  accrued_gross          numeric,
  social_insurance       numeric,
  income_tax             numeric,
  accrued_net            numeric,
  existing_open_advances numeric,
  available_headroom     numeric,
  eligible_50pct         numeric,
  eligible_70pct         numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_emp record;
  v_company record;
  v_cycle record;
  v_cycle_start date;
  v_cycle_end date;
  v_working_days int := 26;
  v_daily_rate numeric := 0;
  v_monthly_base numeric := 0;
  v_attended int := 0;
  v_half int := 0;
  v_leave int := 0;
  v_absent int := 0;
  v_effective numeric := 0;
  v_gross numeric := 0;
  v_insurance numeric := 0;
  v_tax numeric := 0;
  v_net numeric := 0;
  v_open numeric := 0;
  v_headroom numeric := 0;
  v_taxable_annual numeric := 0;
  v_annual_tax numeric := 0;
begin
  -- 1. Employee snapshot
  select
    e.full_name,
    coalesce(e.basic_salary, 0) as basic_salary,
    coalesce(e.housing_allowance, 0) as housing_allowance,
    coalesce(e.transport_allowance, 0) as transport_allowance,
    coalesce(e.other_allowances, 0) as other_allowances,
    coalesce(e.incentive_allowance, 0) as incentive_allowance,
    e.company_id
  into v_emp
  from public.employees e
  where e.id = p_employee_id;

  if v_emp.full_name is null then
    return;
  end if;

  -- Tenant guard (security-definer re-check).
  if v_emp.company_id <> public.current_company_id() then
    return;
  end if;

  select
    coalesce(c.social_insurance_enabled, false) as social_insurance_enabled,
    coalesce(c.income_tax_enabled, false) as income_tax_enabled
  into v_company
  from public.companies c
  where c.id = v_emp.company_id;

  -- 2. Salary structure
  v_monthly_base :=
    v_emp.basic_salary +
    v_emp.housing_allowance +
    v_emp.transport_allowance +
    v_emp.other_allowances +
    v_emp.incentive_allowance;

  -- 3. Resolve the company's cycle window containing as_of_date.
  -- Falls back to calendar month if the company hasn't configured a
  -- custom start_day yet (compute_payroll_cycle_window defaults to 1).
  select cs.cycle_start, cs.cycle_end
    into v_cycle
  from public.compute_payroll_cycle_window(p_as_of_date, 'monthly') cs
  limit 1;

  if v_cycle.cycle_start is null then
    -- safety net: should never happen with the default args, but if it
    -- does, fall back to calendar month so we don't divide by zero.
    v_cycle_start := date_trunc('month', p_as_of_date)::date;
    v_cycle_end := (date_trunc('month', p_as_of_date) + interval '1 month' - interval '1 day')::date;
  else
    v_cycle_start := v_cycle.cycle_start;
    v_cycle_end := v_cycle.cycle_end;
  end if;

  -- Working days in the cycle = (end - start + 1) - weekly rest days
  -- approximation. For a 21->20 cycle that's exactly 30 days; we keep
  -- 26 as the "working days" default since the Egyptian SMB convention
  -- treats one rest day per week (Friday). HR overrides this in the
  -- payroll period if their workweek differs.
  v_working_days := 26;

  v_daily_rate := case
    when v_working_days > 0 then v_monthly_base / v_working_days
    else 0
  end;

  -- 4. Attendance from cycle_start to as_of_date
  select
    count(*) filter (where status = 'present'),
    count(*) filter (where status = 'half_day'),
    count(*) filter (where status in ('leave', 'holiday', 'weekend')),
    count(*) filter (where status = 'absent')
  into v_attended, v_half, v_leave, v_absent
  from public.attendance
  where employee_id = p_employee_id
    and date >= v_cycle_start
    and date <= p_as_of_date;

  v_effective := v_attended + (v_half::numeric * 0.5) + v_leave;
  v_gross := round(v_effective * v_daily_rate, 2);

  -- 5. Pro-rated deductions (same brackets as the full payroll engine)
  if v_company.social_insurance_enabled then
    declare
      v_insurable_max numeric;
      v_insurable numeric;
    begin
      v_insurable_max := 12600 *
        case when v_working_days > 0 then v_effective / v_working_days else 0 end;
      v_insurable := least(v_gross, v_insurable_max);
      v_insurance := round(v_insurable * 0.14, 2);
    end;
  end if;

  if v_company.income_tax_enabled then
    v_taxable_annual := greatest(0, (v_gross - v_insurance) * 12 - 20000);

    if v_taxable_annual <= 40000 then
      v_annual_tax := v_taxable_annual * 0.10;
    elsif v_taxable_annual <= 55000 then
      v_annual_tax := 40000 * 0.10 + (v_taxable_annual - 40000) * 0.15;
    elsif v_taxable_annual <= 70000 then
      v_annual_tax := 40000 * 0.10 + 15000 * 0.15 + (v_taxable_annual - 55000) * 0.20;
    elsif v_taxable_annual <= 200000 then
      v_annual_tax := 40000 * 0.10 + 15000 * 0.15 + 15000 * 0.20 + (v_taxable_annual - 70000) * 0.225;
    elsif v_taxable_annual <= 400000 then
      v_annual_tax := 40000 * 0.10 + 15000 * 0.15 + 15000 * 0.20 + 130000 * 0.225 + (v_taxable_annual - 200000) * 0.25;
    else
      v_annual_tax := 40000 * 0.10 + 15000 * 0.15 + 15000 * 0.20 + 130000 * 0.225 + 200000 * 0.25 + (v_taxable_annual - 400000) * 0.275;
    end if;

    v_tax := round(v_annual_tax / 12, 2);
  end if;

  v_net := round(v_gross - v_insurance - v_tax, 2);
  if v_net < 0 then v_net := 0; end if;

  -- 6. Existing open advances: count installments already deducted via
  -- payroll periods that start strictly after the advance's paid_at.
  -- Uses pp.start_date instead of (year*100+month).
  with open_advances as (
    select
      ar.id,
      ar.amount,
      ar.installments,
      ar.paid_at::date as paid_date,
      (
        select count(*)
        from public.payroll_periods pp
        join public.payroll_entries pe on pe.period_id = pp.id
        where pe.employee_id = p_employee_id
          and pp.status in ('approved', 'paid')
          and pp.start_date > ar.paid_at::date
      ) as months_repaid
    from public.advance_requests ar
    where ar.employee_id = p_employee_id
      and ar.status = 'paid'
      and ar.paid_at is not null
  )
  select coalesce(sum(
    greatest(
      0,
      amount - round(amount / installments, 2) * least(months_repaid, installments)
    )
  ), 0)
  into v_open
  from open_advances;

  v_headroom := greatest(0, v_net - v_open);

  return query
  select
    v_emp.full_name,
    v_monthly_base,
    v_working_days,
    round(v_daily_rate, 2),
    v_attended,
    v_half,
    v_leave,
    v_absent,
    v_effective,
    v_gross,
    v_insurance,
    v_tax,
    v_net,
    v_open,
    v_headroom,
    round(v_headroom * 0.50, 2),
    round(v_headroom * 0.70, 2);
end;
$$;

grant execute on function public.compute_employee_accrued_net(uuid, date) to authenticated;


notify pgrst, 'reload schema';
