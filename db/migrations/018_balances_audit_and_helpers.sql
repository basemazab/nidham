-- ============================================================================
-- Migration 018 -- Leave balances, audit log, and helper RPCs for the mobile
--                  Phase-4 employee self-service screens.
--
-- Three threads land together:
--
--   1. leave_balances: per-employee, per-year, per-leave-type accounting.
--      Decremented automatically when an HR user approves a leave_request.
--      Egyptian Labor Law defaults:
--        - annual: 21 days / year (15 if hire_date < 1 year ago)
--        - casual: 6 days / year
--        - sick:   30 days / year (rough cap; the full 180-day statutory
--                  cap is rarely hit by white-collar employees and would
--                  pollute the UI)
--      Hajj / maternity / bereavement are tracked but not balance-gated.
--
--   2. audit_log: append-only history of every business mutation. Each
--      row records actor, table, row id, action (INSERT/UPDATE/DELETE),
--      before, after, and timestamp. Triggers attach to the high-value
--      tables only -- writing to audit_log is cheap but RLS scans on
--      every read are not. HR can query the company's audit history;
--      employees cannot read it.
--
--   3. Helper RPCs:
--        - mobile_create_leave_request(...)
--        - mobile_create_advance_request(...)
--        - mobile_create_permission_request(...)
--      These wrap the boilerplate of "resolve employee_id, validate,
--      insert" so the mobile app makes one round-trip per submission.
--      They also enforce business rules the RLS WITH-CHECK clauses
--      can't express (balance not exceeded, no overlap with an existing
--      approved leave, etc.).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. leave_balances
-- ----------------------------------------------------------------------------

create table if not exists public.leave_balances (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  employee_id   uuid not null references public.employees(id) on delete cascade,

  year          integer not null check (year between 2020 and 2099),
  leave_type    text not null check (leave_type in (
                  'annual', 'casual', 'sick'
                )),

  entitled_days  numeric(5, 1) not null check (entitled_days >= 0),
  used_days      numeric(5, 1) not null default 0 check (used_days >= 0),
  -- carried_over from previous year (allowed for annual, not for casual/sick)
  carried_over   numeric(5, 1) not null default 0 check (carried_over >= 0),

  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null,

  unique (employee_id, year, leave_type)
);

create index if not exists idx_leave_balances_company  on public.leave_balances(company_id);
create index if not exists idx_leave_balances_employee on public.leave_balances(employee_id, year);

drop trigger if exists leave_balances_set_updated_at on public.leave_balances;
create trigger leave_balances_set_updated_at
  before update on public.leave_balances
  for each row execute function public.tg_set_updated_at();

alter table public.leave_balances enable row level security;

drop policy if exists "employee_view_own_leave_balance" on public.leave_balances;
create policy "employee_view_own_leave_balance"
  on public.leave_balances for select
  using (employee_id = public.current_employee_id());

drop policy if exists "hr_view_leave_balances" on public.leave_balances;
create policy "hr_view_leave_balances"
  on public.leave_balances for select
  using (company_id = public.current_company_id() and public.is_hr());

drop policy if exists "hr_manage_leave_balances" on public.leave_balances;
create policy "hr_manage_leave_balances"
  on public.leave_balances for all
  using (company_id = public.current_company_id() and public.is_hr())
  with check (company_id = public.current_company_id() and public.is_hr());


-- Default entitlement for a fresh balance row. Egyptian Labor Law Art. 47.
create or replace function public.default_entitled_days(
  p_leave_type text,
  p_hire_date  date
) returns numeric
language sql
immutable
as $$
  select case
    when p_leave_type = 'annual' and p_hire_date is not null
      and p_hire_date > current_date - interval '1 year' then 15
    when p_leave_type = 'annual' then 21
    when p_leave_type = 'casual' then 6
    when p_leave_type = 'sick'   then 30
    else 0
  end::numeric
$$;


-- Seed balance rows for every existing employee for the current year.
-- Idempotent: ON CONFLICT does nothing, so re-running the migration is
-- safe.
insert into public.leave_balances (company_id, employee_id, year, leave_type, entitled_days)
select
  e.company_id,
  e.id,
  extract(year from current_date)::int,
  lt.leave_type,
  public.default_entitled_days(lt.leave_type, e.hire_date)
from public.employees e
cross join (values ('annual'), ('casual'), ('sick')) as lt(leave_type)
where e.status = 'active'
on conflict (employee_id, year, leave_type) do nothing;


