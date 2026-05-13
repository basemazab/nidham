"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect(
      "/forgot-password?error=" + encodeURIComponent("الإيميل مطلوب"),
    );
  }

  const supabase = await createClient();
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });

  // We intentionally don't reveal whether the email exists (security best practice).
  // Always show the same success message.
  if (error) {
    console.error("Password reset error:", error.message);
  }

  redirect("/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  if (!password || password.length < 6) {
    redirect(
      "/update-password?error=" +
        encodeURIComponent("كلمة السر لازم تبقى 6 حروف على الأقل"),
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(
      "/update-password?error=" + encodeURIComponent(error.message),
    );
  }

  redirect("/dashboard?password_updated=1");
}
