-- ============================================================================
-- Migration 024 -- Shift definitions + rotation patterns
--
-- Foundation for 3-shift / continuous-rotation workforces typical of
-- Egyptian factories: production runs in 3 shifts (8-4, 4-12, 12-8)
-- with a 6-on / 1-off pattern that cycles employees through all three
-- shifts over a 21-day rotation. Admin staff sit on a fixed shift
-- (e.g. 8-6) without rotation.
--
-- Tables:
--   shifts            -- a single window with start/end times + hours
--   shift_rotations   -- a JSONB pattern of shift IDs (or null for
--                        OFF) covering one full cycle
--
-- Columns on employees:
--   shift_id            -- fixed assignment (admin staff)
--   rotation_id         -- pattern assignment (production workers)
--   rotation_anchor_date    -- reference date for position calc
--   rotation_anchor_position-- which slot in the cycle the employee
--                            was on at the anchor date
--
-- Helper function:
--   get_shift_for_employee_on_date(employee_id, date) returns the
--   shift the employee should be on for a given date -- handles both
--   fixed and rotating assignments. Returns NULL for OFF days.
--
-- Defaults seeded for every existing tenant: 3 production shifts + 1
-- admin shift + 1 standard 21-day rotation pattern. Tenants can edit
-- or delete them as needed.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. shifts
-- ----------------------------------------------------------------------------
create table if not exists public.shifts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  name            text not null,
  start_time      time not null,
  end_time        time not null,
  -- True when end_time is on the next calendar day (e.g. 00:00 from
  -- 16:00 means a 4pm-midnight shift, while 08:00 from 00:00 means an
  -- overnight 12-8 shift). The client + RPC use this to know that
  -- adding 8 hours to start_time should wrap past midnight.
  is_overnight    boolean not null default false,
  expected_hours  numeric(4, 2) not null check (expected_hours between 0 and 24),
  color           text not null default 'cyan'
                  check (color in (
                    'cyan', 'emerald', 'amber', 'red',
                    'purple', 'slate', 'gold', 'rose'
                  )),
  is_active       boolean not null default true,
  notes           text,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

create index if not exists idx_shifts_company on public.shifts(company_id);
create index if not exists idx_shifts_active  on public.shifts(company_id, is_active);

drop trigger if exists shifts_set_updated_at on public.shifts;
create trigger shifts_set_updated_at
  before update on public.shifts
  for each row execute function public.tg_set_updated_at();

alter table public.shifts enable row level security;

drop policy if exists "hr_view_shifts"   on public.shifts;
drop policy if exists "hr_manage_shifts" on public.shifts;
create policy "hr_view_shifts"
  on public.shifts for select
  using (company_id = public.current_company_id());
create policy "hr_manage_shifts"
  on public.shifts for all
  using (company_id = public.current_company_id() and public.is_hr())
  with check (company_id = public.current_company_id() and public.is_hr());


-- ----------------------------------------------------------------------------
-- 2. shift_rotations
-- ----------------------------------------------------------------------------
create table if not exists public.shift_rotations (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  name          text not null,
  cycle_days    integer not null check (cycle_days between 2 and 365),
  -- JSONB array of shift_ids (string uuid) or null (for OFF days).
  -- Length MUST equal cycle_days; validated client-side on save.
  -- Example for 3-shift × 6-on-1-off (21 days):
  --   [s_A, s_A, s_A, s_A, s_A, s_A, null, s_B, s_B, ..., null]
  pattern       jsonb not null,
  description   text,
  is_active     boolean not null default true,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);

create index if not exists idx_rotations_company on public.shift_rotations(company_id);

drop trigger if exists rotations_set_updated_at on public.shift_rotations;
create trigger rotations_set_updated_at
  before update on public.shift_rotations
  for each row execute function public.tg_set_updated_at();

alter table public.shift_rotations enable row level security;

drop policy if exists "hr_view_rotations"   on public.shift_rotations;
drop policy if exists "hr_manage_rotations" on public.shift_rotations;
create policy "hr_view_rotations"
  on public.shift_rotations for select
  using (company_id = public.current_company_id());
create policy "hr_manage_rotations"
  on public.shift_rotations for all
  using (company_id = public.current_company_id() and public.is_hr())
  with check (company_id = public.current_company_id() and public.is_hr());


-- ----------------------------------------------------------------------------
-- 3. employees -- shift / rotation assignment columns
-- ----------------------------------------------------------------------------
alter table public.employees
  add column if not exists shift_id                  uuid references public.shifts(id) on delete set null,
  add column if not exists rotation_id               uuid references public.shift_rotations(id) on delete set null,
  add column if not exists rotation_anchor_date      date,
  add column if not exists rotation_anchor_position  integer default 0
                                                     check (rotation_anchor_position >= 0);

comment on column public.employees.shift_id is
  'For employees on a fixed schedule (admin / office). Mutually exclusive with rotation_id.';
comment on column public.employees.rotation_id is
  'For employees in a rotating shift pattern (production). Mutually exclusive with shift_id.';
comment on column public.employees.rotation_anchor_date is
  'Reference date. On this date the employee was at rotation_anchor_position in the cycle.';
comment on column public.employees.rotation_anchor_position is
  'Zero-based index into the rotation.pattern array at rotation_anchor_date.';


