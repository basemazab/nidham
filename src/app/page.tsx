import Link from "next/link";
import { MobileAppQR } from "@/components/mobile-app-qr";

type SearchParams = Promise<{
  error?: string;
  error_code?: string;
  error_description?: string;
}>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const hasAuthError = !!(params.error || params.error_code);
  const friendlyError =
    params.error_code === "otp_expired"
      ? "اللينك انتهت صلاحيته أو اتستخدم قبل كده — اطلب لينك جديد"
      : params.error_description
      ? decodeURIComponent(params.error_description.replace(/\+/g, " "))
      : "حصلت مشكلة في تسجيل الدخول — جرّب تاني";

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30">
      <div className="max-w-2xl w-full text-center">
        {hasAuthError && (
          <div className="mb-8 p-4 rounded-xl bg-red-50 border-2 border-red-200 text-right">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <h3 className="font-bold text-red-800 mb-1 font-cairo">حصلت مشكلة</h3>
                <p className="text-sm text-red-700 mb-3 font-cairo">{friendlyError}</p>
                <Link
                  href="/forgot-password"
                  className="inline-block text-sm text-red-700 font-bold underline hover:no-underline font-cairo"
                >
                  اطلب لينك إعادة تعيين جديد ←
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Logo */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-navy mb-8 shadow-xl shadow-cyan-500/20">
          <span className="text-4xl font-black text-white font-display">ن</span>
        </div>

        {/* Brand */}
        <h1 className="text-6xl md:text-7xl font-black mb-2 tracking-tight font-display">
          <span className="bg-gradient-to-r from-brand-cyan-dark via-brand-cyan to-brand-navy bg-clip-text text-transparent">
            نِظام
          </span>
        </h1>
        <p className="text-sm tracking-[0.4em] text-brand-gold font-semibold mb-8">
          NIDHAM
        </p>

        {/* Headline */}
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4 font-cairo leading-tight">
          منصة <span className="text-brand-cyan-dark">HR + CRM</span> اللي
          بتجاوبك:
        </h2>
        <p className="text-lg md:text-xl text-slate-600 mb-12 leading-relaxed">
          الموظف ده ملتزم إداريًا — وكمان منتج فعليًا؟
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
          <Link
            href="/signup"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-lg shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all font-cairo"
          >
            إنشاء حساب شركة جديد
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-4 rounded-xl border-2 border-slate-200 text-slate-700 font-bold text-lg hover:border-slate-400 hover:bg-white transition-all font-cairo"
          >
            تسجيل الدخول
          </Link>
        </div>

        {/* Mobile app callout */}
        <div className="mt-10 max-w-md mx-auto">
          <MobileAppQR variant="card" />
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-slate-200 flex flex-col items-center gap-2">
          <p className="text-xs text-slate-400 font-mono tracking-wider">
            BETA · v0.1 · BUILT IN DAMIETTA, EGYPT
          </p>
          <a
            href="https://nidham.netlify.app"
            target="_blank"
            rel="noopener"
            className="text-xs text-slate-500 hover:text-brand-cyan-dark transition"
          >
            ← العودة للصفحة الترويجية
          </a>
        </div>
      </div>
    </main>
  );
}
