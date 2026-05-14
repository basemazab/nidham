"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/permissions";
import { bustDashboardCache } from "@/lib/cache";

function asText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function createInvitation(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const user = { id: profile.id };

  const email = asText(formData.get("email"))?.toLowerCase() ?? null;
  const fullName = asText(formData.get("full_name"));
  const role = asText(formData.get("role")) ?? "employee";

  if (!email) {
    redirect(
      "/dashboard/team?error=" +
        encodeURIComponent("الإيميل مطلوب"),
    );
  }

  if (!["admin", "manager", "employee"].includes(role)) {
    redirect(
      "/dashboard/team?error=" + encodeURIComponent("الدور غير صالح"),
    );
  }

  // Check if user with this email already exists in this company
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", profile.company_id);

  // We can't easily filter by email here (no email on profiles), so this check
  // is approximate. The trigger will gracefully handle dupes.

  const { data: invitation, error } = await supabase
    .from("team_invitations")
    .insert({
      company_id: profile.company_id,
      invited_by: user.id,
      email,
      full_name: fullName,
      role,
    })
    .select("id")
    .single();

  if (error) {
    redirect(
      "/dashboard/team?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/team");
  bustDashboardCache();
  redirect(`/dashboard/team/invited/${invitation.id}`);
}

export async function cancelInvitation(id: string) {
  await requireAdmin();
  const supabase = await createClient();

  await supabase
    .from("team_invitations")
    .update({ status: "cancelled" })
    .eq("id", id);

  revalidatePath("/dashboard/team");
  bustDashboardCache();
}

export async function resendInvitation(id: string) {
  await requireAdmin();
  const supabase = await createClient();

  // Reset expiry to 7 days from now
  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + 7);

  await supabase
    .from("team_invitations")
    .update({
      status: "pending",
      expires_at: newExpiry.toISOString(),
    })
    .eq("id", id);

  revalidatePath("/dashboard/team");
  bustDashboardCache();
  redirect(`/dashboard/team/invited/${id}`);
}
