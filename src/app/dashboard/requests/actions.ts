"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireHR } from "@/lib/permissions";

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
  revalidatePath("/dashboard/requests");
  revalidatePath(backUrl);
  redirect("/dashboard/requests?decided=1");
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

  revalidatePath("/dashboard/requests");
  revalidatePath(`/dashboard/requests/advance/${id}`);
}
