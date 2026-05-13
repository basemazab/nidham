-- ============================================================================
-- Migration 008 — Super-Admin
-- The SaaS owner (Basem) needs to see ALL tenants and manage their billing.
-- RLS normally scopes to the caller's own company; super-admins get bypass
-- policies that let them see/update every company and subscription.
-- ============================================================================

create table public.super_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamp with time zone default now() not null
);

-- RLS on the table itself: users can only see their own row (so the layout
-- can check "am I a super admin?" without exposing the full admin list).
alter table public.super_admins enable row level security;

create policy "users_can_check_own_super_admin"
  on public.super_admins for select
  using (user_id = auth.uid());

-- Helper — is the current user a super admin?
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.super_admins where user_id = auth.uid()
  )
$$;

-- Bypass policies — super admins see and manage everything
create policy "super_admin_view_all_companies"
  on public.companies for select
  using (public.is_super_admin());

create policy "super_admin_view_all_profiles"
  on public.profiles for select
  using (public.is_super_admin());

create policy "super_admin_view_all_subscriptions"
  on public.subscriptions for select
  using (public.is_super_admin());

create policy "super_admin_update_subscriptions"
  on public.subscriptions for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Seed: basemazab (basemazab640@gmail.com) is the sole super admin of Nidham SaaS.
-- Looked up by email at migration time — the email must already be a signed-up user.
insert into public.super_admins (user_id)
select id from auth.users
where email = 'basemazab640@gmail.com'
on conflict (user_id) do nothing;
