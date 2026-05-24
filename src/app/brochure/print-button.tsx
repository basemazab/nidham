"use client";

// Client component just for the print button — keeps the rest of the
// page as a server component so we can still export `metadata`.

export function PrintButton() {
  return (
    <div className="no-print sticky top-0 z-50 bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white py-3 px-6 shadow-lg">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm font-cairo font-bold">
          📄 الـ Brochure ده مخصص للطباعة + المشاركة
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-1.5 rounded-lg bg-white text-brand-cyan-dark font-cairo font-black text-sm hover:bg-cyan-50 transition"
        >
          💾 احفظ كـ PDF (Ctrl+P)
        </button>
      </div>
    </div>
  );
}
