-- ============================================================================
-- Migration 009 — Team Invitations (Multi-User)
-- Admins can invite team members to join their company. Each invitation is a
-- unique token that the recipient uses to sign up. The trigger checks for the
-- token and joins the user to the inviter's company instead of creating new.
-- ============================================================================

create table public.team_invitations (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  invited_by    uuid references auth.users(id) on delete set null,

  email         text not null,
  full_name     text,
  role          text not null check (role in ('admin', 'manager', 'employee')),

  token         text unique not null default encode(gen_random_bytes(24), 'hex'),
  status        text not null default 'pending'
                check (status in ('pending', 'accepted', 'expired', 'cancelled')),

  expires_at    timestamp with time zone default (now() + interval '7 days') not null,
  accepted_at   timestamp with time zone,
  created_at    timestamp with time zone default now() not null
);

create index idx_invitations_company on public.team_invitations(company_id);
create index idx_invitations_token   on public.team_invitations(token);
create index idx_invitations_email   on public.team_invitations(email);

alter table public.team_invitations enable row level security;

-- Members of a company can see their company's invitations
create policy "view_invitations_in_own_company"
  on public.team_invitations for select
  using (company_id = public.current_company_id());

-- Only admins can create/cancel invitations
create policy "admin_manage_invitations"
  on public.team_invitations for all
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Also allow ANYONE to read invitations by token (needed for the accept-invite
-- page where the user isn't logged in yet). Uses a SECURITY DEFINER function
-- to scope the lookup to a single token at a time.
create or replace function public.get_invitation_by_token(p_token text)
returns table (
  id uuid,
  company_id uuid,
  company_name text,
  email text,
  full_name text,
  role text,
  status text,
  expires_at timestamp with time zone
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id, i.company_id, c.name as company_name,
    i.email, i.full_name, i.role, i.status, i.expires_at
  from public.team_invitations i
  join public.companies c on c.id = i.company_id
  where i.token = p_token
  limit 1;
$$;

grant execute on function public.get_invitation_by_token(text) to anon, authenticated;

-- =========================================================================
-- Update handle_new_user trigger to handle invite tokens
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id   uuid;
  v_company_name text;
  v_full_name    text;
  v_invite_token text;
  v_invite_id    uuid;
  v_invite_role  text;
begin
  v_invite_token := new.raw_user_meta_data->>'invite_token';
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  -- Path 1: User is accepting an invitation
  if v_invite_token is not null then
    select id, company_id, role into v_invite_id, v_company_id, v_invite_role
    from public.team_invitations
    where token = v_invite_token
      and lower(email) = lower(new.email)
      and status = 'pending'
      and expires_at > now()
    limit 1;

    if v_company_id is not null then
      -- Join the inviting company with the invited role
      insert into public.profiles (id, company_id, full_name, role)
      values (new.id, v_company_id, v_full_name, v_invite_role);

      -- Mark invite as accepted
      update public.team_invitations
      set status = 'accepted', accepted_at = now()
      where id = v_invite_id;

      return new;
    end if;
  end if;

  -- Path 2: Brand-new tenant signup (existing flow)
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
    v_company_id,
    'trial',
    'trial',
    current_date,
    current_date + interval '14 days'
  );

  return new;
end;
$$;
