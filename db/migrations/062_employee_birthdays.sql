-- ============================================================================
-- Migration 062 -- Birthday field on employees
--
-- Until now the employees table had hire_date (work anniversary) but no
-- date_of_birth. The /dashboard/celebrations page can't congratulate
-- birthdays without it, and HR who keep birthday cake budgets need it
-- per-employee. Nullable so existing rows don't break — HR fills it in
-- over time from /dashboard/employees/[id]/edit.
--
-- No CHECK constraint on the date itself — we let HR enter any plausible
-- value (some Egyptian employees have inaccurate IDs and "01/01" is a
-- common placeholder; rejecting it would just block data entry).
-- ============================================================================

alter table public.employees
  add column if not exists date_of_birth date;

comment on column public.employees.date_of_birth is
  'Employee birth date (optional). Drives /dashboard/celebrations birthday list.';

-- Index just for the celebrations query — we filter by month-day extracted
-- from this column. A partial index keeps it tiny for tenants who only
-- filled some employees.
create index if not exists idx_employees_dob_not_null
  on public.employees (date_of_birth)
  where date_of_birth is not null;

notify pgrst, 'reload schema';
