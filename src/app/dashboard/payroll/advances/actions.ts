"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireHR } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";
import { bustDashboardCache } from "@/lib/cache";

// HR-initiated advance disbursement -- creates an advance_request
// directly in `paid` status. The standard mobile flow creates them
// in `pending` and HR approves; this skips that loop for the
// Wednesday batch where HR is generating + paying in one go.
//
// The advance auto-deducts from future payrolls via the
// compute_advance_deduction_for_month function from migration 019,
// no extra wiring needed.
export async function issueHRAdvance(formData: FormData) {
  const { supabase, profile } = await (async () => {
    const r = await requireHR();
    return r;
  })();

  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const installmentsRaw = String(formData.get("installments") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!employeeId) {
    redirect(
      "/dashboard/payroll/advances?error=" +
        encodeURIComponent("الموظف غير محدد"),
    );
  }
  const amount = Number(amountRaw);
  const installments = parseInt(installmentsRaw, 10);

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect(
      "/dashboard/payroll/advances?error=" +
        encodeURIComponent("اكتب مبلغ صحيح أكبر من صفر"),
    );
  }
  if (!Number.isFinite(installments) || installments < 1 || installments > 24) {
    redirect(
      "/dashboard/payroll/advances?error=" +
        encodeURIComponent("عدد الأقساط لازم بين 1 و 24"),
    );
  }

  // Verify the employee belongs to the caller's company. RLS already
  // enforces this on insert but a clear early failure beats a silent
  // permission denied.
  const { data: emp } = await supabase
    .from("employees")
    .select("id, company_id, full_name")
    .eq("id", employeeId)
    .eq("company_id", profile.company_id)
    .single();

  if (!emp) {
    redirect(
      "/dashboard/payroll/advances?error=" +
        encodeURIComponent("الموظف مش تابع لشركتك"),
    );
  }

  // Insert as `paid` directly. reviewed_at + reviewed_by + paid_at all
  // recorded so the audit trail tells the full story.
  const now = new Date().toISOString();
  const { error } = await supabase.from("advance_requests").insert({
    company_id: profile.company_id,
    employee_id: employeeId,
    amount,
    installments,
    reason,
    status: "paid",
    reviewed_at: now,
    reviewed_by: profile.id,
    paid_at: now,
    hr_notes:
      reason ??
      `صرف بواسطة ${profile.full_name ?? "HR"} - دفعة ${new Date().toLocaleDateString(
        "ar-EG",
      )}`,
  });

  if (error) {
    redirect(
      "/dashboard/payroll/advances?error=" +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/payroll/advances");
  revalidatePath("/dashboard/requests");
  bustDashboardCache();
  redirect(
    "/dashboard/payroll/advances?issued=" +
      encodeURIComponent(`${emp.full_name}|${amount}`),
  );
}
