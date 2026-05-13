import Link from "next/link";
import { requestPasswordReset } from "./actions";
import { SubmitButton } from "@/components/submit-button";

type SearchParams = Promise<{ error?: string; sent?: string }>;

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, sent } = await searchParams;

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
          <h2 className="text-2xl font-bold text-slate-800 mb-2 font-cairo text-center">
            نسيت كلمة السر؟
          </h2>
          <p className="text-sm text-slate-500 text-center mb-6 font-cairo">
            هنبعتلك لينك على إيميلك تقدر تغيّر منه كلمة السر
          </p>

          {sent && (
            <div className="mb-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-cairo">
              ✓ لو الإيميل مسجّل عندنا، هتلاقي لينك إعادة تعيين كلمة السر في الـ Inbox بتاعك (وممكن في Spam).
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
              ⚠ {decodeURIComponent(error)}
            </div>
          )}

          <form action={requestPasswordReset} className="space-y-4">
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

            <SubmitButton
              loadingText="جاري الإرسال..."
              className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all font-cairo"
            >
              ابعت لينك إعادة التعيين
            </SubmitButton>
          </form>

          <p className="text-center text-sm text-slate-600 mt-6">
            تفتكرت كلمة السر؟{" "}
            <Link
              href="/login"
              className="text-brand-cyan-dark font-bold hover:underline"
            >
              ارجع لتسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
