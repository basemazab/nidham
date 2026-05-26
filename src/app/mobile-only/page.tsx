import Link from "next/link";
import { logout } from "@/app/login/actions";
import { PWAInstallButton } from "@/components/pwa-install-button";

// Landing page for employee-role accounts that try to access the
// HR-only /dashboard. The layout redirects them here so they get a
// clear explainer ("use your phone — clock in here") instead of an
// empty page or a confusing /login bounce loop.
//
// Now points to /clock-in (the working PWA web flow) instead of the
// abstract "download a mobile app" message — there is no separate
// mobile app, the PWA IS the app.
export const metadata = {
  title: "للموظفين — تسجيل الحضور | نِظام",
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
            دي صفحة <strong>HR</strong>، حسابك حساب <strong>موظف</strong>.
            افتح صفحة تسجيل الحضور بدالها.
          </p>
        </div>

        {/* Main CTA: open the clock-in page */}
        <Link
          href="/clock-in"
          className="block w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-cairo font-black text-lg shadow-lg transition"
        >
          📍 افتح تسجيل الحضور
        </Link>

        {/* PWA install — encourages employees to add Nidham to home screen */}
        <div className="bg-cyan-50 border-2 border-cyan-200 rounded-2xl p-4 font-cairo text-right">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-3xl">📱</span>
            <div className="flex-1">
              <h2 className="font-bold text-slate-800 mb-1">
                ثبّت Nidham على شاشتك الرئيسية
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                علشان تفتح تسجيل الحضور بضغطة واحدة كل يوم بدون ما تكتب
                اللينك. شغّال زي تطبيق عادي.
              </p>
            </div>
          </div>
          <PWAInstallButton />
        </div>

        <div className="bg-slate-50 rounded-xl p-4 text-right space-y-2 font-cairo">
          <div className="text-xs text-brand-cyan-dark font-bold tracking-wider uppercase mb-2">
            تقدر تعمل من خلال الموبايل:
          </div>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <span className="text-emerald-600">✓</span>
              <span>تسجيل حضور وانصراف بالـ GPS + سيلفي</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600">✓</span>
              <span>سؤال بوت WhatsApp عن رصيد إجازاتك أو مرتبك</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600">✓</span>
              <span>توقيع المستندات بإصبعك من اللينك اللي HR بيبعتهولك</span>
            </li>
          </ul>
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
