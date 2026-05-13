-- ============================================================================
-- Migration 001 — Multi-tenancy foundation
-- Creates: companies, profiles, RLS policies, and signup trigger.
-- Run this once in Supabase SQL Editor.
-- ============================================================================

-- 1. Companies table — each tenant is one company
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  industry    text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamp with time zone default now() not null,
  updated_at  timestamp with time zone default now() not null
);

-- 2. Profiles table — 1:1 with auth.users; carries the company link & role
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  full_name   text,
  role        text not null default 'admin'
              check (role in ('admin','manager','employee')),
  created_at  timestamp with time zone default now() not null,
  updated_at  timestamp with time zone default now() not null
);

create index idx_profiles_company on public.profiles(company_id);

-- 3. Enable Row Level Security on both
alter table public.companies enable row level security;
alter table public.profiles  enable row level security;

-- 4. Helper — resolves current user's company_id (used in every RLS policy)
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

-- 5. RLS policies — companies
create policy "view_own_company"
  on public.companies for select
  using (id = public.current_company_id());

create policy "admin_update_own_company"
  on public.companies for update
  using (
    id = public.current_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 6. RLS policies — profiles
create policy "view_profiles_in_own_company"
  on public.profiles for select
  using (company_id = public.current_company_id());

create policy "update_own_profile"
  on public.profiles for update
  using (id = auth.uid());

-- 7. Trigger — auto-provision company + profile when a new auth.user signs up
--    Reads `company_name` and `full_name` from raw_user_meta_data
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
begin
  v_company_name := coalesce(
    new.raw_user_meta_data->>'company_name',
    'شركة بدون اسم'
  );
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  insert into public.companies (name, created_by)
  values (v_company_name, new.id)
  returning id into v_company_id;

  insert into public.profiles (id, company_id, full_name, role)
  values (new.id, v_company_id, v_full_name, 'admin');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
