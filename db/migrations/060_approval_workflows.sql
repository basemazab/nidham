-- ============================================================================
-- Migration 060 — Multi-level approval workflows
-- ============================================================================
--
-- Configures who-approves-what for each request type (leave / advance
-- / permission). Three layers:
--
--   1. approval_workflows
--      Per-company, per-request-type. A rule like:
--        "Leave requests: manager → HR → CEO"
--      stored as an ordered list of steps in the steps jsonb.
--
--   2. request_approvals
--      An append-only log of every approval event on every request.
--      Tracks who approved/rejected/escalated at each step + when.
--
-- The actual runtime — when a request is submitted, walk the
-- workflow steps and dispatch notifications — is implemented in
-- TS server actions in a follow-up commit. This migration is the
-- data layer only.
-- ============================================================================

create table if not exists public.approval_workflows (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,

  -- Which kind of request this workflow applies to
  request_type  text not null check (request_type in (
    'leave', 'advance', 'permission', 'overtime', 'expense'
  )),

  name          text not null,
  description   text,
  is_active     boolean not null default true,

  -- Steps shape:
  -- [
  --   { "step": 1, "approver_role": "manager",      "label": "المدير المباشر" },
  --   { "step": 2, "approver_role": "hr",           "label": "الموارد البشرية" },
  --   { "step": 3, "approver_role": "admin",        "label": "الإدارة العليا" }
  -- ]
  --
  -- approver_role values: manager (employee's reports_to), hr (anyone
  -- with profile.role='manager'), admin (profile.role='admin'),
  -- specific_user (then approver_user_id must be set on the step).
  steps         jsonb not null default '[]'::jsonb,

  -- Trigger condition: when does this workflow apply?
  -- Optional — when null, applies to ALL requests of this type.
  -- Example: { "amount_gte": 5000 } — only advances >= 5000 EGP get
  -- the longer approval chain.
  trigger_condition jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Each company can have only one active default workflow per type.
  -- (Conditional workflows can coexist with the default.)
  unique (company_id, request_type, name)
);

create index if not exists idx_approval_workflows_company_type
  on public.approval_workflows(company_id, request_type, is_active);

drop trigger if exists approval_workflows_set_updated_at on public.approval_workflows;
create trigger approval_workflows_set_updated_at
  before update on public.approval_workflows
  for each row execute function public.tg_set_updated_at();

alter table public.approval_workflows enable row level security;

drop policy if exists "view_approval_workflows_in_own_company" on public.approval_workflows;
drop policy if exists "manage_approval_workflows_in_own_company" on public.approval_workflows;

create policy "view_approval_workflows_in_own_company"
  on public.approval_workflows for select
  using (company_id = public.current_company_id());

create policy "manage_approval_workflows_in_own_company"
  on public.approval_workflows for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());


-- ----------------------------------------------------------------------------
-- Per-request approval log
-- ----------------------------------------------------------------------------
create table if not exists public.request_approvals (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,

  -- Polymorphic reference (the actual request row lives in
  -- leave_requests, advance_requests, etc.)
  request_type  text not null,
  request_id    uuid not null,

  workflow_id   uuid references public.approval_workflows(id) on delete set null,
  step          integer not null,
  approver_id   uuid references auth.users(id) on delete set null,
  decision      text not null check (decision in ('approve', 'reject', 'escalate')),
  notes         text,

  decided_at    timestamptz not null default now()
);

create index if not exists idx_request_approvals_request
  on public.request_approvals(request_type, request_id, step);
create index if not exists idx_request_approvals_company
  on public.request_approvals(company_id, decided_at desc);

alter table public.request_approvals enable row level security;

drop policy if exists "view_request_approvals_in_own_company" on public.request_approvals;
drop policy if exists "manage_request_approvals_in_own_company" on public.request_approvals;

create policy "view_request_approvals_in_own_company"
  on public.request_approvals for select
  using (company_id = public.current_company_id());

create policy "manage_request_approvals_in_own_company"
  on public.request_approvals for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());


notify pgrst, 'reload schema';
