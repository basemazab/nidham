-- ============================================================================
-- Migration 031 -- Termination + End-of-Service gratuity
--
-- The schema previously had employees.status='terminated' but no
-- termination_date column, no reason, and no way to compute the
-- statutory مكافأة نهاية الخدمة (End-of-Service gratuity) the company
-- owes the worker per Egyptian Labour Law 12/2003 Article 122:
--
--   - First 5 years of service  -> 1/2 month wage per year
--   - Each year beyond year 5    -> 1 full month wage per year
--   - Wage base = basic + housing + transport + incentive (fixed monthly
--     compensation; one-off bonuses + overtime excluded by case law)
--
-- This migration:
--   1. Adds termination_date + termination_reason + eos_gratuity columns.
--   2. Adds an RPC compute_eos_gratuity(employee_id, termination_date)
--      that returns the breakdown (years, months_owed, gratuity_amount,
--      wage_base) so UI can show "كده فاضل علي الشركة X جنيه".
--   3. Adds a server action wrapper in src/app/dashboard/employees/actions.ts
--      (separate commit).
-- ============================================================================

alter table public.employees
  add column if not exists termination_date date,
  add column if not exists termination_reason text,
  add column if not exists eos_gratuity numeric(12, 2);

alter table public.employees
  add constraint employees_termination_reason_check
    check (
      termination_reason is null
      or termination_reason in (
        'resignation',          -- استقالة
        'termination_by_employer', -- فصل من العمل
        'mutual_agreement',     -- اتفاق ودي
        'end_of_contract',      -- انتهاء عقد محدد المدة
        'retirement',           -- تقاعد
        'death'                 -- وفاة
      )
    ) not valid;
alter table public.employees
  validate constraint employees_termination_reason_check;

-- If termination_date is set, termination_reason should also be set.
-- Not enforced at the DB level to avoid breaking historical data --
-- enforced by the server action that sets both.

comment on column public.employees.termination_date is
  'Date the employment ended. NULL means still active.';
comment on column public.employees.termination_reason is
  'Why employment ended. One of: resignation / termination_by_employer / mutual_agreement / end_of_contract / retirement / death.';
comment on column public.employees.eos_gratuity is
  'End-of-Service gratuity owed at termination per Law 12/2003 Art 122. Snapshot at termination_date, NOT recomputed if wage changes later.';


-- ----------------------------------------------------------------------------
-- compute_eos_gratuity(employee_id, termination_date)
--
-- Returns the breakdown without persisting -- the server action calls
-- this to preview before HR confirms, then writes the result onto the
-- employees row.
--
-- Formula (Law 12/2003 Art 122):
--   wage_base = basic_salary + housing_allowance + transport_allowance
--               + incentive_allowance
--   years_of_service = (termination_date - hire_date) / 365.25
--
--   if years <= 5:
--     gratuity = years * (wage_base * 0.5)
--   else:
--     first_5_part = 5 * (wage_base * 0.5)             -- 2.5 months
--     remaining_part = (years - 5) * wage_base
--     gratuity = first_5_part + remaining_part
-- ----------------------------------------------------------------------------
create or replace function public.compute_eos_gratuity(
  p_employee_id     uuid,
  p_termination_date date
) returns table (
  hire_date         date,
  termination_date  date,
  years_of_service  numeric,
  wage_base         numeric,
  months_owed       numeric,
  gratuity_amount   numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hire date;
  v_basic numeric;
  v_housing numeric;
  v_transport numeric;
  v_incentive numeric;
  v_wage_base numeric;
  v_years numeric;
  v_months_owed numeric;
  v_gratuity numeric;
begin
  select
    e.hire_date,
    coalesce(e.basic_salary, 0),
    coalesce(e.housing_allowance, 0),
    coalesce(e.transport_allowance, 0),
    coalesce(e.incentive_allowance, 0)
  into v_hire, v_basic, v_housing, v_transport, v_incentive
  from public.employees e
  where e.id = p_employee_id
    and e.company_id = public.current_company_id();

  if v_hire is null then
    return;
  end if;
  if p_termination_date < v_hire then
    return; -- termination before hire makes no sense
  end if;

  v_wage_base := v_basic + v_housing + v_transport + v_incentive;

  -- Years of service as a fractional number (e.g. 3.5)
  v_years := round(
    extract(epoch from (p_termination_date::timestamp - v_hire::timestamp)) / (86400 * 365.25),
    4
  );

  -- Statutory formula
  if v_years <= 5 then
    v_months_owed := round(v_years * 0.5, 4);
  else
    -- 5 years × 0.5 = 2.5 months (the "first 5 years" portion)
    -- plus 1 full month per year of service after year 5
    v_months_owed := round(2.5 + (v_years - 5) * 1.0, 4);
  end if;

  v_gratuity := round(v_months_owed * v_wage_base, 2);

  return query
  select
    v_hire,
    p_termination_date,
    v_years,
    v_wage_base,
    v_months_owed,
    v_gratuity;
end;
$$;

grant execute on function public.compute_eos_gratuity(uuid, date) to authenticated;


notify pgrst, 'reload schema';
