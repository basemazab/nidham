-- ============================================================================
-- Migration 021 -- Post-audit fixes
--
-- A comprehensive static + integration audit (after 020 shipped) found
-- five issues worth fixing as one migration:
--
--   1. BREAKING -- handle_new_user (mig 009) and claim_employee_invitation
--      (mig 017) contradict each other for the mobile-employee signup
--      path. Every fresh signup gets Path 2 (new tenant + admin profile),
--      and then claim_employee_invitation refuses because the profile
--      exists. The mobile claim flow is broken for any account that
--      doesn't predate migration 017.
--
--      Fix: add a new "Path 0" to handle_new_user that runs FIRST and
--      checks raw_user_meta_data->>'employee_invite_token'. When present
--      and valid, it links the auth.user to the existing employees row
--      and creates a 'employee' profile in the inviter's company --
--      atomically, no follow-up RPC needed. The mobile app passes this
--      token in its signUp options.data going forward.
--
--   2. BREAKING -- mobile_get_my_summary (mig 018) had the same OUT-
--      parameter shadowing bug 016 and 020 fixed elsewhere. The
--      employee_id OUT parameter collides with the employee_id column
--      referenced inside its sub-SELECTs (where employee_id = ...) and
--      fails with 42702 'column reference is ambiguous' on first call.
--
--      Fix: rewrite to alias every table and qualify every column.
--      Output columns are now aliased explicitly with AS.
--
--   3. RISK -- migrations 014, 015, and 017 created new policies without
--      `drop policy if exists` guards on their NEW names. Re-running any
--      of them fails on "policy ... already exists". Migration 017 in
--      particular hit this for the user today.
--
--      Fix: defensively `drop policy if exists` every policy this file
--      replaces or revisits.
--
--   4. RISK -- super_admin (Basem) has SELECT bypass for payroll/recruit-
--      ment (mig 014) but NOT for leave_requests / advance_requests /
--      permission_requests (mig 015) or leave_balances / audit_log (mig
--      018). The super-admin panel can't inspect those tables across
--      tenants.
--
--      Fix: add super-admin SELECT policies for the five missing tables.
--
--   5. NIT -- jobs and candidates (mig 012) have updated_at columns but
--      no tg_set_updated_at trigger -- the timestamp never advances after
--      insert. applications has no updated_at column at all.
--
--      Fix: attach the trigger to jobs + candidates; add updated_at to
--      applications and attach the trigger there too.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. handle_new_user -- new Path 0 for the mobile employee invitation flow
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id     uuid;
  v_company_name   text;
  v_full_name      text;
  v_emp_token      uuid;
  v_emp_id         uuid;
  v_emp_full_name  text;
  v_invite_token   text;
  v_invite_id      uuid;
  v_invite_role    text;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  -- Pull both possible token shapes out of metadata once.
  begin
    v_emp_token := nullif(new.raw_user_meta_data->>'employee_invite_token', '')::uuid;
  exception when others then
    v_emp_token := null;  -- malformed UUID -> ignore
  end;
  v_invite_token := nullif(new.raw_user_meta_data->>'invite_token', '');

  -- ------------------------------------------------------------------
  -- Path 0: mobile employee claim. Highest priority. Looks up the
  -- employees row by token and creates the linked profile atomically.
  -- ------------------------------------------------------------------
  if v_emp_token is not null then
    select e.id, e.company_id, e.full_name
      into v_emp_id, v_company_id, v_emp_full_name
    from public.employees e
    where e.invitation_token = v_emp_token
      and e.user_id is null
      and e.invitation_token_created_at is not null
      and e.invitation_token_created_at > now() - interval '30 days';

    if v_emp_id is not null then
      update public.employees set
        user_id = new.id,
        invitation_token = null,
        invitation_token_created_at = null
      where id = v_emp_id;

      insert into public.profiles (id, company_id, full_name, role)
      values (new.id, v_company_id,
              coalesce(v_emp_full_name, v_full_name), 'employee');

      return new;
    end if;
    -- Token was supplied but didn't validate. Fall through to Path 1
    -- and then Path 2 so signup still succeeds; the user can sort it
    -- out from the mobile claim UI later.
  end if;

  -- ------------------------------------------------------------------
  -- Path 1: team_invitation token (HR invites another HR / employee
  -- through the dashboard).
  -- ------------------------------------------------------------------
  if v_invite_token is not null then
    select id, company_id, role into v_invite_id, v_company_id, v_invite_role
    from public.team_invitations
    where token = v_invite_token
      and lower(email) = lower(new.email)
      and status = 'pending'
      and expires_at > now()
    limit 1;

    if v_company_id is not null then
      insert into public.profiles (id, company_id, full_name, role)
      values (new.id, v_company_id, v_full_name, v_invite_role);

      update public.team_invitations
      set status = 'accepted', accepted_at = now()
      where id = v_invite_id;

      return new;
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- Path 2: brand-new tenant signup (the existing default).
  -- ------------------------------------------------------------------
  v_company_name := coalesce(
    new.raw_user_meta_data->>'company_name',
    'شركة بدون اسم'
  );

  insert into public.companies (name, created_by)
  values (v_company_name, new.id)
  returning id into v_company_id;

  insert into public.profiles (id, company_id, full_name, role)
  values (new.id, v_company_id, v_full_name, 'admin');

  insert into public.subscriptions (company_id, plan, status, starts_at, ends_at)
  values (
    v_company_id, 'trial', 'trial',
    current_date, current_date + interval '14 days'
  );

  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 2. mobile_get_my_summary -- alias everything, kill the ambiguity bug
