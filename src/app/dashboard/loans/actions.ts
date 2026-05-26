"use server";

// ============================================================================
// Loan / advance server actions (سلف الموظفين)
// ============================================================================
//
// Three workflows:
//   1. createLoan       — HR records a new advance request for an employee.
//   2. approveLoan      — HR (or admin) marks an existing pending loan as
//                          approved → active so payroll deductions can start.
//   3. recordPayment    — HR records an installment payment (date + amount).
//                          The trigger in migration 063 auto-decrements the
//                          loan's remaining_amount and flips status → "paid"
//                          when the balance hits zero.
//   4. cancelLoan       — HR cancels a loan that won't proceed.
//
// All actions go through requireHR() (which redirects to /login on
// unauthed) and use RLS for tenant scoping.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHR } from "@/lib/permissions";

/** Parse a positive numeric form value, returning 0 if missing/invalid. */
function asPositiveNumber(value: FormDataEntryValue | null): number {
  if (value === null) return 0;
  const n = parseFloat(String(value).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

/** Trim + return null for empty strings. */
function asText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export async function createLoan(formData: FormData) {
  const { supabase, profile } = await requireHR();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const employeeId = asText(formData.get("employee_id"));
  const amount = asPositiveNumber(formData.get("amount"));
  const monthlyInstallment = asPositiveNumber(
    formData.get("monthly_installment"),
  );
  const reason = asText(formData.get("reason"));
  const status = asText(formData.get("status")) ?? "pending";

  if (!employeeId) {
    redirect(
      "/dashboard/loans/new?error=" + encodeURIComponent("اختار الموظف الأول"),
    );
  }
  if (amount <= 0) {
    redirect(
      "/dashboard/loans/new?error=" +
        encodeURIComponent("قيمة السلفة لازم تكون أكبر من صفر"),
    );
  }
  if (monthlyInstallment <= 0) {
    redirect(
      "/dashboard/loans/new?error=" +
        encodeURIComponent("القسط الشهري لازم يكون أكبر من صفر"),
    );
  }
  if (monthlyInstallment > amount) {
    redirect(
      "/dashboard/loans/new?error=" +
        encodeURIComponent("القسط الشهري ما يصحش يكون أكبر من قيمة السلفة"),
    );
  }
  if (!["pending", "approved", "active"].includes(status)) {
    redirect(
      "/dashboard/loans/new?error=" +
        encodeURIComponent("حالة غير صحيحة"),
    );
  }

  // Defensive: confirm the employee belongs to the caller's company. RLS
  // would block the insert otherwise, but the redirect-error UX is nicer
  // than an opaque DB error.
  const { data: emp } = await supabase
    .from("employees")
    .select("id, company_id")
    .eq("id", employeeId)
    .eq("company_id", profile.company_id)
    .maybeSingle<{ id: string; company_id: string }>();
  if (!emp) {
    redirect(
      "/dashboard/loans/new?error=" + encodeURIComponent("الموظف ده مش موجود"),
    );
  }

  const { error } = await supabase.from("employee_loans").insert({
    company_id: profile.company_id,
    employee_id: employeeId,
    amount,
    monthly_installment: monthlyInstallment,
    remaining_amount: amount, // starts at full amount, decremented by payment trigger
    reason,
    status,
    approved_at: status !== "pending" ? new Date().toISOString() : null,
    approved_by: status !== "pending" ? user.id : null,
    created_by: user.id,
  });

  if (error) {
    redirect(
      "/dashboard/loans/new?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/loans");
  redirect("/dashboard/loans?saved=1");
}

export async function approveLoan(formData: FormData) {
  const { supabase } = await requireHR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const loanId = asText(formData.get("loan_id"));
  if (!loanId) {
    redirect("/dashboard/loans?error=" + encodeURIComponent("رقم السلفة مفقود"));
  }

  const { error } = await supabase
    .from("employee_loans")
    .update({
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq("id", loanId)
    .eq("status", "pending"); // idempotent — won't re-approve

  if (error) {
    redirect("/dashboard/loans?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/dashboard/loans");
  redirect("/dashboard/loans?approved=1");
}

export async function recordPayment(formData: FormData) {
  const { supabase } = await requireHR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const loanId = asText(formData.get("loan_id"));
  const amount = asPositiveNumber(formData.get("amount"));
  const paidAt = asText(formData.get("paid_at"));
  const notes = asText(formData.get("notes"));

  if (!loanId) {
    redirect("/dashboard/loans?error=" + encodeURIComponent("رقم السلفة مفقود"));
  }
  if (amount <= 0) {
    redirect(
      "/dashboard/loans?error=" + encodeURIComponent("قيمة الدفعة مطلوبة"),
    );
  }

  // Defensive: don't allow a payment greater than the remaining balance
  // — the constraint on the loans table would still catch it via
  // `remaining_amount >= 0` after the trigger fires, but a clear error
  // upfront is friendlier than a generic constraint violation.
  const { data: loan } = await supabase
    .from("employee_loans")
    .select("id, remaining_amount, status")
    .eq("id", loanId)
    .maybeSingle<{ id: string; remaining_amount: number; status: string }>();

  if (!loan) {
    redirect("/dashboard/loans?error=" + encodeURIComponent("السلفة دي مش موجودة"));
  }
  if (loan.status === "cancelled") {
    redirect(
      "/dashboard/loans?error=" +
        encodeURIComponent("مش تقدر تسجل دفعة على سلفة ملغية"),
    );
  }
  if (amount > Number(loan.remaining_amount)) {
    redirect(
      "/dashboard/loans?error=" +
        encodeURIComponent(
          `قيمة الدفعة أكبر من الرصيد المتبقي (${Number(loan.remaining_amount).toLocaleString("ar-EG")} ج)`,
        ),
    );
  }

  const { error } = await supabase.from("employee_loan_payments").insert({
    loan_id: loanId,
    amount,
    paid_at: paidAt ?? new Date().toISOString().split("T")[0],
    notes,
    created_by: user.id,
  });

  if (error) {
    redirect("/dashboard/loans?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/dashboard/loans");
  redirect("/dashboard/loans?payment=1");
}

export async function cancelLoan(formData: FormData) {
  const { supabase } = await requireHR();

  const loanId = asText(formData.get("loan_id"));
  if (!loanId) {
    redirect("/dashboard/loans?error=" + encodeURIComponent("رقم السلفة مفقود"));
  }

  // Don't allow cancelling a loan that's already had payments — that
  // would leave dangling payment rows. Cancel only pending / approved
  // loans before any installment is paid.
  const { count: paymentCount } = await supabase
    .from("employee_loan_payments")
    .select("id", { count: "exact", head: true })
    .eq("loan_id", loanId);

  if ((paymentCount ?? 0) > 0) {
    redirect(
      "/dashboard/loans?error=" +
        encodeURIComponent(
          "مش تقدر تلغي سلفة فيها دفعات. عدّل القيم أو ادفع المتبقي.",
        ),
    );
  }

  const { error } = await supabase
    .from("employee_loans")
    .update({ status: "cancelled" })
    .eq("id", loanId)
    .neq("status", "paid");

  if (error) {
    redirect("/dashboard/loans?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/dashboard/loans");
  redirect("/dashboard/loans?cancelled=1");
}
