import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

// Public-facing "get the mobile app" landing.
// Reached from:
//   - The QR shown on /login + landing (which encodes this URL)
//   - The /mobile-only redirect for employees
//   - Eventually App Store / Google Play deeplinks pointing here as
//     a backup install path.
//
// The store buttons are intentionally disabled while we're still
// pre-launch. Once the app ships, drop the disabled styling and
// fill in the real store URLs.
export const metadata = {
  title: "تطبيق Nidham للموظفين | نِظام",
};

const STORE_LINKS = {
  ios: "#", // TODO: replace with App Store URL after release
  android: "#", // TODO: replace with Play Store URL after release
};

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-navy via-slate-900 to-brand-navy text-white">
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-cairo mb-8"
        >
          ← العودة للصفحة الرئيسية
        </Link>

        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* Left: pitch + store buttons */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-bold mb-4 font-cairo">
              📱 تطبيق الموبايل
            </div>
            <h1 className="text-4xl md:text-5xl font-black font-cairo mb-3 leading-tight">
              نِظام للموظفين
            </h1>
            <p className="text-lg text-slate-300 mb-6 leading-relaxed font-cairo">
              التطبيق الرسمي لموظفي شركات Nidham. من جيبك تقدر تثبت حضور بالـ
              GPS، تطلب إجازة أو سلفة، تتابع قسائم مرتبك، وتشوف رصيد إجازاتك.
            </p>

            <ul className="space-y-3 mb-8">
              <Feature icon="📍" text="تثبيت حضور وانصراف من موقعك (GPS-aware)" />
              <Feature icon="🏝️" text="طلب إجازة / سلفة / استئذان في ثوانٍ" />
              <Feature icon="🧾" text="قسائم مرتباتك الشهرية بكل تفاصيلها" />
              <Feature icon="📊" text="رصيد إجازاتك السنوي والعارض والمرضي" />
              <Feature icon="🔒" text="بياناتك محمية بـ RLS متعدد المستويات" />
            </ul>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <StoreButton
                href={STORE_LINKS.ios}
                badge="iOS"
                title="App Store"
                subtitle="قريبًا"
                disabled
              />
              <StoreButton
                href={STORE_LINKS.android}
                badge="Android"
                title="Google Play"
                subtitle="قريبًا"
                disabled
              />
            </div>
            <p className="text-xs text-slate-500 font-cairo">
              التطبيق في مرحلة beta الآن. لو HR في شركتك بعتلك كود دعوة،
              ابعتلنا على{" "}
              <a
                href="https://wa.me/201055356622"
                className="text-brand-cyan hover:underline"
              >
                واتساب
              </a>{" "}
              لنشاركك تجربة الـ TestFlight.
            </p>
          </div>

          {/* Right: QR code */}
          <div className="flex flex-col items-center">
            <div className="bg-white p-6 rounded-3xl shadow-2xl">
              <QRCodeSVG
                value="https://nidham.app/download"
                size={220}
                level="M"
                bgColor="#ffffff"
                fgColor="#0a1428"
                marginSize={0}
              />
            </div>
            <p className="mt-4 text-sm text-slate-300 text-center font-cairo max-w-[260px]">
              صوّر الـ QR من كاميرا موبايلك لما يتشغل التطبيق
            </p>
          </div>
        </div>

        {/* HR section */}
        <div className="mt-16 border-t border-slate-700 pt-8">
          <h2 className="text-2xl font-bold font-cairo mb-3">للـ HR؟</h2>
          <p className="text-slate-300 font-cairo mb-4">
            لو انت صاحب الشركة أو HR، انت محتاج لوحة التحكم على المتصفح --
            مش التطبيق.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/login"
              className="px-5 py-3 rounded-xl bg-brand-cyan hover:bg-brand-cyan-dark text-white font-bold text-sm font-cairo transition"
            >
              دخول لوحة التحكم
            </Link>
            <Link
              href="/signup"
              className="px-5 py-3 rounded-xl border border-slate-600 hover:border-slate-400 text-slate-200 font-bold text-sm font-cairo transition"
            >
              تسجيل شركة جديدة
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <li className="flex items-start gap-3 text-slate-200 font-cairo">
      <span className="text-xl shrink-0">{icon}</span>
      <span>{text}</span>
    </li>
  );
}

function StoreButton({
  href,
  badge,
  title,
  subtitle,
  disabled,
}: {
  href: string;
  badge: string;
  title: string;
  subtitle: string;
  disabled?: boolean;
}) {
  const inner = (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${disabled ? "border-slate-700 bg-slate-800/40 text-slate-400" : "border-brand-cyan bg-brand-cyan/10 text-white"}`}
    >
      <div className="text-xs opacity-70">{badge}</div>
      <div>
        <div className="font-bold text-sm">{title}</div>
        <div className="text-[10px] opacity-60">{subtitle}</div>
      </div>
    </div>
  );
  return disabled ? (
    <div className="cursor-not-allowed">{inner}</div>
  ) : (
    <a href={href}>{inner}</a>
  );
}
