-- ============================================================================
-- Migration 032 -- Annual leave carryover RPC
--
-- public.leave_balances.carried_over was added in migration 018 with
-- the comment "allowed for annual" but no code ever wrote to it. On
-- 1-Jan every year, every employee silently lost their unused annual
-- leave -- the new-year balance row (created by handle_new_user only
-- on hire, never refreshed) would default carried_over to 0.
--
-- This migration adds rollover_leave_balances(year) which, when run
-- against year N, computes each employee's remaining annual days from
-- year N-1 and writes it as the carried_over for year N. Idempotent:
-- running twice with the same target year is safe -- the upsert
-- updates rather than accumulates.
--
-- Cap: 2x the standard entitlement (default 42 days for >1y employees,
-- 30 for new hires). Eg-labour case-law allows generous carryover but
-- capping prevents abuse of unlimited accumulation.
-- ============================================================================

create or replace function public.rollover_leave_balances(
  p_target_year integer
) returns table (
  employee_id        uuid,
  full_name          text,
  prior_remaining    numeric,
  carried_over_to_new numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_year integer := p_target_year - 1;
  v_co_id uuid := public.current_company_id();
  r record;
  v_remaining numeric;
  v_capped numeric;
  v_new_entitled numeric;
  v_cap_factor numeric := 2.0; -- cap carryover at 2x entitlement
begin
  if v_co_id is null then
    return;
  end if;
  if p_target_year < 2020 or p_target_year > 2099 then
    raise exception 'target year out of range';
  end if;

  -- For each ACTIVE employee in this company, compute their prior-year
  -- remaining annual leave and write the new-year row.
  for r in
    select e.id, e.full_name, e.hire_date, lb.entitled_days, lb.carried_over, lb.used_days
    from public.employees e
    left join public.leave_balances lb
      on lb.employee_id = e.id
     and lb.year = v_prev_year
     and lb.leave_type = 'annual'
    where e.company_id = v_co_id
      and e.status = 'active'
  loop
    -- Remaining annual leave from prior year = entitled + carried + 0 - used.
    -- If no row existed (lb.entitled_days is null), remaining is 0.
    v_remaining := coalesce(r.entitled_days, 0)
                 + coalesce(r.carried_over, 0)
                 - coalesce(r.used_days, 0);
    if v_remaining < 0 then v_remaining := 0; end if;

    -- New-year entitlement for cap purposes
    v_new_entitled := public.default_entitled_days('annual', r.hire_date);

    -- Cap carryover at 2x the new-year entitlement
    v_capped := least(v_remaining, v_cap_factor * v_new_entitled);

    -- Upsert the target-year row with the new carryover
    insert into public.leave_balances
      (company_id, employee_id, year, leave_type, entitled_days, carried_over, used_days)
    values
      (v_co_id, r.id, p_target_year, 'annual', v_new_entitled, v_capped, 0)
    on conflict (employee_id, year, leave_type) do update
      set carried_over = excluded.carried_over,
          entitled_days = case
            -- Don't lower entitlement if the existing row already has more
            when leave_balances.entitled_days > excluded.entitled_days
              then leave_balances.entitled_days
            else excluded.entitled_days
          end,
          updated_at = now();

    employee_id := r.id;
    full_name := r.full_name;
    prior_remaining := v_remaining;
    carried_over_to_new := v_capped;
    return next;
  end loop;

  return;
end;
$$;

grant execute on function public.rollover_leave_balances(integer) to authenticated;


-- Helper for the UI: a non-mutating preview of what the rollover
-- WOULD do, so admin can review before clicking the button.
create or replace function public.preview_leave_rollover(
  p_target_year integer
) returns table (
  employee_id        uuid,
  full_name          text,
  prior_remaining    numeric,
  would_carry_over   numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prev_year integer := p_target_year - 1;
  v_co_id uuid := public.current_company_id();
  v_cap_factor numeric := 2.0;
begin
  if v_co_id is null then return; end if;

  return query
  select
    e.id,
    e.full_name,
    greatest(
      0,
      coalesce(lb.entitled_days, 0)
        + coalesce(lb.carried_over, 0)
        - coalesce(lb.used_days, 0)
    ) as prior_remaining,
    least(
      greatest(
        0,
        coalesce(lb.entitled_days, 0)
          + coalesce(lb.carried_over, 0)
          - coalesce(lb.used_days, 0)
      ),
      v_cap_factor * public.default_entitled_days('annual', e.hire_date)
    ) as would_carry_over
  from public.employees e
  left join public.leave_balances lb
    on lb.employee_id = e.id
   and lb.year = v_prev_year
   and lb.leave_type = 'annual'
  where e.company_id = v_co_id
    and e.status = 'active'
  order by e.full_name;
end;
$$;

grant execute on function public.preview_leave_rollover(integer) to authenticated;


notify pgrst, 'reload schema';
