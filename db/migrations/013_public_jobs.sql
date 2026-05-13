-- ============================================================================
-- Migration 013 — Public job portal (Sprint 2)
--
-- Lets anonymous visitors browse public open jobs and submit applications
-- without an account. Tenant data stays isolated — anons can ONLY read jobs
-- explicitly marked is_public=true AND status='open', and can only INSERT
-- applications through a security-definer function that validates the job.
-- ============================================================================

-- 1. Public read access to open public jobs ----------------------------------
-- This policy is ADDED to the existing tenant-only select policy. Postgres
-- ORs multiple SELECT policies together, so:
--   • Tenant members still see all their own jobs (draft/closed/etc).
--   • Anonymous visitors only see jobs where is_public AND status='open'.
create policy "jobs_public_select" on public.jobs for select
  using (is_public = true and status = 'open');


-- 2. Secure submission RPC ---------------------------------------------------
-- We expose a single function that:
--   • Validates the target job is public+open.
--   • Reuses the candidate row if one already exists in that tenant by email.
--   • Refuses duplicate applications for the same job+candidate.
--   • Stamps source='public_portal' so the dashboard can distinguish.
--
-- security definer => runs as the owner (bypasses RLS), but only writes the
-- exact data we validate. Granted to anon + authenticated.
create or replace function public.submit_public_application(
  p_job_slug      text,
  p_full_name     text,
  p_email         text,
  p_phone         text default null,
  p_current_title text default null,
  p_location      text default null,
  p_years_experience numeric default null,
  p_cv_text       text default null,
  p_cv_pdf_url    text default null,
  p_cover_letter  text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id        uuid;
  v_company_id    uuid;
  v_candidate_id  uuid;
  v_app_id        uuid;
  v_cv_chars      integer;
begin
  -- Trim inputs
  p_full_name := nullif(trim(p_full_name), '');
  p_email     := nullif(trim(p_email), '');
  p_cv_text   := nullif(p_cv_text, '');

  if p_full_name is null then
    raise exception 'الاسم مطلوب' using errcode = 'P0001';
  end if;
  if p_email is null then
    raise exception 'الإيميل مطلوب' using errcode = 'P0001';
  end if;

  v_cv_chars := coalesce(length(p_cv_text), 0);
  if v_cv_chars < 30 and p_cv_pdf_url is null then
    raise exception 'لازم ترفع CV أو تلصق نص السيرة الذاتية' using errcode = 'P0001';
  end if;

  -- 1. Find the job (and its tenant) by slug — and confirm it's public+open
  select id, company_id into v_job_id, v_company_id
  from public.jobs
  where slug = p_job_slug
    and is_public = true
    and status = 'open'
  limit 1;

  if v_job_id is null then
    raise exception 'الوظيفة دي مش متاحة أو اتقفلت' using errcode = 'P0001';
  end if;

  -- 2. Find-or-create candidate within this tenant, keyed by email
  select id into v_candidate_id
  from public.candidates
  where company_id = v_company_id and email = p_email
  limit 1;

  if v_candidate_id is null then
    insert into public.candidates (
      company_id, full_name, email, phone, current_title, location, years_experience
    )
    values (
      v_company_id, p_full_name, p_email, p_phone, p_current_title, p_location, p_years_experience
    )
    returning id into v_candidate_id;
  else
    -- Update non-null fields the applicant provided
    update public.candidates set
      full_name        = coalesce(p_full_name, full_name),
      phone            = coalesce(p_phone, phone),
      current_title    = coalesce(p_current_title, current_title),
      location         = coalesce(p_location, location),
      years_experience = coalesce(p_years_experience, years_experience),
      updated_at       = now()
    where id = v_candidate_id;
  end if;

  -- 3. Refuse duplicate application
  if exists (
    select 1 from public.applications
    where job_id = v_job_id and candidate_id = v_candidate_id
  ) then
    raise exception 'انت قدمت قبل كده على نفس الوظيفة' using errcode = 'P0001';
  end if;

  -- 4. Create the application
  insert into public.applications (
    company_id, job_id, candidate_id,
    cv_text, cv_pdf_url, cover_letter,
    source, status
  )
  values (
    v_company_id, v_job_id, v_candidate_id,
    p_cv_text, p_cv_pdf_url, p_cover_letter,
    'public_portal', 'new'
  )
  returning id into v_app_id;

  return v_app_id;
end;
$$;

-- Anyone (anon visitors + logged-in users) can call the RPC.
grant execute on function public.submit_public_application(
  text, text, text, text, text, text, numeric, text, text, text
) to anon, authenticated;


-- 3. Helper view — public job listing
-- Anon visitors can't see all columns of a public.jobs row even when our
-- public SELECT policy lets them through, because some columns (created_by,
-- internal status flags) are PII we don't want exposed. The view below
-- whitelists only the public-safe fields.
create or replace view public.public_jobs as
select
  id,
  company_id,
  title,
  department,
  description,
  requirements,
  responsibilities,
  job_type,
  location,
  remote_ok,
  salary_min,
  salary_max,
  experience_years_min,
  slug,
  posted_at,
  closes_at
from public.jobs
where is_public = true
  and status = 'open';

grant select on public.public_jobs to anon, authenticated;


-- 4. Read-back for the thank-you page ----------------------------------------
-- An anonymous applicant who just submitted has the application id in the URL,
-- but RLS on `applications` only allows tenant reads. We expose a single-row
-- read function so the thank-you page can show "Application received for
-- {Job Title}" without leaking anything else.
create or replace function public.get_public_application_summary(p_app_id uuid)
returns table (
  id uuid,
  job_title text,
  applied_at timestamptz,
  candidate_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id,
    j.title,
    a.applied_at,
    c.full_name
  from public.applications a
  join public.jobs j on j.id = a.job_id
  join public.candidates c on c.id = a.candidate_id
  where a.id = p_app_id
    and a.source = 'public_portal';
$$;

grant execute on function public.get_public_application_summary(uuid) to anon, authenticated;


-- 5. Internal RPCs used by the public form's inline AI screening -------------
-- After submit_public_application returns the new application id, the server
-- action calls Gemini and needs to (a) read the CV/job/candidate to build the
-- prompt, and (b) save the AI verdict — both blocked by RLS for anon.
--
-- These two RPCs do exactly those reads/writes, scoped to the specific
-- application id, so the public flow can complete without exposing the
-- applications table broadly.

create or replace function public.fetch_application_for_screening(p_app_id uuid)
returns table (
  cv_text text,
  job_title text,
  job_department text,
  job_description text,
  job_requirements text,
  job_responsibilities text,
  job_experience_years_min integer,
  job_location text,
  job_type text,
  candidate_full_name text,
  candidate_current_title text,
  candidate_years_experience numeric,
  candidate_location text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.cv_text,
    j.title,
    j.department,
    j.description,
    j.requirements,
    j.responsibilities,
    j.experience_years_min,
    j.location,
    j.job_type,
    c.full_name,
    c.current_title,
    c.years_experience,
    c.location
  from public.applications a
  join public.jobs j on j.id = a.job_id
  join public.candidates c on c.id = a.candidate_id
  where a.id = p_app_id
    and a.source = 'public_portal'
    and a.ai_analyzed_at is null;  -- only newly-submitted rows
$$;

grant execute on function public.fetch_application_for_screening(uuid) to anon, authenticated;


create or replace function public.save_screening_result(
  p_app_id              uuid,
  p_score               integer,
  p_recommendation      text,
  p_summary             text,
  p_strengths           jsonb,
  p_weaknesses          jsonb,
  p_interview_questions jsonb,
  p_extracted_skills    jsonb,
  p_model               text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.applications set
    ai_score              = p_score,
    ai_recommendation     = p_recommendation,
    ai_summary            = p_summary,
    ai_strengths          = p_strengths,
    ai_weaknesses         = p_weaknesses,
    ai_interview_questions = p_interview_questions,
    ai_extracted_skills   = p_extracted_skills,
    ai_analyzed_at        = now(),
    ai_model              = p_model,
    ai_error              = null
  where id = p_app_id
    and source = 'public_portal';
end;
$$;

grant execute on function public.save_screening_result(
  uuid, integer, text, text, jsonb, jsonb, jsonb, jsonb, text
) to anon, authenticated;


create or replace function public.save_screening_error(
  p_app_id uuid,
  p_error  text,
  p_model  text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.applications set
    ai_error       = p_error,
    ai_analyzed_at = now(),
    ai_model       = p_model
  where id = p_app_id
    and source = 'public_portal';
end;
$$;

grant execute on function public.save_screening_error(uuid, text, text)
  to anon, authenticated;
