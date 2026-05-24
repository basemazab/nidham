-- ============================================================================
-- Migration 059 — Per-company custom fields
-- ============================================================================
--
-- Lets each tenant define their own employee data fields (text, number,
-- date, select). Values are stored in employees.custom_fields (jsonb
-- column) keyed by the definition's field_key. UI rendering lives in
-- TS/React — the schema just gives us the safe storage + definition
-- table.
--
-- Why JSONB vs columnar: SMBs add weird fields ("blood type", "حجم
-- البدلة", "tax-card serial") that don't generalise. Per-tenant
-- columns would explode the table. JSONB stays bounded.
--
-- Each definition is scoped to ONE entity_type so a tenant can have
-- different custom fields for employees vs customers without
-- collisions.
-- ============================================================================

create table if not exists public.company_custom_fields (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,

  entity_type   text not null check (entity_type in ('employee', 'customer')),

  -- field_key is the JSONB property name. Snake_case, no spaces,
  -- ASCII-only — UI strips bad chars before sending.
  field_key     text not null check (field_key ~ '^[a-z][a-z0-9_]{0,49}$'),

  label_ar      text not null,
  label_en      text,

  field_type    text not null check (field_type in (
    'text', 'number', 'date', 'boolean', 'select'
  )),

  -- For field_type='select', options is the list. JSONB so each
  -- option can carry both a value + a label_ar without a second table.
  -- Example: [{ "value": "S", "label_ar": "صغير" }, { "value": "M", "label_ar": "متوسط" }]
  options       jsonb not null default '[]'::jsonb,

  default_value text,
  is_required   boolean not null default false,
  display_order integer not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (company_id, entity_type, field_key)
);

create index if not exists idx_company_custom_fields_company_entity
  on public.company_custom_fields(company_id, entity_type, display_order);

drop trigger if exists company_custom_fields_set_updated_at on public.company_custom_fields;
create trigger company_custom_fields_set_updated_at
  before update on public.company_custom_fields
  for each row execute function public.tg_set_updated_at();

alter table public.company_custom_fields enable row level security;

drop policy if exists "view_custom_fields_in_own_company" on public.company_custom_fields;
drop policy if exists "manage_custom_fields_in_own_company" on public.company_custom_fields;

create policy "view_custom_fields_in_own_company"
  on public.company_custom_fields for select
  using (company_id = public.current_company_id());

create policy "manage_custom_fields_in_own_company"
  on public.company_custom_fields for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());


-- ----------------------------------------------------------------------------
-- Storage column on employees (additive, default '{}')
-- ----------------------------------------------------------------------------
alter table public.employees
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

comment on column public.employees.custom_fields is
  'Per-tenant custom field values, keyed by company_custom_fields.field_key. Validated TS-side against the definitions table.';


-- ----------------------------------------------------------------------------
-- Storage column on customers
-- ----------------------------------------------------------------------------
alter table public.customers
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

comment on column public.customers.custom_fields is
  'Per-tenant custom field values for customers. Same shape as employees.custom_fields.';


notify pgrst, 'reload schema';
