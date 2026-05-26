-- ============================================================================
-- Migration 068 — Audit-driven hardening (J6)
-- ============================================================================
--
-- Two bugs uncovered by a system-wide audit (after the pii_decrypt issue
-- exposed a class of "we noticed and worked around it" hidden bugs):
--
--   J6a) signature_captures has no unique constraint on request_id, so
--        two concurrent submissions of the same signing token can each
--        INSERT a capture row. We DO check request.status before
--        accepting, but in a race both checks fire before either INSERT
--        sees the other's UPDATE → two captures, one signature_request.
--
--   J6b) employee_loan_payments has remaining_amount >= 0 enforced (via
--        the trigger's greatest(0, ...) clamp), but no invariant on
--        sum(payments) <= amount. Two concurrent payments racing past
--        the application-level check both INSERT successfully and the
--        trigger silently clamps; the loan looks "paid off" but the
--        company has effectively received over-payment that doesn't
--        reflect in the audit trail.
--
-- ============================================================================

-- ── J6a: one capture per signature request ──
alter table public.signature_captures
  add constraint signature_captures_one_per_request
  unique (request_id);

comment on constraint signature_captures_one_per_request
  on public.signature_captures is
  'Enforces single-signer-per-request semantics. Race between two concurrent submissions can no longer leave two captures attached to one request.';


-- ── J6b: enforce sum(payments) <= loan.amount in the recompute trigger ──
-- The function already exists from mig 063. We're replacing it with a
-- version that raises an exception instead of silently clamping to 0.
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

  -- J6b: reject over-payment instead of silently clamping. PostgreSQL
  -- will roll back the offending INSERT and the client gets a clear
  -- error instead of a corrupted "paid" loan with a phantom surplus.
  if (tg_op = 'INSERT') and v_paid > v_amount then
    raise exception 'مجموع الدفعات (% ج) أكبر من قيمة السلفة (% ج) — راجع الدفعات السابقة',
      v_paid, v_amount
      using errcode = 'P0001';
  end if;

  update public.employee_loans
     set remaining_amount = greatest(0, v_amount - v_paid),
         status = case
                    when v_amount - v_paid <= 0 then 'paid'
                    when status = 'pending' then status
                    when status = 'cancelled' then status
                    else 'active'
                  end,
         updated_at = now()
   where id = v_loan_id;

  return null;
end;
$$;

comment on function public.tg_loan_recompute_remaining() is
  'Recomputes loan remaining_amount + status after each payment. As of mig 068, also rejects payments that would push sum(payments) above loan.amount.';

notify pgrst, 'reload schema';
