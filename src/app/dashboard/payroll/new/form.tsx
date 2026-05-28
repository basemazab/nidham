"use client";

// Client form for "new payroll period". Two key behaviors:
//   - Switching frequency (monthly <-> weekly) recomputes the suggested
//     start/end window from the company's cycle settings on the fly,
//     so the user never sees a stale Saturday-to-Friday window after
//     they flipped to "monthly".
//   - Editing start_date auto-fills end_date (start + 1 month - 1 day
//     for monthly, start + 6 days for weekly). The end_date input stays
//     editable -- a few customers really do want non-standard windows.

import { useState, useTransition, useEffect } from "react";

type Frequency = "monthly" | "weekly";

type Props = {
  initialFrequency: Frequency;
  initialStartDate: string;
  initialEndDate: string;
  monthlyStartDay: number;
  weeklyStartDow: number;
  monthlyEmployeeCount: number;
  weeklyEmployeeCount: number;
  action: (formData: FormData) => Promise<void> | void;
};

export function NewPayrollForm({
  initialFrequency,
  initialStartDate,
  initialEndDate,
  monthlyStartDay,
  weeklyStartDow,
  monthlyEmployeeCount,
  weeklyEmployeeCount,
  action,
}: Props) {
  const [frequency, setFrequency] = useState<Frequency>(initialFrequency);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  // Egyptian standard: 26 working days/month for monthly employees
  // (30 days minus ~4 Fridays). Weekly stays at 6 (one cycle = one week).
  const [workingDays, setWorkingDays] = useState(
    initialFrequency === "weekly" ? "6" : "26",
  );
  const [isPending, startTransition] = useTransition();

  // When the user flips the frequency tab, pull a fresh suggested cycle
  // for that frequency rather than carrying over the old one.
  function handleFrequencyChange(next: Frequency) {
    if (next === frequency) return;
    setFrequency(next);
    const suggested = suggestCycle(next, monthlyStartDay, weeklyStartDow);
    setStartDate(suggested.startDate);
    setEndDate(suggested.endDate);
    setWorkingDays(next === "weekly" ? "6" : "26");
  }

  // When the user manually edits start_date, recompute end_date from
  // the cycle length for the active frequency.
  useEffect(() => {
    if (!startDate) return;
    const computed = computeEndDate(frequency, startDate);
    if (computed) setEndDate(computed);
    // intentionally omit endDate from deps -- we don't want a feedback loop
    // when the user manually nudges the end-date field.
  }, [startDate, frequency]);

  const eligibleCount =
    frequency === "monthly" ? monthlyEmployeeCount : weeklyEmployeeCount;

  return (
    <form
      action={(fd) => startTransition(() => action(fd))}
      className="space-y-5"
    >
      {/* Frequency picker */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-2 font-cairo">
          نوع التكرار
        </label>
        <div className="grid grid-cols-2 gap-2">
          <FrequencyChip
            checked={frequency === "monthly"}
            onClick={() => handleFrequencyChange("monthly")}
            label="شهري"
            description={`دورة ${monthlyStartDay} → ${prevDay(
              monthlyStartDay,
            )} من الشهر الي بعده`}
            count={monthlyEmployeeCount}
          />
          <FrequencyChip
            checked={frequency === "weekly"}
            onClick={() => handleFrequencyChange("weekly")}
            label="أسبوعي"
            description={`دورة 7 أيام تبدأ ${DAY_NAMES[weeklyStartDow]}`}
            count={weeklyEmployeeCount}
          />
        </div>
      </div>

      {/* Hidden frequency field for the server action */}
      <input type="hidden" name="frequency" value={frequency} />

      {/* Date window */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
            تاريخ البداية
          </label>
          <input
            type="date"
            name="start_date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20"
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
            تاريخ النهاية
          </label>
          <input
            type="date"
            name="end_date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20"
            dir="ltr"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
          أيام العمل في الفترة
        </label>
        <input
          type="number"
          name="working_days"
          value={workingDays}
          onChange={(e) => setWorkingDays(e.target.value)}
          min="1"
          max="31"
          required
          className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20"
        />
        <p className="text-[11px] text-slate-500 mt-1 font-cairo">
          عدد أيام العمل المتوقعة (بيستخدم في حساب الخصم على الغياب).
        </p>
      </div>

      {/* Eligibility summary */}
      <div
        className={`p-3 rounded-lg border text-sm font-cairo ${
          eligibleCount > 0
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-amber-50 border-amber-200 text-amber-800"
        }`}
      >
        {eligibleCount > 0 ? (
          <>
            ✓ سيتم احتساب{" "}
            <strong className="font-bold">{eligibleCount}</strong> موظف{" "}
            {frequency === "monthly" ? "شهري" : "أسبوعي"} في هذه الفترة.
          </>
        ) : (
          <>
            ⚠ مفيش موظفين من نوع{" "}
            <strong className="font-bold">
              {frequency === "monthly" ? "شهري" : "أسبوعي"}
            </strong>
            . عدّل التكرار في صفحة الموظف، أو غيّر النوع هنا.
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending || eligibleCount === 0}
        className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all font-cairo disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        {isPending ? "...جاري الإنشاء" : "إنشاء فترة المرتبات"}
      </button>
    </form>
  );
}

function FrequencyChip({
  checked,
  onClick,
  label,
  description,
  count,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  description: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-4 rounded-xl border-2 transition text-right ${
        checked
          ? "border-brand-cyan bg-brand-cyan/5 ring-2 ring-brand-cyan/30"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-sm text-slate-800 font-cairo">
          {label}
        </span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            count > 0
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {count} موظف
        </span>
      </div>
      <div className="text-[11px] text-slate-500 font-cairo leading-relaxed">
        {description}
      </div>
    </button>
  );
}

// ----------------------------------------------------------------------------
// Date helpers — mirror suggestCycle() in page.tsx and the SQL function
// compute_payroll_cycle_window so the form math stays consistent client-side.
// ----------------------------------------------------------------------------

const DAY_NAMES = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

function prevDay(day: number): number {
  return day === 1 ? 28 : day - 1;
}

function computeEndDate(frequency: Frequency, startDate: string): string | null {
  const parts = startDate.split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  const start = new Date(y, m - 1, d);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start);
  if (frequency === "monthly") {
    end.setMonth(end.getMonth() + 1);
    end.setDate(end.getDate() - 1);
  } else {
    end.setDate(end.getDate() + 6);
  }
  return toIso(end);
}

function suggestCycle(
  frequency: Frequency,
  monthlyStartDay: number,
  weeklyStartDow: number,
): { startDate: string; endDate: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (frequency === "monthly") {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const d = yesterday.getDate();
    let startMonth = yesterday.getMonth();
    let startYear = yesterday.getFullYear();
    if (d < monthlyStartDay) {
      startMonth -= 1;
      if (startMonth < 0) {
        startMonth = 11;
        startYear -= 1;
      }
    }
    const start = new Date(startYear, startMonth, monthlyStartDay);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(end.getDate() - 1);
    return { startDate: toIso(start), endDate: toIso(end) };
  }

  const todayDow = today.getDay();
  const stepBack = ((todayDow - weeklyStartDow + 7) % 7) + 7;
  const start = new Date(today);
  start.setDate(start.getDate() - stepBack);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { startDate: toIso(start), endDate: toIso(end) };
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
