-- ============================================================================
-- Migration 048 — Public holidays calendar
-- ============================================================================
--
-- Adds a per-tenant holiday calendar so the attendance + payroll engines
-- can finally tell a workday from a public holiday without HR babysitting
-- every Eid + Mawlid + Sham El Nessim.
--
-- The seed below covers the SHARED Egyptian fixed-date holidays for 2026
-- and 2027. Islamic-calendar holidays (Eid Al-Fitr, Eid Al-Adha, Mawlid,
-- Islamic New Year) shift each year — we ship best-known dates today,
-- but operators can edit/delete from /dashboard/settings/holidays when
-- the official Gregorian dates are announced.
--
-- The seed runs against public.public_holidays which is GLOBAL (no
-- company_id) — every tenant inherits the same default set. Companies
-- can also add tenant-specific custom holidays in a separate row
-- via company_id.
-- ============================================================================

create table if not exists public.public_holidays (
  id            uuid primary key default gen_random_uuid(),
  -- NULL company_id = global default (visible to every tenant).
  -- Set company_id = a real company → tenant-specific override / add.
  company_id    uuid references public.companies(id) on delete cascade,

  date          date not null,
  name_ar       text not null,
  name_en       text,

  -- Classification — used by the payroll engine to decide whether to
  -- pay the day, and by the calendar UI to color it.
  holiday_type  text not null default 'national'
                check (holiday_type in (
                  'national',       -- عيد قومي (25 يناير، 23 يوليو، 6 أكتوبر)
                  'religious',      -- ديني (الفطر، الأضحى، المولد، عيد الميلاد المجيد)
                  'seasonal',       -- موسمي (شم النسيم، رأس السنة)
                  'company',        -- إجازة شركة خاصة
                  'other'
                )),

  -- Is the day paid? Standard Egyptian holidays are paid; some
  -- company-specific holidays (e.g. half-day Thursday) are unpaid.
  is_paid       boolean not null default true,

  -- Optional notes (e.g. "نصف يوم", "تعطيل المصانع فقط")
  notes         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- A tenant can't have two rows for the same date — keeps the calendar
  -- clean (one entry per day per company).
  unique (company_id, date)
);

create index if not exists idx_public_holidays_date
  on public.public_holidays(date);
create index if not exists idx_public_holidays_company
  on public.public_holidays(company_id);


-- ----------------------------------------------------------------------------
-- RLS — anyone in the tenant can READ (so payroll/attendance can join
--       to it server-side under any role); only admin can WRITE.
--       Global rows (company_id is null) are visible to everyone.
-- ----------------------------------------------------------------------------
alter table public.public_holidays enable row level security;

drop policy if exists "public_holidays_tenant_read" on public.public_holidays;
drop policy if exists "public_holidays_admin_write" on public.public_holidays;
drop policy if exists "public_holidays_admin_update" on public.public_holidays;
drop policy if exists "public_holidays_admin_delete" on public.public_holidays;

create policy "public_holidays_tenant_read"
on public.public_holidays for select
to authenticated
using (
  -- Either a global row (no company_id) ...
  company_id is null
  -- ... or belongs to the caller's tenant.
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.company_id = public_holidays.company_id
  )
);

create policy "public_holidays_admin_write"
on public.public_holidays for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.company_id = public_holidays.company_id
  )
);

create policy "public_holidays_admin_update"
on public.public_holidays for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.company_id = public_holidays.company_id
  )
);

create policy "public_holidays_admin_delete"
on public.public_holidays for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.company_id = public_holidays.company_id
  )
);


-- ----------------------------------------------------------------------------
-- Seed: Egyptian public holidays 2026 + 2027
-- ----------------------------------------------------------------------------
-- Sources: presidential decrees + Cabinet annual schedule. Islamic
-- holidays use the announced Gregorian dates where available; HR
-- editing later is supported (UI lets the admin shift the date).

