-- ============================================================================
-- Migration 057 — Asset management (laptops, phones, cars, ...)
-- ============================================================================
--
-- Tracks company assets and who has them. Solves the recurring HR pain
-- point at every SMB: "John left — did he return the laptop?"
--
-- The asset's lifecycle:
--   1. Add the asset (no assignment) → status='available'
--   2. Assign to employee → status='assigned', assigned_employee_id set
--   3. Return → status='available', assigned_employee_id cleared,
--               assignment recorded in asset_assignments history
--   4. Retire (broken / sold / lost) → status='retired'
--
-- The asset_assignments table preserves the FULL history (every assign
-- + return event) so HR can answer "who had this laptop before?".
-- ============================================================================

create table if not exists public.assets (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,

  name            text not null,
  asset_type      text not null check (asset_type in (
    'laptop',
    'desktop',
    'phone',
    'tablet',
    'monitor',
    'printer',
    'car',
    'motorcycle',
    'tool',
    'uniform',
    'sim_card',
    'access_card',
    'other'
  )),

  -- Identifiers
  serial_number   text,
  asset_tag       text,  -- internal label sticker on the device

  -- Financial
  purchase_date         date,
  purchase_cost         numeric(12, 2),
  depreciation_years    integer check (depreciation_years is null or depreciation_years > 0),
  current_estimated_value numeric(12, 2),

  -- Lifecycle
  status text not null default 'available'
    check (status in ('available', 'assigned', 'in_maintenance', 'retired', 'lost')),

  -- Assignment (denormalised — assignment HISTORY in asset_assignments)
  assigned_employee_id  uuid references public.employees(id) on delete set null,
  assigned_at           timestamptz,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assets_company on public.assets(company_id);
create index if not exists idx_assets_company_status on public.assets(company_id, status);
create index if not exists idx_assets_assigned_employee on public.assets(assigned_employee_id)
  where assigned_employee_id is not null;
create unique index if not exists idx_assets_asset_tag_company on public.assets(company_id, asset_tag)
  where asset_tag is not null;

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at
  before update on public.assets
  for each row execute function public.tg_set_updated_at();

alter table public.assets enable row level security;

drop policy if exists "view_assets_in_own_company" on public.assets;
drop policy if exists "manage_assets_in_own_company" on public.assets;

create policy "view_assets_in_own_company"
  on public.assets for select
  using (company_id = public.current_company_id());

create policy "manage_assets_in_own_company"
  on public.assets for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());


-- ----------------------------------------------------------------------------
-- Assignment history — append-only audit of every (assign, return) event
-- ----------------------------------------------------------------------------
create table if not exists public.asset_assignments (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  asset_id      uuid not null references public.assets(id) on delete cascade,
  employee_id   uuid not null references public.employees(id) on delete cascade,

  assigned_at   timestamptz not null default now(),
  returned_at   timestamptz,

  -- Per-event details so HR can record condition + reason without
  -- editing the asset row.
  condition_on_assign  text check (condition_on_assign is null or condition_on_assign in (
    'new', 'good', 'fair', 'poor'
  )),
  condition_on_return  text check (condition_on_return is null or condition_on_return in (
    'good', 'fair', 'poor', 'damaged', 'lost'
  )),
  notes text,

  created_at timestamptz not null default now()
);

create index if not exists idx_asset_assignments_asset on public.asset_assignments(asset_id, assigned_at desc);
create index if not exists idx_asset_assignments_employee on public.asset_assignments(employee_id, assigned_at desc);
create index if not exists idx_asset_assignments_company on public.asset_assignments(company_id);

alter table public.asset_assignments enable row level security;

drop policy if exists "view_asset_assignments_in_own_company" on public.asset_assignments;
drop policy if exists "manage_asset_assignments_in_own_company" on public.asset_assignments;

create policy "view_asset_assignments_in_own_company"
  on public.asset_assignments for select
  using (company_id = public.current_company_id());

create policy "manage_asset_assignments_in_own_company"
  on public.asset_assignments for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());


notify pgrst, 'reload schema';
