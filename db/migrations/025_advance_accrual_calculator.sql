-- ============================================================================
-- Migration 025 -- Mid-month advance calculator
--
-- Egyptian SMBs commonly disburse salary advances every Wednesday for
-- employees who need cash before month-end payroll. The advance is
-- bounded between 50% and 70% of what the employee has *actually
-- earned to date* based on attendance -- not the full monthly salary.
-- HR shouldn't have to do this math by hand.
--
-- compute_employee_accrued_net(employee_id, as_of_date) returns:
--   - monthly_base / daily_rate / working_days (config snapshot)
--   - attended / half / leave / absent day counts since the 1st of
--     the month containing as_of_date
--   - effective_days (paid days = attended + halfDay*0.5 + leave)
--   - accrued_gross  = effective_days * daily_rate
--   - social_insurance + income_tax (pro-rated, respecting the per-
--     company toggles from migration 023; both 0 when off)
--   - accrued_net    = accrued_gross - deductions
--   - existing_open_advances (sum of installments still owed across
--     previously-issued paid advances; subtracted from the headroom
--     so HR doesn't accidentally double-disburse)
--   - eligible_50pct + eligible_70pct (the two quick-pick values)
--
-- Used by /dashboard/payroll/advances to show every employee's
-- accrued state side by side on Wednesday.
-- ============================================================================

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
  v_start_month date;
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
  -- 1. Employee + company snapshot
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

  -- Tenant guard (the function is security-definer; this re-checks).
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

  v_daily_rate := case
    when v_working_days > 0 then v_monthly_base / v_working_days
    else 0
  end;

  -- 3. Attendance from 1st of the month to as_of_date
  v_start_month := date_trunc('month', p_as_of_date)::date;

  select
    count(*) filter (where status = 'present'),
    count(*) filter (where status = 'half_day'),
    count(*) filter (where status in ('leave', 'holiday', 'weekend')),
    count(*) filter (where status = 'absent')
  into v_attended, v_half, v_leave, v_absent
  from public.attendance
  where employee_id = p_employee_id
    and date >= v_start_month
    and date <= p_as_of_date;

  v_effective := v_attended + (v_half::numeric * 0.5) + v_leave;
  v_gross := round(v_effective * v_daily_rate, 2);

  -- 4. Pro-rated deductions (if the company has them enabled)
  if v_company.social_insurance_enabled then
    -- 14% of insurable wage, capped at 12,600 × (effective_days / working_days)
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
    -- Egyptian 2024 brackets after a 20k personal exemption, annualized
    -- from the accrued gross + insurance net. Same brackets as the
    -- full payroll engine in src/lib/payroll.ts.
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

  -- 5. Existing open advances -- the total amount still owed across
  -- previously-issued paid advances. We subtract from net so HR
  -- doesn't disburse more than the employee can realistically
  -- repay through the upcoming payroll.
  with open_advances as (
    select
      ar.id,
      ar.amount,
      ar.installments,
      ar.paid_at,
      (
        select count(*)
        from public.payroll_periods pp
        join public.payroll_entries pe on pe.period_id = pp.id
        where pe.employee_id = p_employee_id
          and pp.status in ('approved', 'paid')
          and (pp.year * 100 + pp.month) >
            (extract(year from ar.paid_at)::int * 100 + extract(month from ar.paid_at)::int)
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


-- ----------------------------------------------------------------------------
-- Bulk roll-up -- compute accrued state for EVERY active employee at once.
-- Used by /dashboard/payroll/advances to render the Wednesday roster
-- in a single round-trip.
-- ----------------------------------------------------------------------------
create or replace function public.list_employees_advance_eligibility(
  p_as_of_date date default current_date
) returns table (
  employee_id            uuid,
  full_name              text,
  job_title              text,
  department             text,
  attended_days          integer,
  effective_days         numeric,
  monthly_base           numeric,
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
  v_calc record;
begin
  for v_emp in
    select e.id, e.full_name, e.job_title, e.department
    from public.employees e
    where e.company_id = public.current_company_id()
      and e.status = 'active'
    order by e.full_name
  loop
    select * into v_calc
    from public.compute_employee_accrued_net(v_emp.id, p_as_of_date);

    -- Skip employees who somehow returned no calc row
    if v_calc.full_name is null then
      continue;
    end if;

    employee_id := v_emp.id;
    full_name := v_emp.full_name;
    job_title := v_emp.job_title;
    department := v_emp.department;
    attended_days := v_calc.attended_days;
    effective_days := v_calc.effective_days;
    monthly_base := v_calc.monthly_base;
    accrued_net := v_calc.accrued_net;
    existing_open_advances := v_calc.existing_open_advances;
    available_headroom := v_calc.available_headroom;
    eligible_50pct := v_calc.eligible_50pct;
    eligible_70pct := v_calc.eligible_70pct;

    return next;
  end loop;

  return;
end;
$$;

grant execute on function public.list_employees_advance_eligibility(date) to authenticated;


notify pgrst, 'reload schema';
