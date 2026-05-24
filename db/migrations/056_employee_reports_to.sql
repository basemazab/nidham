-- ============================================================================
-- Migration 056 — Reporting structure (org chart) on employees
-- ============================================================================
--
-- Adds employees.reports_to so the dashboard can render an org chart
-- and so future approval workflows (B4) can walk "manager → HR → CEO"
-- chains without a separate table.
--
-- Self-referential FK with ON DELETE SET NULL so terminating a manager
-- doesn't cascade-delete their reports. The cycle-detection trigger
-- below stops anyone from accidentally making A → B → A loops which
-- would crash recursive CTEs in the org-chart query.
-- ============================================================================

alter table public.employees
  add column if not exists reports_to uuid references public.employees(id) on delete set null;

create index if not exists idx_employees_reports_to
  on public.employees(reports_to)
  where reports_to is not null;

comment on column public.employees.reports_to is
  'The employee this person reports to. NULL for org root(s). Cycle-protected by tg_check_reports_to_cycle.';


-- ----------------------------------------------------------------------------
-- Cycle guard — prevents A → B → A loops via a depth-limited walk
-- ----------------------------------------------------------------------------
create or replace function public.tg_check_reports_to_cycle()
returns trigger
language plpgsql
as $$
declare
  v_current uuid := new.reports_to;
  v_depth   int  := 0;
begin
  -- A NULL reports_to is fine (root). A self-reference is not.
  if new.reports_to is null then
    return new;
  end if;
  if new.reports_to = new.id then
    raise exception 'Employee cannot report to themselves (id=%)', new.id;
  end if;

  -- Walk up the chain. Bail out at depth 32 — that's the deepest real
  -- org chart we've ever seen, and stops a malicious cycle from
  -- DoSing the trigger.
  while v_current is not null and v_depth < 32 loop
    if v_current = new.id then
      raise exception 'Cycle detected in reports_to chain at id=%', new.id;
    end if;
    select reports_to into v_current
      from public.employees
     where id = v_current;
    v_depth := v_depth + 1;
  end loop;

  return new;
end;
$$;

drop trigger if exists employees_check_reports_to_cycle on public.employees;
create trigger employees_check_reports_to_cycle
  before insert or update of reports_to
  on public.employees
  for each row execute function public.tg_check_reports_to_cycle();


notify pgrst, 'reload schema';
