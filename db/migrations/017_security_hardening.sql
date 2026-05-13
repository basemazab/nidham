-- ============================================================================
-- Migration 017 -- Security hardening
--
-- Migrations 002-013 enabled RLS on every business table but the policies
-- were uniformly "any member of the tenant company can SELECT/INSERT/UPDATE/
-- DELETE everything in their company". That was fine when the only role
-- was 'admin', but now that 015 ships a mobile app with role='employee',
-- a mobile-linked employee can:
--   - SELECT every colleague's national_id, bank_account_number,
--     social_insurance_number, basic_salary
--   - SELECT every payroll entry's gross_salary / net_salary
--   - SELECT every team invitation token in plaintext
--   - INSERT / UPDATE / DELETE customers, contracts, jobs, applications
--   - approve and pay payroll periods
--   - move or disable the company geofence
-- ...all through the existing dashboard server actions, which currently
-- only check "is the user logged in" and rely on RLS for the rest.
--
-- This migration tightens RLS so:
--   1. employees -- HR (admin/manager) sees + manages all; an employee
--      sees only their own row (so the mobile app keeps working).
--   2. payroll_periods / payroll_entries -- HR-only manage; the
--      employees_view_own_* policies from 015 still let an employee see
--      their own payslip.
--   3. attendance -- HR-only manage; mobile clock-in/out goes through
--      the security-definer RPCs in 015 which bypass RLS anyway.
--   4. team_invitations -- HR-only SELECT (tokens are sensitive).
--   5. customers / interactions / contracts -- CRM is HR-only, full stop.
--   6. jobs / candidates / applications -- recruitment is HR-only. (The
--      public job board still works via the security-definer functions
--      in 013_public_jobs.sql.)
--
-- It also hardens claim_employee_invitation against an admin-downgrade
-- account-takeover: a logged-in user who already has a profile cannot
-- have their role/company silently rewritten by calling the RPC with
-- any leaked token. The on-conflict upsert is gone; the function now
-- refuses the call if the caller is already linked.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper -- "is the current user HR (admin or manager) in any company?"
--
-- Used as a guard inside every tightened policy below. We keep it
-- company-agnostic on purpose: the policies always pair it with
-- `company_id = current_company_id()`, so it can't leak across tenants.
-- ----------------------------------------------------------------------------
create or replace function public.is_hr()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'manager')
  )
$$;

grant execute on function public.is_hr() to authenticated;


-- ----------------------------------------------------------------------------
-- 2. employees -- HR sees all; employee sees own row
-- ----------------------------------------------------------------------------
drop policy if exists "view_employees_in_own_company"   on public.employees;
drop policy if exists "manage_employees_in_own_company" on public.employees;

create policy "hr_view_company_employees"
  on public.employees for select
  using (
    company_id = public.current_company_id() and public.is_hr()
  );

-- Lets an employee read their own row (full columns) so the mobile app
-- can show "my profile" / "my salary structure" without breaking RLS.
create policy "employee_view_own_employee_row"
  on public.employees for select
  using (user_id = auth.uid());

create policy "hr_manage_company_employees"
  on public.employees for all
  using (
    company_id = public.current_company_id() and public.is_hr()
  )
  with check (
    company_id = public.current_company_id() and public.is_hr()
  );


-- ----------------------------------------------------------------------------
-- 3. payroll_periods / payroll_entries -- HR manages; employee reads own
-- ----------------------------------------------------------------------------
drop policy if exists "view_payroll_periods_in_own_company"   on public.payroll_periods;
drop policy if exists "manage_payroll_periods_in_own_company" on public.payroll_periods;

create policy "hr_view_payroll_periods"
  on public.payroll_periods for select
  using (
    company_id = public.current_company_id() and public.is_hr()
  );
-- employees_view_payroll_periods_for_own_entries from 015 stays as-is.

create policy "hr_manage_payroll_periods"
  on public.payroll_periods for all
  using (
    company_id = public.current_company_id() and public.is_hr()
  )
  with check (
    company_id = public.current_company_id() and public.is_hr()
  );

