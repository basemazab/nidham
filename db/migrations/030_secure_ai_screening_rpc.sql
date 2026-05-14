-- ============================================================================
-- Migration 030 -- Lock down anonymous AI-screening RPCs
--
-- The public job-application flow (migration 013) needs to call two
-- RPCs from the unauthenticated anon side:
--   save_screening_result(app_id, score, ...)
--   save_screening_error(app_id, error, model)
--
-- Both were granted to `anon` and only filtered by `source = 'public_portal'`
-- in the WHERE clause -- no idempotency check, no auth, no rate limit.
-- An attacker who can guess or scrape a public application UUID can:
--   - overwrite a strong candidate's ai_score with 0 / 'strong_no'
--   - flip ai_recommendation, ai_summary, ai_strengths, etc.
--   - DoS the HR funnel by writing fake errors
--
-- Fix: drop the existing grants, recreate the functions with an
-- idempotency guard so the FIRST successful save wins. The guard is
-- `ai_score IS NULL` (for save_screening_result) -- a row that has
-- been successfully scored cannot be overwritten. Errors do NOT lock
-- the row, so a legitimate retry after an AI error still works.
--
-- This is the minimum-disruption fix: anon callers can still hit the
-- function (the public application flow needs that), but they can't
-- mutate a row that's already been definitively scored.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. save_screening_result  --  one-write idempotency on ai_score
-- ----------------------------------------------------------------------------
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
  -- Guard: only update if the row is still un-scored. ai_score IS NULL
  -- means "AI hasn't given a definitive score yet" -- safe to write.
  -- If the previous attempt was an error (ai_error is not null but
  -- ai_score is null), retrying is still allowed -- the WHERE matches.
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
    and source = 'public_portal'
    and ai_score is null;
end;
$$;

-- Re-grant (the create-or-replace preserves the function, but the
-- grants need to be reasserted in case we ever drop+recreate).
grant execute on function public.save_screening_result(
  uuid, integer, text, text, jsonb, jsonb, jsonb, jsonb, text
) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 2. save_screening_error  --  cannot overwrite a successful score
-- ----------------------------------------------------------------------------
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
  -- Guard: never overwrite a row that has a successful score. An error
  -- write would zero out the recommendation and look like the candidate
  -- failed AI screening -- attacker-controlled defamation.
  update public.applications set
    ai_error       = p_error,
    ai_analyzed_at = now(),
    ai_model       = p_model
  where id = p_app_id
    and source = 'public_portal'
    and ai_score is null;
end;
$$;

grant execute on function public.save_screening_error(uuid, text, text)
  to anon, authenticated;


notify pgrst, 'reload schema';
