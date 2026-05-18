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

/**
 * Remove an existing tenant member (manager / employee / even an admin
 * that isn't you). Wipes the profiles row, which is the source of truth
 * for "is this user inside this company". The auth.users row is left
 * intact intentionally — if HR ever wants to invite the same person
 * back, they don't have to recreate an auth account.
 *
 * Safety:
 *   - admin-only (requireAdmin())
 *   - you can never remove yourself (avoids lockouts)
 *   - target must be in the same company (defends against a crafted
 *     member_id pointing at another tenant's user)
 */
export async function removeMember(formData: FormData) {
  const { supabase, profile: actor } = await requireAdmin();

  const memberId = String(formData.get("member_id") ?? "").trim();
  if (!memberId) {
    redirect(
      "/dashboard/team?error=" +
        encodeURIComponent("معرف العضو مطلوب"),
    );
  }

  // Refuse to delete yourself.
  if (memberId === actor.id) {
    redirect(
      "/dashboard/team?error=" +
        encodeURIComponent("مش تقدر تحذف نفسك من الفريق"),
    );
  }

  // Verify target lives inside the same tenant.
  // Preview check so we can surface a friendly "member not in your
  // company" error before invoking the RPC. The RPC ALSO checks this
  // (it's SECURITY DEFINER and walks the tenant chain server-side),
  // but the app-side guard gives a cleaner error message.
  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name, role, company_id")
    .eq("id", memberId)
    .eq("company_id", actor.company_id)
    .maybeSingle<{
      id: string;
      full_name: string | null;
      role: "admin" | "manager" | "employee";
      company_id: string;
    }>();

  if (!target) {
    redirect(
      "/dashboard/team?error=" +
        encodeURIComponent("العضو ده مش موجود في فريقك"),
    );
  }

  // CRITICAL: profiles has SELECT + UPDATE RLS policies (mig 001 + 008)
  // but no DELETE policy, so a plain user-scoped DELETE returns
  // 0-rows-affected without raising an error — the action would
  // silently "succeed" while leaving the member intact. We use a
  // SECURITY DEFINER RPC (mig 046) that performs the delete with
  // application-layer admin + same-tenant checks built in.
  const { error } = await supabase.rpc("remove_team_member", {
    p_target_id: memberId,
  });

  if (error) {
    redirect(
      "/dashboard/team?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/team");
  bustDashboardCache();
  redirect("/dashboard/team?deleted=1");
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
