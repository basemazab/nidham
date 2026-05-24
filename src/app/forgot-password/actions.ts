"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/password";
import {
  checkPasswordResetRateLimit,
  checkPasswordUpdateRateLimit,
} from "@/lib/rate-limit";

async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect(
      "/forgot-password?error=" + encodeURIComponent("الإيميل مطلوب"),
    );
  }

  // Rate-limit BEFORE sending the email. Stops both spam (one IP
  // emailing a victim repeatedly) and bulk enumeration (one IP cycling
  // through many emails).
  const ip = await getClientIp();
  const rl = checkPasswordResetRateLimit(ip, email);
  if (!rl.ok) {
    // Reveal the wait time but NOT whether the email is a valid user
    // — same "sent?" success message wins either way at the redirect.
    redirect(
      "/forgot-password?error=" +
        encodeURIComponent(
          `حاولت كتير. جرّب بعد ${Math.ceil(rl.retryAfterSeconds / 60)} دقيقة.`,
        ),
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

  // Rate-limit post-reset attempts. The user just clicked an email link
  // — they shouldn't need 50 tries to type a password.
  const ip = await getClientIp();
  const rl = checkPasswordUpdateRateLimit(ip);
  if (!rl.ok) {
    redirect(
      "/update-password?error=" +
        encodeURIComponent(
          `حاولت كتير. جرّب بعد ${Math.ceil(rl.retryAfterSeconds / 60)} دقيقة.`,
        ),
    );
  }

  // Centralised password policy (12+ chars + complexity rules).
  const pw = validatePassword(password);
  if (!pw.ok) {
    redirect("/update-password?error=" + encodeURIComponent(pw.reason));
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
