"use client";

// "إنهاء التوظيف" modal. Admin-only. Computes end-of-service gratuity
// (مكافأة نهاية الخدمة) per Egyptian Labour Law 12/2003 Art 122 and
// shows HR the breakdown BEFORE they confirm:
//
//   1. سنوات الخدمة
//   2. الأجر الأساسي للحساب (basic + housing + transport + incentive)
//   3. عدد الشهور المستحقة (per law: years * 0.5 if <=5, else 2.5 + (y-5)*1)
//   4. المكافأة الإجمالية
//
// Once confirmed, the server action writes:
//   status='terminated', termination_date, termination_reason, eos_gratuity

import { useEffect, useMemo, useState, useTransition } from "react";
import type { EOSBreakdown } from "@/app/dashboard/employees/actions";

type Props = {
  employeeId: string;
  employeeName: string;
  isActive: boolean;
  previewAction: (
    employeeId: string,
    terminationDate: string,
  ) => Promise<EOSBreakdown | null>;
  terminateAction: (formData: FormData) => Promise<void> | void;
};

const REASON_OPTIONS = [
  { value: "resignation", label: "استقالة", emoji: "✍" },
  { value: "termination_by_employer", label: "فصل من العمل", emoji: "⚠" },
  { value: "mutual_agreement", label: "اتفاق ودي", emoji: "🤝" },
  { value: "end_of_contract", label: "انتهاء عقد محدد المدة", emoji: "📅" },
  { value: "retirement", label: "تقاعد", emoji: "🏖" },
  { value: "death", label: "وفاة", emoji: "🕊" },
];

