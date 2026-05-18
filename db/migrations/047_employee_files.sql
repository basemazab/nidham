-- ============================================================================
-- Migration 047 — Employee files (avatars + document vault)
-- ============================================================================
--
-- Two long-requested features in one migration because they share the same
-- Supabase Storage bucket + RLS layer:
--
--   1) employees.avatar_url — single photo per employee, rendered on the
--      Kanban cards, the detail page, and (later) the mobile app's profile.
--   2) employee_documents — many-to-one document vault (contracts, IDs,
--      certificates, CV, photos, etc.) so HR can stop emailing PDFs around.
--
-- Both feed off a new public storage bucket `employee-files`. Path scheme:
--
--   {company_id}/{employee_id}/avatar/{ts}-photo.{ext}
--   {company_id}/{employee_id}/docs/{ts}-{filename}.{ext}
--
-- The first path segment = company_id, which the RLS policies match against
-- the caller's profiles.company_id. So an HR user can only write inside
-- their own tenant's folder. Reads are public because the UUID paths are
-- effectively unguessable — same trade-off as social-media (mig 045).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) employees.avatar_url column
-- ----------------------------------------------------------------------------
alter table public.employees
  add column if not exists avatar_url text;

comment on column public.employees.avatar_url is
  'Public URL of the employee photo in supabase://employee-files. ' ||
  'Path follows {company_id}/{employee_id}/avatar/{ts}-photo.{ext}.';


-- ----------------------------------------------------------------------------
-- 2) employee_documents table
-- ----------------------------------------------------------------------------
create table if not exists public.employee_documents (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  employee_id   uuid not null references public.employees(id) on delete cascade,

  -- Document classification — drives the icon + grouping in the UI.
  -- Kept as a free-form text+check rather than an enum so HR can add
  -- new types without a migration.
  doc_type      text not null
                check (doc_type in (
                  'contract',          -- عقد عمل
                  'national_id',       -- بطاقة رقم قومي
                  'cv',                -- السيرة الذاتية
                  'certificate',       -- شهادات (جامعية، خبرة، تدريب)
                  'photo',             -- صور شخصية (غير الـ avatar)
                  'license',           -- رخصة قيادة، نقابة، إلخ
                  'insurance',         -- استمارة 1/2/6 تأمينات
                  'bank',              -- مستند بنكي
                  'medical',           -- تقرير طبي / كشف لياقة
                  'other'              -- أي حاجة تانية
                )),

  -- Display name shown in the UI. Defaults to the original filename.
  name          text not null,

  -- Public URL in the employee-files bucket.
  file_url      text not null,
  -- Storage object path — kept separately so we can delete the underlying
  -- bytes when the row is deleted (file_url is for rendering only).
  storage_path  text not null,
  mime_type     text,
  size_bytes    bigint,

  -- Optional metadata: expiry date for documents that go stale
  -- (national IDs, licenses, insurance forms, etc.).
  expires_at    date,
  notes         text,

  -- Audit
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_employee_documents_employee
  on public.employee_documents(employee_id);
create index if not exists idx_employee_documents_company_type
  on public.employee_documents(company_id, doc_type);
create index if not exists idx_employee_documents_expires_at
  on public.employee_documents(expires_at)
  where expires_at is not null;

comment on table public.employee_documents is
  'Per-employee document vault. Files live in supabase://employee-files; ' ||
  'this table tracks metadata + the URL for rendering. expires_at lets the ' ||
  'dashboard surface "expiring docs" reminders.';


-- ----------------------------------------------------------------------------
-- 3) RLS — same-tenant HR can read/write, super-admin sees all
-- ----------------------------------------------------------------------------
alter table public.employee_documents enable row level security;

drop policy if exists "employee_documents_tenant_read"   on public.employee_documents;
drop policy if exists "employee_documents_hr_write"      on public.employee_documents;
drop policy if exists "employee_documents_hr_update"     on public.employee_documents;
drop policy if exists "employee_documents_hr_delete"     on public.employee_documents;
drop policy if exists "employee_documents_super_admin"   on public.employee_documents;

-- READ — anyone in the same tenant (admin/manager/employee can see their own).
-- For V1 we restrict to admin + manager because employees don't have a
-- way to "own" their docs yet (mobile app is scaffolded, not deployed).
create policy "employee_documents_tenant_read"
on public.employee_documents for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.company_id = employee_documents.company_id
      and p.role in ('admin', 'manager')
  )
);

-- WRITE — same gate. HR is the only role that uploads docs in V1.
create policy "employee_documents_hr_write"
on public.employee_documents for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.company_id = employee_documents.company_id
      and p.role in ('admin', 'manager')
  )
);

create policy "employee_documents_hr_update"
on public.employee_documents for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.company_id = employee_documents.company_id
      and p.role in ('admin', 'manager')
  )
);

create policy "employee_documents_hr_delete"
on public.employee_documents for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.company_id = employee_documents.company_id
      and p.role in ('admin', 'manager')
  )
);

-- Super-admin: cross-tenant SELECT (same pattern as mig 038).
create policy "employee_documents_super_admin"
on public.employee_documents for select
to authenticated
using (
  exists (select 1 from public.super_admins where user_id = auth.uid())
);


-- ----------------------------------------------------------------------------
-- 4) Storage bucket — employee-files (public reads, tenant-scoped writes)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-files',
  'employee-files',
  true,                                   -- public reads (unguessable UUID paths)
  10485760,                               -- 10 MB per file
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public                = excluded.public,
  file_size_limit       = excluded.file_size_limit,
  allowed_mime_types    = excluded.allowed_mime_types;

-- Storage policies. The path format is {company_id}/{employee_id}/...
-- so storage.foldername(name)[1] returns the company_id.
drop policy if exists "employee_files_public_read"   on storage.objects;
drop policy if exists "employee_files_hr_write"      on storage.objects;
drop policy if exists "employee_files_hr_update"     on storage.objects;
drop policy if exists "employee_files_hr_delete"     on storage.objects;

create policy "employee_files_public_read"
on storage.objects for select
using (bucket_id = 'employee-files');

create policy "employee_files_hr_write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'employee-files'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
      and p.company_id::text = (storage.foldername(name))[1]
  )
);

create policy "employee_files_hr_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'employee-files'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
      and p.company_id::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'employee-files'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
      and p.company_id::text = (storage.foldername(name))[1]
  )
);

create policy "employee_files_hr_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'employee-files'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
      and p.company_id::text = (storage.foldername(name))[1]
  )
);


-- ----------------------------------------------------------------------------
-- 5) Reload PostgREST so the new table + column appear immediately
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
