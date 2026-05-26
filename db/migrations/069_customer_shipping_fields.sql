-- ============================================================================
-- Migration 069 — Shipping-industry custom fields on customers
-- ============================================================================
--
-- For B2B software customers (like CircleCode) selling to shipping
-- companies, the standard CRM columns (name, phone, status) aren't
-- enough. Sales reps need to know:
--
--   1. How big is their fleet? (drives deal size)
--   2. How many shipments do they handle? (drives feature scope)
--   3. What TMS do they use today? (drives competitor analysis)
--   4. Who's the decision maker? (drives outreach strategy)
--
-- These fields are added directly to the customers table (not via the
-- custom_fields module from mig 059) because they're broadly useful
-- across the SaaS-for-shipping segment. The custom_fields system stays
-- for company-specific one-off fields.
--
-- All four columns are nullable — existing customer rows aren't
-- affected. Form fields default-to-blank in the UI.
-- ============================================================================

alter table public.customers
  add column if not exists fleet_size           integer,
  add column if not exists shipments_per_month  integer,
  add column if not exists current_tms          text,
  add column if not exists decision_maker       text,
  add column if not exists decision_maker_role  text;

comment on column public.customers.fleet_size is
  'Number of vehicles/trucks in the customer''s fleet. NULL when not applicable.';
comment on column public.customers.shipments_per_month is
  'Average monthly shipment volume — used as deal-size proxy.';
comment on column public.customers.current_tms is
  'Existing Transport Management System the customer uses (competitor name or "none").';
comment on column public.customers.decision_maker is
  'Name of the person who signs the contract — often different from contact_name.';
comment on column public.customers.decision_maker_role is
  'Title of the decision maker — e.g., COO, Head of Operations, CEO.';

-- Sanity check constraint: fleet_size and shipments_per_month can't be
-- negative. NOT VALID lets us add without scanning existing rows;
-- they're all NULL right now so the constraint is trivially satisfied.
alter table public.customers
  add constraint customers_fleet_size_nonneg
    check (fleet_size is null or fleet_size >= 0) not valid;
alter table public.customers
  validate constraint customers_fleet_size_nonneg;

alter table public.customers
  add constraint customers_shipments_per_month_nonneg
    check (shipments_per_month is null or shipments_per_month >= 0) not valid;
alter table public.customers
  validate constraint customers_shipments_per_month_nonneg;

notify pgrst, 'reload schema';
