-- ============================================================================
-- Migration 016 -- Fix the 'column reference "company_id" is ambiguous' error
-- in claim_employee_invitation.
--
-- The function in 015 returns a table whose OUT parameters share names
-- with columns on public.employees (company_id, full_name). When the
-- function body wrote `SELECT id, company_id, full_name, ... FROM
-- public.employees`, PostgreSQL couldn't tell whether `company_id`
-- referred to the OUT parameter or the table column and bailed with
-- error code 42702.
--
-- Fix: alias the table and qualify every column ref in the body. While
-- here, also reshape generate_employee_invitation to use an aliased
-- table reference -- same potential issue.
-- ============================================================================

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
begin
  if auth.uid() is null then
    raise exception 'لازم تكون مسجل دخول' using errcode = 'P0001';
  end if;

  -- Aliased select into scalars (not a record) to keep every column
  -- reference unambiguous w.r.t. the function's OUT parameters.
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

  insert into public.profiles (id, company_id, full_name, role)
  values (auth.uid(), v_company_id, v_full_name, 'employee')
  on conflict (id) do update set
    company_id = excluded.company_id,
    full_name = excluded.full_name,
    role = 'employee';

  -- Explicit aliases on the SELECT so the return-table OUT parameters
  -- (employee_id, company_id, full_name) get populated unambiguously.
  return query select v_id as employee_id, v_company_id as company_id, v_full_name as full_name;
end;
$$;

grant execute on function public.claim_employee_invitation(uuid) to authenticated;


-- Same defensive aliasing for the invitation generator -- there's no
-- ambiguity today because it returns a scalar uuid, but the existing
-- SELECT bare-references e.company_id / e.id inside an EXISTS subquery
-- which is fine as is. No change needed there.
