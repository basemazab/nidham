"use server";

// ============================================================================
// 2FA setup + verify + disable server actions
// ============================================================================
//
// Flow:
//   1. User clicks "Set up 2FA" → start2faSetup() generates a fresh
//      secret, stores it encrypted (set_my_totp_secret RPC), returns
//      the otpauth URL for the QR.
//   2. User scans the QR with their authenticator app, types the first
//      6-digit code. confirm2faSetup(code) verifies it. On success,
//      enable_my_2fa() flips the flag — from this point onward login
//      requires the code.
//   3. To turn off, user calls disable2fa() — the secret is wiped.
//
// The setup secret is generated server-side and persisted ONCE; the
// browser never sees it after the first response. If the user loses
// their authenticator, they must disable + re-enable (which generates
// a fresh secret).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  generateTotpSecret,
  buildOtpauthUrl,
  verifyTotpCode,
} from "@/lib/totp";

/**
 * Start the setup flow. Returns the otpauth:// URL + the raw base32
 * secret (shown as a backup string under the QR). The client builds
 * the QR image from the URL using qrcode.react.
 */
export async function start2faSetup(): Promise<
  { ok: true; otpauthUrl: string; secret: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "غير مسجّل دخول" };

  const secret = generateTotpSecret();
  const otpauthUrl = buildOtpauthUrl({
    secret,
    accountEmail: user.email,
  });

  const { error } = await supabase.rpc("set_my_totp_secret", {
    p_secret: secret,
  });
  if (error) {
    return { ok: false, error: "تعذّر حفظ مفتاح 2FA — حاول تاني" };
  }

  return { ok: true, otpauthUrl, secret };
}

export async function confirm2faSetup(formData: FormData) {
  const supabase = await createClient();
  const code = String(formData.get("code") ?? "").trim();

  // Pull the secret back out (decrypted by the RPC).
  const { data: secret } = await supabase.rpc("get_my_totp_secret");
  if (!secret || typeof secret !== "string") {
    redirect(
      "/dashboard/profile/2fa?error=" +
        encodeURIComponent("ابدأ الإعداد من الأول — مفيش مفتاح محفوظ"),
    );
  }

  if (!verifyTotpCode({ secret, code })) {
    redirect(
      "/dashboard/profile/2fa?error=" +
        encodeURIComponent("الكود غلط أو منتهي — حاول تاني"),
    );
  }

  const { error } = await supabase.rpc("enable_my_2fa");
  if (error) {
    redirect(
      "/dashboard/profile/2fa?error=" +
        encodeURIComponent("تعذّر تفعيل 2FA — حاول تاني"),
    );
  }

  // Force a re-login so the next session goes through the 2FA challenge
  // and gets the 2FA-passed cookie. Without this, the existing session
  // would keep working forever without ever being asked for the code —
  // an indefinite bypass for anyone who held a session token from
  // before 2FA was turned on.
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?two_factor=enabled");
}

export async function disable2fa() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("disable_my_2fa");
  if (error) {
    redirect(
      "/dashboard/profile/2fa?error=" +
        encodeURIComponent("تعذّر إيقاف 2FA"),
    );
  }
  revalidatePath("/dashboard/profile");
  redirect("/dashboard/profile?two_factor=disabled");
}
