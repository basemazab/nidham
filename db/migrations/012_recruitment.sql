-- ============================================================================
-- Migration 012 — Recruitment module (jobs, candidates, applications)
--
-- Lets a company post a job, capture applicants, and have Gemini auto-screen
-- each CV against the job's requirements: returns 0-100 score, recommendation,
-- strengths, weaknesses, and interview questions in Arabic.
--
-- Phase 1 (this migration): manual applicant entry by HR.
-- Phase 2 (future): public job portal where candidates apply themselves.
-- ============================================================================

-- 1. Jobs ---------------------------------------------------------------------
create table public.jobs (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,

  -- The post
  title          text not null,
  department     text,
  description    text,
  requirements   text,
  responsibilities text,
  job_type       text not null default 'full_time'
                 check (job_type in ('full_time', 'part_time', 'contract', 'internship', 'remote')),
  location       text,
  remote_ok      boolean default false,

  -- Comp & seniority
  salary_min     numeric(10, 2),
  salary_max     numeric(10, 2),
  experience_years_min integer default 0,

  -- Lifecycle
  status         text not null default 'open'
                 check (status in ('draft', 'open', 'closed', 'filled', 'cancelled')),
  posted_at      timestamptz default now(),
  closes_at      timestamptz,

  -- For Phase 2 public portal
  slug           text,
  is_public      boolean default false,

  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

create index idx_jobs_company on public.jobs(company_id);
create index idx_jobs_status on public.jobs(status);
create unique index idx_jobs_slug_unique on public.jobs(slug) where slug is not null;


-- 2. Candidates --------------------------------------------------------------
-- A candidate is a person, scoped to one tenant. (In Phase 2 the public
-- portal can promote shared candidate accounts via a separate global table.)
create table public.candidates (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,

  full_name       text not null,
  email           text,
  phone           text,
  linkedin_url    text,
  current_title   text,
  current_company text,
  years_experience numeric(4, 1),
  location        text,
  expected_salary numeric(10, 2),

  -- Tag-style metadata
  tags            text[],
  notes           text,

  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

create index idx_candidates_company on public.candidates(company_id);
create index idx_candidates_email on public.candidates(email) where email is not null;


-- 3. Applications -------------------------------------------------------------
-- Pairs a candidate with a specific job. Holds the CV (text or PDF URL),
-- the AI screening output, and the HR decision pipeline.
create table public.applications (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  job_id          uuid not null references public.jobs(id) on delete cascade,
  candidate_id    uuid not null references public.candidates(id) on delete cascade,

  -- The submission itself
  cv_text         text,                -- pasted or extracted CV text
  cv_pdf_url      text,                -- supabase storage URL (Phase 2)
  cover_letter    text,
  source          text not null default 'manual'
                  check (source in ('manual', 'public_portal', 'referral', 'linkedin', 'import')),

  -- AI screening output (all optional — populated by /api/ai/screen-cv)
  ai_score              integer check (ai_score between 0 and 100),
  ai_recommendation     text check (ai_recommendation in ('strong_yes', 'yes', 'maybe', 'no')),
  ai_summary            text,
  ai_strengths          jsonb,         -- string[]
  ai_weaknesses         jsonb,         -- string[]
  ai_interview_questions jsonb,        -- string[]
  ai_extracted_skills   jsonb,         -- string[]
  ai_analyzed_at        timestamptz,
  ai_model              text,
  ai_error              text,          -- if the screening call failed

  -- HR pipeline
  status          text not null default 'new'
                  check (status in (
                    'new',
                    'reviewing',
                    'shortlisted',
                    'interview',
                    'offer',
                    'hired',
                    'rejected',
                    'withdrawn'
                  )),
  hr_notes        text,
  interview_at    timestamptz,

  applied_at      timestamptz default now() not null,
  reviewed_at     timestamptz,
  reviewed_by     uuid references auth.users(id) on delete set null,

  unique (job_id, candidate_id)
);

create index idx_applications_company on public.applications(company_id);
create index idx_applications_job on public.applications(job_id);
create index idx_applications_candidate on public.applications(candidate_id);
create index idx_applications_status on public.applications(status);
create index idx_applications_ai_score on public.applications(ai_score desc nulls last);


-- 4. Row Level Security -----------------------------------------------------
alter table public.jobs        enable row level security;
alter table public.candidates  enable row level security;
alter table public.applications enable row level security;

-- Jobs: tenant-scoped CRUD (plus public read in Phase 2 via separate policy)
create policy "jobs_tenant_select" on public.jobs for select
  using (company_id = public.current_company_id());
create policy "jobs_tenant_insert" on public.jobs for insert
  with check (company_id = public.current_company_id());
create policy "jobs_tenant_update" on public.jobs for update
  using (company_id = public.current_company_id());
create policy "jobs_tenant_delete" on public.jobs for delete
  using (company_id = public.current_company_id());

-- Candidates: tenant-scoped
create policy "candidates_tenant_select" on public.candidates for select
  using (company_id = public.current_company_id());
create policy "candidates_tenant_insert" on public.candidates for insert
  with check (company_id = public.current_company_id());
create policy "candidates_tenant_update" on public.candidates for update
  using (company_id = public.current_company_id());
create policy "candidates_tenant_delete" on public.candidates for delete
  using (company_id = public.current_company_id());

-- Applications: tenant-scoped
create policy "applications_tenant_select" on public.applications for select
  using (company_id = public.current_company_id());
create policy "applications_tenant_insert" on public.applications for insert
  with check (company_id = public.current_company_id());
create policy "applications_tenant_update" on public.applications for update
  using (company_id = public.current_company_id());
create policy "applications_tenant_delete" on public.applications for delete
  using (company_id = public.current_company_id());
