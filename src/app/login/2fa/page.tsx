// ============================================================================
// /login/2fa — TOTP challenge after a successful password login
// ============================================================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyLogin2fa } from "./actions";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function LoginTwoFactorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If the user reached /login/2fa without an active session, bounce to
  // the password page. (Direct nav to /login/2fa with no session
  // shouldn't reveal anything useful.)
  if (!user) redirect("/login");

  // If the user reached /login/2fa but doesn't have 2FA enabled
  // anymore, no need to challenge them.
  const { data: profile } = await supabase
    .from("profiles")
    .select("two_factor_enabled")
    .eq("id", user.id)
    .single<{ two_factor_enabled: boolean | null }>();
  if (profile?.two_factor_enabled !== true) redirect("/dashboard");

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30">
      <div className="max-w-md w-full">
        <Link href="/" className="flex flex-col items-center mb-8 group">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-navy shadow-lg shadow-cyan-500/20 mb-3">
            <span className="text-3xl font-black text-white font-display">
              ن
            </span>
          </div>
          <h1 className="text-3xl font-black font-display bg-gradient-to-r from-brand-cyan-dark via-brand-cyan to-brand-navy bg-clip-text text-transparent">
            نِظام
          </h1>
        </Link>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🔐</div>
            <h2 className="text-2xl font-bold text-slate-800 font-cairo mb-1">
              المصادقة الثنائية
            </h2>
            <p className="text-sm text-slate-500 font-cairo">
              ادخل الـ 6 أرقام من تطبيق المصادقة
            </p>
          </div>

          {sp.error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
              ⚠ {decodeURIComponent(sp.error)}
            </div>
          )}

          <form action={verifyLogin2fa} className="space-y-4">
            <input
              type="text"
              name="code"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              dir="ltr"
              autoComplete="one-time-code"
              autoFocus
              className="w-full text-center px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-3xl font-mono tracking-[0.5em]"
            />
            <SubmitButton
              loadingText="جاري التحقق..."
              className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition font-cairo"
            >
              تحقّق ودخول
            </SubmitButton>
          </form>

          <p className="text-center text-xs text-slate-500 mt-6 font-cairo">
            فقدت تطبيق المصادقة؟{" "}
            <Link
              href="/login?error=contact_admin"
              className="text-brand-cyan-dark font-bold hover:underline"
            >
              تواصل مع المدير
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
