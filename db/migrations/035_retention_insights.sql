-- ============================================================================
-- Migration 035 — Employee Retention Insights
--
-- The "killer feature" for SMBs: an HR brain that watches employees
-- and tells the owner WHEN a salary is overdue for a raise, WHO
-- deserves a spot bonus, and WHO is showing flight-risk signals —
-- before they hand in a resignation.
--
-- This migration creates three pieces of infrastructure:
--   1) salary_history    -- per-employee log of every basic_salary
--                           change (with old, new, change_date, reason)
--                           Seeded with the current salary @ hire_date
--                           for every existing employee, so the engine
--                           has a baseline.
--   2) employee_retention_insights -- generated recommendations.
--                           Stored so HR can review, dismiss, or
--                           "action" them (turn into a real raise /
--                           bonus) without re-running the analysis.
--   3) bumped trigger    -- catches future employees.basic_salary
--                           updates and appends a salary_history row
--                           automatically (so the engine stays in
--                           sync without the dashboard remembering
--                           to log changes manually).
--
-- The scoring engine itself lives in /lib/retention.ts so it's easy
-- to iterate without DB migrations.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. salary_history
-- ----------------------------------------------------------------------------
create table if not exists public.salary_history (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  employee_id         uuid not null references public.employees(id) on delete cascade,
  old_basic_salary    numeric(12,2),
  new_basic_salary    numeric(12,2) not null,
  change_date         date not null default current_date,
  reason              text,
  changed_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists idx_salary_history_employee_date
  on public.salary_history(employee_id, change_date desc);
create index if not exists idx_salary_history_company
  on public.salary_history(company_id);

-- One row per (employee, change_date) so re-seeding is idempotent and
-- a same-day correction overwrites instead of duplicating.
alter table public.salary_history
  drop constraint if exists salary_history_emp_date_unique;
alter table public.salary_history
  add constraint salary_history_emp_date_unique unique (employee_id, change_date);

alter table public.salary_history enable row level security;

drop policy if exists "salary_history_select_own_company" on public.salary_history;
create policy "salary_history_select_own_company"
  on public.salary_history for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "salary_history_modify_hr_only" on public.salary_history;
create policy "salary_history_modify_hr_only"
  on public.salary_history for all
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  )
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

-- Seed: for every existing employee, log the current salary @ hire_date
-- as the "starting" salary so the engine can compute monthsSinceLastRaise
-- relative to a real baseline. Idempotent via ON CONFLICT.
insert into public.salary_history
  (company_id, employee_id, new_basic_salary, change_date, reason)
select
  e.company_id,
  e.id,
  coalesce(e.basic_salary, 0),
  coalesce(e.hire_date, current_date),
  'الراتب الابتدائي عند التعيين (seed)'
from public.employees e
where e.hire_date is not null
on conflict (employee_id, change_date) do nothing;


-- ----------------------------------------------------------------------------
-- 2. employee_retention_insights
-- ----------------------------------------------------------------------------
create table if not exists public.employee_retention_insights (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  employee_id         uuid not null references public.employees(id) on delete cascade,
  -- One of: raise (مستحق زيادة), bonus (مستحق مكافأة),
  --         flight_risk (إنذار مغادرة), anniversary (ذكرى تعيين)
  insight_type        text not null check (
    insight_type in ('raise', 'bonus', 'flight_risk', 'anniversary')
  ),
  score               numeric(5,2) not null,         -- 0-100
  reasoning           text not null,                  -- bullet-point Arabic
  suggested_amount    numeric(12,2),                  -- for raise / bonus
  -- Free-form metadata snapshot so we can re-render the card without
  -- re-querying. Keys depend on insight_type:
  --   raise:        { tenureMonths, attendanceRate, monthsSinceLastRaise,
  --                   currentSalary, newSalary, raisePct }
  --   bonus:        { tenureMonths, attendanceRate, tardinessMinutes }
  --   flight_risk:  { attendanceRate, attendanceRateDelta, recentLeaveDays }
  --   anniversary:  { tenureYears, hireDate, daysUntil }
  metadata            jsonb default '{}'::jsonb,
  status              text not null default 'pending'
                      check (status in ('pending', 'actioned', 'dismissed')),
  actioned_at         timestamptz,
  actioned_by         uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists idx_retention_insights_company_status
  on public.employee_retention_insights(company_id, status, insight_type);
create index if not exists idx_retention_insights_employee
  on public.employee_retention_insights(employee_id);

-- Only one PENDING insight per (employee, type). When the engine
-- re-runs it deletes prior pending insights first, so this is just a
-- belt-and-braces guard against concurrent generates.
create unique index if not exists uniq_retention_pending_per_employee_type
  on public.employee_retention_insights(employee_id, insight_type)
  where status = 'pending';

alter table public.employee_retention_insights enable row level security;

drop policy if exists "retention_select_own_company"
  on public.employee_retention_insights;
create policy "retention_select_own_company"
  on public.employee_retention_insights for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "retention_modify_hr_only"
  on public.employee_retention_insights;
create policy "retention_modify_hr_only"
  on public.employee_retention_insights for all
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  )
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );


-- ----------------------------------------------------------------------------
-- 3. Trigger -- auto-log future salary changes
-- ----------------------------------------------------------------------------
-- When employees.basic_salary changes, append a salary_history row with
-- the old/new values. This means HR doesn't have to remember to log the
-- raise manually -- editing the employee form is enough.
create or replace function public.log_salary_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only log REAL changes (not no-op updates that touched other columns)
  if new.basic_salary is distinct from old.basic_salary then
    insert into public.salary_history
      (company_id, employee_id, old_basic_salary, new_basic_salary, change_date, reason, changed_by)
    values
      (new.company_id, new.id, old.basic_salary, new.basic_salary,
       current_date, 'تعديل من نموذج الموظف', auth.uid())
    on conflict (employee_id, change_date) do update
      set new_basic_salary = excluded.new_basic_salary,
          old_basic_salary = excluded.old_basic_salary,
          reason = excluded.reason,
          changed_by = excluded.changed_by;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_salary_change on public.employees;
create trigger trg_log_salary_change
  after update of basic_salary on public.employees
  for each row execute function public.log_salary_change();


-- ----------------------------------------------------------------------------
-- 4. count_pending_retention_insights -- banner counter for dashboard
-- ----------------------------------------------------------------------------
create or replace function public.count_pending_retention_insights()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.employee_retention_insights
  where company_id = public.current_company_id()
    and status = 'pending';
$$;

grant execute on function public.count_pending_retention_insights()
  to authenticated;


notify pgrst, 'reload schema';
