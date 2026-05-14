"use client";

// Smart "new advance" form.
//
//   - Employee picker uses a native <datalist> for autocomplete, so the
//     HR can type the first 2-3 letters and the browser narrows it
//     down. Works for 5 employees or 500.
//   - The moment a valid employee is selected we kick off a server
//     action (compute_employee_accrued_net via getEmployeeAccruedNet)
//     and render the eligibility panel.
//   - Amount input is colour-coded live:
//       green   -> amount <= 50%   (safely within headroom)
//       cyan    -> 50% < amount <= 70%
//       amber   -> 70% < amount <= headroom
//       red     -> amount > headroom (will be blocked at submit)
//   - Submit is disabled until employee + valid amount are set.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { AccruedNetRow } from "../actions";

type EmployeeLite = {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
};

type Props = {
  employees: EmployeeLite[];
  getEligibilityAction: (employeeId: string) => Promise<AccruedNetRow | null>;
  issueAction: (formData: FormData) => Promise<void> | void;
};

export function NewAdvanceForm({
  employees,
  getEligibilityAction,
  issueAction,
}: Props) {
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [eligibility, setEligibility] = useState<AccruedNetRow | null>(null);
  const [eligibilityLoading, startEligibility] = useTransition();
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  const [amount, setAmount] = useState<string>("");
  const [installments, setInstallments] = useState<string>("1");
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, startSubmit] = useTransition();

  // Resolve the typed text to an employee id by exact full-name match.
  // We don't auto-pick the first prefix match because that's surprising
  // when the HR is still typing.
  const matchedEmployee = useMemo(
    () =>
      employees.find(
        (e) => e.full_name.trim() === employeeQuery.trim(),
      ) ?? null,
    [employees, employeeQuery],
  );

  // Whenever the matched employee changes, fetch their eligibility.
  // We also clear the amount when the employee changes so the live
  // colour doesn't carry over from the previous selection.
  const lastFetchedId = useRef<string | null>(null);
  useEffect(() => {
    if (!matchedEmployee) {
      setEligibility(null);
      setEligibilityError(null);
      lastFetchedId.current = null;
      return;
    }
    if (lastFetchedId.current === matchedEmployee.id) return;
    lastFetchedId.current = matchedEmployee.id;
    setEligibilityError(null);
    startEligibility(async () => {
      try {
        const row = await getEligibilityAction(matchedEmployee.id);
        setEligibility(row);
        if (!row) {
          setEligibilityError(
            "مفيش بيانات حضور كافية لحساب الاستحقاق. تأكد إن الموظف موجود وعنده حضور هذا الشهر.",
          );
        }
      } catch {
        setEligibilityError("حصلت مشكلة في حساب الاستحقاق، حاول تاني.");
      }
    });
  }, [matchedEmployee, getEligibilityAction]);

  const numericAmount = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) ? n : 0;
  }, [amount]);

  const numericInstallments = useMemo(() => {
    const n = parseInt(installments, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [installments]);

  // Decide the visual tier for the amount input based on eligibility.
  const amountStatus = useMemo<{
    tier: "neutral" | "green" | "cyan" | "amber" | "red";
    label: string | null;
  }>(() => {
    if (!eligibility || numericAmount === 0) {
      return { tier: "neutral", label: null };
    }
    const headroom = Number(eligibility.available_headroom ?? 0);
    const e50 = Number(eligibility.eligible_50pct ?? 0);
    const e70 = Number(eligibility.eligible_70pct ?? 0);

    if (numericAmount > headroom) {
      const extra = numericAmount - headroom;
      return {
        tier: "red",
        label: `⚠ المبلغ بيتجاوز المتاح بـ ${fmt(extra)} ج. مينفعش تتصرف.`,
      };
    }
    if (numericAmount > e70) {
      return {
        tier: "amber",
        label: `⚠ المبلغ فوق الـ 70% المعتاد بس لسه في المتاح. تأكد قبل ما تصرف.`,
      };
    }
    if (numericAmount > e50) {
      return {
        tier: "cyan",
        label: `✓ المبلغ بين 50% و 70% — في الحد الآمن.`,
      };
    }
    return {
      tier: "green",
      label: `✓ المبلغ تحت 50% — مريح جدًا.`,
    };
  }, [eligibility, numericAmount]);

  const canSubmit =
    matchedEmployee !== null &&
    eligibility !== null &&
    numericAmount > 0 &&
    amountStatus.tier !== "red" &&
    numericInstallments >= 1 &&
    numericInstallments <= 24 &&
    !isSubmitting;

  function fillFromPercent(pct: number) {
    if (!eligibility) return;
    const value = Math.round(
      Number(eligibility.available_headroom ?? 0) * pct,
    );
    setAmount(String(value));
  }

  function fillMax() {
    if (!eligibility) return;
    setAmount(String(Math.floor(Number(eligibility.available_headroom ?? 0))));
  }

  return (
    <form
      action={(fd) => {
        if (!matchedEmployee) return;
        fd.set("employee_id", matchedEmployee.id);
        startSubmit(() => issueAction(fd));
      }}
      className="space-y-5"
    >
      {/* Employee picker */}
      <div>
        <label
          htmlFor="employee_name"
          className="block text-sm font-bold text-slate-700 mb-2 font-cairo"
        >
          الموظف <span className="text-red-500">*</span>
        </label>
        <input
          id="employee_name"
          type="text"
          list="employees-list"
          value={employeeQuery}
          onChange={(e) => setEmployeeQuery(e.target.value)}
          placeholder="اكتب أول حروف من اسم الموظف..."
          className={`w-full px-4 py-3 rounded-lg border outline-none transition text-slate-900 font-cairo ${
            matchedEmployee
              ? "border-emerald-300 bg-emerald-50/30 focus:border-emerald-500"
              : "border-slate-200 focus:border-brand-cyan"
          }`}
          autoComplete="off"
        />
        <datalist id="employees-list">
          {employees.map((e) => (
            <option key={e.id} value={e.full_name}>
              {e.job_title ?? ""}
              {e.department ? ` · ${e.department}` : ""}
            </option>
          ))}
        </datalist>
        {!matchedEmployee && employeeQuery.length > 0 && (
          <p className="text-[11px] text-amber-700 mt-1 font-cairo">
            ⚠ مفيش موظف بالاسم ده بالظبط. اختار من القائمة المنسدلة.
          </p>
        )}
        {matchedEmployee && (
          <p className="text-[11px] text-emerald-700 mt-1 font-cairo">
            ✓ {matchedEmployee.full_name}
            {matchedEmployee.job_title
              ? ` · ${matchedEmployee.job_title}`
              : ""}
          </p>
        )}
      </div>

      {/* Eligibility panel */}
      {matchedEmployee && (
        <EligibilityPanel
          loading={eligibilityLoading}
          error={eligibilityError}
          row={eligibility}
          onPick50={() => fillFromPercent(0.5)}
          onPick70={() => fillFromPercent(0.7)}
          onPickMax={fillMax}
        />
      )}

      {/* Amount */}
      <div>
        <label
          htmlFor="amount"
          className="block text-sm font-bold text-slate-700 mb-2 font-cairo"
        >
          المبلغ المطلوب (جنيه) <span className="text-red-500">*</span>
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="مثلًا: 2500"
          className={`w-full px-4 py-3 rounded-lg border-2 outline-none transition text-2xl font-bold text-slate-900 font-mono text-right ${
            AMOUNT_TIER_CLASSES[amountStatus.tier]
          }`}
          dir="ltr"
        />
        {amountStatus.label && (
          <p
            className={`text-xs mt-2 font-cairo font-bold ${
              AMOUNT_LABEL_CLASSES[amountStatus.tier]
            }`}
          >
            {amountStatus.label}
          </p>
        )}
      </div>

      {/* Installments */}
      <div>
        <label
          htmlFor="installments"
          className="block text-sm font-bold text-slate-700 mb-2 font-cairo"
        >
          عدد الأقساط (1–24)
        </label>
        <input
          id="installments"
          name="installments"
          type="number"
          min="1"
          max="24"
          value={installments}
          onChange={(e) => setInstallments(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
        />
        {numericAmount > 0 && numericInstallments > 0 && (
          <p className="text-[11px] text-slate-500 mt-1 font-cairo">
            القسط الشهري = <b className="text-slate-700">{fmt(
              numericAmount / numericInstallments,
            )}</b>{" "}
            ج لمدة <b className="text-slate-700">{numericInstallments}</b>{" "}
            شهر، يخصم تلقائيًا من راتب الموظف.
          </p>
        )}
      </div>

      {/* Reason */}
      <div>
        <label
          htmlFor="reason"
          className="block text-sm font-bold text-slate-700 mb-2 font-cairo"
        >
          السبب / ملاحظات (اختياري)
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="مثلًا: ظرف صحي مفاجئ"
          className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo resize-none"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all font-cairo disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        {isSubmitting
          ? "...جاري الصرف"
          : amountStatus.tier === "red"
            ? "⚠ المبلغ بيتجاوز المتاح"
            : !matchedEmployee
              ? "اختار موظف الأول"
              : numericAmount <= 0
                ? "اكتب المبلغ"
                : `اعتمد وصرف ${fmt(numericAmount)} ج`}
      </button>

      <p className="text-[11px] text-slate-500 text-center font-cairo">
        السلفة تتسجل بحالة "مدفوع" فورًا، وتنخصم تلقائيًا من راتب الموظف
        على عدد الأقساط اللي اخترتها.
      </p>
    </form>
  );
}

// ----------------------------------------------------------------------------
// Eligibility panel sub-component
// ----------------------------------------------------------------------------

function EligibilityPanel({
  loading,
  error,
  row,
  onPick50,
  onPick70,
  onPickMax,
}: {
  loading: boolean;
  error: string | null;
  row: AccruedNetRow | null;
  onPick50: () => void;
  onPick70: () => void;
  onPickMax: () => void;
}) {
  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500 font-cairo text-center">
        ...جاري حساب الاستحقاق
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 font-cairo">
        {error}
      </div>
    );
  }

  if (!row) return null;

  const headroom = Number(row.available_headroom ?? 0);
  const e50 = Number(row.eligible_50pct ?? 0);
  const e70 = Number(row.eligible_70pct ?? 0);
  const accruedNet = Number(row.accrued_net ?? 0);
  const openAdvances = Number(row.existing_open_advances ?? 0);
  const attended = Number(row.attended_days ?? 0);
  const monthly = Number(row.monthly_base ?? 0);

  return (
    <div className="bg-gradient-to-br from-cyan-50 to-emerald-50 border-2 border-cyan-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 font-cairo">
          📊 الاستحقاق المحسوب
        </h3>
        <span className="text-[10px] text-slate-500 font-cairo">
          بناءً على {attended} يوم حضور هذا الشهر
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="الراتب الشهري" value={monthly} color="slate" />
        <Metric label="الصافي المستحق" value={accruedNet} color="emerald" />
        <Metric label="سلف مفتوحة قديمة" value={openAdvances} color="amber" />
        <Metric
          label="المتاح للصرف"
          value={headroom}
          color="cyan"
          highlight
        />
      </div>

      {headroom > 0 ? (
        <>
          <div className="border-t border-cyan-200 pt-3">
            <div className="text-xs text-slate-600 mb-2 font-cairo">
              💡 اختصارات لتعبئة المبلغ:
            </div>
            <div className="grid grid-cols-3 gap-2">
              <QuickPickButton onClick={onPick50} label="50%" sub={`${fmt(e50)} ج`} />
              <QuickPickButton onClick={onPick70} label="70%" sub={`${fmt(e70)} ج`} highlight />
              <QuickPickButton
                onClick={onPickMax}
                label="كل المتاح"
                sub={`${fmt(headroom)} ج`}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 font-cairo">
          ⚠ المتاح للصرف صفر. الموظف عنده سلف مفتوحة بتغطي كل الصافي المستحق
          ({fmt(openAdvances)} ج سلف قديمة مقابل {fmt(accruedNet)} ج صافي).
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  color,
  highlight,
}: {
  label: string;
  value: number;
  color: "slate" | "emerald" | "amber" | "cyan";
  highlight?: boolean;
}) {
  const colorClasses = {
    slate: "text-slate-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    cyan: "text-cyan-700",
  }[color];
  return (
    <div
      className={`bg-white rounded-lg p-3 ${
        highlight ? "ring-2 ring-cyan-400 shadow-md" : "border border-slate-100"
      }`}
    >
      <div className="text-[10px] text-slate-500 font-cairo mb-0.5">
        {label}
      </div>
      <div className={`text-lg font-black font-mono ${colorClasses}`} dir="ltr">
        {fmt(value)} ج
      </div>
    </div>
  );
}

function QuickPickButton({
  onClick,
  label,
  sub,
  highlight,
}: {
  onClick: () => void;
  label: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-2 rounded-lg border-2 transition text-center font-cairo ${
        highlight
          ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800"
          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
      }`}
    >
      <div className="text-sm font-bold">{label}</div>
      <div className="text-[10px] opacity-75 font-mono mt-0.5" dir="ltr">
        {sub}
      </div>
    </button>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const AMOUNT_TIER_CLASSES: Record<string, string> = {
  neutral:
    "border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20",
  green: "border-emerald-400 bg-emerald-50/50 focus:ring-2 focus:ring-emerald-300",
  cyan: "border-cyan-400 bg-cyan-50/50 focus:ring-2 focus:ring-cyan-300",
  amber: "border-amber-400 bg-amber-50/50 focus:ring-2 focus:ring-amber-300",
  red: "border-red-500 bg-red-50/50 focus:ring-2 focus:ring-red-300",
};

const AMOUNT_LABEL_CLASSES: Record<string, string> = {
  neutral: "text-slate-500",
  green: "text-emerald-700",
  cyan: "text-cyan-700",
  amber: "text-amber-700",
  red: "text-red-700",
};

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("ar-EG");
}
