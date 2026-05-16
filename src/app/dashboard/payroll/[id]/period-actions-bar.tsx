"use client";

// ============================================================================
// PeriodActionsBar — top action row on the period page
// ============================================================================
//
// Bundles the "things HR does to this period" into a single horizontal
// bar with a clean visual hierarchy:
//
//   [Export ▼] [Bulk Bonus] [Cancel / Reopen]
//
// Export is a dropdown menu (xlsx / csv / sif) to keep the bar narrow
// even though there are three formats. The destructive actions
// (cancel + reopen) open inline confirm panels that require typing
// a specific word — same pattern as the bulk-delete employees button.

import { useState } from "react";
import Link from "next/link";

type Status = "draft" | "approved" | "paid" | "cancelled";

type Props = {
  periodId: string;
  status: Status;
  cancelAction: (formData: FormData) => Promise<void> | void;
  reopenAction: (formData: FormData) => Promise<void> | void;
  regenerateAction: (formData: FormData) => Promise<void> | void;
};

export function PeriodActionsBar({
  periodId,
  status,
  cancelAction,
  reopenAction,
  regenerateAction,
}: Props) {
  const [showCancel, setShowCancel] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const canCancel =
    status === "draft" || status === "approved" || status === "paid";
  const canReopen =
    status === "approved" || status === "paid" || status === "cancelled";
  const isEditable = status === "draft" || status === "approved";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 mb-4 flex flex-wrap items-center gap-2">
      {/* Export dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setExportOpen((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm font-cairo transition"
        >
          <span>📥</span>
          <span>تصدير</span>
          <span className="text-slate-400 text-xs">▼</span>
        </button>
        {exportOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setExportOpen(false)}
            />
            <div className="absolute top-full right-0 mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden min-w-[260px]">
              <ExportItem
                href={`/dashboard/payroll/${periodId}/export?format=xlsx`}
                icon="📊"
                title="Excel كامل (.xlsx)"
                subtitle="كشف تفصيلي + ملخص بالأقسام — للمحاسب"
              />
              <ExportItem
                href={`/dashboard/payroll/${periodId}/export?format=csv`}
                icon="📄"
                title="CSV عام للبنك"
                subtitle="مقبول من كل البنوك المصرية"
              />
              <ExportItem
                href={`/dashboard/payroll/${periodId}/export?format=sif`}
                icon="🏦"
                title="ملف بنك SIF"
                subtitle="CIB / NBE — تحويل جماعي مباشر"
              />
            </div>
          </>
        )}
      </div>

      {/* Bulk bonus — only when editable */}
      {isEditable && (
        <Link
          href={`/dashboard/payroll/${periodId}/bulk-bonus`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-sm font-cairo transition border border-amber-200"
        >
          <span>🎁</span>
          <span>مكافأة جماعية</span>
        </Link>
      )}

      {/* Print ALL payslips — works on every status (draft / approved /
          paid / cancelled). The most important button for HR: instead
          of clicking each employee individually, one click renders +
          prints every payslip in the period. */}
      <Link
        href={`/print/payslips-bulk/${periodId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-sm font-cairo transition border border-emerald-200"
      >
        <span>🧾</span>
        <span>طباعة كل القسائم</span>
      </Link>

      {/* Regenerate — drafts only. Re-syncs entries with current
          employee + attendance data. Useful when attendance got
          imported AFTER the period was created. */}
      {status === "draft" && (
        <button
          type="button"
          onClick={() => {
            setShowRegenerate((v) => !v);
            setShowCancel(false);
            setShowReopen(false);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-bold text-sm font-cairo transition border border-cyan-200"
        >
          <span>🔄</span>
          <span>إعادة توليد</span>
        </button>
      )}

      {/* Spacer pushes destructive actions to the right edge */}
      <span className="flex-1" />

      {/* Cancel */}
      {canCancel && (
        <button
          type="button"
          onClick={() => {
            setShowCancel((v) => !v);
            setShowReopen(false);
          }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs font-cairo transition"
        >
          🚫 إلغاء الدورة
        </button>
      )}

      {/* Reopen */}
      {canReopen && (
        <button
          type="button"
          onClick={() => {
            setShowReopen((v) => !v);
            setShowCancel(false);
          }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 font-bold text-xs font-cairo transition"
        >
          🔓 إعادة فتح
        </button>
      )}

      {/* Inline confirm panels (full-width, below the bar) */}
      {showRegenerate && (
        <ConfirmPanel
          tone="cyan"
          title="🔄 إعادة توليد قسائم الدورة"
          message="هتمسح كل entries الموظفين الحالية في الدورة دي وتعيد توليدها من بيانات الموظفين والحضور الحالية. أي تعديلات يدوية (مكافآت، overtime, خصومات) هتضيع. خصوصاً مفيد لو رفعت الحضور بعد ما الدورة اتعملت."
        >
          <form action={regenerateAction}>
            <input type="hidden" name="period_id" value={periodId} />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm font-cairo transition"
              >
                🔄 نفذ إعادة التوليد
              </button>
              <button
                type="button"
                onClick={() => setShowRegenerate(false)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm font-cairo transition"
              >
                إلغاء
              </button>
            </div>
          </form>
        </ConfirmPanel>
      )}

      {showCancel && (
        <ConfirmPanel
          tone="rose"
          title="🚫 إلغاء الدورة"
          message="الإلغاء بيخلي الدورة read-only ومش هتظهر في التقارير. اكتب سبب الإلغاء + كلمة 'إلغاء' للتأكيد."
        >
          <form action={cancelAction} className="space-y-3">
            <input type="hidden" name="period_id" value={periodId} />
            <input
              type="text"
              name="reason"
              required
              minLength={5}
              placeholder="مثلاً: تم توليد الدورة بفترة غلط"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-rose-400 outline-none text-sm font-cairo"
            />
            <div className="flex gap-2">
              <input
                type="text"
                name="confirm"
                required
                placeholder='اكتب: إلغاء'
                className="flex-1 px-3 py-2 rounded-lg border border-rose-200 focus:border-rose-400 outline-none text-sm font-cairo font-bold"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm font-cairo transition"
              >
                نفذ الإلغاء
              </button>
              <button
                type="button"
                onClick={() => setShowCancel(false)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm font-cairo transition"
              >
                إلغاء
              </button>
            </div>
          </form>
        </ConfirmPanel>
      )}

      {showReopen && (
        <ConfirmPanel
          tone="amber"
          title="🔓 إعادة فتح الدورة"
          message={
            status === "paid"
              ? "هترجع للحالة 'معتمدة' وممكن تعدل وتصرف تاني. اكتب 'فتح' للتأكيد."
              : status === "cancelled"
                ? "هترجع للحالة 'مسودة' وكأنها جديدة. اكتب 'فتح' للتأكيد."
                : "هترجع للحالة 'مسودة' وممكن تعدل. اكتب 'فتح' للتأكيد."
          }
        >
          <form action={reopenAction} className="space-y-3">
            <input type="hidden" name="period_id" value={periodId} />
            <div className="flex gap-2">
              <input
                type="text"
                name="confirm"
                required
                placeholder='اكتب: فتح'
                className="flex-1 px-3 py-2 rounded-lg border border-amber-200 focus:border-amber-400 outline-none text-sm font-cairo font-bold"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm font-cairo transition"
              >
                افتح الدورة
              </button>
              <button
                type="button"
                onClick={() => setShowReopen(false)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm font-cairo transition"
              >
                إلغاء
              </button>
            </div>
          </form>
        </ConfirmPanel>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------
function ExportItem({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <a
      href={href}
      className="block px-4 py-3 hover:bg-slate-50 transition border-b border-slate-100 last:border-0"
    >
      <div className="flex items-start gap-3">
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800 font-cairo text-sm">
            {title}
          </div>
          <div className="text-[11px] text-slate-500 font-cairo">
            {subtitle}
          </div>
        </div>
      </div>
    </a>
  );
}

function ConfirmPanel({
  title,
  message,
  tone,
  children,
}: {
  title: string;
  message: string;
  tone: "rose" | "amber" | "cyan";
  children: React.ReactNode;
}) {
  const bg = {
    rose: "bg-rose-50 border-rose-200",
    amber: "bg-amber-50 border-amber-200",
    cyan: "bg-cyan-50 border-cyan-200",
  }[tone];
  return (
    <div className={`w-full mt-2 p-4 rounded-xl border ${bg}`}>
      <div className="font-black font-cairo text-slate-800 mb-1">{title}</div>
      <p className="text-xs text-slate-600 font-cairo mb-3 leading-relaxed">
        {message}
      </p>
      {children}
    </div>
  );
}
