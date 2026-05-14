"use client";

// "حضور جماعي" modal. Two modes:
//   - يوم واحد       single date
//   - فترة من → إلى  date range (up to BULK_MAX_DAYS = 60 days)
//
// Behaviour:
//   - Bulk action is ADDITIVE -- existing attendance rows are NEVER
//     overwritten. The per-employee form is the source of truth for
//     anything HR already recorded.
//   - "اعتبر الجمعة عطلة" is on by default and maps any Friday in the
//     range to status='weekend' regardless of the chosen status.

import { useState, useTransition } from "react";

type Mode = "single" | "range";

type Props = {
  defaultDate: string;
  action: (formData: FormData) => Promise<void> | void;
};

const STATUS_OPTIONS = [
  { value: "present", label: "حضور", color: "emerald", emoji: "✓" },
  { value: "leave", label: "إجازة", color: "amber", emoji: "🌴" },
  { value: "holiday", label: "عطلة رسمية", color: "violet", emoji: "🎉" },
  { value: "weekend", label: "عطلة أسبوعية", color: "slate", emoji: "🛌" },
] as const;

export function BulkAttendanceModal({ defaultDate, action }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("single");
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [status, setStatus] = useState<string>("present");
  const [fridaysAsWeekend, setFridaysAsWeekend] = useState(true);
  const [isPending, startTransition] = useTransition();

  function rangeDayCount(): number {
    if (mode === "single") return 1;
    const [ys, ms, ds] = startDate.split("-").map((n) => parseInt(n, 10));
    const [ye, me, de] = endDate.split("-").map((n) => parseInt(n, 10));
    const s = new Date(ys, ms - 1, ds).getTime();
    const e = new Date(ye, me - 1, de).getTime();
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
    return Math.round((e - s) / 86400000) + 1;
  }

  const dayCount = rangeDayCount();
  const tooManyDays = dayCount > 60;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-sm shadow-md font-cairo transition"
      >
        <span>👥</span>
        <span>حضور جماعي</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50"
            onClick={() => !isPending && setOpen(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full pointer-events-auto max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-800 font-cairo">
                    👥 حضور جماعي
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-cairo">
                    سجّل حالة لكل الموظفين النشطين دفعة واحدة
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !isPending && setOpen(false)}
                  disabled={isPending}
                  aria-label="إغلاق"
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
                >
                  <svg
                    className="w-5 h-5 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Form body */}
              <form
                action={(fd) => {
                  fd.set("start_date", startDate);
                  fd.set("end_date", mode === "range" ? endDate : startDate);
                  fd.set("status", status);
                  if (fridaysAsWeekend) fd.set("fridays_as_weekend", "on");
                  startTransition(() => action(fd));
                }}
                className="px-6 py-5 space-y-5"
              >
                {/* Mode picker */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 font-cairo">
                    نوع التسجيل
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <ModeChip
                      checked={mode === "single"}
                      onClick={() => setMode("single")}
                      label="يوم واحد"
                      description="حالة واحدة لكل الموظفين النهاردة"
                    />
                    <ModeChip
                      checked={mode === "range"}
                      onClick={() => setMode("range")}
                      label="فترة من → إلى"
                      description="استكمال backlog لفترة كاملة"
                    />
                  </div>
                </div>

                {/* Dates */}
                {mode === "single" ? (
                  <div>
                    <label
                      htmlFor="bulk_start_date"
                      className="block text-xs font-bold text-slate-700 mb-1 font-cairo"
                    >
                      التاريخ
                    </label>
                    <input
                      id="bulk_start_date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-sm"
                      dir="ltr"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="bulk_start_date"
                        className="block text-xs font-bold text-slate-700 mb-1 font-cairo"
                      >
                        من
                      </label>
                      <input
                        id="bulk_start_date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-sm"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="bulk_end_date"
                        className="block text-xs font-bold text-slate-700 mb-1 font-cairo"
                      >
                        إلى
                      </label>
                      <input
                        id="bulk_end_date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-sm"
                        dir="ltr"
                      />
                    </div>
                  </div>
                )}

                {/* Day count badge */}
                {mode === "range" && dayCount > 0 && (
                  <div
                    className={`text-xs px-3 py-2 rounded-lg font-cairo ${
                      tooManyDays
                        ? "bg-red-50 border border-red-200 text-red-700"
                        : "bg-slate-50 border border-slate-200 text-slate-600"
                    }`}
                  >
                    {tooManyDays ? (
                      <>⚠ الفترة كبيرة جدًا ({dayCount} يوم). الحد الأقصى 60 يوم.</>
                    ) : (
                      <>📅 الفترة فيها <b>{dayCount} يوم</b></>
                    )}
                  </div>
                )}

                {/* Status picker */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 font-cairo">
                    الحالة اللي هتتسجل
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUS_OPTIONS.map((opt) => (
                      <StatusChip
                        key={opt.value}
                        checked={status === opt.value}
                        onClick={() => setStatus(opt.value)}
                        label={opt.label}
                        emoji={opt.emoji}
                        color={opt.color}
                      />
                    ))}
                  </div>
                </div>

                {/* Friday toggle */}
                <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                  <input
                    type="checkbox"
                    checked={fridaysAsWeekend}
                    onChange={(e) => setFridaysAsWeekend(e.target.checked)}
                    className="mt-0.5 w-5 h-5 accent-brand-cyan-dark cursor-pointer"
                  />
                  <div className="text-xs font-cairo">
                    <div className="font-bold text-slate-800 mb-0.5">
                      اعتبر الجمعة عطلة أسبوعية
                    </div>
                    <div className="text-slate-500 leading-relaxed">
                      لو الفترة فيها أيام جمعة، النظام يسجّلها كـ "عطلة" مش الحالة اللي اخترتها.
                    </div>
                  </div>
                </label>

                {/* Info box */}
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-xs text-cyan-900 font-cairo leading-relaxed">
                  💡 <b>الحضور الجماعي إضافي بس</b> — لو فيه موظف عنده تسجيل
                  مسبق لأي يوم في الفترة (مثلًا غياب أو نصف يوم)، حالته
                  المسجلة <b>هتفضل زي ما هي</b> ومش هتتغير.
                </div>

                {/* Submit */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={isPending}
                    className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition font-cairo disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || tooManyDays || dayCount === 0}
                    className="flex-1 px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending
                      ? "...جاري الحفظ"
                      : `سجّل ${dayCount > 0 ? dayCount : 0} يوم لكل الموظفين`}
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

function ModeChip({
  checked,
  onClick,
  label,
  description,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-xl border-2 transition text-right ${
        checked
          ? "border-brand-cyan bg-brand-cyan/5 ring-2 ring-brand-cyan/30"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="font-bold text-sm text-slate-800 font-cairo mb-0.5">
        {label}
      </div>
      <div className="text-[10px] text-slate-500 font-cairo leading-relaxed">
        {description}
      </div>
    </button>
  );
}

function StatusChip({
  checked,
  onClick,
  label,
  emoji,
  color,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  emoji: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    emerald: checked
      ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300 text-emerald-800"
      : "border-slate-200 bg-white hover:bg-slate-50",
    amber: checked
      ? "border-amber-400 bg-amber-50 ring-2 ring-amber-300 text-amber-800"
      : "border-slate-200 bg-white hover:bg-slate-50",
    violet: checked
      ? "border-violet-400 bg-violet-50 ring-2 ring-violet-300 text-violet-800"
      : "border-slate-200 bg-white hover:bg-slate-50",
    slate: checked
      ? "border-slate-400 bg-slate-100 ring-2 ring-slate-300 text-slate-800"
      : "border-slate-200 bg-white hover:bg-slate-50",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-xl border-2 transition flex items-center gap-2 font-cairo ${
        colorClasses[color] ?? colorClasses.slate
      }`}
    >
      <span className="text-lg">{emoji}</span>
      <span className="font-bold text-sm">{label}</span>
    </button>
  );
}
