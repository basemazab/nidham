"use server";

// ============================================================================
// /onboard — Server actions for employee self-onboarding
// ============================================================================

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function asText(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/**
 * Save the current onboarding step. The employee record is identified
 * via the auth user's user_id link — they can't update anyone else's
 * record because RLS scopes to their company AND the trigger lookup
 * uses auth.uid().
 *
 * The PII columns (national_id, bank_*) flow through the encryption
 * trigger from mig 050/061/067 — we write plaintext, the trigger
 * encrypts to *_encrypted and clears the plaintext column.
 */
export async function saveOnboardingStep(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboard");

  // Find the employee record this user is linked to
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();
  if (!emp) {
    redirect("/onboard?error=" + encodeURIComponent("حسابك مش متربط بموظف"));
  }

  // Collect ALL possible fields from the form. Any field missing in the
  // current step is simply undefined → not included in the update → the
  // existing value is preserved. This lets the wizard save partial
  // progress on every step.
  const update: Record<string, string | null> = {};

  const trackField = (name: string, formKey: string) => {
    if (formData.has(formKey)) {
      update[name] = asText(formData.get(formKey));
    }
  };

  trackField("full_name", "full_name");
  trackField("date_of_birth", "date_of_birth");
  trackField("national_id", "national_id");
  trackField("phone", "phone");
  trackField("email", "email");
  trackField("bank_name", "bank_name");
  trackField("bank_account_number", "bank_account_number");
  trackField("avatar_url", "avatar_url");

  if (Object.keys(update).length === 0) {
    // No changes — just go to next step
    return;
  }

  const { error } = await supabase
    .from("employees")
    .update(update)
    .eq("id", emp.id);

  if (error) {
    redirect(
      "/onboard?error=" + encodeURIComponent("ما قدرناش نحفظ: " + error.message),
    );
  }

  revalidatePath("/onboard");
  revalidatePath("/dashboard/employees");
}

/**
 * Mark onboarding as complete. The wizard calls this on the final step
 * after the user reviews + confirms. We don't have a dedicated column
 * for it (yet) — instead the dashboard infers "complete" from having
 * national_id + at least one bank field. Future iteration could add
 * an explicit onboarding_status column.
 */
export async function completeOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Just revalidate caches — the actual completion signal is data presence
  revalidatePath("/onboard");
  revalidatePath("/dashboard/employees");
  redirect("/onboard?done=1");
}
