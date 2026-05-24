"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

// Public "we have a mobile app" QR. Encodes the /download page URL.
// Stand-alone callout sits below the login form / in the sidebar / on
// landing-page footer — wherever a visitor would benefit from knowing
// the app exists.
//
// Two visual variants:
//   - "card"    : full white card with explanation + QR (login page,
//                 landing page).
//   - "compact" : thin row with a small QR and one-liner (dashboard
//                 footer, /mobile-only page, etc).

type Props = {
  variant?: "card" | "compact";
  /** Absolute URL to encode. Defaults to the same-origin /download page. */
  href?: string;
};

export function MobileAppQR({ variant = "card", href }: Props) {
  // Default to a relative path the user can click in dev; the QR
  // generator can still embed it -- phones will resolve relative URLs
  // against the current host when scanned from the same screen.
  const target = href ?? "/download";

  if (variant === "compact") {
    return (
      <Link
        href={target}
        className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-brand-cyan/40 hover:bg-slate-50 transition group"
      >
        <div className="p-1 bg-white rounded">
          <QRCodeSVG
            value={absoluteUrl(target)}
            size={48}
            level="M"
            marginSize={0}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-slate-800 font-cairo">
            📱 تطبيق الموبايل
          </div>
          <div className="text-[10px] text-slate-500 font-cairo">
            صوّر الكود من جيبك للتطبيق
          </div>
        </div>
        <span className="text-xs text-brand-cyan-dark group-hover:translate-x-[-2px] transition font-cairo">
          ←
        </span>
      </Link>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-cyan-50/50 border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-white rounded-xl border border-slate-200 shrink-0">
          <QRCodeSVG
            value={absoluteUrl(target)}
            size={104}
            level="M"
            marginSize={0}
          />
        </div>
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-cyan/10 text-brand-cyan-dark text-[10px] font-bold mb-1 font-cairo">
            📱 جديد
          </div>
          <h3 className="text-sm font-black text-slate-800 font-cairo mb-1">
            تطبيق نِظام للموظفين
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed font-cairo mb-2">
            للموظفين فقط: حضور بالـ GPS، طلبات إجازة وسلفة، قسائم
            الرواتب — من جيبك.
          </p>
          <Link
            href={target}
            className="text-xs font-bold text-brand-cyan-dark hover:underline font-cairo"
          >
            تفاصيل التحميل ←
          </Link>
        </div>
      </div>
    </div>
  );
}

// QR scanners only render absolute URLs reliably. SSR can't read
// window.location, so we fall back to the publicly-known production
// host. The qrcode.react component re-renders on hydration with the
// real origin, so anyone who actually scans the QR gets the right
// URL whether dev / preview / prod.
const FALLBACK_HOST = "https://nidhamhr.com";

function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  if (typeof window !== "undefined") {
    return new URL(path, window.location.origin).toString();
  }
  return new URL(path, FALLBACK_HOST).toString();
}
