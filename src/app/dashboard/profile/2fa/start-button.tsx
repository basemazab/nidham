"use client";

// ============================================================================
// Start 2FA setup — client button that hits the server action then
// renders the QR + secret + verify input inline. Avoids a page reload
// so the secret can be displayed without going through a URL parameter
// (which would log it in browser history).
// ============================================================================

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { start2faSetup, confirm2faSetup } from "./actions";

export function Start2FASetupButton() {
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{
    otpauthUrl: string;
    secret: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setError(null);
    setBusy(true);
    try {
      const r = await start2faSetup();
      if (r.ok) {
        setSetup({ otpauthUrl: r.otpauthUrl, secret: r.secret });
      } else {
        setError(r.error);
      }
    } finally {
      setBusy(false);
    }
  }

  if (setup) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="bg-white p-3 rounded-lg shadow">
            <QRCodeSVG value={setup.otpauthUrl} size={180} level="M" />
          </div>
          <div className="text-center font-cairo">
            <p className="text-xs text-slate-600 mb-1">
              صوّر الـ QR من تطبيق المصادقة
            </p>
            <p className="text-[10px] text-slate-500">
              أو أدخل الكود يدوياً:
            </p>
            <code
              dir="ltr"
              className="block mt-1 px-3 py-1.5 bg-slate-900 text-emerald-300 rounded font-mono text-sm tracking-widest break-all"
            >
              {setup.secret}
            </code>
          </div>
        </div>

        <form action={confirm2faSetup} className="space-y-3">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
              ادخل الـ 6 أرقام من التطبيق:
            </label>
            <input
              type="text"
              name="code"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              dir="ltr"
              className="w-full text-center px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-2xl font-mono tracking-[0.5em]"
              autoComplete="one-time-code"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 font-cairo"
          >
            ✓ فعّل المصادقة الثنائية
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-cairo">
          ⚠ {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleStart}
        disabled={busy}
        className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-sm shadow-md font-cairo disabled:opacity-60"
      >
        {busy ? "جاري الإعداد..." : "🚀 ابدأ الإعداد"}
      </button>
    </div>
  );
}
