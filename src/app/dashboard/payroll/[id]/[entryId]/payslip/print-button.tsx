"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-sm shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/40 transition font-cairo"
    >
      🖨 طباعة / حفظ PDF
    </button>
  );
}