-- ----------------------------------------------------------------------------
-- 4. Helper -- shift for a given (employee, date)
--
-- Returns the shift.id the employee should be on for that date, or
-- NULL when the date falls on an OFF day OR the employee has no
-- assignment at all. Used by mobile clock-in (later phase) + the HR
-- "today's roster" view + the overtime calculator (later phase).
-- ----------------------------------------------------------------------------
create or replace function public.get_shift_for_employee_on_date(
  p_employee_id uuid,
  p_date        date
) returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shift_id         uuid;
  v_rotation_id      uuid;
  v_anchor_date      date;
  v_anchor_position  integer;
  v_cycle_days       integer;
  v_pattern          jsonb;
  v_days_since       integer;
  v_position         integer;
  v_slot             text;
begin
  select e.shift_id, e.rotation_id, e.rotation_anchor_date, e.rotation_anchor_position
    into v_shift_id, v_rotation_id, v_anchor_date, v_anchor_position
  from public.employees e
  where e.id = p_employee_id;

  -- Fixed schedule -- return the single shift directly.
  if v_rotation_id is null then
    return v_shift_id;
  end if;

  -- Rotation -- compute position in the cycle.
  select sr.cycle_days, sr.pattern
    into v_cycle_days, v_pattern
  from public.shift_rotations sr
  where sr.id = v_rotation_id;

  if v_cycle_days is null or v_anchor_date is null then
    return null;
  end if;

  v_days_since := p_date - v_anchor_date;
  v_position := (coalesce(v_anchor_position, 0) + v_days_since) % v_cycle_days;
  if v_position < 0 then
    v_position := v_position + v_cycle_days;
  end if;

  -- pattern[v_position] is either a UUID string (shift_id) or null (OFF).
  v_slot := v_pattern->>v_position;
  if v_slot is null or v_slot = '' then
    return null;
  end if;

  return v_slot::uuid;
exception when others then
  -- Malformed pattern (invalid uuid string, etc) -- treat as OFF.
  return null;
end;
$$;

grant execute on function public.get_shift_for_employee_on_date(uuid, date) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. Helper -- "who's on which shift today" for HR roster
-- ----------------------------------------------------------------------------
create or replace function public.get_todays_roster()
returns table (
  employee_id   uuid,
  employee_name text,
  department    text,
  shift_id      uuid,
  shift_name    text,
  shift_start   time,
  shift_end     time,
  is_off        boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id as employee_id,
    e.full_name as employee_name,
    e.department,
    s.id as shift_id,
    s.name as shift_name,
    s.start_time as shift_start,
    s.end_time as shift_end,
    s.id is null as is_off
  from public.employees e
  left join public.shifts s
    on s.id = public.get_shift_for_employee_on_date(e.id, current_date)
  where e.company_id = public.current_company_id()
    and e.status = 'active'
  order by
    -- Employees with no shift assignment go to the bottom
    case when s.id is null then 1 else 0 end,
    s.start_time nulls last,
    e.full_name;
$$;

grant execute on function public.get_todays_roster() to authenticated;


-- ----------------------------------------------------------------------------
-- 6. Seed defaults for every existing tenant
--
-- We mint 4 standard shifts (Production A/B/C + Admin) + 1 standard
-- 21-day rotation pattern that cycles through A → B → C with 1 day
-- off after each 6-day stretch. Tenants can edit or delete these
-- from /dashboard/shifts.
-- ----------------------------------------------------------------------------
do $$
declare
  v_company record;
  v_shift_a uuid;
  v_shift_b uuid;
  v_shift_c uuid;
  v_shift_admin uuid;
  v_pattern jsonb;
begin
  for v_company in select id from public.companies loop
    -- Skip if this tenant already has shifts (re-running migration).
    if exists (select 1 from public.shifts where company_id = v_company.id) then
      continue;
    end if;

    insert into public.shifts (company_id, name, start_time, end_time, is_overnight, expected_hours, color)
    values (v_company.id, 'الوردية الأولى', '08:00', '16:00', false, 8, 'emerald')
    returning id into v_shift_a;

    insert into public.shifts (company_id, name, start_time, end_time, is_overnight, expected_hours, color)
    values (v_company.id, 'الوردية الثانية', '16:00', '00:00', true, 8, 'amber')
    returning id into v_shift_b;

    insert into public.shifts (company_id, name, start_time, end_time, is_overnight, expected_hours, color)
    values (v_company.id, 'الوردية الثالثة', '00:00', '08:00', true, 8, 'purple')
    returning id into v_shift_c;

    insert into public.shifts (company_id, name, start_time, end_time, is_overnight, expected_hours, color)
    values (v_company.id, 'دوام الإدارة', '08:00', '18:00', false, 10, 'cyan')
    returning id into v_shift_admin;

    -- Build the 21-day rotation: 6 × A → OFF → 6 × B → OFF → 6 × C → OFF
    v_pattern := jsonb_build_array(
      v_shift_a::text, v_shift_a::text, v_shift_a::text,
      v_shift_a::text, v_shift_a::text, v_shift_a::text,
      null,
      v_shift_b::text, v_shift_b::text, v_shift_b::text,
      v_shift_b::text, v_shift_b::text, v_shift_b::text,
      null,
      v_shift_c::text, v_shift_c::text, v_shift_c::text,
      v_shift_c::text, v_shift_c::text, v_shift_c::text,
      null
    );

    insert into public.shift_rotations
      (company_id, name, cycle_days, pattern, description)
    values (
      v_company.id,
      'تدوير 3 ورديات - عمال الإنتاج',
      21,
      v_pattern,
      'الموظف بيشتغل 6 أيام في وردية واحدة، ياخد يوم راحة، ثم ينتقل للوردية اللي بعدها. الدورة الكاملة 21 يوم.'
    );
  end loop;
end $$;


notify pgrst, 'reload schema';
