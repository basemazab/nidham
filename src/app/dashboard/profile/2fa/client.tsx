"use client";

// ============================================================================
// "Confirm 2FA setup" — shown when the user has a secret saved but
// hasn't yet verified the first 6-digit code. They land here on
// refresh after starting setup but before completing it.
// ============================================================================

import { confirm2faSetup } from "./actions";

export function Confirm2FASetupForm() {
  return (
    <section className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 font-cairo">
      <h2 className="text-base font-black text-amber-900 mb-2">
        ⏳ إعداد 2FA لسه ما اتفعّلش
      </h2>
      <p className="text-sm text-amber-800 mb-4 leading-relaxed">
        ضفت مفتاح 2FA لحسابك بس ما أكدتش الكود لسه. ادخل الكود من تطبيق
        المصادقة عشان تفعّل الحماية. لو فقدت الـ QR، اضغط "ابدأ من جديد"
        تحت لتوليد مفتاح جديد.
      </p>

      <form action={confirm2faSetup} className="space-y-3">
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
          className="w-full text-center px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-2xl font-mono tracking-[0.5em]"
        />
        <button
          type="submit"
          className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 font-cairo"
        >
          ✓ فعّل المصادقة الثنائية
        </button>
      </form>
    </section>
  );
}
