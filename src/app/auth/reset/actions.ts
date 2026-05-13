"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function verifyResetToken(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const next = String(formData.get("next") ?? "/update-password");

  if (!tokenHash) {
    redirect(
      "/?error=access_denied&error_description=" +
        encodeURIComponent("اللينك مش صحيح"),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });

  if (error) {
    redirect(
      "/?error=access_denied&error_code=otp_expired&error_description=" +
        encodeURIComponent(error.message),
    );
  }

  redirect(next);
}
