-- ============================================================================
-- Migration 020 -- Fix the 'column reference "geofence_enabled" is ambiguous'
-- error in mobile_clock_in / mobile_clock_out.
--
-- Same class of bug as migration 016 (claim_employee_invitation): the
-- function returns a table whose OUT parameters share names with columns
-- on the source tables. When the body writes
--   `select geofence_enabled from public.companies`
-- PostgreSQL can't tell whether `geofence_enabled` refers to the OUT
-- parameter or the column and bails.
--
-- Fix: alias the source tables and fully qualify every column reference
-- in the body (c.geofence_enabled, a.check_in_at, etc.).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- mobile_clock_in
-- ----------------------------------------------------------------------------

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
  v_emp_id            uuid;
  v_company_id        uuid;
  v_office_lat        numeric;
  v_office_lng        numeric;
  v_office_radius     integer;
  v_geofence_enabled  boolean;
  v_distance          numeric;
  v_outside           boolean;
  v_today             date := current_date;
  v_row_id            uuid;
begin
  -- 1. Resolve the caller (aliased so e.user_id isn't ambiguous)
  select e.id, e.company_id
    into v_emp_id, v_company_id
  from public.employees e
  where e.user_id = auth.uid();

  if v_emp_id is null then
    raise exception 'حسابك مش متربط بأي موظف' using errcode = 'P0001';
  end if;

  -- 2. Read the company's geofence config (aliased -> qualified)
  select c.office_lat, c.office_lng, c.office_radius_meters, c.geofence_enabled
    into v_office_lat, v_office_lng, v_office_radius, v_geofence_enabled
  from public.companies c
  where c.id = v_company_id;

  -- 3. Distance via Haversine when an office location is set
  if v_office_lat is not null and v_office_lng is not null then
    v_distance := 6371000 * 2 * asin(sqrt(
      power(sin(radians(p_lat - v_office_lat) / 2), 2)
      + cos(radians(v_office_lat)) * cos(radians(p_lat))
        * power(sin(radians(p_lng - v_office_lng) / 2), 2)
    ));
    v_outside := v_distance > coalesce(v_office_radius, 100);
  else
    v_distance := null;
    v_outside  := null;
  end if;

  -- 4. Strict mode rejects an out-of-radius clock-in
  if coalesce(v_geofence_enabled, false) and v_outside then
    raise exception 'مش في مكان العمل (المسافة %m)', round(v_distance)
      using errcode = 'P0001';
  end if;

  -- 5. Upsert today's attendance row (aliased to avoid the same trap)
  insert into public.attendance as a (
    company_id, employee_id, date, status,
    check_in_at, check_in_lat, check_in_lng,
    check_in_distance_meters, check_in_outside_geofence,
    device_id, source
  )
  values (
    v_company_id, v_emp_id, v_today, 'present',
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
    source = case when a.source = 'manual' then 'mobile_app' else a.source end
  returning a.id into v_row_id;

  -- 6. Return -- alias every OUT parameter so the planner has no doubt.
  return query select
    v_row_id                          as attendance_id,
    v_distance                        as distance_meters,
    v_outside                         as outside_geofence,
    coalesce(v_geofence_enabled, false) as geofence_enabled;
end;
$$;

grant execute on function public.mobile_clock_in(numeric, numeric, text) to authenticated;


-- ----------------------------------------------------------------------------
-- mobile_clock_out
-- ----------------------------------------------------------------------------

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
  v_emp_id            uuid;
  v_company_id        uuid;
  v_office_lat        numeric;
  v_office_lng        numeric;
  v_office_radius     integer;
  v_distance          numeric;
  v_outside           boolean;
  v_today             date := current_date;
  v_row_id            uuid;
  v_check_in_at       timestamptz;
  v_hours             numeric;
begin
  select e.id, e.company_id
    into v_emp_id, v_company_id
  from public.employees e
  where e.user_id = auth.uid();

  if v_emp_id is null then
    raise exception 'حسابك مش متربط بأي موظف' using errcode = 'P0001';
  end if;

  select c.office_lat, c.office_lng, c.office_radius_meters
    into v_office_lat, v_office_lng, v_office_radius
  from public.companies c
  where c.id = v_company_id;

  if v_office_lat is not null and v_office_lng is not null then
    v_distance := 6371000 * 2 * asin(sqrt(
      power(sin(radians(p_lat - v_office_lat) / 2), 2)
      + cos(radians(v_office_lat)) * cos(radians(p_lat))
        * power(sin(radians(p_lng - v_office_lng) / 2), 2)
    ));
    v_outside := v_distance > coalesce(v_office_radius, 100);
  else
    v_distance := null;
    v_outside  := null;
  end if;

  -- Locate today's row -- must already exist (created by clock-in)
  select a.id, a.check_in_at
    into v_row_id, v_check_in_at
  from public.attendance a
  where a.employee_id = v_emp_id and a.date = v_today;

  if v_row_id is null then
    raise exception 'لازم تثبت حضور الأول' using errcode = 'P0001';
  end if;

  if v_check_in_at is not null then
    v_hours := round(extract(epoch from (now() - v_check_in_at)) / 3600.0, 2);
  end if;

  update public.attendance as a set
    check_out_at = now(),
    check_out_lat = p_lat,
    check_out_lng = p_lng,
    check_out_distance_meters = v_distance,
    check_out_outside_geofence = v_outside,
    device_id = coalesce(p_device_id, a.device_id),
    hours_worked = v_hours
  where a.id = v_row_id;

  return query select
    v_row_id   as attendance_id,
    v_distance as distance_meters,
    v_outside  as outside_geofence,
    v_hours    as hours_worked;
end;
$$;

grant execute on function public.mobile_clock_out(numeric, numeric, text) to authenticated;


-- ----------------------------------------------------------------------------
-- Refresh the PostgREST schema cache so newly-added functions (from
-- migration 018) become callable immediately instead of waiting for the
-- 5-15 second auto-reload. Harmless if PostgREST isn't listening.
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
