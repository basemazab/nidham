-- ============================================================================
-- Migration 010 — Employee Code (for ZKTeco / external device matching)
-- Adds a `code` field on employees so bulk-imported attendance rows can be
-- matched to the correct employee. The code is whatever ID the company's
-- biometric/HR system uses (often a number like "100" or "EMP-042").
-- ============================================================================

alter table public.employees
  add column employee_code text;

create index idx_employees_company_code
  on public.employees(company_id, employee_code)
  where employee_code is not null;
