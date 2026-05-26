"use client";

// ============================================================================
// PrintButton — floating toolbar for the sales brochure
// ============================================================================
//
// A fixed-position bar with three actions:
//   1. Save as PDF (window.print → user picks "Save as PDF" destination)
//   2. Copy share link (URL → clipboard, ready for WhatsApp)
//   3. Quick anchor jumps to each section (so reviewers can skim)
//
// Hidden in print via .no-print so it doesn't appear in the downloaded
// PDF.

import { useState } from "react";

export function PrintButton() {
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    // Force light theme before printing — dark mode CSS would tank
    // legibility on paper.
    document.documentElement.classList.remove("dark");
    setTimeout(() => window.print(), 50);
  };

  const handleShare = async () => {
    const url =
      typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older mobile browsers
      const tmp = document.createElement("input");
      tmp.value = url;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand("copy");
      document.body.removeChild(tmp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      className="no-print fixed top-4 left-4 z-50 flex gap-2 font-cairo"
      dir="rtl"
    >
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-sm shadow-lg transition active:scale-95"
      >
        <span>📥</span>
        <span>تحميل PDF</span>
      </button>

      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm shadow-lg border-2 border-slate-200 transition active:scale-95"
      >
        <span>{copied ? "✓" : "🔗"}</span>
        <span>{copied ? "اتنسخ" : "انسخ اللينك"}</span>
      </button>

      <a
        href="https://wa.me/201055356622?text=أهلاً، شفت كتيب نِظام وعايز أتكلم عن النظام"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg transition active:scale-95"
      >
        <span>💬</span>
        <span>كلّمنا</span>
      </a>
    </div>
  );
}
