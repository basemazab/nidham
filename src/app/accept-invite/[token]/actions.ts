"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/password";
import { checkInvitationClaimRateLimit } from "@/lib/rate-limit";

/** Get the caller's IP from Vercel's forwarded headers. */
async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function acceptInvitation(token: string, formData: FormData) {
  // Rate-limit BEFORE any DB work. Otherwise a brute-forcer tracking
  // the response timing of valid vs invalid tokens could enumerate.
  const ip = await getClientIp();
  const rl = checkInvitationClaimRateLimit(ip);
  if (!rl.ok) {
    redirect(
      `/accept-invite/${token}?error=` +
        encodeURIComponent(
          `حاولت كتير في وقت قصير. جرّب بعد ${Math.ceil(
            rl.retryAfterSeconds / 60,
          )} دقيقة.`,
        ),
    );
  }

  const supabase = await createClient();

  // Validate the invitation via the public RPC function
  const { data: invitations, error: lookupError } = await supabase.rpc(
    "get_invitation_by_token",
    { p_token: token },
  );

  if (lookupError || !invitations || invitations.length === 0) {
    redirect(`/accept-invite/${token}?error=` + encodeURIComponent("الدعوة مش موجودة"));
  }

  const invitation = invitations[0];

  if (invitation.status !== "pending") {
    redirect(
      `/accept-invite/${token}?error=` +
        encodeURIComponent("الدعوة دي مش متاحة (مقبولة قبل كده أو ملغية)"),
    );
  }

  if (new Date(invitation.expires_at) < new Date()) {
    redirect(
      `/accept-invite/${token}?error=` + encodeURIComponent("الدعوة منتهية الصلاحية"),
    );
  }

  // Centralised password policy (12+ chars + complexity rules).
  const password = String(formData.get("password") ?? "");
  const pw = validatePassword(password);
  if (!pw.ok) {
    redirect(
      `/accept-invite/${token}?error=` + encodeURIComponent(pw.reason),
    );
  }

  const fullName =
    String(formData.get("full_name") ?? "").trim() ||
    invitation.full_name ||
    invitation.email.split("@")[0];

  const { error: signupError } = await supabase.auth.signUp({
    email: invitation.email,
    password,
    options: {
      data: {
        invite_token: token,
        full_name: fullName,
      },
    },
  });

  if (signupError) {
    redirect(
      `/accept-invite/${token}?error=` + encodeURIComponent(signupError.message),
    );
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
