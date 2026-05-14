-- ============================================================================
-- Migration 033 -- Duplicate-employee detector
--
-- find_duplicate_employees() scans the caller's company for employees
-- that share a "match key" -- one of:
--   national_id   (14 Egyptian digits, the strongest signal)
--   employee_code (ZKTeco code, strong)
--   email         (email collision)
--   phone         (phone collision -- often the source of accidental dups
--                  when HR re-imports a roster without dedup)
--
-- Returns one row per (group_id, employee) pair, so the UI can render
-- a group of N employees as a card with N rows. Each group_id is
-- formed as 'match_type:match_value' so the UI can colour-code the
-- match type and sort groups deterministically.
--
-- Confidence ranking (UI uses this to suggest auto-deletion):
--   national_id   -> 'high'    (auto-suggest keep oldest, delete rest)
--   employee_code -> 'high'    (ZKTeco code uniqueness is reliable)
--   email         -> 'medium'  (someone might share a family email)
--   phone         -> 'medium'  (multiple people on one line is possible)
--
-- The function does NOT delete anything -- that's the server action's job
-- once HR confirms.
-- ============================================================================

create or replace function public.find_duplicate_employees()
returns table (
  group_id        text,
  match_type      text,
  match_value     text,
  confidence      text,
  employee_id     uuid,
  full_name       text,
  employee_code   text,
  national_id     text,
  email           text,
  phone           text,
  hire_date       date,
  created_at      timestamptz,
  has_user        boolean,
  status          text
)
language sql
stable
security definer
set search_path = public
as $$
  -- National-ID collisions
  select
    'national_id:' || e.national_id as group_id,
    'national_id'::text,
    e.national_id as match_value,
    'high'::text as confidence,
    e.id, e.full_name, e.employee_code, e.national_id,
    e.email, e.phone, e.hire_date, e.created_at,
    e.user_id is not null,
    e.status
  from public.employees e
  where e.company_id = public.current_company_id()
    and e.national_id is not null
    and e.national_id <> ''
    and exists (
      select 1 from public.employees e2
      where e2.company_id = e.company_id
        and e2.national_id = e.national_id
        and e2.id <> e.id
    )

  union all

  -- Employee-code collisions (ZKTeco mapping must be unique per company)
  select
    'employee_code:' || e.employee_code,
    'employee_code',
    e.employee_code,
    'high',
    e.id, e.full_name, e.employee_code, e.national_id,
    e.email, e.phone, e.hire_date, e.created_at,
    e.user_id is not null,
    e.status
  from public.employees e
  where e.company_id = public.current_company_id()
    and e.employee_code is not null
    and trim(e.employee_code) <> ''
    and exists (
      select 1 from public.employees e2
      where e2.company_id = e.company_id
        and e2.employee_code = e.employee_code
        and e2.id <> e.id
    )

  union all

  -- Email collisions
  select
    'email:' || lower(e.email),
    'email',
    e.email,
    'medium',
    e.id, e.full_name, e.employee_code, e.national_id,
    e.email, e.phone, e.hire_date, e.created_at,
    e.user_id is not null,
    e.status
  from public.employees e
  where e.company_id = public.current_company_id()
    and e.email is not null
    and trim(e.email) <> ''
    and exists (
      select 1 from public.employees e2
      where e2.company_id = e.company_id
        and lower(e2.email) = lower(e.email)
        and e2.id <> e.id
    )

  union all

  -- Phone collisions
  select
    'phone:' || regexp_replace(e.phone, '[^0-9]', '', 'g'),
    'phone',
    e.phone,
    'medium',
    e.id, e.full_name, e.employee_code, e.national_id,
    e.email, e.phone, e.hire_date, e.created_at,
    e.user_id is not null,
    e.status
  from public.employees e
  where e.company_id = public.current_company_id()
    and e.phone is not null
    and length(regexp_replace(e.phone, '[^0-9]', '', 'g')) >= 7
    and exists (
      select 1 from public.employees e2
      where e2.company_id = e.company_id
        and regexp_replace(e2.phone, '[^0-9]', '', 'g') = regexp_replace(e.phone, '[^0-9]', '', 'g')
        and e2.id <> e.id
    )

  order by group_id, created_at;
$$;

grant execute on function public.find_duplicate_employees() to authenticated;


-- Lightweight count for the banner on /dashboard/employees -- if zero,
-- the banner doesn't render. Faster than calling find_duplicate_employees
-- and counting groups in JS because PG can short-circuit on the first
-- collision per type.
create or replace function public.count_duplicate_employee_groups()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct group_id)::int
  from public.find_duplicate_employees();
$$;

grant execute on function public.count_duplicate_employee_groups() to authenticated;


notify pgrst, 'reload schema';
