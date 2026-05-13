import Link from "next/link";
import { logout } from "@/app/login/actions";

// Landing page for employee-role accounts that try to access the
// HR-only /dashboard. The layout redirects them here so they get a
// clear explainer ("use the mobile app") instead of an empty page
// or a confusing /login bounce loop.
export const metadata = {
  title: "للموظفين — تطبيق الموبايل | نِظام",
};

export default function MobileOnlyPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-navy via-slate-900 to-brand-navy p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6 text-center">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-brand-cyan to-brand-navy flex items-center justify-center shadow-lg">
          <span className="text-4xl font-black text-white font-display">ن</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 font-cairo">
            مرحبًا 👋
          </h1>
          <p className="text-slate-600 font-cairo leading-relaxed">
            حسابك حساب <strong>موظف</strong>، وكل الخدمات بتاعتك متاحة من
            خلال تطبيق <strong>نِظام للموظفين</strong> على الموبايل.
          </p>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 text-right space-y-3 font-cairo">
          <div className="text-xs text-brand-cyan-dark font-bold tracking-wider uppercase">
            من خلال التطبيق تقدر:
          </div>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <span className="text-brand-cyan-dark">✓</span>
              <span>تثبيت حضور وانصراف من موقعك (GPS)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-cyan-dark">✓</span>
              <span>تقديم طلب إجازة، سلفة، أو استئذان</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-cyan-dark">✓</span>
              <span>تتابع قسائم مرتبك الشهرية</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-cyan-dark">✓</span>
              <span>تشوف رصيد إجازاتك ومسيرة حضورك</span>
            </li>
          </ul>
        </div>

        <div className="text-xs text-slate-500 font-cairo">
          هتلاقي التطبيق على Google Play و App Store قريبًا.
          <br />
          لو HR طلب منك تستلم كود دعوة، التطبيق هيسألك عليه عند أول تسجيل دخول.
        </div>

        <div className="flex gap-3 pt-2">
          <form action={logout} className="flex-1">
            <button
              type="submit"
              className="w-full px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-cairo font-bold text-sm transition"
            >
              تسجيل خروج
            </button>
          </form>
          <Link
            href="/"
            className="flex-1 px-4 py-3 rounded-xl bg-brand-cyan-dark hover:bg-brand-cyan text-white font-cairo font-bold text-sm transition flex items-center justify-center"
          >
            للصفحة الرئيسية
          </Link>
        </div>
      </div>
    </main>
  );
}
