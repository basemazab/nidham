"use client";

// One row in the advances table + a modal that opens when HR clicks
// "صرف سلفة". The modal renders the same numbers from the server
// row (no re-fetch) so it opens instantly; on submit it posts to
// issueHRAdvance via a server-action <form>.

import { useEffect, useState } from "react";

type Props = {
  employeeId: string;
  fullName: string;
  jobTitle: string | null;
  department: string | null;
  attendedDays: number;
  effectiveDays: number;
  monthlyBase: number;
  accruedNet: number;
  existingOpenAdvances: number;
  availableHeadroom: number;
  eligible50: number;
  eligible70: number;
  issueAction: (formData: FormData) => Promise<void>;
};

function fmt(n: number): string {
  return n.toLocaleString("ar-EG", { maximumFractionDigits: 0 });
}

export function IssueAdvanceRow({
  employeeId,
  fullName,
  jobTitle,
  department,
  attendedDays,
  effectiveDays,
  monthlyBase,
  accruedNet,
  existingOpenAdvances,
  availableHeadroom,
  eligible50,
  eligible70,
  issueAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>(String(eligible50));
  const [installments, setInstallments] = useState<string>("1");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const noHeadroom = availableHeadroom <= 0;

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50/80 transition">
        <td className="px-3 py-3">
          <div className="font-bold text-slate-800 font-cairo">{fullName}</div>
          <div className="text-[10px] text-slate-500 font-cairo">
            {jobTitle ?? "—"}
            {department && <> · {department}</>}
          </div>
        </td>
        <td className="px-3 py-3 text-center font-mono" dir="ltr">
          <span className="font-bold text-slate-800">{attendedDays}</span>
          {effectiveDays !== attendedDays && (
            <span className="text-[10px] text-slate-500 block">
              ({effectiveDays} يوم محسوب)
            </span>
          )}
        </td>
        <td className="px-3 py-3 font-mono text-slate-600" dir="ltr">
          {fmt(monthlyBase)} ج
        </td>
        <td className="px-3 py-3 font-mono font-bold text-emerald-700" dir="ltr">
          {fmt(accruedNet)} ج
        </td>
        <td className="px-3 py-3 font-mono text-amber-700" dir="ltr">
          {existingOpenAdvances > 0 ? `${fmt(existingOpenAdvances)} ج` : "—"}
        </td>
        <td className="px-3 py-3 font-mono font-bold" dir="ltr">
          <span className={noHeadroom ? "text-red-600" : "text-slate-800"}>
            {fmt(availableHeadroom)} ج
          </span>
        </td>
        <td className="px-3 py-3 font-mono text-cyan-700" dir="ltr">
          {fmt(eligible50)} ج
        </td>
        <td className="px-3 py-3 font-mono text-emerald-700 font-bold" dir="ltr">
          {fmt(eligible70)} ج
        </td>
        <td className="px-3 py-3 text-left">
          <button
            type="button"
            onClick={() => {
              setAmount(String(eligible50));
              setInstallments("1");
              setOpen(true);
            }}
            disabled={noHeadroom}
            className="px-3 py-1.5 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white text-xs font-bold font-cairo disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition"
          >
            💵 صرف سلفة
          </button>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={9} className="p-0">
            <div
              className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setOpen(false)}
            >
              <form
                action={issueAction}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-right space-y-4 font-cairo"
              >
                <input type="hidden" name="employee_id" value={employeeId} />

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">
                      💵 صرف سلفة لـ {fullName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {attendedDays} يوم حضور · صافي مستحق{" "}
                      <b>{fmt(accruedNet)} ج</b>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>

                {/* Quick-pick buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAmount(String(eligible50))}
                    className={`p-3 rounded-xl border-2 text-right transition ${
                      Number(amount) === eligible50
                        ? "border-brand-cyan bg-brand-cyan/5 ring-2 ring-brand-cyan/30"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs text-slate-500">50% من الصافي</div>
                    <div
                      className="text-xl font-black text-cyan-700 font-display"
                      dir="ltr"
                    >
                      {fmt(eligible50)} ج
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount(String(eligible70))}
                    className={`p-3 rounded-xl border-2 text-right transition ${
                      Number(amount) === eligible70
                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs text-slate-500">70% من الصافي</div>
                    <div
                      className="text-xl font-black text-emerald-700 font-display"
                      dir="ltr"
                    >
                      {fmt(eligible70)} ج
                    </div>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المبلغ (تقدر تعدّله يدويًا)
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-lg font-bold font-mono text-right"
                  />
                  {Number(amount) > availableHeadroom && (
                    <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      ⚠ المبلغ أكبر من المتاح ({fmt(availableHeadroom)} ج). تأكد قبل
                      التأكيد.
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    عدد الأقساط
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 6, 12].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setInstallments(String(n))}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition ${
                          installments === String(n)
                            ? "border-brand-cyan-dark bg-brand-cyan-dark text-white"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number"
                      name="installments"
                      value={installments}
                      onChange={(e) => setInstallments(e.target.value)}
                      min="1"
                      max="24"
                      required
                      className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 outline-none text-sm text-center font-bold"
                    />
                  </div>
                  {Number(installments) > 0 && Number(amount) > 0 && (
                    <p className="text-[10px] text-slate-500 mt-2">
                      كل قسط ={" "}
                      <b className="font-mono">
                        {fmt(Number(amount) / Number(installments))} ج
                      </b>
                      {" "}/ شهر
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سبب / ملاحظة (اختياري)
                  </label>
                  <textarea
                    name="reason"
                    rows={2}
                    placeholder="مثلاً: سلفة عيد، ظرف عائلي"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 px-4 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition"
                  >
                    ✓ أكّد الصرف
                  </button>
                </div>
              </form>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
