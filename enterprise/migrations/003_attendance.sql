-- ============================================================================
-- Migration 003 — Attendance module
-- One attendance record per employee per date (unique constraint).
-- Statuses: present | absent | half_day | leave | holiday | weekend
-- ============================================================================

create table public.attendance (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  employee_id   uuid not null references public.employees(id) on delete cascade,
  date          date not null,
  status        text not null
                check (status in ('present', 'absent', 'half_day', 'leave', 'holiday', 'weekend')),
  check_in      time,
  check_out     time,
  hours_worked  numeric(4, 2),
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamp with time zone default now() not null,
  updated_at    timestamp with time zone default now() not null,

  unique (employee_id, date)
);

create index idx_attendance_company       on public.attendance(company_id);
create index idx_attendance_employee_date on public.attendance(employee_id, date);
create index idx_attendance_company_date  on public.attendance(company_id, date);

create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function public.tg_set_updated_at();

-- RLS — scoped to caller's company
alter table public.attendance enable row level security;

create policy "view_attendance_in_own_company"
  on public.attendance for select
  using (company_id = public.current_company_id());

create policy "manage_attendance_in_own_company"
  on public.attendance for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
