"use client";

// Top sticky toolbar with two CTAs:
//   1) "تنزيل PDF" — direct download via DownloadPdfButton (html2canvas
//      + jsPDF) — no print dialog, no extra clicks, the .pdf lands in
//      Downloads.
//   2) "طباعة" — fallback to native window.print() for users who'd
//      rather paper or choose a specific printer.
//
// Both buttons hide on the printed page (.no-print).

import { DownloadPdfButton } from "@/components/download-pdf-button";

export function PrintButton() {
  return (
    <div className="no-print pdf-hide sticky top-0 z-50 bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white py-3 px-6 shadow-lg">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm font-cairo font-bold">
          📄 الـ Brochure ده مخصص للطباعة + المشاركة
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Primary CTA: direct download (no print dialog) */}
          <DownloadPdfButton
            targetSelector="#brochure-content"
            filename="Nidham-Brochure.pdf"
            label="📥 تنزيل PDF"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-white text-brand-cyan-dark font-cairo font-black text-sm hover:bg-cyan-50 transition disabled:opacity-60"
          />

          {/* Secondary CTA: native print (for those who want paper) */}
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/30 text-white font-cairo font-bold text-xs hover:bg-white/20 transition"
          >
            🖨 طباعة
          </button>
        </div>
      </div>
    </div>
  );
}