drop policy if exists "view_payroll_entries_in_own_company"   on public.payroll_entries;
drop policy if exists "manage_payroll_entries_in_own_company" on public.payroll_entries;

create policy "hr_view_payroll_entries"
  on public.payroll_entries for select
  using (
    company_id = public.current_company_id() and public.is_hr()
  );
-- employees_view_own_payroll_entries from 015 stays as-is.

create policy "hr_manage_payroll_entries"
  on public.payroll_entries for all
  using (
    company_id = public.current_company_id() and public.is_hr()
  )
  with check (
    company_id = public.current_company_id() and public.is_hr()
  );


-- ----------------------------------------------------------------------------
-- 4. attendance -- HR manages; employees read own; mobile RPCs bypass anyway
-- ----------------------------------------------------------------------------
drop policy if exists "view_attendance_in_own_company"   on public.attendance;
drop policy if exists "manage_attendance_in_own_company" on public.attendance;

create policy "hr_view_attendance"
  on public.attendance for select
  using (
    company_id = public.current_company_id() and public.is_hr()
  );
-- employees_view_own_attendance from 015 stays as-is.

create policy "hr_manage_attendance"
  on public.attendance for all
  using (
    company_id = public.current_company_id() and public.is_hr()
  )
  with check (
    company_id = public.current_company_id() and public.is_hr()
  );


-- ----------------------------------------------------------------------------
-- 5. team_invitations -- HR-only SELECT + manage (tokens are secrets)
-- ----------------------------------------------------------------------------
drop policy if exists "view_invitations_in_own_company" on public.team_invitations;
drop policy if exists "admin_manage_invitations"        on public.team_invitations;

create policy "hr_view_invitations"
  on public.team_invitations for select
  using (
    company_id = public.current_company_id() and public.is_hr()
  );

create policy "hr_manage_invitations"
  on public.team_invitations for all
  using (
    company_id = public.current_company_id() and public.is_hr()
  )
  with check (
    company_id = public.current_company_id() and public.is_hr()
  );


-- ----------------------------------------------------------------------------
-- 6. customers / interactions / contracts -- CRM is HR-only
-- ----------------------------------------------------------------------------
drop policy if exists "view_customers_in_own_company"     on public.customers;
drop policy if exists "manage_customers_in_own_company"   on public.customers;
create policy "hr_view_customers"
  on public.customers for select
  using (company_id = public.current_company_id() and public.is_hr());
create policy "hr_manage_customers"
  on public.customers for all
  using (company_id = public.current_company_id() and public.is_hr())
  with check (company_id = public.current_company_id() and public.is_hr());

drop policy if exists "view_interactions_in_own_company"   on public.interactions;
drop policy if exists "manage_interactions_in_own_company" on public.interactions;
create policy "hr_view_interactions"
  on public.interactions for select
  using (company_id = public.current_company_id() and public.is_hr());
create policy "hr_manage_interactions"
  on public.interactions for all
  using (company_id = public.current_company_id() and public.is_hr())
  with check (company_id = public.current_company_id() and public.is_hr());

drop policy if exists "view_contracts_in_own_company"   on public.contracts;
drop policy if exists "manage_contracts_in_own_company" on public.contracts;
create policy "hr_view_contracts"
  on public.contracts for select
  using (company_id = public.current_company_id() and public.is_hr());
create policy "hr_manage_contracts"
  on public.contracts for all
  using (company_id = public.current_company_id() and public.is_hr())
  with check (company_id = public.current_company_id() and public.is_hr());


-- ----------------------------------------------------------------------------
-- 7. jobs / candidates / applications -- recruitment is HR-only
--    The public job board (anonymous "browse open positions" + "apply")
--    uses the security-definer functions in 013_public_jobs.sql, which
--    don't rely on these policies.
-- ----------------------------------------------------------------------------
drop policy if exists "jobs_tenant_select" on public.jobs;
drop policy if exists "jobs_tenant_insert" on public.jobs;
drop policy if exists "jobs_tenant_update" on public.jobs;
drop policy if exists "jobs_tenant_delete" on public.jobs;
create policy "hr_view_jobs"
  on public.jobs for select
  using (company_id = public.current_company_id() and public.is_hr());
