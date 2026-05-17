-- ============================================================================
-- Migration 041 — Per-tenant feature overrides
-- ============================================================================
--
-- The existing subscription model (mig 008 + lib/subscriptions.ts) gates
-- features by TIER:
--   trial  → everything
--   basic  → core HR
--   pro    → +CRM +Recruitment +AI
--   enterprise → +Marketing Studio +Bridge Analytics +Branding
--
-- But Basem wants finer-grained control. Some customers buy "Marketing
-- only" (an Enterprise plan but they only want the marketing studio,
-- not HR). Other customers buy "HR only" on Enterprise pricing but
-- don't need Marketing. The tier-based defaults don't fit those.
--
-- This migration adds a tenant_feature_overrides table that lets the
-- super-admin EXPLICITLY enable or disable any single feature for any
-- single tenant, regardless of their tier. The override takes priority
-- over the tier-based default in canUseFeature().
--
-- Three states per feature per tenant:
--   1. NO ROW             → fall back to tier-based default
--   2. enabled=true       → force ON (e.g. give a Basic tenant the
--                            marketing_studio they paid extra for)
--   3. enabled=false      → force OFF (e.g. hide HR modules from a
--                            marketing-only customer)
-- ============================================================================

create table if not exists public.tenant_feature_overrides (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,

  -- The feature key — must match a Feature in lib/subscriptions.ts.
  -- We don't enforce this in the DB (no enum) because the feature
  -- list lives in TypeScript and changes as the product evolves;
  -- the super-admin UI only shows known features, so invalid values
  -- shouldn't reach here in practice.
  feature_key   text not null,

  -- The override
  enabled       boolean not null,

  -- Why the super-admin set this (optional but recommended).
  -- e.g. "Customer bought Marketing-Only package on 2026-05-17"
  reason        text,

  -- Audit
  set_by        uuid references public.profiles(id) on delete set null,
  set_at        timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Each feature appears at most once per tenant
  unique (company_id, feature_key)
);

create index if not exists idx_tenant_feature_overrides_company
  on public.tenant_feature_overrides(company_id);

drop trigger if exists tenant_feature_overrides_set_updated_at
  on public.tenant_feature_overrides;
create trigger tenant_feature_overrides_set_updated_at
  before update on public.tenant_feature_overrides
  for each row execute function public.tg_set_updated_at();


-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.tenant_feature_overrides enable row level security;

-- Authenticated users can read THEIR OWN company's overrides so the
-- canUseFeature() check at runtime can see them.
drop policy if exists "view_feature_overrides_in_own_company"
  on public.tenant_feature_overrides;
create policy "view_feature_overrides_in_own_company"
  on public.tenant_feature_overrides for select
  to authenticated
  using (company_id = public.current_company_id());

-- Only super-admins can WRITE. Tenants can't set their own overrides
-- (that'd let a Basic tenant enable Enterprise features for free).
drop policy if exists "super_admin_manage_feature_overrides"
  on public.tenant_feature_overrides;
create policy "super_admin_manage_feature_overrides"
  on public.tenant_feature_overrides for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Super-admins can read every tenant's overrides too (for the admin
-- panel). Covered by the manage policy above but explicit for clarity.


-- ----------------------------------------------------------------------------
-- bulk_set_tenant_overrides — preset helper for "Marketing only" / "HR
-- only" / "Everything" packages. Takes a JSON array of {feature, enabled}
-- and applies them in a single transaction.
-- ----------------------------------------------------------------------------
create or replace function public.bulk_set_tenant_overrides(
  p_company_id uuid,
  p_overrides  jsonb,  -- e.g. '[{"feature":"marketing_studio","enabled":true},...]'
  p_reason     text
)
returns integer  -- rows affected
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_is_super   boolean;
  v_item       jsonb;
  v_count      integer := 0;
begin
  if v_profile_id is null then
    raise exception 'must be authenticated';
  end if;

  select public.is_super_admin() into v_is_super;
  if not v_is_super then
    raise exception 'super-admin only';
  end if;

  -- Validate the company exists
  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'company not found';
  end if;

  for v_item in select * from jsonb_array_elements(p_overrides)
  loop
    insert into public.tenant_feature_overrides (
      company_id, feature_key, enabled, reason, set_by
    )
    values (
      p_company_id,
      v_item->>'feature',
      (v_item->>'enabled')::boolean,
      p_reason,
      v_profile_id
    )
    on conflict (company_id, feature_key) do update set
      enabled    = excluded.enabled,
      reason     = excluded.reason,
      set_by     = excluded.set_by,
      set_at     = now(),
      updated_at = now();
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.bulk_set_tenant_overrides(uuid, jsonb, text)
  to authenticated;


-- ----------------------------------------------------------------------------
-- clear_tenant_overrides — remove all overrides for a tenant (revert
-- them to tier-based defaults). Useful for switching a customer back
-- to "standard plan behavior".
-- ----------------------------------------------------------------------------
create or replace function public.clear_tenant_overrides(p_company_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_is_super boolean;
  v_count    integer;
begin
  if auth.uid() is null then raise exception 'must be authenticated'; end if;
  select public.is_super_admin() into v_is_super;
  if not v_is_super then raise exception 'super-admin only'; end if;

  delete from public.tenant_feature_overrides where company_id = p_company_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.clear_tenant_overrides(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- Reload PostgREST schema cache
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
