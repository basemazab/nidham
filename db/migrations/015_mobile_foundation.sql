-- ============================================================================
-- Migration 015 -- Mobile app foundation
--
-- Adds the database layer the Android + iPhone employee app will sit on top
-- of. Three threads land together:
--
--   1. Identity: each employee row can be linked to an auth.users account.
--      Once linked, the mobile app's signed-in user is identifiable as a
--      specific employee, which everything else keys off.
--
--   2. Geofence: companies gain office_lat/lng/radius + a flag for whether
--      a far check-in is rejected (strict) or just flagged (flexible).
--      attendance gets check_in/out timestamps, GPS coords, computed
--      distance, and a 'source' tag so HR can tell an HR-entered row
--      from a mobile clock-in.
--
--   3. Requests: three new tables (leave_requests, advance_requests,
--      permission_requests) -- each with the same approval lifecycle
--      (pending -> approved | rejected | cancelled). Employees write
--      their own pending rows; HR moves them through the workflow.
--
-- RLS: every new table + the new request tables enforce
--   (employee sees own rows) OR (HR in the same company sees all).
-- ============================================================================

-- 1. Identity link --------------------------------------------------------

alter table public.employees
  add column user_id uuid references auth.users(id) on delete set null,
  add column invitation_token uuid,
  add column invitation_token_created_at timestamptz;

-- One user can be exactly one employee in one company. Multiple
-- employee rows pointing at the same user would let RLS leak across
-- tenants, so enforce uniqueness when the link is set.
create unique index idx_employees_user_id_unique
  on public.employees(user_id) where user_id is not null;

create unique index idx_employees_invitation_token_unique
  on public.employees(invitation_token) where invitation_token is not null;


-- 2. Helper functions -----------------------------------------------------

-- Returns the employee.id linked to the current auth.uid(), or NULL
-- when the caller isn't an employee (e.g. HR-only accounts or anon).
create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.employees where user_id = auth.uid()
$$;

-- True when the current user is either:
--   - an admin/manager profile in the given company, or
--   - linked as an employee in the given company
-- Used inside RLS policies that want both HR and employees to access
-- the same row.
create or replace function public.has_access_to_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.profiles
      where id = auth.uid() and company_id = p_company_id
    )
    or
    exists (
      select 1 from public.employees
      where user_id = auth.uid() and company_id = p_company_id
    )
$$;


-- 3. Companies -- office geofence -----------------------------------------

alter table public.companies
  add column office_address       text,
  add column office_lat            numeric(10, 7),
  add column office_lng            numeric(10, 7),
  add column office_radius_meters  integer default 100 check (office_radius_meters between 10 and 5000),
  add column geofence_enabled      boolean default false;

-- Let an employee linked to this company read its row (for the office
-- coordinates). The existing tenant SELECT policy already covers HR.
create policy "employees_view_own_company"
  on public.companies for select
  using (
    exists (
      select 1 from public.employees
      where user_id = auth.uid() and company_id = companies.id
    )
  );


-- 4. Attendance -- mobile clock-in/out fields -----------------------------

alter table public.attendance
  add column check_in_at                timestamptz,
  add column check_in_lat                numeric(10, 7),
  add column check_in_lng                numeric(10, 7),
  add column check_in_distance_meters    numeric(8, 2),
  add column check_in_outside_geofence   boolean,
  add column check_out_at                timestamptz,
  add column check_out_lat               numeric(10, 7),
  add column check_out_lng               numeric(10, 7),
  add column check_out_distance_meters   numeric(8, 2),
  add column check_out_outside_geofence  boolean,
  add column device_id                   text,
  add column source                      text not null default 'manual'
                                         check (source in ('manual', 'import', 'mobile_app', 'zkteco'));

create index idx_attendance_source on public.attendance(source);

-- Add employee self-access on top of the existing tenant SELECT
create policy "employees_view_own_attendance"
  on public.attendance for select
  using (employee_id = public.current_employee_id());


-- 5. Payroll -- employee can view own ------------------------------------
-- The employee needs to see their own payslips inside the mobile app.

create policy "employees_view_own_payroll_entries"
  on public.payroll_entries for select
  using (employee_id = public.current_employee_id());

create policy "employees_view_payroll_periods_for_own_entries"
  on public.payroll_periods for select
  using (
    exists (
      select 1 from public.payroll_entries
      where period_id = payroll_periods.id
        and employee_id = public.current_employee_id()
    )
  );


-- 6. Leave requests -------------------------------------------------------

