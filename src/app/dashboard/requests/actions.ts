"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireHR } from "@/lib/permissions";
import { bustDashboardCache } from "@/lib/cache";
import {
  sendEmail,
  emailLeaveDecision,
  emailAdvanceDecision,
  emailAdvancePaid,
} from "@/lib/email";
import { LEAVE_TYPE_LABELS_AR, type LeaveType } from "@/lib/requests";

type RequestKind = "leave" | "advance" | "permission";

const TABLE_OF: Record<RequestKind, string> = {
  leave: "leave_requests",
  advance: "advance_requests",
  permission: "permission_requests",
};

function asText(value: FormDataEntryValue | null): string | null {
  if (value === null || typeof value !== "string") return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

/**
 * Approve or reject a pending request. We require the row to be pending
 * in the WHERE clause so a replayed POST can't flip a paid advance back
 * to "approved" or revive a cancelled leave.
 */
export async function decideRequest(
  kind: RequestKind,
  id: string,
  decision: "approved" | "rejected",
  formData: FormData,
) {
  const { profile } = await requireHR();
  const supabase = await createClient();
  const user = { id: profile.id };

  const hrNotes = asText(formData.get("hr_notes"));

  const { error } = await supabase
    .from(TABLE_OF[kind])
    .update({
      status: decision,
      hr_notes: hrNotes,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", id)
    .eq("status", "pending");

  const backUrl = `/dashboard/requests/${kind}/${id}`;
  if (error) {
    redirect(`${backUrl}?error=${encodeURIComponent(error.message)}`);
  }

  // Fire-and-forget employee notification. Failures are logged inside
  // sendEmail; we never block the decision flow on them.
  void notifyDecision(supabase, kind, id, decision, hrNotes);

  revalidatePath("/dashboard/requests");
  bustDashboardCache();
  revalidatePath(backUrl);
  redirect("/dashboard/requests?decided=1");
}

// Look up the request + employee + their auth email, then send the
// appropriate templated message. Skips silently if the employee row
// has no linked auth user yet (rare; mobile-claim hasn't happened).
async function notifyDecision(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: RequestKind,
  id: string,
  decision: "approved" | "rejected",
  hrNotes: string | null,
) {
  try {
    if (kind === "leave") {
      const { data } = await supabase
        .from("leave_requests")
        .select(
          `leave_type, start_date, end_date, days_count,
           employees!inner(full_name, email, user_id)`,
        )
        .eq("id", id)
        .single<{
          leave_type: string;
          start_date: string;
          end_date: string;
          days_count: number;
          employees: {
            full_name: string;
            email: string | null;
            user_id: string | null;
          };
        }>();
      if (!data) return;
      const email = await resolveEmail(supabase, data.employees);
      if (!email) return;
      await sendEmail(
        emailLeaveDecision({
          to: email,
          employeeName: data.employees.full_name,
          leaveTypeAr:
            LEAVE_TYPE_LABELS_AR[data.leave_type as LeaveType] ?? data.leave_type,
          startDate: data.start_date,
          endDate: data.end_date,
          daysCount: Number(data.days_count),
          decision,
          hrNotes,
        }),
      );
      return;
    }

    if (kind === "advance") {
      const { data } = await supabase
        .from("advance_requests")
        .select(
          `amount, installments,
           employees!inner(full_name, email, user_id)`,
        )
        .eq("id", id)
        .single<{
          amount: number;
          installments: number;
          employees: {
            full_name: string;
            email: string | null;
            user_id: string | null;
          };
        }>();
      if (!data) return;
      const email = await resolveEmail(supabase, data.employees);
      if (!email) return;
      await sendEmail(
        emailAdvanceDecision({
          to: email,
          employeeName: data.employees.full_name,
          amount: Number(data.amount),
          installments: data.installments,
          decision,
          hrNotes,
        }),
      );
      return;
    }

    // permission: no email for now -- noisy and HR usually approves the
    // same day. Easy to add later.
  } catch (err) {
    console.warn("notifyDecision failed:", err);
  }
}

// Resolve the best email to use for an employee: prefer the employee
// record's `email` field, fall back to the linked auth user's address.
async function resolveEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  emp: { email: string | null; user_id: string | null },
): Promise<string | null> {
  if (emp.email && emp.email.includes("@")) return emp.email;
  if (!emp.user_id) return null;
  // The current session user can read their own profile.email via
  // auth.getUser, but we're acting on behalf of HR. We don't have a
  // service_role client wired up; skip rather than over-engineer.
  return null;
}

/**
 * Mark an approved advance as 'paid' once the HR has actually disbursed it.
 * Locks to status='approved' so paid advances can't be paid twice.
 */
export async function markAdvancePaid(id: string) {
  await requireHR();
  const supabase = await createClient();
  await supabase
    .from("advance_requests")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "approved");

  // Best-effort "تم الصرف" email.
  void (async () => {
    try {
      const { data } = await supabase
        .from("advance_requests")
        .select(`amount, employees!inner(full_name, email)`)
        .eq("id", id)
        .single<{
          amount: number;
          employees: { full_name: string; email: string | null };
        }>();
      if (!data?.employees?.email) return;
      await sendEmail(
        emailAdvancePaid({
          to: data.employees.email,
          employeeName: data.employees.full_name,
          amount: Number(data.amount),
        }),
      );
    } catch (err) {
      console.warn("markAdvancePaid email failed:", err);
    }
  })();

  revalidatePath("/dashboard/requests");
  bustDashboardCache();
  revalidatePath(`/dashboard/requests/advance/${id}`);
}
