"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvitation(token: string, formData: FormData) {
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

  const password = String(formData.get("password") ?? "");
  if (!password || password.length < 6) {
    redirect(
      `/accept-invite/${token}?error=` +
        encodeURIComponent("كلمة السر لازم 6 حروف على الأقل"),
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
