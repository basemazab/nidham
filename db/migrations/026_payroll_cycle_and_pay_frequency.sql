-- ============================================================================
-- Migration 026 -- Per-employee pay frequency + custom cycle windows
--
-- Real-world Egyptian SMBs run two payrolls in parallel:
--   - Office / monthly staff: paid once per month on a custom window
--     (the user's company runs 21st-of-previous-month → 20th-of-current-
--     month, not the calendar month).
--   - Production / daily-paid staff: paid weekly, typically Saturday
--     to Friday or Sunday to Saturday.
--
-- The Phase-1 payroll module assumed everyone is monthly with a
-- calendar-month cycle. This migration loosens both assumptions:
--
--   payroll_periods:
--     - new columns: frequency ('monthly'|'weekly'), start_date, end_date
--     - existing rows backfilled from (year, month) -> calendar month
--     - drop the (company_id, year, month) unique constraint (multiple
--       weekly periods land in the same month)
--     - new unique on (company_id, frequency, start_date)
--
--   employees:
--     - new column pay_frequency ('monthly'|'weekly'), default 'monthly'
--
--   companies:
--     - monthly_cycle_start_day (1-28, default 1): the day of month the
--       monthly cycle begins. User sets 21 to get 21st→20th cycles.
--     - weekly_cycle_start_dow (0-6, default 6=Saturday): the day of week
--       the weekly cycle begins.
--
--   Helper: compute_payroll_cycle_window(as_of_date, frequency, ...) ->
--     (start_date, end_date) for the cycle containing as_of_date.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. payroll_periods: frequency + explicit cycle window
-- ----------------------------------------------------------------------------
alter table public.payroll_periods
  add column if not exists frequency  text,
  add column if not exists start_date date,
  add column if not exists end_date   date;

-- Backfill: existing rows are all monthly with calendar-month windows.
update public.payroll_periods
   set frequency = coalesce(frequency, 'monthly'),
       start_date = coalesce(start_date, make_date(year, month, 1)),
       end_date   = coalesce(
         end_date,
         (make_date(year, month, 1) + interval '1 month' - interval '1 day')::date
       )
 where frequency is null
    or start_date is null
    or end_date   is null;

-- Lock the new columns down now that data is in place.
alter table public.payroll_periods
  alter column frequency  set not null,
  alter column start_date set not null,
  alter column end_date   set not null;

alter table public.payroll_periods
  add constraint payroll_periods_frequency_check
    check (frequency in ('monthly', 'weekly')) not valid;
alter table public.payroll_periods
  validate constraint payroll_periods_frequency_check;

alter table public.payroll_periods
  add constraint payroll_periods_end_after_start
    check (end_date >= start_date) not valid;
alter table public.payroll_periods
  validate constraint payroll_periods_end_after_start;

-- Drop the old (year, month) unique constraint -- it doesn't survive
-- multiple weekly periods inside one month. The constraint name is
-- whatever Postgres auto-generated; query the catalog for it.
do $$
declare
  v_name text;
begin
  for v_name in
    select conname
    from pg_constraint
    where conrelid = 'public.payroll_periods'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%year%month%'
  loop
    execute format('alter table public.payroll_periods drop constraint %I', v_name);
  end loop;
end $$;

-- New unique: one period per (tenant, frequency, start_date)
create unique index if not exists payroll_periods_unique_cycle
  on public.payroll_periods(company_id, frequency, start_date);


-- ----------------------------------------------------------------------------
-- 2. employees: per-employee pay frequency
-- ----------------------------------------------------------------------------
alter table public.employees
  add column if not exists pay_frequency text not null default 'monthly'
    check (pay_frequency in ('monthly', 'weekly'));

comment on column public.employees.pay_frequency is
  'How often this employee gets paid. Defaults to monthly. When generating a payroll period, only employees whose frequency matches the period are included.';


-- ----------------------------------------------------------------------------
-- 3. companies: payroll cycle configuration
-- ----------------------------------------------------------------------------
alter table public.companies
  add column if not exists monthly_cycle_start_day integer not null default 1
    check (monthly_cycle_start_day between 1 and 28),
  add column if not exists weekly_cycle_start_dow integer not null default 6
    check (weekly_cycle_start_dow between 0 and 6);

comment on column public.companies.monthly_cycle_start_day is
  'Day of the month the monthly payroll cycle begins. Default 1 (calendar month). Set to 21 for 21→20 cycles.';
comment on column public.companies.weekly_cycle_start_dow is
  'Day of the week the weekly payroll cycle begins. 0=Sunday, 1=Monday, ..., 6=Saturday. Default 6 (Saturday).';