-- Trigger: when a new employee is inserted, mint their balance rows
-- for the current year.
create or replace function public.tg_seed_leave_balances()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.leave_balances
    (company_id, employee_id, year, leave_type, entitled_days)
  values
    (new.company_id, new.id, extract(year from current_date)::int,
     'annual', public.default_entitled_days('annual', new.hire_date)),
    (new.company_id, new.id, extract(year from current_date)::int,
     'casual', public.default_entitled_days('casual', new.hire_date)),
    (new.company_id, new.id, extract(year from current_date)::int,
     'sick',   public.default_entitled_days('sick',   new.hire_date))
  on conflict (employee_id, year, leave_type) do nothing;
  return new;
end;
$$;

drop trigger if exists employees_seed_leave_balances on public.employees;
create trigger employees_seed_leave_balances
  after insert on public.employees
  for each row execute function public.tg_seed_leave_balances();


-- Trigger: when a leave_request is approved (transition pending -> approved),
-- decrement the matching balance's used_days. When un-approved (reversed,
-- which we don't currently support but might one day), restore.
create or replace function public.tg_leave_request_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer;
begin
  v_year := extract(year from new.start_date)::int;

  if tg_op = 'UPDATE'
     and old.status != 'approved'
     and new.status = 'approved'
     and new.leave_type in ('annual', 'casual', 'sick') then
    update public.leave_balances
       set used_days = used_days + new.days_count
     where employee_id = new.employee_id
       and year = v_year
       and leave_type = new.leave_type;
  end if;

  -- Approved -> rejected/cancelled: restore the days.
  if tg_op = 'UPDATE'
     and old.status = 'approved'
     and new.status in ('rejected', 'cancelled')
     and new.leave_type in ('annual', 'casual', 'sick') then
    update public.leave_balances
       set used_days = greatest(0, used_days - new.days_count)
     where employee_id = new.employee_id
       and year = v_year
       and leave_type = new.leave_type;
  end if;

  return new;
end;
$$;

drop trigger if exists leave_requests_balance_sync on public.leave_requests;
create trigger leave_requests_balance_sync
  after update on public.leave_requests
  for each row execute function public.tg_leave_request_balance();


-- ----------------------------------------------------------------------------
-- 2. audit_log
-- ----------------------------------------------------------------------------

create table if not exists public.audit_log (
  id            bigserial primary key,
  company_id    uuid not null,
  actor_id      uuid,   -- auth.users.id; null for system actions
  table_name    text not null,
  row_id        uuid,
  action        text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  before_data   jsonb,
  after_data    jsonb,
  created_at    timestamptz default now() not null
);

create index if not exists idx_audit_log_company   on public.audit_log(company_id, created_at desc);
create index if not exists idx_audit_log_table_row on public.audit_log(table_name, row_id);
create index if not exists idx_audit_log_actor     on public.audit_log(actor_id);

alter table public.audit_log enable row level security;

drop policy if exists "hr_view_audit_log" on public.audit_log;
create policy "hr_view_audit_log"
  on public.audit_log for select
  using (company_id = public.current_company_id() and public.is_hr());

-- No INSERT / UPDATE / DELETE policies: only the trigger function (SECURITY
-- DEFINER) writes to this table. Even an admin cannot INSERT directly.


-- Generic audit-write helper. Reads company_id from the row being audited
-- (every business table has a company_id column).
create or replace function public.tg_write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     jsonb;
  v_company uuid;
  v_row_id  uuid;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_company := (v_row->>'company_id')::uuid;
  v_row_id  := (v_row->>'id')::uuid;

  insert into public.audit_log
    (company_id, actor_id, table_name, row_id, action, before_data, after_data)
  values
    (
      v_company,
      auth.uid(),
      tg_table_name,
      v_row_id,
      tg_op,
      case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
      case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
    );

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;


-- Attach the trigger to high-value tables. Read-heavy tables (attendance,
-- interactions) are skipped to keep insert cost low; we can extend later.
drop trigger if exists audit_employees on public.employees;
create trigger audit_employees
  after insert or update or delete on public.employees
  for each row execute function public.tg_write_audit_log();

drop trigger if exists audit_payroll_periods on public.payroll_periods;
create trigger audit_payroll_periods
  after insert or update or delete on public.payroll_periods
  for each row execute function public.tg_write_audit_log();

drop trigger if exists audit_payroll_entries on public.payroll_entries;
create trigger audit_payroll_entries
  after insert or update or delete on public.payroll_entries
  for each row execute function public.tg_write_audit_log();

