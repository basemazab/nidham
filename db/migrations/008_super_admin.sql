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

-- Seed: basemazab is super admin (looked up by email at migration time)
insert into public.super_admins (user_id)
select id from auth.users
where email in ('basemazab644@gmail.com', 'basemazab640@gmail.com')
on conflict (user_id) do nothing;
