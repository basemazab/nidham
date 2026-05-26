"use client";

// ============================================================================
// QuickLogModal — 1-click interaction logging from the customers list
// ============================================================================
//
// Reduces "log a call" from a 4-step flow (open customer → click "log
// interaction" → fill form → save) to a 1-click action:
//
//   Click "📞 سجّل" on the row → modal appears → pick type + write 1
//   line of notes → save.
//
// Built specifically for CircleCode's pattern (13 customers added,
// 0 interactions logged — they need a frictionless logging entry point).

import { useState, useTransition } from "react";
import { logInteraction } from "@/app/dashboard/interactions/actions";

const TYPE_OPTIONS = [
  { value: "call", label: "📞 مكالمة", color: "blue" },
  { value: "whatsapp", label: "💬 واتساب", color: "emerald" },
  { value: "email", label: "📧 إيميل", color: "violet" },
  { value: "meeting", label: "🤝 اجتماع", color: "amber" },
  { value: "visit", label: "🚗 زيارة", color: "cyan" },
] as const;

const OUTCOME_OPTIONS = [
  { value: "positive", label: "👍 إيجابي", color: "emerald" },
  { value: "neutral", label: "😐 محايد", color: "slate" },
  { value: "negative", label: "👎 سلبي", color: "rose" },
] as const;

type Props = {
  customerId: string;
  customerName: string;
  /** The currently-logged-in user's linked employee ID. Required to
   *  satisfy the interactions.employee_id NOT NULL constraint. */
  employeeId: string;
};

export function QuickLogModal({
  customerId,
  customerName,
  employeeId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("call");
  const [outcome, setOutcome] = useState<string>("positive");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const fd = new FormData();
    fd.append("customer_id", customerId);
    fd.append("employee_id", employeeId);
    fd.append("type", type);
    fd.append("outcome", outcome);
    fd.append("notes", notes.trim() || `(${type})`);
    fd.append("date", new Date().toISOString().split("T")[0]);

    startTransition(async () => {
      try {
        await logInteraction(fd);
        // Server action redirects on success — we won't actually reach
        // here unless it threw or the action returns normally
      } catch (err) {
        const msg = err instanceof Error ? err.message : "حصل عطل";
        // Server-action redirects throw a special NEXT_REDIRECT error;
        // those are NOT real errors so we shouldn't surface them
        if (msg.includes("NEXT_REDIRECT")) {
          setOpen(false);
          setNotes("");
          return;
        }
        setError(msg);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition font-cairo"
        title="سجّل تفاعل سريع"
      >
        📞 سجّل
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full pointer-events-auto font-cairo"
              dir="rtl"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-900">
                    📞 سجّل تفاعل
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    مع: {customerName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Type picker — pill row */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    نوع التفاعل
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setType(opt.value)}
                        className={`px-2 py-2 rounded-lg text-xs font-bold border transition ${
                          type === opt.value
                            ? "bg-brand-cyan-dark text-white border-brand-cyan-dark shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Outcome picker */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    النتيجة
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {OUTCOME_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setOutcome(opt.value)}
                        className={`px-2 py-2 rounded-lg text-xs font-bold border transition ${
                          outcome === opt.value
                            ? "bg-brand-cyan-dark text-white border-brand-cyan-dark shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    ملاحظات (اختياري)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="مثلاً: عرض الـ Demo، عايز يفكّر أسبوع، يطلب POC..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 text-sm resize-none"
                  />
                </div>

                {error && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                    ⚠ {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-sm shadow-md transition disabled:opacity-50"
                  >
                    {pending ? "⏳ بنحفظ..." : "✓ سجّل"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