create table public.leave_requests (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,

  leave_type  text not null check (leave_type in (
                'annual',       -- اعتيادية
                'casual',       -- عارضة
                'sick',         -- مرضية
                'unpaid',       -- بدون أجر
                'maternity',    -- وضع
                'hajj',         -- حج
                'bereavement',  -- وفاة
                'other'
              )),

  start_date  date not null,
  end_date    date not null check (end_date >= start_date),
  days_count  numeric(4, 1) not null check (days_count > 0),

  reason      text,

  status      text not null default 'pending' check (status in (
                'pending', 'approved', 'rejected', 'cancelled'
              )),

  hr_notes    text,
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users(id) on delete set null,

  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create index idx_leave_requests_company  on public.leave_requests(company_id);
create index idx_leave_requests_employee on public.leave_requests(employee_id);
create index idx_leave_requests_status   on public.leave_requests(status);
create index idx_leave_requests_dates    on public.leave_requests(start_date, end_date);

create trigger leave_requests_set_updated_at
  before update on public.leave_requests
  for each row execute function public.tg_set_updated_at();


-- 7. Advance / loan requests ----------------------------------------------

create table public.advance_requests (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,

  amount      numeric(10, 2) not null check (amount > 0),
  installments integer not null default 1 check (installments between 1 and 24),
  reason      text,

  status      text not null default 'pending' check (status in (
                'pending', 'approved', 'rejected', 'cancelled', 'paid'
              )),

  hr_notes    text,
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users(id) on delete set null,
  paid_at      timestamptz,

  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create index idx_advance_requests_company  on public.advance_requests(company_id);
create index idx_advance_requests_employee on public.advance_requests(employee_id);
create index idx_advance_requests_status   on public.advance_requests(status);

create trigger advance_requests_set_updated_at
  before update on public.advance_requests
  for each row execute function public.tg_set_updated_at();


-- 8. Permission requests (late arrival / early leave / errand) ------------

create table public.permission_requests (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,

  permission_type text not null check (permission_type in (
                    'late_arrival',  -- تأخير
                    'early_leave',   -- مغادرة مبكرة
                    'errand',        -- مأمورية
                    'remote_day',    -- عمل عن بُعد
                    'other'
                  )),

  permission_date date not null,
  from_time   time,
  to_time     time,
  reason      text,

  status      text not null default 'pending' check (status in (
                'pending', 'approved', 'rejected', 'cancelled'
              )),

  hr_notes    text,
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users(id) on delete set null,

  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create index idx_permission_requests_company  on public.permission_requests(company_id);
create index idx_permission_requests_employee on public.permission_requests(employee_id);
create index idx_permission_requests_status   on public.permission_requests(status);
create index idx_permission_requests_date     on public.permission_requests(permission_date);

create trigger permission_requests_set_updated_at
  before update on public.permission_requests
  for each row execute function public.tg_set_updated_at();


-- 9. RLS on the three request tables -------------------------------------
-- Same shape on each: employee sees + creates + cancels their own
-- pending rows; HR (admin/manager) in the same tenant sees + manages
-- everything.

alter table public.leave_requests      enable row level security;
alter table public.advance_requests    enable row level security;
alter table public.permission_requests enable row level security;

-- ---- leave_requests ----
create policy "employee_view_own_leave"        on public.leave_requests for select
  using (employee_id = public.current_employee_id());
create policy "hr_view_company_leave"          on public.leave_requests for select
  using (company_id = public.current_company_id());

create policy "employee_create_own_leave"      on public.leave_requests for insert
  with check (
    employee_id = public.current_employee_id()
    and status = 'pending'
  );
create policy "hr_create_company_leave"        on public.leave_requests for insert
  with check (company_id = public.current_company_id());

create policy "employee_cancel_own_pending_leave" on public.leave_requests for update
  using (
    employee_id = public.current_employee_id()
    and status = 'pending'
  )
  with check (status in ('pending', 'cancelled'));
create policy "hr_update_company_leave"        on public.leave_requests for update
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "hr_delete_company_leave"        on public.leave_requests for delete
  using (company_id = public.current_company_id());


-- ---- advance_requests ----
create policy "employee_view_own_advance"      on public.advance_requests for select
  using (employee_id = public.current_employee_id());
create policy "hr_view_company_advance"        on public.advance_requests for select
  using (company_id = public.current_company_id());

create policy "employee_create_own_advance"    on public.advance_requests for insert
  with check (
    employee_id = public.current_employee_id()
    and status = 'pending'
  );
create policy "hr_create_company_advance"      on public.advance_requests for insert
  with check (company_id = public.current_company_id());

create policy "employee_cancel_own_pending_advance" on public.advance_requests for update
  using (
    employee_id = public.current_employee_id()
    and status = 'pending'
  )
  with check (status in ('pending', 'cancelled'));
create policy "hr_update_company_advance"      on public.advance_requests for update
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "hr_delete_company_advance"      on public.advance_requests for delete
  using (company_id = public.current_company_id());


-- ---- permission_requests ----
create policy "employee_view_own_permission"   on public.permission_requests for select
  using (employee_id = public.current_employee_id());
create policy "hr_view_company_permission"     on public.permission_requests for select
  using (company_id = public.current_company_id());

create policy "employee_create_own_permission" on public.permission_requests for insert
  with check (
    employee_id = public.current_employee_id()
    and status = 'pending'
  );
create policy "hr_create_company_permission"   on public.permission_requests for insert
  with check (company_id = public.current_company_id());

create policy "employee_cancel_own_pending_permission" on public.permission_requests for update
  using (
    employee_id = public.current_employee_id()
    and status = 'pending'
  )
  with check (status in ('pending', 'cancelled'));
create policy "hr_update_company_permission"   on public.permission_requests for update
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "hr_delete_company_permission"   on public.permission_requests for delete
  using (company_id = public.current_company_id());


-- 10. Mobile clock-in / clock-out RPC ------------------------------------
-- Wraps the geofence check + attendance upsert in one transaction so the
-- mobile app does a single round-trip instead of "query company, compute
-- distance, write attendance, hope nothing changed in between".
--
-- Returns the (possibly created/updated) attendance row id along with
-- the computed distance and whether it was inside the configured radius.

create or replace function public.mobile_clock_in(
  p_lat        numeric,
  p_lng        numeric,
  p_device_id  text default null
) returns table (
  attendance_id      uuid,
  distance_meters    numeric,
  outside_geofence   boolean,
  geofence_enabled   boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee record;
  v_company  record;
  v_distance numeric;
  v_outside  boolean;
  v_today    date := current_date;
  v_row_id   uuid;
begin
  -- 1. Resolve the caller
  select id, company_id into v_employee
  from public.employees
  where user_id = auth.uid();

  if v_employee.id is null then
    raise exception 'حسابك مش متربط بأي موظف' using errcode = 'P0001';
  end if;

  -- 2. Read the company's geofence config
  select office_lat, office_lng, office_radius_meters, geofence_enabled
    into v_company
  from public.companies
  where id = v_employee.company_id;

  -- 3. Compute the distance (Haversine, in metres) when an office
  --    location is set; otherwise treat distance as 0.
  if v_company.office_lat is not null and v_company.office_lng is not null then
    v_distance := 6371000 * 2 * asin(sqrt(
      power(sin(radians(p_lat - v_company.office_lat) / 2), 2)
      + cos(radians(v_company.office_lat)) * cos(radians(p_lat))
        * power(sin(radians(p_lng - v_company.office_lng) / 2), 2)
    ));
    v_outside := v_distance > coalesce(v_company.office_radius_meters, 100);
  else
    v_distance := null;
    v_outside  := null;
  end if;

  -- 4. Strict mode: reject when outside the radius
  if v_company.geofence_enabled and v_outside then
    raise exception 'مش في مكان العمل (المسافة %m)', round(v_distance)
      using errcode = 'P0001';
  end if;

  -- 5. Upsert today's attendance row
  insert into public.attendance (
    company_id, employee_id, date, status,
    check_in_at, check_in_lat, check_in_lng,
    check_in_distance_meters, check_in_outside_geofence,
    device_id, source
  )
  values (
    v_employee.company_id, v_employee.id, v_today, 'present',
    now(), p_lat, p_lng,
    v_distance, v_outside,
    p_device_id, 'mobile_app'
  )
  on conflict (employee_id, date) do update set
    status = 'present',
    check_in_at = excluded.check_in_at,
    check_in_lat = excluded.check_in_lat,
    check_in_lng = excluded.check_in_lng,
    check_in_distance_meters = excluded.check_in_distance_meters,
    check_in_outside_geofence = excluded.check_in_outside_geofence,
    device_id = excluded.device_id,
    source = case when public.attendance.source = 'manual'
                  then 'mobile_app' else public.attendance.source end
  returning id into v_row_id;

  return query select v_row_id, v_distance, v_outside, coalesce(v_company.geofence_enabled, false);
end;
$$;

grant execute on function public.mobile_clock_in(numeric, numeric, text) to authenticated;


create or replace function public.mobile_clock_out(
  p_lat       numeric,
  p_lng       numeric,
  p_device_id text default null
) returns table (
  attendance_id    uuid,
  distance_meters  numeric,
  outside_geofence boolean,
  hours_worked     numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee record;
  v_company  record;
  v_distance numeric;
  v_outside  boolean;
  v_today    date := current_date;
  v_row      record;
  v_hours    numeric;
begin
  select id, company_id into v_employee from public.employees where user_id = auth.uid();
  if v_employee.id is null then
    raise exception 'حسابك مش متربط بأي موظف' using errcode = 'P0001';
  end if;

  select office_lat, office_lng, office_radius_meters, geofence_enabled into v_company
  from public.companies where id = v_employee.company_id;

  if v_company.office_lat is not null and v_company.office_lng is not null then
    v_distance := 6371000 * 2 * asin(sqrt(
      power(sin(radians(p_lat - v_company.office_lat) / 2), 2)
      + cos(radians(v_company.office_lat)) * cos(radians(p_lat))
        * power(sin(radians(p_lng - v_company.office_lng) / 2), 2)
    ));
    v_outside := v_distance > coalesce(v_company.office_radius_meters, 100);
  else
    v_distance := null;
    v_outside  := null;
  end if;

  -- Find today's row -- must already exist (clock-in created it)
  select id, check_in_at into v_row
  from public.attendance
  where employee_id = v_employee.id and date = v_today;

  if v_row.id is null then
    raise exception 'لازم تثبت حضور الأول' using errcode = 'P0001';
  end if;

  if v_row.check_in_at is not null then
    v_hours := round(extract(epoch from (now() - v_row.check_in_at)) / 3600.0, 2);
  end if;

  update public.attendance set
    check_out_at = now(),
    check_out_lat = p_lat,
    check_out_lng = p_lng,
    check_out_distance_meters = v_distance,
    check_out_outside_geofence = v_outside,
    device_id = coalesce(p_device_id, public.attendance.device_id),
    hours_worked = v_hours
  where id = v_row.id;

  return query select v_row.id, v_distance, v_outside, v_hours;
end;
$$;

grant execute on function public.mobile_clock_out(numeric, numeric, text) to authenticated;


-- 11. Employee invitation flow -------------------------------------------
-- HR calls generate_employee_invitation(employee_id) -> uuid token. They
-- share the token with the employee (SMS / WhatsApp / paper). The mobile
-- app, after signup, calls claim_employee_invitation(token) which links
-- the new auth user to the employees row.

create or replace function public.generate_employee_invitation(p_employee_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid := gen_random_uuid();
begin
  -- Only HR in the same company can issue an invitation
  if not exists (
    select 1 from public.employees e
    join public.profiles p on p.company_id = e.company_id
    where e.id = p_employee_id
      and p.id = auth.uid()
      and p.role in ('admin', 'manager')
  ) then
    raise exception 'مش مسموح -- لازم تكون admin أو manager' using errcode = 'P0001';
  end if;

  update public.employees set
    invitation_token = v_token,
    invitation_token_created_at = now()
  where id = p_employee_id;

  return v_token;
end;
$$;

grant execute on function public.generate_employee_invitation(uuid) to authenticated;


create or replace function public.claim_employee_invitation(p_token uuid)
returns table (
  employee_id  uuid,
  company_id   uuid,
  full_name    text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee record;
begin
  if auth.uid() is null then
    raise exception 'لازم تكون مسجل دخول' using errcode = 'P0001';
  end if;

  -- Token must exist and be no older than 30 days
  select id, company_id, full_name, user_id, invitation_token_created_at
    into v_employee
  from public.employees
  where invitation_token = p_token;

  if v_employee.id is null then
    raise exception 'الكود مش صحيح' using errcode = 'P0001';
  end if;
  if v_employee.user_id is not null then
    raise exception 'الكود اتستخدم قبل كده' using errcode = 'P0001';
  end if;
  if v_employee.invitation_token_created_at < now() - interval '30 days' then
    raise exception 'الكود انتهت صلاحيته' using errcode = 'P0001';
  end if;

  update public.employees set
    user_id = auth.uid(),
    invitation_token = null,        -- single-use
    invitation_token_created_at = null
  where id = v_employee.id;

  -- Also create a profile row so the employee gets the right role
  insert into public.profiles (id, company_id, full_name, role)
  values (auth.uid(), v_employee.company_id, v_employee.full_name, 'employee')
  on conflict (id) do update set
    company_id = excluded.company_id,
    full_name = excluded.full_name,
    role = 'employee';

  return query select v_employee.id, v_employee.company_id, v_employee.full_name;
end;
$$;

grant execute on function public.claim_employee_invitation(uuid) to authenticated;
