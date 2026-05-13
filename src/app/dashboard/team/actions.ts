"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function asText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function createInvitation(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get inviter's profile (must be admin)
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) throw new Error("Profile not found");
  if (profile.role !== "admin") {
    redirect(
      "/dashboard/team?error=" +
        encodeURIComponent("لازم تكون مدير عشان تدعو موظفين"),
    );
  }

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
  redirect(`/dashboard/team/invited/${invitation.id}`);
}

export async function cancelInvitation(id: string) {
  const supabase = await createClient();

  await supabase
    .from("team_invitations")
    .update({ status: "cancelled" })
    .eq("id", id);

  revalidatePath("/dashboard/team");
}

export async function resendInvitation(id: string) {
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
  redirect(`/dashboard/team/invited/${id}`);
}
