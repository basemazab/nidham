"use client";

import { useState, useMemo } from "react";
import {
  calculateSocialInsurance,
  calculateEmployerSocialInsurance,
  formatEGP,
  MIN_INSURABLE_WAGE,
  MAX_INSURABLE_WAGE,
  SOCIAL_INSURANCE_RATE,
  EMPLOYER_SOCIAL_INSURANCE_RATE,
} from "@/lib/payroll";

// ============================================================================
// Interactive social insurance calculator
// ============================================================================
//
// Single input (insurable wage), shows employee + employer + total, plus
// floor/ceiling warnings. Simpler than salary-calculator on purpose — most
// people Googling "حساب تأمينات" want a quick lookup.

export function InsuranceCalculator() {
  const [insurableWage, setInsurableWage] = useState<number>(10000);

  const result = useMemo(() => {
    const wage = Number.isFinite(insurableWage) && insurableWage > 0
      ? insurableWage
      : 0;

    const effectiveWage = Math.max(
      MIN_INSURABLE_WAGE,
      Math.min(wage, MAX_INSURABLE_WAGE),
    );

    return {
      effectiveWage,
      cappedAtMax: wage > MAX_INSURABLE_WAGE,
      floored: wage > 0 && wage < MIN_INSURABLE_WAGE,
      employeeShare: calculateSocialInsurance(wage),
      employerShare: calculateEmployerSocialInsurance(wage),
      total:
        calculateSocialInsurance(wage) +
        calculateEmployerSocialInsurance(wage),
    };
  }, [insurableWage]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Input */}
      <div className="p-6 md:p-8 bg-gradient-to-br from-cyan-50/50 to-white border-b border-slate-200">
        <h2 className="text-lg font-black text-slate-900 mb-5">
          أدخل الأجر التأميني
        </h2>

        <label className="block">
          <span className="block text-sm font-bold text-slate-900 mb-1">
            الأجر التأميني الشهري
          </span>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={100}
              value={insurableWage || ""}
              onChange={(e) => setInsurableWage(Number(e.target.value))}
              className="w-full px-4 py-3 pr-14 text-lg font-bold text-slate-900 rounded-lg border border-slate-300 bg-white focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 outline-none transition"
              placeholder="0"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              ج.م
            </span>
          </div>
          <span className="block text-xs text-slate-500 mt-1">
            الأساسي + البدلات الثابتة (مش الإجمالي ولا المتغير)
          </span>
        </label>

        {(result.cappedAtMax || result.floored) && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            {result.cappedAtMax && (
              <p>
                ⚠️ الأجر أعلى من الحد الأقصى ({formatEGP(MAX_INSURABLE_WAGE)})
                — الحساب على {formatEGP(MAX_INSURABLE_WAGE)} بس.
              </p>
            )}
            {result.floored && (
              <p>
                ℹ️ الأجر أقل من الحد الأدنى ({formatEGP(MIN_INSURABLE_WAGE)})
                — الحساب على {formatEGP(MIN_INSURABLE_WAGE)}.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="p-6 md:p-8">
        <h2 className="text-lg font-black text-slate-900 mb-5">
          توزيع التأمينات
        </h2>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {/* Employee card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 border-2 border-rose-200">
            <div className="text-xs font-bold text-rose-700 mb-2">
              نصيب الموظف ({(SOCIAL_INSURANCE_RATE * 100).toFixed(0)}%)
            </div>
            <div className="text-3xl font-black text-rose-900">
              {formatEGP(result.employeeShare)}
            </div>
            <div className="text-xs text-rose-700 mt-2">
              تخصم من المرتب
            </div>
          </div>

          {/* Employer card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-300">
            <div className="text-xs font-bold text-amber-800 mb-2">
              نصيب الشركة ({(EMPLOYER_SOCIAL_INSURANCE_RATE * 100).toFixed(2)}%)
            </div>
            <div className="text-3xl font-black text-amber-900">
              {formatEGP(result.employerShare)}
            </div>
            <div className="text-xs text-amber-800 mt-2">
              تكلفة إضافية على الشركة
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-300 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-emerald-700">
              إجمالي ما يصل للهيئة
            </div>
            <div className="text-sm text-emerald-700 mt-1">
              نصيب الموظف + نصيب الشركة
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-emerald-900">
            {formatEGP(result.total)}
          </div>
        </div>

        {/* Annual projection */}
        <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-xs font-bold tracking-wide uppercase text-slate-600 mb-3">
            على مدار السنة
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-500">الموظف/سنة</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {formatEGP(result.employeeShare * 12)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">الشركة/سنة</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {formatEGP(result.employerShare * 12)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">الإجمالي/سنة</div>
              <div className="font-bold text-brand-cyan-dark mt-0.5">
                {formatEGP(result.total * 12)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