insert into public.public_holidays (date, name_ar, name_en, holiday_type, is_paid, company_id)
values
  -- ─── 2026 ───
  ('2026-01-07', 'عيد الميلاد المجيد',              'Coptic Christmas',          'religious', true, null),
  ('2026-01-25', 'عيد ثورة 25 يناير + عيد الشرطة',  '25 January Revolution',     'national',  true, null),
  ('2026-04-13', 'شم النسيم',                       'Sham El Nessim',            'seasonal',  true, null),
  ('2026-04-25', 'عيد تحرير سيناء',                 'Sinai Liberation Day',      'national',  true, null),
  ('2026-05-01', 'عيد العمال',                       'Labour Day',                'national',  true, null),
  ('2026-03-20', 'أول أيام عيد الفطر',               'Eid Al-Fitr Day 1',         'religious', true, null),
  ('2026-03-21', 'ثاني أيام عيد الفطر',              'Eid Al-Fitr Day 2',         'religious', true, null),
  ('2026-03-22', 'ثالث أيام عيد الفطر',              'Eid Al-Fitr Day 3',         'religious', true, null),
  ('2026-05-27', 'عيد الأضحى — وقفة عرفات',         'Arafat Day',                'religious', true, null),
  ('2026-05-28', 'أول أيام عيد الأضحى',              'Eid Al-Adha Day 1',         'religious', true, null),
  ('2026-05-29', 'ثاني أيام عيد الأضحى',             'Eid Al-Adha Day 2',         'religious', true, null),
  ('2026-05-30', 'ثالث أيام عيد الأضحى',             'Eid Al-Adha Day 3',         'religious', true, null),
  ('2026-06-17', 'رأس السنة الهجرية',                'Islamic New Year',          'religious', true, null),
  ('2026-06-30', 'ثورة 30 يونيو',                    '30 June Revolution',        'national',  true, null),
  ('2026-07-23', 'ثورة 23 يوليو',                    '23 July Revolution',        'national',  true, null),
  ('2026-08-25', 'المولد النبوي الشريف',             'Prophet Mohamed Birthday',  'religious', true, null),
  ('2026-10-06', 'انتصارات أكتوبر',                  'October Armed Forces Day',  'national',  true, null),

  -- ─── 2027 ───
  ('2027-01-07', 'عيد الميلاد المجيد',              'Coptic Christmas',          'religious', true, null),
  ('2027-01-25', 'عيد ثورة 25 يناير + عيد الشرطة',  '25 January Revolution',     'national',  true, null),
  ('2027-04-25', 'عيد تحرير سيناء',                 'Sinai Liberation Day',      'national',  true, null),
  ('2027-05-01', 'عيد العمال',                       'Labour Day',                'national',  true, null),
  ('2027-05-02', 'شم النسيم',                        'Sham El Nessim',            'seasonal',  true, null),
  ('2027-03-10', 'أول أيام عيد الفطر',               'Eid Al-Fitr Day 1',         'religious', true, null),
  ('2027-03-11', 'ثاني أيام عيد الفطر',              'Eid Al-Fitr Day 2',         'religious', true, null),
  ('2027-03-12', 'ثالث أيام عيد الفطر',              'Eid Al-Fitr Day 3',         'religious', true, null),
  ('2027-05-16', 'عيد الأضحى — وقفة عرفات',         'Arafat Day',                'religious', true, null),
  ('2027-05-17', 'أول أيام عيد الأضحى',              'Eid Al-Adha Day 1',         'religious', true, null),
  ('2027-05-18', 'ثاني أيام عيد الأضحى',             'Eid Al-Adha Day 2',         'religious', true, null),
  ('2027-05-19', 'ثالث أيام عيد الأضحى',             'Eid Al-Adha Day 3',         'religious', true, null),
  ('2027-06-06', 'رأس السنة الهجرية',                'Islamic New Year',          'religious', true, null),
  ('2027-06-30', 'ثورة 30 يونيو',                    '30 June Revolution',        'national',  true, null),
  ('2027-07-23', 'ثورة 23 يوليو',                    '23 July Revolution',        'national',  true, null),
  ('2027-08-14', 'المولد النبوي الشريف',             'Prophet Mohamed Birthday',  'religious', true, null),
  ('2027-10-06', 'انتصارات أكتوبر',                  'October Armed Forces Day',  'national',  true, null)
on conflict (company_id, date) do nothing;


notify pgrst, 'reload schema';
