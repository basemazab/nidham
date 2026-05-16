-- ============================================================================
-- Migration 038 — Super-Admin engagement visibility
--
-- The /admin/trials analytics page (added with the SaaS dashboard) measures
-- how each trial tenant is using the product by counting rows in:
--
--   employees / attendance / customers / interactions / payroll_periods
--   + marketing_projects (Enterprise)
--
-- Migration 008 gave the super-admin SELECT bypass for companies, profiles,
-- and subscriptions. Migration 014 added the same for payroll_periods,
-- payroll_entries, jobs, candidates, applications. Migration 021 added
-- leave_requests, advance_requests, permission_requests, leave_balances,
-- audit_log.
--
-- But four tables that the trials page reads — employees, attendance,
-- customers, interactions — were never granted the bypass. As a result, the
-- super-admin's queries against them returned 0 for every tenant other than
-- their own, and every trial company looked "cold" regardless of real
-- activity. Same gap for the marketing_* tables added in mig 037.
--
-- This migration closes the gap so the trial analytics page reflects
-- reality.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Foundational tenant tables — the four the trials page already queries
-- ----------------------------------------------------------------------------

drop policy if exists "super_admin_view_all_employees" on public.employees;
create policy "super_admin_view_all_employees"
  on public.employees for select
  using (public.is_super_admin());

drop policy if exists "super_admin_view_all_attendance" on public.attendance;
create policy "super_admin_view_all_attendance"
  on public.attendance for select
  using (public.is_super_admin());

drop policy if exists "super_admin_view_all_customers" on public.customers;
create policy "super_admin_view_all_customers"
  on public.customers for select
  using (public.is_super_admin());

drop policy if exists "super_admin_view_all_interactions" on public.interactions;
create policy "super_admin_view_all_interactions"
  on public.interactions for select
  using (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 2. Marketing Studio tables (mig 037) — Enterprise engagement signal
--
-- A tenant who created a marketing project, generated personas, ran ads,
-- or built campaigns is the strongest possible engagement evidence. Bring
-- those into super-admin visibility too.
-- ----------------------------------------------------------------------------

drop policy if exists "super_admin_view_all_marketing_projects" on public.marketing_projects;
create policy "super_admin_view_all_marketing_projects"
  on public.marketing_projects for select
  using (public.is_super_admin());

drop policy if exists "super_admin_view_all_marketing_personas" on public.marketing_personas;
create policy "super_admin_view_all_marketing_personas"
  on public.marketing_personas for select
  using (public.is_super_admin());

drop policy if exists "super_admin_view_all_marketing_campaigns" on public.marketing_campaigns;
create policy "super_admin_view_all_marketing_campaigns"
  on public.marketing_campaigns for select
  using (public.is_super_admin());

drop policy if exists "super_admin_view_all_marketing_ad_creatives" on public.marketing_ad_creatives;
create policy "super_admin_view_all_marketing_ad_creatives"
  on public.marketing_ad_creatives for select
  using (public.is_super_admin());

drop policy if exists "super_admin_view_all_marketing_keywords" on public.marketing_keywords;
create policy "super_admin_view_all_marketing_keywords"
  on public.marketing_keywords for select
  using (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 3. Notify PostgREST so the new policies land in the schema cache
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
