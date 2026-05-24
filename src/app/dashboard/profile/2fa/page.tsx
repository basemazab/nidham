// ============================================================================
// /dashboard/profile/2fa — Two-Factor Authentication setup
// ============================================================================
//
// Three states:
//   1. user.two_factor_enabled = false AND no secret → "Set up 2FA" button
//   2. secret exists, not yet enabled → show QR + verify input
//   3. enabled → status badge + "Disable" form (re-auth via the disable RPC)

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Confirm2FASetupForm } from "./client";
import { Start2FASetupButton } from "./start-button";
import { disable2fa } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "two_factor_enabled, two_factor_verified_at, two_factor_secret_encrypted",
    )
    .eq("id", user.id)
    .single<{
      two_factor_enabled: boolean;
      two_factor_verified_at: string | null;
      two_factor_secret_encrypted: unknown | null;
    }>();

  const enabled = profile?.two_factor_enabled === true;
  const hasSecret = profile?.two_factor_secret_encrypted !== null;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/dashboard/profile"
          className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo mb-4 inline-block"
        >
          ← الرجوع للملف الشخصي
        </Link>

        <header className="mb-6">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            🔐 المصادقة الثنائية (2FA)
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            طبقة حماية إضافية — حتى لو سُرقت كلمة السر، الحساب لسه محمي بكود
            من تطبيقك (Google Authenticator / 1Password / Authy)
          </p>
        </header>

        {sp.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(sp.error)}
          </div>
        )}

        {enabled ? (
          <section className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 font-cairo">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">✅</span>
              <div>
                <h2 className="text-lg font-black text-emerald-900">
                  المصادقة الثنائية مفعّلة
                </h2>
                <p className="text-xs text-emerald-700">
                  آخر تفعيل:{" "}
                  {profile?.two_factor_verified_at
                    ? new Date(profile.two_factor_verified_at).toLocaleString(
                        "ar-EG",
                      )
                    : "—"}
                </p>
              </div>
            </div>
            <p className="text-sm text-emerald-800 mb-4 leading-relaxed">
              في كل تسجيل دخول جديد هتطلب منك الكود ذو الـ 6 أرقام من تطبيق
              المصادقة. لو ضيّعت التطبيق، استخدم زرار "إيقاف" تحت وأعد
              الإعداد على جهاز جديد.
            </p>
            <form action={disable2fa}>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-red-50 border-2 border-red-200 text-red-700 font-bold text-sm hover:bg-red-100 transition"
              >
                ⚠ إيقاف المصادقة الثنائية
              </button>
            </form>
          </section>
        ) : hasSecret ? (
          <Confirm2FASetupForm />
        ) : (
          <section className="bg-white rounded-2xl border-2 border-slate-200 p-6 font-cairo">
            <h2 className="text-base font-bold text-slate-800 mb-2">
              ✨ ابدأ إعداد المصادقة الثنائية
            </h2>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              لو معاكش تطبيق مصادقة، نزّل واحد من الـ App Store / Play Store:
              <strong> Google Authenticator</strong>،{" "}
              <strong>1Password</strong>، أو <strong>Authy</strong>. بعدها
              اضغط الزرار تحت.
            </p>
            <Start2FASetupButton />
          </section>
        )}
      </div>
    </main>
  );
}
