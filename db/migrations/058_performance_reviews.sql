-- ============================================================================
-- Migration 058 — Performance reviews (KPIs + ratings)
-- ============================================================================
--
-- Self-contained performance management. Each review captures:
--   - the period it covers (e.g. "Q1 2026", "January 2026", "Annual 2025")
--   - manager's rating (1-5 scale)
--   - optional self-assessment
--   - KPI scores (JSONB list — name, target, score)
--   - written notes / strengths / areas to improve
--   - status: draft → submitted → acknowledged → closed
--
-- Why JSONB for KPIs:
--   Egyptian SMBs use wildly different KPI shapes (sales rep gets a
--   "target vs achieved" sheet; production worker gets "scrap rate %"
--   + "punctuality"; office worker gets "deliverables completed").
--   A flat columnar schema would either be too narrow or too sparse.
--   JSONB keeps the engine flexible — UI renders the array as a table.
--
-- KPI shape (validated by Zod TS-side, NOT a DB check):
--   [
--     { name: "إجمالي المبيعات", target: 500000, achieved: 470000, weight: 30, score: 4 },
--     { name: "نسبة العملاء الجدد",  target: 20,     achieved: 25,     weight: 20, score: 5 },
--     ...
--   ]
--
-- Rating scale: 1=ضعيف, 2=أقل من المتوقع, 3=يلبي التوقعات, 4=ممتاز,
-- 5=استثنائي. Matches what Bayzat + ZenHR use.
-- ============================================================================

create table if not exists public.performance_reviews (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  employee_id   uuid not null references public.employees(id) on delete cascade,

  -- Period covered by this review
  period_label  text not null, -- "يناير 2026" / "Q1 2026" / "Annual 2025"
  period_start  date,
  period_end    date,

  -- Ratings (1-5). Manager rating is required; self_rating optional.
  manager_rating  smallint check (manager_rating between 1 and 5),
  self_rating     smallint check (self_rating is null or self_rating between 1 and 5),

  -- Free-text sections
  strengths           text,
  areas_to_improve    text,
  manager_notes       text,
  employee_response   text,

  -- Optional KPI breakdown — see header for shape
  kpis jsonb not null default '[]'::jsonb,

  -- Outcome
  outcome text check (outcome is null or outcome in (
    'extend_probation',
    'continue',
    'promote',
    'pip_30_day',
    'pip_60_day',
    'terminate'
  )),

  -- Lifecycle
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'acknowledged', 'closed')),

  reviewer_id   uuid references auth.users(id) on delete set null,
  submitted_at  timestamptz,
  acknowledged_at timestamptz,
  closed_at     timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_performance_reviews_company on public.performance_reviews(company_id);
create index if not exists idx_performance_reviews_employee on public.performance_reviews(employee_id, period_end desc);
create index if not exists idx_performance_reviews_status on public.performance_reviews(company_id, status);

drop trigger if exists performance_reviews_set_updated_at on public.performance_reviews;
create trigger performance_reviews_set_updated_at
  before update on public.performance_reviews
  for each row execute function public.tg_set_updated_at();

alter table public.performance_reviews enable row level security;

drop policy if exists "view_performance_reviews_in_own_company" on public.performance_reviews;
drop policy if exists "manage_performance_reviews_in_own_company" on public.performance_reviews;

create policy "view_performance_reviews_in_own_company"
  on public.performance_reviews for select
  using (company_id = public.current_company_id());

create policy "manage_performance_reviews_in_own_company"
  on public.performance_reviews for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());


notify pgrst, 'reload schema';
