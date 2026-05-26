-- ============================================================================
-- Migration 063 -- Employee loans / salary advances (سلف الموظفين)
-- ============================================================================
--
-- Egyptian SMB necessity. A core HR job in factories / construction /
-- workshops is processing weekly/monthly salary advances:
--   * موظف يطلب سلفة 5000 جنيه
--   * HR يعتمدها أو يرفضها
--   * الـ HR يخصم 500 جنيه شهرياً من المرتب على 10 شهور
--
-- Until now the only way to record this was in spreadsheets, which means
-- the deduction often got forgotten — losing the company money. This
-- module makes it a tracked process: every loan has a status, a remaining
-- balance, and an audit trail of installments paid.
--
-- Two tables:
--   employee_loans          — the loan itself (amount, status, remaining)
--   employee_loan_payments  — each installment paid (date, amount, period)
--
-- The two-table design lets the payroll module insert a payment row when
-- it deducts the installment, and the loan's remaining_amount is derived
-- by a trigger (so it's always in sync — no drift between manual edits
-- and payroll-driven deductions).
-- ============================================================================

create table if not exists public.employee_loans (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  employee_id         uuid not null references public.employees(id) on delete cascade,

  amount              numeric(12, 2) not null check (amount > 0),
  monthly_installment numeric(12, 2) not null check (monthly_installment > 0),
  -- Cached: amount minus sum(employee_loan_payments.amount). Kept in
  -- sync by trigger so the list page is one SELECT, not a join+aggregate.
  remaining_amount    numeric(12, 2) not null check (remaining_amount >= 0),

  reason              text,
  status              text not null default 'pending'
                      check (status in ('pending', 'approved', 'active', 'paid', 'cancelled')),

  requested_at        timestamp with time zone default now() not null,
  approved_at         timestamp with time zone,
  approved_by         uuid references auth.users(id) on delete set null,

  created_by          uuid references auth.users(id) on delete set null,
  notes               text,

  created_at          timestamp with time zone default now() not null,
  updated_at          timestamp with time zone default now() not null
);

create table if not exists public.employee_loan_payments (
  id          uuid primary key default gen_random_uuid(),
  loan_id     uuid not null references public.employee_loans(id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  paid_at     date not null default current_date,
  -- Optional link back to the payroll period that originated this payment.
  -- Null = manual entry by HR (e.g., cash deduction outside payroll).
  payroll_period_id uuid,
  notes       text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamp with time zone default now() not null
);

create index if not exists idx_employee_loans_company   on public.employee_loans(company_id);
create index if not exists idx_employee_loans_employee  on public.employee_loans(employee_id);
create index if not exists idx_employee_loans_status    on public.employee_loans(company_id, status);
create index if not exists idx_loan_payments_loan       on public.employee_loan_payments(loan_id);

-- Updated-at trigger for the loan record
create trigger employee_loans_set_updated_at
  before update on public.employee_loans
  for each row execute function public.tg_set_updated_at();

-- Trigger: whenever a payment row is inserted/deleted, recompute the
-- parent loan's remaining_amount + transition status to 'paid' when fully
-- repaid. Centralising this here keeps HR / payroll / direct SQL all in
-- sync — they can't accidentally desynchronise the cached balance.
create or replace function public.tg_loan_recompute_remaining()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loan_id uuid;
  v_paid    numeric(12, 2);
  v_amount  numeric(12, 2);
begin
  v_loan_id := coalesce(new.loan_id, old.loan_id);

  select coalesce(sum(amount), 0)
    into v_paid
    from public.employee_loan_payments
   where loan_id = v_loan_id;

  select amount into v_amount
    from public.employee_loans
   where id = v_loan_id;

  update public.employee_loans
     set remaining_amount = greatest(0, v_amount - v_paid),
         status = case
                    when v_amount - v_paid <= 0 then 'paid'
                    when status = 'pending' then status  -- don't auto-activate
                    when status = 'cancelled' then status
                    else 'active'
                  end,
         updated_at = now()
   where id = v_loan_id;

  return null;
end;
$$;

create trigger loan_payments_recompute
  after insert or delete on public.employee_loan_payments
  for each row execute function public.tg_loan_recompute_remaining();

-- ── RLS ──
alter table public.employee_loans         enable row level security;
alter table public.employee_loan_payments enable row level security;

create policy "view_loans_in_own_company"
  on public.employee_loans for select
  using (company_id = public.current_company_id());

create policy "manage_loans_in_own_company"
  on public.employee_loans for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- Payments inherit the parent loan's company scoping via the FK.
create policy "view_loan_payments_in_own_company"
  on public.employee_loan_payments for select
  using (
    loan_id in (
      select id from public.employee_loans
       where company_id = public.current_company_id()
    )
  );

create policy "manage_loan_payments_in_own_company"
  on public.employee_loan_payments for all
  using (
    loan_id in (
      select id from public.employee_loans
       where company_id = public.current_company_id()
    )
  )
  with check (
    loan_id in (
      select id from public.employee_loans
       where company_id = public.current_company_id()
    )
  );

notify pgrst, 'reload schema';
