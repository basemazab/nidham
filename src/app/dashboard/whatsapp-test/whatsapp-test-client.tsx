"use client";

// ============================================================================
// WhatsAppTestClient — interactive bot reply preview
// ============================================================================
//
// Client component because we need fetch() + useState for the form
// submission + reply display. POSTs to /api/whatsapp/test-bot which runs
// the bot's intent router with the picked employee's data.

import { useState } from "react";

type Employee = {
  id: string;
  full_name: string;
  phone: string | null;
  department: string | null;
  job_title: string | null;
};

type Reply =
  | null
  | {
      ok: true;
      reply: string;
      employee: { full_name: string; phone: string | null };
    }
  | { ok: false; error: string };

// Quick-tap presets — the most common employee questions, pre-filled
// so HR doesn't have to remember the exact wording.
const PRESETS = [
  { label: "📋 مساعدة (قائمة الأوامر)", text: "مساعدة" },
  { label: "🏖 رصيد إجازاتي", text: "رصيد إجازاتي" },
  { label: "💰 مرتبي", text: "مرتبي" },
  { label: "📅 حضوري آخر أسبوع", text: "حضوري" },
  { label: "💵 سلفي", text: "سلفي" },
  { label: "📜 شهادة عمل", text: "شهادة عمل" },
];

export function WhatsAppTestClient({ employees }: { employees: Employee[] }) {
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Reply>(null);

  const send = async () => {
    if (!selectedEmpId || !text.trim()) return;
    setBusy(true);
    setReply(null);
    try {
      const res = await fetch("/api/whatsapp/test-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: selectedEmpId, text: text.trim() }),
      });
      const data = (await res.json()) as Reply;
      setReply(data);
    } catch (err) {
      setReply({
        ok: false,
        error: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setBusy(false);
    }
  };

  const selectedEmp = employees.find((e) => e.id === selectedEmpId);

  if (employees.length === 0) {
    return (
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center font-cairo">
        <div className="text-4xl mb-2">👥</div>
        <h2 className="font-bold text-slate-700 mb-1">
          مفيش موظفين نشطين للاختبار
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          ضيف موظف الأول علشان تقدر تجرب البوت.
        </p>
        <a
          href="/dashboard/employees/new"
          className="inline-block px-5 py-2.5 rounded-xl bg-brand-cyan-dark text-white font-bold font-cairo text-sm"
        >
          ضيف موظف
        </a>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl shadow-md border border-slate-100 p-5 font-cairo">
      <h2 className="font-bold text-slate-800 mb-3">💬 محاكاة محادثة</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            الموظف
          </label>
          <select
            value={selectedEmpId}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
                {e.department ? ` — ${e.department}` : ""}
              </option>
            ))}
          </select>
          {selectedEmp && (
            <p className="text-[10px] text-slate-400 mt-1">
              {selectedEmp.phone
                ? `📱 ${selectedEmp.phone}`
                : "⚠ مفيش رقم تليفون مسجل"}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            الرسالة (زي ما الموظف هيكتبها)
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="اكتب رسالة الموظف..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) send();
            }}
          />
        </div>
      </div>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PRESETS.map((p) => (
          <button
            key={p.text}
            type="button"
            onClick={() => setText(p.text)}
            className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={send}
        disabled={busy || !text.trim()}
        className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold transition active:scale-95"
      >
        {busy ? "⏳ بنجيب الرد..." : "🚀 شغّل البوت"}
      </button>

      {/* Reply pane — styled like a WhatsApp conversation */}
      {reply && (
        <div className="mt-5 bg-gradient-to-br from-emerald-50/50 to-cyan-50/50 rounded-2xl p-4 border-2 border-slate-100">
          {reply.ok ? (
            <>
              {/* Outgoing bubble — what the employee sent */}
              <div className="flex justify-end mb-2">
                <div className="bg-emerald-500 text-white rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%] text-sm shadow-sm">
                  {text}
                </div>
              </div>
              {/* Incoming bubble — what the bot replied */}
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-br-sm px-4 py-3 max-w-[85%] text-sm whitespace-pre-wrap shadow-sm">
                  <div className="text-[10px] text-emerald-700 font-bold mb-1">
                    🤖 Nidham Bot
                  </div>
                  {reply.reply}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 text-center">
                ✓ ده الرد اللي الموظف هيشوفه على واتساب لما الـ Cloud API
                يكون شغّال.
              </p>
            </>
          ) : (
            <div className="text-center py-3">
              <div className="text-rose-700 font-bold text-sm mb-1">⚠ خطأ</div>
              <p className="text-rose-600 text-xs">{reply.error}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