drop trigger if exists audit_leave_requests on public.leave_requests;
create trigger audit_leave_requests
  after insert or update or delete on public.leave_requests
  for each row execute function public.tg_write_audit_log();

drop trigger if exists audit_advance_requests on public.advance_requests;
create trigger audit_advance_requests
  after insert or update or delete on public.advance_requests
  for each row execute function public.tg_write_audit_log();

drop trigger if exists audit_permission_requests on public.permission_requests;
create trigger audit_permission_requests
  after insert or update or delete on public.permission_requests
  for each row execute function public.tg_write_audit_log();

drop trigger if exists audit_contracts on public.contracts;
create trigger audit_contracts
  after insert or update or delete on public.contracts
  for each row execute function public.tg_write_audit_log();

drop trigger if exists audit_team_invitations on public.team_invitations;
create trigger audit_team_invitations
  after insert or update or delete on public.team_invitations
  for each row execute function public.tg_write_audit_log();


-- ----------------------------------------------------------------------------
-- 3. mobile_create_leave_request
--    Wraps validation + insert in one round-trip.
-- ----------------------------------------------------------------------------

create or replace function public.mobile_create_leave_request(
  p_leave_type  text,
  p_start_date  date,
  p_end_date    date,
  p_reason      text default null
) returns table (
  request_id   uuid,
  days_count   numeric,
  remaining_balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_company_id  uuid;
  v_days        numeric;
  v_year        integer;
  v_remaining   numeric;
  v_existing    boolean;
  v_request_id  uuid;
begin
  -- Resolve caller
  select e.id, e.company_id into v_employee_id, v_company_id
  from public.employees e where e.user_id = auth.uid();

  if v_employee_id is null then
    raise exception 'حسابك مش متربط بأي موظف' using errcode = 'P0001';
  end if;

  -- Validate dates
  if p_start_date is null or p_end_date is null then
    raise exception 'لازم تحدد تاريخ البداية والنهاية' using errcode = 'P0001';
  end if;
  if p_end_date < p_start_date then
    raise exception 'تاريخ النهاية لازم بعد تاريخ البداية' using errcode = 'P0001';
  end if;
  if p_start_date < current_date - interval '7 days' then
    raise exception 'مينفعش تطلب إجازة عن فترة قديمة أكتر من أسبوع' using errcode = 'P0001';
  end if;

  v_days := (p_end_date - p_start_date) + 1;
  v_year := extract(year from p_start_date)::int;

  -- Validate type
  if p_leave_type not in ('annual','casual','sick','unpaid','maternity','hajj','bereavement','other') then
    raise exception 'نوع الإجازة مش معروف' using errcode = 'P0001';
  end if;

  -- For balance-gated types, check sufficient balance
  if p_leave_type in ('annual','casual','sick') then
    select greatest(0, entitled_days + carried_over - used_days)
      into v_remaining
    from public.leave_balances
    where employee_id = v_employee_id
      and year = v_year
      and leave_type = p_leave_type;

    if v_remaining is null then
      raise exception 'مفيش رصيد إجازات مسجّل للسنة دي -- كلّم HR' using errcode = 'P0001';
    end if;
    if v_remaining < v_days then
      raise exception 'الرصيد غير كافٍ -- متبقي % يوم بس', round(v_remaining, 1) using errcode = 'P0001';
    end if;
  end if;

  -- Check for overlap with existing pending/approved requests
  select exists (
    select 1 from public.leave_requests
    where employee_id = v_employee_id
      and status in ('pending', 'approved')
      and not (end_date < p_start_date or start_date > p_end_date)
  ) into v_existing;

  if v_existing then
    raise exception 'في طلب إجازة تاني في نفس الفترة' using errcode = 'P0001';
  end if;

  -- Insert
  insert into public.leave_requests
    (company_id, employee_id, leave_type, start_date, end_date, days_count, reason, status)
  values
    (v_company_id, v_employee_id, p_leave_type, p_start_date, p_end_date, v_days, p_reason, 'pending')
  returning id into v_request_id;

  return query select v_request_id, v_days, coalesce(v_remaining - v_days, 0::numeric);
end;
$$;

grant execute on function public.mobile_create_leave_request(text, date, date, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 4. mobile_create_advance_request
-- ----------------------------------------------------------------------------

create or replace function public.mobile_create_advance_request(
  p_amount       numeric,
  p_installments integer,
  p_reason       text default null
) returns table (request_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_company_id  uuid;
  v_basic       numeric;
  v_request_id  uuid;
begin
  select e.id, e.company_id, coalesce(e.basic_salary, 0)
    into v_employee_id, v_company_id, v_basic
  from public.employees e where e.user_id = auth.uid();

  if v_employee_id is null then
    raise exception 'حسابك مش متربط بأي موظف' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'المبلغ لازم يكون أكبر من صفر' using errcode = 'P0001';
  end if;
  if p_installments is null or p_installments < 1 or p_installments > 24 then
    raise exception 'عدد الأقساط لازم بين 1 و 24' using errcode = 'P0001';
  end if;

  -- Cap: an open advance request must not exceed 3x the basic salary.
  -- (Internal policy -- adjust per company later if needed.)
  if v_basic > 0 and p_amount > v_basic * 3 then
    raise exception 'المبلغ كبير -- الحد الأقصى 3 أضعاف المرتب الأساسي' using errcode = 'P0001';
  end if;

  insert into public.advance_requests
    (company_id, employee_id, amount, installments, reason, status)
  values
    (v_company_id, v_employee_id, p_amount, p_installments, p_reason, 'pending')
  returning id into v_request_id;

  return query select v_request_id;
end;
$$;

grant execute on function public.mobile_create_advance_request(numeric, integer, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. mobile_create_permission_request
-- ----------------------------------------------------------------------------

create or replace function public.mobile_create_permission_request(
  p_permission_type text,
  p_permission_date date,
  p_from_time       time default null,
  p_to_time         time default null,
  p_reason          text default null
) returns table (request_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_company_id  uuid;
  v_request_id  uuid;
begin
  select e.id, e.company_id into v_employee_id, v_company_id
  from public.employees e where e.user_id = auth.uid();

  if v_employee_id is null then
    raise exception 'حسابك مش متربط بأي موظف' using errcode = 'P0001';
  end if;

  if p_permission_type not in ('late_arrival', 'early_leave', 'errand', 'remote_day', 'other') then
    raise exception 'نوع الاستئذان مش معروف' using errcode = 'P0001';
  end if;

  if p_permission_date is null then
    raise exception 'تاريخ الاستئذان مطلوب' using errcode = 'P0001';
  end if;

  if p_from_time is not null and p_to_time is not null and p_to_time <= p_from_time then
    raise exception 'وقت النهاية لازم بعد وقت البداية' using errcode = 'P0001';
  end if;

  insert into public.permission_requests
    (company_id, employee_id, permission_type, permission_date, from_time, to_time, reason, status)
  values
    (v_company_id, v_employee_id, p_permission_type, p_permission_date, p_from_time, p_to_time, p_reason, 'pending')
  returning id into v_request_id;

  return query select v_request_id;
end;
$$;

grant execute on function public.mobile_create_permission_request(text, date, time, time, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 6. Helper: mobile_get_my_summary -- one round-trip dashboard data
--
-- Returns the employee's leave balances + counts of pending requests +
-- last attendance check-in. Used by the mobile home screen so it doesn't
-- need 4-5 separate queries to render.
-- ----------------------------------------------------------------------------

create or replace function public.mobile_get_my_summary()
returns table (
  employee_id                uuid,
  full_name                  text,
  job_title                  text,
  annual_remaining           numeric,
  casual_remaining           numeric,
  sick_remaining             numeric,
  pending_leave_requests     integer,
  pending_advance_requests   integer,
  pending_permission_requests integer
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select e.id, e.full_name, e.job_title
    from public.employees e
    where e.user_id = auth.uid()
  ),
  bal as (
    select
      leave_type,
      greatest(0, entitled_days + carried_over - used_days) as remaining
    from public.leave_balances
    where employee_id = (select id from me)
      and year = extract(year from current_date)::int
  )
  select
    m.id,
    m.full_name,
    m.job_title,
    coalesce((select remaining from bal where leave_type = 'annual'), 0)::numeric,
    coalesce((select remaining from bal where leave_type = 'casual'), 0)::numeric,
    coalesce((select remaining from bal where leave_type = 'sick'),   0)::numeric,
    (select count(*)::integer from public.leave_requests
       where employee_id = m.id and status = 'pending'),
    (select count(*)::integer from public.advance_requests
       where employee_id = m.id and status = 'pending'),
    (select count(*)::integer from public.permission_requests
       where employee_id = m.id and status = 'pending')
  from me m;
$$;

grant execute on function public.mobile_get_my_summary() to authenticated;
