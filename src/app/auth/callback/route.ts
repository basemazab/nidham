import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the OAuth-style callback after the user clicks the password-reset link
// (or any future email-confirmation link). Exchanges the `code` for a session
// cookie, then redirects to `next` (default: /update-password for reset flow).
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/update-password";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(
    new URL(
      "/login?error=" +
        encodeURIComponent("لينك تأكيد منتهي الصلاحية — جرّب تطلب لينك جديد"),
      url.origin,
    ),
  );
}