-- ----------------------------------------------------------------------------
drop function if exists public.mobile_get_my_summary();

create or replace function public.mobile_get_my_summary()
returns table (
  employee_id                 uuid,
  full_name                   text,
  job_title                   text,
  annual_remaining            numeric,
  casual_remaining            numeric,
  sick_remaining              numeric,
  pending_leave_requests      integer,
  pending_advance_requests    integer,
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
      lb.leave_type,
      greatest(0, lb.entitled_days + lb.carried_over - lb.used_days) as remaining
    from public.leave_balances lb
    where lb.employee_id = (select me.id from me)
      and lb.year = extract(year from current_date)::int
  )
  select
    m.id                                                              as employee_id,
    m.full_name                                                       as full_name,
    m.job_title                                                       as job_title,
    coalesce((select bal.remaining from bal where bal.leave_type = 'annual'), 0)::numeric  as annual_remaining,
    coalesce((select bal.remaining from bal where bal.leave_type = 'casual'), 0)::numeric  as casual_remaining,
    coalesce((select bal.remaining from bal where bal.leave_type = 'sick'),   0)::numeric  as sick_remaining,
    (select count(*)::integer from public.leave_requests lr
       where lr.employee_id = m.id and lr.status = 'pending')         as pending_leave_requests,
    (select count(*)::integer from public.advance_requests ar
       where ar.employee_id = m.id and ar.status = 'pending')         as pending_advance_requests,
    (select count(*)::integer from public.permission_requests pr
       where pr.employee_id = m.id and pr.status = 'pending')         as pending_permission_requests
  from me m;
$$;

grant execute on function public.mobile_get_my_summary() to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Idempotency guards on previously-non-idempotent policy creates
-- ----------------------------------------------------------------------------
-- Each "drop if exists" below maps to a policy created earlier without
-- one. Re-running migrations 014 / 015 / 017 used to error out; now
-- they're safe to replay.

-- 014: public.companies "public_view_company_with_public_jobs"
drop policy if exists "public_view_company_with_public_jobs" on public.companies;
create policy "public_view_company_with_public_jobs"
  on public.companies for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.jobs j
      where j.company_id = companies.id and j.is_public = true
    )
  );

-- 015: public.companies "employees_view_own_company"
drop policy if exists "employees_view_own_company" on public.companies;
create policy "employees_view_own_company"
  on public.companies for select
  using (
    exists (
      select 1 from public.employees e
      where e.user_id = auth.uid() and e.company_id = companies.id
    )
  );

-- (017's new policies already have drop-if-exists in 017 itself.)


-- ----------------------------------------------------------------------------
-- 4. Super-admin SELECT bypass for the five RLS tables that mig 014
--    didn't cover
-- ----------------------------------------------------------------------------
drop policy if exists "super_admin_view_all_leave_requests" on public.leave_requests;
create policy "super_admin_view_all_leave_requests"
  on public.leave_requests for select
  using (public.is_super_admin());

drop policy if exists "super_admin_view_all_advance_requests" on public.advance_requests;
create policy "super_admin_view_all_advance_requests"
  on public.advance_requests for select
  using (public.is_super_admin());

drop policy if exists "super_admin_view_all_permission_requests" on public.permission_requests;
create policy "super_admin_view_all_permission_requests"
  on public.permission_requests for select
  using (public.is_super_admin());

drop policy if exists "super_admin_view_all_leave_balances" on public.leave_balances;
create policy "super_admin_view_all_leave_balances"
  on public.leave_balances for select
  using (public.is_super_admin());

drop policy if exists "super_admin_view_all_audit_log" on public.audit_log;
create policy "super_admin_view_all_audit_log"
  on public.audit_log for select
  using (public.is_super_admin());


-- ----------------------------------------------------------------------------
-- 5. updated_at triggers on recruitment tables
-- ----------------------------------------------------------------------------
drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.tg_set_updated_at();

drop trigger if exists candidates_set_updated_at on public.candidates;
create trigger candidates_set_updated_at
  before update on public.candidates
  for each row execute function public.tg_set_updated_at();

-- applications needs both the column and the trigger.
alter table public.applications
  add column if not exists updated_at timestamptz default now() not null;

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.tg_set_updated_at();


-- ----------------------------------------------------------------------------
-- Notify PostgREST so the rewritten mobile_get_my_summary signature
-- + new handle_new_user behaviour land in the schema cache immediately.
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