-- ----------------------------------------------------------------------------
-- 4. Helper -- compute the cycle window containing a given date
--
-- compute_payroll_cycle_window(as_of_date, frequency, start_day, start_dow)
-- returns (start_date, end_date) for the cycle that contains as_of_date.
-- The third / fourth params default to NULL so callers can pass only
-- what's relevant for the frequency they care about; the function reads
-- the company's settings from current_company_id() if they're null.
-- ----------------------------------------------------------------------------
create or replace function public.compute_payroll_cycle_window(
  p_as_of_date date,
  p_frequency  text,
  p_start_day  integer default null,
  p_start_dow  integer default null
) returns table (cycle_start date, cycle_end date)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start_day integer;
  v_start_dow integer;
  v_year      integer;
  v_month     integer;
  v_day       integer;
  v_start     date;
  v_end       date;
  v_dow       integer;
begin
  -- Default config from the caller's company when not supplied.
  if p_start_day is null or p_start_dow is null then
    select
      coalesce(p_start_day, monthly_cycle_start_day),
      coalesce(p_start_dow, weekly_cycle_start_dow)
    into v_start_day, v_start_dow
    from public.companies
    where id = public.current_company_id();
  else
    v_start_day := p_start_day;
    v_start_dow := p_start_dow;
  end if;

  v_start_day := coalesce(v_start_day, 1);
  v_start_dow := coalesce(v_start_dow, 6);

  if p_frequency = 'monthly' then
    v_year  := extract(year  from p_as_of_date)::int;
    v_month := extract(month from p_as_of_date)::int;
    v_day   := extract(day   from p_as_of_date)::int;

    -- If today is on or after the cycle start day, the cycle began
    -- this month. Otherwise it began last month.
    if v_day >= v_start_day then
      v_start := make_date(v_year, v_month, v_start_day);
    else
      v_start := (make_date(v_year, v_month, v_start_day) - interval '1 month')::date;
    end if;
    -- Cycle covers a full month minus a day (21st → 20th of next month)
    v_end := (v_start + interval '1 month' - interval '1 day')::date;

  elsif p_frequency = 'weekly' then
    -- extract(dow) returns 0..6 with 0 = Sunday, matching v_start_dow.
    v_dow := extract(dow from p_as_of_date)::int;
    -- Walk backwards to the most recent v_start_dow (inclusive).
    v_start := (p_as_of_date - ((v_dow - v_start_dow + 7) % 7))::date;
    v_end   := (v_start + interval '6 days')::date;
  else
    return;  -- unknown frequency
  end if;

  return query select v_start, v_end;
end;
$$;

grant execute on function public.compute_payroll_cycle_window(date, text, integer, integer)
  to authenticated;


-- ----------------------------------------------------------------------------
-- 5. Suggest the NEXT cycle window (the one the user wants to generate)
--
-- Most-common case: HR opens "new payroll period" today and the system
-- proposes "the cycle that just ended" -- which is the most recent
-- closed cycle, ready to be paid. This helper finds it.
-- ----------------------------------------------------------------------------
create or replace function public.suggest_next_payroll_cycle(
  p_frequency text,
  p_as_of_date date default current_date
) returns table (cycle_start date, cycle_end date)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_curr_start date;
  v_curr_end   date;
  v_prev_start date;
  v_prev_end   date;
begin
  -- Get the cycle that contains today.
  select cs.cycle_start, cs.cycle_end
    into v_curr_start, v_curr_end
  from public.compute_payroll_cycle_window(p_as_of_date, p_frequency) cs
  limit 1;

  if v_curr_start is null then return; end if;

  -- "Just-ended" cycle = the one immediately before. End date is
  -- v_curr_start - 1; we recompute the start by stepping back.
  if p_frequency = 'monthly' then
    v_prev_end := (v_curr_start - interval '1 day')::date;
    v_prev_start := (v_curr_start - interval '1 month')::date;
  elsif p_frequency = 'weekly' then
    v_prev_end := (v_curr_start - interval '1 day')::date;
    v_prev_start := (v_curr_start - interval '7 days')::date;
  else
    return;
  end if;

  -- If today is past the end of the previous cycle, the user probably
  -- wants to run that one. If today is still inside the previous cycle
  -- (we just stepped back into it because as_of_date < start_day), the
  -- "current" cycle (v_curr_*) is actually the one to run.
  -- For monthly: when today >= start_day, the current cycle is open
  -- (not yet ended); we want the previous one.
  -- For weekly: same logic.

  if p_as_of_date > v_prev_end then
    -- Previous cycle has ended -- run that one
    return query select v_prev_start, v_prev_end;
  else
    -- We're sitting inside what compute_*_window already called "prev"
    -- (the cycle hasn't started for "this" period yet) -- run current
    return query select v_curr_start, v_curr_end;
  end if;
end;
$$;

grant execute on function public.suggest_next_payroll_cycle(text, date) to authenticated;


notify pgrst, 'reload schema';
