"use client";

import { useState, useMemo } from "react";
import {
  calculateSocialInsurance,
  calculateEmployerSocialInsurance,
  calculateMonthlyIncomeTax,
  formatEGP,
  MIN_INSURABLE_WAGE,
  MAX_INSURABLE_WAGE,
} from "@/lib/payroll";

// ============================================================================
// Interactive salary calculator
// ============================================================================
//
// Uses the same production payroll functions the actual Nidham payroll engine
// uses — so what visitors see here is byte-for-byte what they'd get inside
// the product. That's deliberate: it builds trust + the numbers are
// guaranteed to stay current (single source of truth in lib/payroll.ts).
//
// State design:
//   • `basicSalary` + `fixedAllowances` → feed the insurance base
//   • `variableAllowances` → added to gross but NOT to insurance base
//   • All re-derived via useMemo on every keystroke — no event handlers
//     for "calculate" button; the result updates live.

export function SalaryCalculator() {
  // ── Inputs (all in EGP/month) ───────────────────────────────────────────
  const [basicSalary, setBasicSalary] = useState<number>(8000);
  const [fixedAllowances, setFixedAllowances] = useState<number>(2000);
  const [variableAllowances, setVariableAllowances] = useState<number>(0);

  // ── Derived calculations ────────────────────────────────────────────────
  const result = useMemo(() => {
    const safe = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
    const basic = safe(basicSalary);
    const fixed = safe(fixedAllowances);
    const variable = safe(variableAllowances);

    // Insurance is on the fixed portion only (law 148/2019)
    const insuranceBase = basic + fixed;
    const grossSalary = insuranceBase + variable;

    // Insurance contributions (employee + employer)
    const employeeInsurance = calculateSocialInsurance(insuranceBase);
    const employerInsurance = calculateEmployerSocialInsurance(insuranceBase);

    // Tax base = gross after insurance is deducted
    const monthlyTaxableBeforeAnnualization = grossSalary - employeeInsurance;
    const monthlyTax = calculateMonthlyIncomeTax(
      monthlyTaxableBeforeAnnualization,
    );

    // Net = gross - employee insurance - tax
    const netSalary = grossSalary - employeeInsurance - monthlyTax;

    // Show the effective insurable wage so users see when the cap kicks in
    const effectiveInsurableWage = Math.max(
      MIN_INSURABLE_WAGE,
      Math.min(insuranceBase, MAX_INSURABLE_WAGE),
    );
    const cappedAtMax = insuranceBase > MAX_INSURABLE_WAGE;
    const floored = insuranceBase < MIN_INSURABLE_WAGE;

    return {
      grossSalary,
      insuranceBase,
      effectiveInsurableWage,
      cappedAtMax,
      floored,
      employeeInsurance,
      employerInsurance,
      monthlyTax,
      netSalary,
      totalCompanyCost: grossSalary + employerInsurance,
    };
  }, [basicSalary, fixedAllowances, variableAllowances]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* ─── Inputs ─── */}
      <div className="p-6 md:p-8 bg-gradient-to-br from-cyan-50/50 to-white border-b border-slate-200">
        <h2 className="text-lg font-black text-slate-900 mb-5">
          أدخل بيانات الموظف
        </h2>

        <div className="grid sm:grid-cols-3 gap-4">
          <NumberInput
            label="الأجر الأساسي"
            hint="من العقد"
            value={basicSalary}
            onChange={setBasicSalary}
          />
          <NumberInput
            label="بدلات ثابتة"
            hint="مواصلات، أكل، طبيعة عمل"
            value={fixedAllowances}
            onChange={setFixedAllowances}
          />
          <NumberInput
            label="بدلات متغيرة"
            hint="عمولات، أوفر تايم، مكافآت"
            value={variableAllowances}
            onChange={setVariableAllowances}
          />
        </div>

        {/* Hints about insurance cap/floor */}
        {(result.cappedAtMax || result.floored) && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            {result.cappedAtMax && (
              <p>
                ⚠️ الأجر الثابت ({formatEGP(result.insuranceBase)}) أعلى من الحد
                الأقصى للأجر التأميني ({formatEGP(MAX_INSURABLE_WAGE)}).
                التأمينات بتتحسب على الحد الأقصى بس.
              </p>
            )}
            {result.floored && (
              <p>
                ℹ️ الأجر الثابت ({formatEGP(result.insuranceBase)}) أقل من الحد
                الأدنى ({formatEGP(MIN_INSURABLE_WAGE)}). التأمينات بتتحسب على
                الحد الأدنى.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ─── Results ─── */}
      <div className="p-6 md:p-8">
        <h2 className="text-lg font-black text-slate-900 mb-5">
          النتيجة التفصيلية
        </h2>

        {/* Big net salary number */}
        <div className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-300">
          <div className="text-sm font-bold text-emerald-700 mb-2">
            صافي المرتب الشهري
          </div>
          <div className="text-4xl md:text-5xl font-black text-emerald-900">
            {formatEGP(result.netSalary)}
          </div>
          <div className="text-sm text-emerald-700 mt-2">
            اللي بيستلمه الموظف فعلياً كل شهر
          </div>
        </div>

        {/* Breakdown table */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              <Row label="الأجر الإجمالي" value={result.grossSalary} kind="positive" />
              <Row
                label="الأجر التأميني (الثابت فقط)"
                value={result.effectiveInsurableWage}
                kind="neutral"
                hint="الأساسي + البدلات الثابتة، محصور بين الحد الأدنى والأقصى"
              />
              <Row
                label="التأمينات الاجتماعية (11%)"
                value={result.employeeInsurance}
                kind="negative"
                hint="تتخصم من الموظف، حسب قانون 148/2019"
              />
              <Row
                label="ضريبة كسب العمل"
                value={result.monthlyTax}
                kind="negative"
                hint="بالشرايح المتدرجة على أساس سنوي"
              />
              <Row
                label="صافي المرتب"
                value={result.netSalary}
                kind="result"
              />
            </tbody>
          </table>
        </div>

        {/* Company cost sidebar */}
        <div className="mt-6 p-5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-xs font-bold tracking-wide uppercase text-slate-600 mb-2">
            من جانب الشركة
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between sm:block">
              <span className="text-slate-600">إجمالي الموظف</span>
              <div className="font-bold text-slate-900 text-base">
                {formatEGP(result.grossSalary)}
              </div>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-slate-600">+ حصة صاحب العمل (18.75%)</span>
              <div className="font-bold text-slate-900 text-base">
                {formatEGP(result.employerInsurance)}
              </div>
            </div>
          </div>
          <div className="border-t border-slate-300 mt-4 pt-3 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-700">
              التكلفة الكاملة على الشركة
            </span>
            <span className="text-lg font-black text-brand-cyan-dark">
              {formatEGP(result.totalCompanyCost)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function NumberInput({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-bold text-slate-900 mb-1">
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={100}
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-4 py-3 pr-14 text-lg font-bold text-slate-900 rounded-lg border border-slate-300 bg-white focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 outline-none transition"
          placeholder="0"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
          ج.م
        </span>
      </div>
      <span className="block text-xs text-slate-500 mt-1">{hint}</span>
    </label>
  );
}

function Row({
  label,
  value,
  kind,
  hint,
}: {
  label: string;
  value: number;
  kind: "positive" | "negative" | "neutral" | "result";
  hint?: string;
}) {
  const styles = {
    positive: {
      bg: "bg-white",
      label: "text-slate-700",
      value: "text-slate-900 font-bold",
      sign: "+",
    },
    negative: {
      bg: "bg-rose-50/40",
      label: "text-rose-800",
      value: "text-rose-700 font-bold",
      sign: "-",
    },
    neutral: {
      bg: "bg-slate-50",
      label: "text-slate-600",
      value: "text-slate-700",
      sign: "",
    },
    result: {
      bg: "bg-emerald-50",
      label: "text-emerald-900 font-bold",
      value: "text-emerald-900 font-black text-lg",
      sign: "=",
    },
  }[kind];

  return (
    <tr className={`${styles.bg} border-b border-slate-200 last:border-b-0`}>
      <td className="px-4 py-3 align-top">
        <div className={styles.label}>{label}</div>
        {hint && (
          <div className="text-xs text-slate-500 mt-0.5 font-normal">
            {hint}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-end whitespace-nowrap">
        <span className={styles.value}>
          {styles.sign && (
            <span className="text-slate-400 ml-1 font-normal">
              {styles.sign}
            </span>
          )}
          {formatEGP(value)}
        </span>
      </td>
    </tr>
  );
}
