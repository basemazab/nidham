-- ============================================================================
-- Migration 014 — Post-audit fixes
--
-- Two issues surfaced during the full review:
--
-- 1. The /jobs public portal queries the companies table to display each
--    job's employer name, but companies had no SELECT policy for anon
--    visitors, so names rendered as "—". This migration adds a narrow
--    public-read policy that only exposes companies which currently have
--    at least one public+open job.
--
-- 2. Migration 008 added super-admin bypass policies for companies,
--    profiles, and subscriptions, but the later migrations (011 payroll,
--    012 recruitment) introduced new tables without matching bypasses.
--    The platform's super admin would therefore be unable to inspect those
--    rows. This migration adds read access for the super admin role on
--    every new table.
-- ============================================================================

-- 1. Companies — let anon read rows that have a public+open job ---------------
create policy "public_view_company_with_public_jobs"
  on public.companies for select
  using (
    exists (
      select 1 from public.jobs
      where jobs.company_id = companies.id
        and jobs.is_public = true
        and jobs.status = 'open'
    )
  );


-- 2. Super admin SELECT bypass for new tables --------------------------------
create policy "super_admin_view_all_payroll_periods"
  on public.payroll_periods for select
  using (public.is_super_admin());

create policy "super_admin_view_all_payroll_entries"
  on public.payroll_entries for select
  using (public.is_super_admin());

create policy "super_admin_view_all_jobs"
  on public.jobs for select
  using (public.is_super_admin());

create policy "super_admin_view_all_candidates"
  on public.candidates for select
  using (public.is_super_admin());

create policy "super_admin_view_all_applications"
  on public.applications for select
  using (public.is_super_admin());