create policy "hr_manage_jobs"
  on public.jobs for all
  using (company_id = public.current_company_id() and public.is_hr())
  with check (company_id = public.current_company_id() and public.is_hr());

drop policy if exists "candidates_tenant_select" on public.candidates;
drop policy if exists "candidates_tenant_insert" on public.candidates;
drop policy if exists "candidates_tenant_update" on public.candidates;
drop policy if exists "candidates_tenant_delete" on public.candidates;
create policy "hr_view_candidates"
  on public.candidates for select
  using (company_id = public.current_company_id() and public.is_hr());
create policy "hr_manage_candidates"
  on public.candidates for all
  using (company_id = public.current_company_id() and public.is_hr())
  with check (company_id = public.current_company_id() and public.is_hr());

drop policy if exists "applications_tenant_select" on public.applications;
drop policy if exists "applications_tenant_insert" on public.applications;
drop policy if exists "applications_tenant_update" on public.applications;
drop policy if exists "applications_tenant_delete" on public.applications;
create policy "hr_view_applications"
  on public.applications for select
  using (company_id = public.current_company_id() and public.is_hr());
create policy "hr_manage_applications"
  on public.applications for all
  using (company_id = public.current_company_id() and public.is_hr())
  with check (company_id = public.current_company_id() and public.is_hr());


-- ----------------------------------------------------------------------------
-- 8. claim_employee_invitation -- block admin downgrade / account takeover
--
-- Old behaviour: the function upserted (id) into public.profiles with
-- `on conflict (id) do update set company_id, full_name, role='employee'`.
-- An admin or manager who was tricked / phished into calling the RPC with
-- any leaked token had their profile silently rewritten:
--   - company switched to the leaker's
--   - role demoted to 'employee'
--   - full_name overwritten by the leaker's invitation row
-- A complete takeover of an HR account.
--
-- New behaviour: if the caller already has a profile in any company, refuse.
-- The mobile invitation flow is strictly for fresh accounts (signup just
-- happened seconds earlier; no profile row yet). Existing HR users use the
-- normal /login flow.
-- ----------------------------------------------------------------------------
drop function if exists public.claim_employee_invitation(uuid);

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
  v_id            uuid;
  v_company_id    uuid;
  v_full_name     text;
  v_user_id       uuid;
  v_created_at    timestamptz;
  v_existing      uuid;
begin
  if auth.uid() is null then
    raise exception 'لازم تكون مسجل دخول' using errcode = 'P0001';
  end if;

  -- Guard against the downgrade-via-leaked-token vector: existing
  -- profiles cannot be silently switched to another tenant or demoted.
  select id into v_existing from public.profiles where id = auth.uid();
  if v_existing is not null then
    raise exception 'حسابك مربوط بشركة بالفعل — استخدم تسجيل دخول عادي'
      using errcode = 'P0001';
  end if;

  -- Aliased select to keep every column ref unambiguous w.r.t. the OUT
  -- parameters (the original cause of migration 016).
  select e.id, e.company_id, e.full_name, e.user_id, e.invitation_token_created_at
    into v_id, v_company_id, v_full_name, v_user_id, v_created_at
  from public.employees e
  where e.invitation_token = p_token;

  if v_id is null then
    raise exception 'الكود مش صحيح' using errcode = 'P0001';
  end if;
  if v_user_id is not null then
    raise exception 'الكود اتستخدم قبل كده' using errcode = 'P0001';
  end if;
  if v_created_at < now() - interval '30 days' then
    raise exception 'الكود انتهت صلاحيته' using errcode = 'P0001';
  end if;

  update public.employees set
    user_id = auth.uid(),
    invitation_token = null,
    invitation_token_created_at = null
  where id = v_id;

  -- Plain INSERT: the guard above proved no profile row exists for this
  -- auth.uid(), so the previous on-conflict update path is gone.
  insert into public.profiles (id, company_id, full_name, role)
  values (auth.uid(), v_company_id, v_full_name, 'employee');

  return query
    select v_id as employee_id, v_company_id as company_id, v_full_name as full_name;
end;
$$;

grant execute on function public.claim_employee_invitation(uuid) to authenticated;