export function TerminateEmployeeModal({
  employeeId,
  employeeName,
  isActive,
  previewAction,
  terminateAction,
}: Props) {
  const todayIso = useMemo(
    () => new Date().toISOString().split("T")[0],
    [],
  );
  const [open, setOpen] = useState(false);
  const [terminationDate, setTerminationDate] = useState(todayIso);
  const [reason, setReason] = useState<string>("resignation");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [breakdown, setBreakdown] = useState<EOSBreakdown | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();
  const [submitting, startSubmit] = useTransition();

  // Re-preview whenever the date changes (debounced via React's natural
  // batching -- React 19 collapses rapid edits into one transition).
  useEffect(() => {
    if (!open || !terminationDate) return;
    setPreviewError(null);
    startPreview(async () => {
      try {
        const result = await previewAction(employeeId, terminationDate);
        if (!result) {
          setBreakdown(null);
          setPreviewError(
            "مش قادر يحسب — تأكد إن للموظف تاريخ تعيين وراتب أساسي",
          );
        } else {
          setBreakdown(result);
        }
      } catch {
        setBreakdown(null);
        setPreviewError("حصلت مشكلة في الحساب");
      }
    });
  }, [open, terminationDate, employeeId, previewAction]);

  const canConfirm =
    breakdown !== null &&
    confirmPhrase.trim() === "إنهاء" &&
    !submitting;

  if (!isActive) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-red-300 bg-red-50 text-red-700 font-bold text-sm hover:bg-red-100 transition font-cairo"
      >
        <span>🏁</span>
        <span>إنهاء التوظيف</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50"
            onClick={() => !submitting && setOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full pointer-events-auto max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-800 font-cairo">
                    🏁 إنهاء توظيف {employeeName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-cairo">
                    تحسب مكافأة نهاية الخدمة (قانون 12/2003 مادة 122)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !submitting && setOpen(false)}
                  disabled={submitting}
                  aria-label="إغلاق"
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form
                action={(fd) => {
                  fd.set("employee_id", employeeId);
                  fd.set("termination_date", terminationDate);
                  fd.set("termination_reason", reason);
                  startSubmit(() => terminateAction(fd));
                }}
                className="px-6 py-5 space-y-5"
              >
                {/* Termination date */}
                <div>
                  <label
                    htmlFor="termination_date"
                    className="block text-xs font-bold text-slate-700 mb-1 font-cairo"
                  >
                    تاريخ انتهاء الخدمة
                  </label>
                  <input
                    id="termination_date"
                    type="date"
                    value={terminationDate}
                    onChange={(e) => setTerminationDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-sm"
                    dir="ltr"
                  />
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 font-cairo">
                    سبب انتهاء الخدمة
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {REASON_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setReason(opt.value)}
                        className={`p-2 rounded-xl border-2 text-right transition font-cairo ${
                          reason === opt.value
                            ? "border-brand-cyan bg-brand-cyan/5 ring-2 ring-brand-cyan/30"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-base">{opt.emoji}</span>
                        <span className="text-xs font-bold text-slate-800 mr-2">
                          {opt.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* EOS gratuity preview */}
                {previewing && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500 font-cairo text-center">
                    ...جاري حساب المكافأة
                  </div>
                )}

                {previewError && !previewing && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 font-cairo">
                    ⚠ {previewError}
                  </div>
                )}

                {breakdown && !previewing && (
                  <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 border-2 border-emerald-200 rounded-2xl p-4 space-y-3">
                    <div className="text-sm font-bold text-emerald-800 font-cairo">
                      💰 مكافأة نهاية الخدمة المستحقة
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <Stat label="سنوات الخدمة" value={`${Number(breakdown.years_of_service).toFixed(2)} سنة`} />
                      <Stat label="الأجر الشهري الأساسي" value={`${fmt(breakdown.wage_base)} ج`} />
                      <Stat label="الشهور المستحقة" value={`${Number(breakdown.months_owed).toFixed(2)} شهر`} />
                      <Stat
                        label="إجمالي المكافأة"
                        value={`${fmt(breakdown.gratuity_amount)} ج`}
                        highlight
                      />
                    </div>
                    <div className="text-[11px] text-emerald-700 font-cairo leading-relaxed border-t border-emerald-200 pt-3">
                      💡 المعادلة: <b>أول 5 سنين × ½ شهر</b> + <b>كل سنة بعد كده × شهر كامل</b>.
                      الأجر = الأساسي + بدل سكن + بدل انتقال + الحافز.
                    </div>
                  </div>
                )}

                {/* Confirm phrase */}
                <div>
                  <label
                    htmlFor="terminate_confirm"
                    className="block text-xs font-bold text-slate-700 mb-1 font-cairo"
                  >
                    اكتب كلمة <b className="text-red-600">إنهاء</b> للتأكيد:
                  </label>
                  <input
                    id="terminate_confirm"
                    type="text"
                    value={confirmPhrase}
                    onChange={(e) => setConfirmPhrase(e.target.value)}
                    placeholder="إنهاء"
                    className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 focus:border-red-400 focus:ring-2 focus:ring-red-200 outline-none text-slate-900 font-cairo text-center font-bold"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 font-cairo leading-relaxed">
                  ⚠ بعد الإنهاء: الموظف يتسجل بحالة <b>منتهي الخدمة</b>،
                  مش هيدخل في فترات المرتب الجاية، وحسابه على الموبايل
                  هيتعطّل. المكافأة محسوبة عليك تدفعها لـ الموظف خارج النظام
                  أو عبر سلفة بحالة "مدفوع".
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition font-cairo disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={!canConfirm}
                    className="flex-1 px-5 py-2.5 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "...جاري الإنهاء" : "🏁 تأكيد إنهاء التوظيف"}
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

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-lg p-3 ${
        highlight ? "ring-2 ring-emerald-400 shadow-md" : "border border-slate-100"
      }`}
    >
      <div className="text-[10px] text-slate-500 font-cairo mb-0.5">{label}</div>
      <div
        className={`text-base font-black font-mono ${
          highlight ? "text-emerald-700" : "text-slate-700"
        }`}
        dir="ltr"
      >
        {value}
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("ar-EG");
}
