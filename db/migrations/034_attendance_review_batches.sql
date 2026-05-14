-- ============================================================================
-- Migration 034 -- Attendance import batches + review
--
-- HR wants the old "DoubleClick" workflow: upload fingerprint data ->
-- review what landed -> edit/delete bad rows -> approve. Currently
-- the importer just upserts everything immediately and there's no
-- way to look back at "what just came in".
--
-- This migration adds two columns to public.attendance:
--   import_batch_id   uuid  --  groups all rows from a single upload
--   imported_at       timestamptz  --  when the batch was imported
--
-- Both are nullable -- manually-entered rows (from /dashboard/attendance)
-- leave them null. Only imported rows carry a batch id.
--
-- A new index on (company_id, import_batch_id) lets the review page
-- pull a batch quickly without scanning the whole tenant's history.
-- ============================================================================

alter table public.attendance
  add column if not exists import_batch_id uuid,
  add column if not exists imported_at timestamptz;

create index if not exists idx_attendance_company_batch
  on public.attendance(company_id, import_batch_id)
  where import_batch_id is not null;

comment on column public.attendance.import_batch_id is
  'UUID of the import batch that created this row. NULL for manually-entered attendance. Used by the review page to group "everything from upload X".';
comment on column public.attendance.imported_at is
  'Timestamp when the import batch was uploaded. NULL for manual entries.';

-- ----------------------------------------------------------------------------
-- list_recent_attendance_batches -- one row per batch, with row count
-- and date range, ordered by most recent first. Used by the review
-- page index.
-- ----------------------------------------------------------------------------
create or replace function public.list_recent_attendance_batches(
  p_limit integer default 20
) returns table (
  batch_id        uuid,
  imported_at     timestamptz,
  row_count       bigint,
  earliest_date   date,
  latest_date     date,
  employee_count  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.import_batch_id as batch_id,
    max(a.imported_at) as imported_at,
    count(*) as row_count,
    min(a.date) as earliest_date,
    max(a.date) as latest_date,
    count(distinct a.employee_id) as employee_count
  from public.attendance a
  where a.company_id = public.current_company_id()
    and a.import_batch_id is not null
  group by a.import_batch_id
  order by max(a.imported_at) desc nulls last
  limit greatest(1, least(p_limit, 100));
$$;

grant execute on function public.list_recent_attendance_batches(integer)
  to authenticated;


-- Count of attendance rows imported in the LAST 24h that haven't been
-- touched since (i.e. still pristine from the import). Drives the
-- banner on /dashboard/attendance: "X سجل اتم استيراده مؤخرًا، راجعه".
create or replace function public.count_recent_import_rows() returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.attendance a
  where a.company_id = public.current_company_id()
    and a.import_batch_id is not null
    and a.imported_at > (now() - interval '24 hours');
$$;

grant execute on function public.count_recent_import_rows() to authenticated;


notify pgrst, 'reload schema';
