-- ============================================================================
-- Migration 037 — Marketing Studio (Enterprise feature)
--
-- AI-powered digital marketing agency built into Nidham. Persists the
-- artifacts the Marketing Studio tools produce so users can come back,
-- iterate, and execute campaigns over time.
--
-- Five tables, all tenant-scoped via RLS:
--   1) marketing_projects   — top-level "marketing project" (product
--                              line, service, campaign theme)
--   2) marketing_personas   — AI-generated buyer personas per project
--   3) marketing_campaigns  — planned campaigns with budget + goals
--   4) marketing_ad_creatives — generated ad copy for Meta/Google/TikTok
--   5) marketing_keywords   — SEO keyword strategy + intent classification
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) marketing_projects — the umbrella record
-- ----------------------------------------------------------------------------
create table if not exists public.marketing_projects (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  name              text not null,
  -- Product / service description — used as input to all AI tools
  product_summary   text,
  -- Industry: "real_estate", "manufacturing", "retail", "saas", "services", "other"
  industry          text,
  -- Country/region (default Egypt)
  target_market     text default 'Egypt',
  -- AI-generated deep analysis (filled by Product Analyzer)
  ai_analysis       jsonb default '{}'::jsonb,
  -- Active / archived
  status            text not null default 'active'
                    check (status in ('active', 'archived')),
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_marketing_projects_company
  on public.marketing_projects(company_id, status);

alter table public.marketing_projects enable row level security;

drop policy if exists "marketing_projects_select" on public.marketing_projects;
create policy "marketing_projects_select"
  on public.marketing_projects for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "marketing_projects_modify" on public.marketing_projects;
create policy "marketing_projects_modify"
  on public.marketing_projects for all to authenticated
  using (company_id = public.current_company_id()
    and exists (select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')))
  with check (company_id = public.current_company_id()
    and exists (select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')));


-- ----------------------------------------------------------------------------
-- 2) marketing_personas — AI-generated buyer personas
-- ----------------------------------------------------------------------------
create table if not exists public.marketing_personas (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  project_id        uuid not null references public.marketing_projects(id) on delete cascade,
  -- Persona name (e.g. "أحمد المهندس المعماري - 35")
  name              text not null,
  -- Demographics: age range, gender, location, income, education
  demographics      jsonb default '{}'::jsonb,
  -- Psychographics: interests, values, lifestyle
  psychographics    jsonb default '{}'::jsonb,
  -- Pain points + desired outcomes
  pain_points       text[],
  goals             text[],
  -- Buying journey: where they research, what triggers, objections
  buying_journey    jsonb default '{}'::jsonb,
  -- Recommended targeting parameters for each platform
  meta_targeting    jsonb default '{}'::jsonb,
  google_targeting  jsonb default '{}'::jsonb,
  tiktok_targeting  jsonb default '{}'::jsonb,
  -- Numeric priority (1 = primary persona)
  priority          integer default 1,
  created_at        timestamptz not null default now()
);

create index if not exists idx_marketing_personas_project
  on public.marketing_personas(project_id, priority);

alter table public.marketing_personas enable row level security;

drop policy if exists "marketing_personas_select" on public.marketing_personas;
create policy "marketing_personas_select"
  on public.marketing_personas for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "marketing_personas_modify" on public.marketing_personas;
create policy "marketing_personas_modify"
  on public.marketing_personas for all to authenticated
  using (company_id = public.current_company_id()
    and exists (select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')))
  with check (company_id = public.current_company_id()
    and exists (select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')));


-- ----------------------------------------------------------------------------
-- 3) marketing_campaigns — planned ad campaigns
-- ----------------------------------------------------------------------------
create table if not exists public.marketing_campaigns (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  project_id        uuid not null references public.marketing_projects(id) on delete cascade,
  -- Campaign name (e.g. "حملة الصيف - WPC أبواب")
  name              text not null,
  -- Goal: "awareness", "engagement", "leads", "sales", "traffic", "messages"
  goal              text not null,
  -- Platforms targeted (any combination)
  platforms         text[] default '{}'::text[],
  -- Budget in EGP (total)
  budget_total      numeric(12,2),
  budget_daily      numeric(12,2),
  -- Schedule
  start_date        date,
  end_date          date,
  -- Persona priorities (UUIDs of personas this campaign targets)
  target_personas   uuid[] default '{}'::uuid[],
  -- AI-generated plan (full strategy)
  ai_strategy       jsonb default '{}'::jsonb,
  -- Status: draft / launched / paused / completed
  status            text not null default 'draft'
                    check (status in ('draft', 'launched', 'paused', 'completed')),
  -- Optional: track ROAS / metrics manually entered by user
  metrics           jsonb default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_marketing_campaigns_project
  on public.marketing_campaigns(project_id, status);

alter table public.marketing_campaigns enable row level security;

drop policy if exists "marketing_campaigns_select" on public.marketing_campaigns;
create policy "marketing_campaigns_select"
  on public.marketing_campaigns for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "marketing_campaigns_modify" on public.marketing_campaigns;
create policy "marketing_campaigns_modify"
  on public.marketing_campaigns for all to authenticated
  using (company_id = public.current_company_id()
    and exists (select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')))
  with check (company_id = public.current_company_id()
    and exists (select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')));


-- ----------------------------------------------------------------------------
-- 4) marketing_ad_creatives — generated ad copy + creative concepts
-- ----------------------------------------------------------------------------
create table if not exists public.marketing_ad_creatives (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  project_id        uuid not null references public.marketing_projects(id) on delete cascade,
  campaign_id       uuid references public.marketing_campaigns(id) on delete set null,
  -- Platform: "meta", "google", "tiktok", "instagram", "linkedin"
  platform          text not null,
  -- Format: "single_image", "carousel", "video", "story", "search_ad"
  format            text not null,
  -- Persona this creative speaks to (optional)
  persona_id        uuid references public.marketing_personas(id) on delete set null,
  -- Headline (max varies by platform — 40 chars for Meta, 30 for Google)
  headline          text not null,
  -- Body copy (Meta: up to 125 chars before truncation, Google: 90 chars)
  body              text not null,
  -- Call to action label
  cta               text,
  -- Hook / opening line (TikTok specific)
  hook              text,
  -- Notes about the creative concept (image idea, video script outline)
  creative_concept  text,
  -- Whether this variant has been used / approved
  status            text not null default 'draft'
                    check (status in ('draft', 'approved', 'published', 'archived')),
  created_at        timestamptz not null default now()
);

create index if not exists idx_marketing_creatives_campaign
  on public.marketing_ad_creatives(campaign_id, platform);
create index if not exists idx_marketing_creatives_project
  on public.marketing_ad_creatives(project_id);

alter table public.marketing_ad_creatives enable row level security;

drop policy if exists "marketing_creatives_select" on public.marketing_ad_creatives;
create policy "marketing_creatives_select"
  on public.marketing_ad_creatives for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "marketing_creatives_modify" on public.marketing_ad_creatives;
create policy "marketing_creatives_modify"
  on public.marketing_ad_creatives for all to authenticated
  using (company_id = public.current_company_id()
    and exists (select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')))
  with check (company_id = public.current_company_id()
    and exists (select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')));


-- ----------------------------------------------------------------------------
-- 5) marketing_keywords — SEO keyword strategy
-- ----------------------------------------------------------------------------
create table if not exists public.marketing_keywords (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  project_id        uuid not null references public.marketing_projects(id) on delete cascade,
  -- The actual keyword/phrase (in Arabic typically)
  keyword           text not null,
  -- Intent: "informational" / "commercial" / "transactional" / "navigational"
  intent            text,
  -- Estimated monthly search volume (Egypt). NULL when AI can't estimate.
  search_volume     integer,
  -- Difficulty 0-100 (how hard to rank). NULL when AI can't estimate.
  difficulty        integer,
  -- Recommended content type: "blog_post" / "product_page" / "landing_page"
  content_type      text,
  -- Suggested title for content
  suggested_title   text,
  -- Brief outline of recommended content
  content_outline   text,
  -- Priority for tackling (1 = highest priority)
  priority          integer default 5,
  -- Tracking: have we created content for this yet?
  status            text not null default 'pending'
                    check (status in ('pending', 'in_progress', 'published', 'ranking')),
  created_at        timestamptz not null default now()
);

create index if not exists idx_marketing_keywords_project
  on public.marketing_keywords(project_id, priority);

alter table public.marketing_keywords enable row level security;

drop policy if exists "marketing_keywords_select" on public.marketing_keywords;
create policy "marketing_keywords_select"
  on public.marketing_keywords for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "marketing_keywords_modify" on public.marketing_keywords;
create policy "marketing_keywords_modify"
  on public.marketing_keywords for all to authenticated
  using (company_id = public.current_company_id()
    and exists (select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')))
  with check (company_id = public.current_company_id()
    and exists (select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager')));


notify pgrst, 'reload schema';
