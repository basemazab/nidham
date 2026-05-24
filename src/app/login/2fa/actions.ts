"use server";

// ============================================================================
// 2FA login challenge — verify the 6-digit code, gate access to /dashboard
// ============================================================================
//
// The user already passed signInWithPassword by the time they hit this
// action — the session is active but they haven't proven knowledge of
// the second factor yet. On success we set a session-scoped cookie
// `nidham_2fa_pass` so middleware (and other guards) can tell this
// session has cleared 2FA. The cookie dies on browser close.

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyTotpCode } from "@/lib/totp";
import { checkLoginRateLimit } from "@/lib/rate-limit";

async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function verifyLogin2fa(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();

  // Rate-limit per IP — same budget as the password login. A 2FA-aware
  // attacker can guess 6 digits in 10^6 / 2 = 500k attempts on average,
  // but the rate limit + TOTP's 30s window makes it impractical.
  const ip = await getClientIp();
  const rl = checkLoginRateLimit(ip, null);
  if (!rl.ok) {
    redirect(
      `/login/2fa?error=${encodeURIComponent(
        `حاولت كتير. جرّب بعد ${Math.ceil(rl.retryAfterSeconds / 60)} دقيقة.`,
      )}`,
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Session expired between login and this challenge — start over.
    redirect("/login?error=" + encodeURIComponent("انتهت الجلسة — سجّل دخول تاني"));
  }

  const { data: secret } = await supabase.rpc("get_my_totp_secret");
  if (!secret || typeof secret !== "string") {
    // 2FA was disabled between password verification and now — skip
    // the challenge entirely.
    redirect("/dashboard");
  }

  if (!verifyTotpCode({ secret, code })) {
    redirect(
      "/login/2fa?error=" + encodeURIComponent("الكود غلط — جرّب تاني"),
    );
  }

  // Mark this session as 2FA-cleared. No maxAge = browser-session
  // cookie (dies on tab close). Httponly + secure + sameSite=lax keep
  // it out of JS and CSRF reach.
  const cookieStore = await cookies();
  cookieStore.set("nidham_2fa_pass", "ok", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  redirect("/dashboard");
}
