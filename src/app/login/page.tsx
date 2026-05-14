import Link from "next/link";
import { login } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { MobileAppQR } from "@/components/mobile-app-qr";

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30">
      <div className="max-w-md w-full">
        <Link href="/" className="flex flex-col items-center mb-8 group">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-navy shadow-lg shadow-cyan-500/20 mb-3 group-hover:scale-105 transition">
            <span className="text-3xl font-black text-white font-display">ن</span>
          </div>
          <h1 className="text-3xl font-black font-display bg-gradient-to-r from-brand-cyan-dark via-brand-cyan to-brand-navy bg-clip-text text-transparent">
            نِظام
          </h1>
        </Link>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 font-cairo text-center">
            تسجيل الدخول
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
              ⚠ {decodeURIComponent(error)}
            </div>
          )}

          <form action={login} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-2 font-cairo"
              >
                الإيميل
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700 font-cairo"
                >
                  كلمة السر
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-brand-cyan-dark hover:underline font-cairo"
                >
                  نسيتها؟
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
            </div>

            <SubmitButton
              loadingText="جاري الدخول..."
              className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all font-cairo"
            >
              دخول
            </SubmitButton>
          </form>

          <p className="text-center text-sm text-slate-600 mt-6">
            مش عندك حساب؟{" "}
            <Link
              href="/signup"
              className="text-brand-cyan-dark font-bold hover:underline"
            >
              اعمل حساب جديد
            </Link>
          </p>
        </div>

        <div className="mt-6">
          <MobileAppQR variant="card" />
          <p className="text-center text-[11px] text-slate-500 mt-3 font-cairo">
            موظف؟ التطبيق على الموبايل أسهل لك. صوّر الكود من جيبك.
          </p>
        </div>
      </div>
    </main>
  );
}
