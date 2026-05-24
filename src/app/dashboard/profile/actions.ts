"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/permissions";
import { validatePassword } from "@/lib/password";

export async function updateMyProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) {
    redirect(
      "/dashboard/profile?error=" + encodeURIComponent("اسمك مطلوب"),
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (error) {
    redirect(
      "/dashboard/profile?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/profile?profile_updated=1");
}

// Change password with re-authentication. A stolen session cookie used to
// be able to silently rotate the password (locking the rightful owner
// out and persisting access for the attacker); require proof that the
// caller knows the current password before applying the change.
export async function changeMyPassword(formData: FormData) {
  const currentPassword = String(formData.get("current_password") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!currentPassword) {
    redirect(
      "/dashboard/profile?error=" +
        encodeURIComponent("كلمة السر الحالية مطلوبة"),
    );
  }
  // Centralised password policy (12+ chars + complexity rules).
  const pw = validatePassword(password);
  if (!pw.ok) {
    redirect("/dashboard/profile?error=" + encodeURIComponent(pw.reason));
  }
  if (password === currentPassword) {
    redirect(
      "/dashboard/profile?error=" +
        encodeURIComponent("كلمة السر الجديدة لازم تكون مختلفة عن الحالية"),
    );
  }
  if (password !== confirmPassword) {
    redirect(
      "/dashboard/profile?error=" +
        encodeURIComponent("كلمة السر الجديدة وتأكيدها مش مطابقين"),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) redirect("/login");

  // Re-verify the current password. signInWithPassword refreshes the
  // session, which is harmless on success; on failure we get a clean
  // "invalid credentials" we can translate to Arabic.
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthErr) {
    redirect(
      "/dashboard/profile?error=" +
        encodeURIComponent("كلمة السر الحالية غلط"),
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(
      "/dashboard/profile?error=" + encodeURIComponent(error.message),
    );
  }

  redirect("/dashboard/profile?password_changed=1");
}

export async function updateMyCompany(formData: FormData) {
  const { supabase, profile } = await requireAdmin();

  const companyName = String(formData.get("company_name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim() || null;

  if (!companyName) {
    redirect(
      "/dashboard/profile?error=" + encodeURIComponent("اسم الشركة مطلوب"),
    );
  }

  const { error } = await supabase
    .from("companies")
    .update({ name: companyName, industry })
    .eq("id", profile.company_id);

  if (error) {
    redirect(
      "/dashboard/profile?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/profile?company_updated=1");
}
