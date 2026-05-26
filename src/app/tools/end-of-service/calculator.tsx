"use client";

import { useState, useMemo } from "react";
import { calculateEosGratuity, EosInvalidDateError } from "@/lib/eos";
import { formatEGP } from "@/lib/payroll";

// ============================================================================
// Interactive EOS calculator
// ============================================================================
//
// Uses the production calculateEosGratuity() from lib/eos.ts. Inputs:
//   • Hire date + termination date (ISO YYYY-MM-DD)
//   • Last basic monthly salary
//
// Output: total + per-year breakdown table.

export function EosCalculator() {
  // Sensible defaults for first-load demo
  const [hireDate, setHireDate] = useState<string>("2018-01-01");
  const [terminationDate, setTerminationDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [basicSalary, setBasicSalary] = useState<number>(10000);

  const result = useMemo(() => {
    try {
      return {
        ok: true as const,
        data: calculateEosGratuity(hireDate, terminationDate, basicSalary || 0),
      };
    } catch (e) {
      if (e instanceof EosInvalidDateError) {
        return { ok: false as const, message: e.message };
      }
      return {
        ok: false as const,
        message: "حصل خطأ غير متوقع في الحساب",
      };
    }
  }, [hireDate, terminationDate, basicSalary]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Inputs */}
      <div className="p-6 md:p-8 bg-gradient-to-br from-cyan-50/50 to-white border-b border-slate-200">
        <h2 className="text-lg font-black text-slate-900 mb-5">
          أدخل بيانات الموظف
        </h2>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <DateInput
            label="تاريخ التعيين"
            value={hireDate}
            onChange={setHireDate}
          />
          <DateInput
            label="تاريخ ترك الخدمة"
            value={terminationDate}
            onChange={setTerminationDate}
          />
        </div>

        <label className="block">
          <span className="block text-sm font-bold text-slate-900 mb-1">
            آخر أجر أساسي (شهري)
          </span>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={100}
              value={basicSalary || ""}
              onChange={(e) => setBasicSalary(Number(e.target.value))}
              className="w-full px-4 py-3 pr-14 text-lg font-bold text-slate-900 rounded-lg border border-slate-300 bg-white focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 outline-none transition"
              placeholder="0"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              ج.م
            </span>
          </div>
          <span className="block text-xs text-slate-500 mt-1">
            الأجر الأساسي من العقد — مش الإجمالي ولا البدلات
          </span>
        </label>
      </div>

      {/* Results */}
      <div className="p-6 md:p-8">
        {!result.ok && (
          <div className="px-4 py-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            ⚠️ {result.message}
          </div>
        )}

        {result.ok && (
          <>
            {/* Big total */}
            <div className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-300">
              <div className="text-sm font-bold text-emerald-700 mb-2">
                إجمالي مكافأة نهاية الخدمة
              </div>
              <div className="text-4xl md:text-5xl font-black text-emerald-900">
                {formatEGP(result.data.totalAmountEgp)}
              </div>
              <div className="text-sm text-emerald-700 mt-2 flex items-center gap-3 flex-wrap">
                <span>
                  مدة الخدمة:{" "}
                  <strong>
                    {result.data.yearsCompleted} سنة
                    {result.data.monthsBeyondLastFullYear > 0
                      ? ` + ${result.data.monthsBeyondLastFullYear} شهر`
                      : ""}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  المعادل:{" "}
                  <strong>
                    {result.data.totalMonthsEarned.toFixed(2)} شهر أجر
                  </strong>
                </span>
              </div>
            </div>

            {/* Breakdown */}
            {result.data.breakdown.length > 0 ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-start text-xs font-bold text-slate-600">
                        السنة
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-bold text-slate-600">
                        المعدل
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-bold text-slate-600">
                        الشهور المستحقة
                      </th>
                      <th className="px-4 py-3 text-end text-xs font-bold text-slate-600">
                        المبلغ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.breakdown.map((row) => (
                      <tr
                        key={row.yearNumber}
                        className="border-t border-slate-200"
                      >
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {row.yearNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.fractionOfMonth === 0.5
                            ? "نص شهر"
                            : "شهر كامل"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.monthsEarned.toFixed(2)} شهر
                        </td>
                        <td className="px-4 py-3 text-end font-bold text-slate-900 whitespace-nowrap">
                          {formatEGP(row.amountEgp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50 border-t-2 border-emerald-300">
                      <td colSpan={2} className="px-4 py-3 font-black text-emerald-900">
                        الإجمالي
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-900">
                        {result.data.totalMonthsEarned.toFixed(2)} شهر
                      </td>
                      <td className="px-4 py-3 text-end font-black text-emerald-900 whitespace-nowrap">
                        {formatEGP(result.data.totalAmountEgp)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                ℹ️ مدة الخدمة أقل من شهر — مفيش مكافأة مستحقة.
              </div>
            )}

            {/* Disclaimers */}
            <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 space-y-2">
              <p>
                <strong>⚠️ تنبيه:</strong> الحاسبة بتطبق قاعدة المادة 122
                فقط. لو الموظف اتفصل لسبب مشروع (مادة 69) أو استقال قبل
                سنتين بدون إخطار، ممكن يفقد المكافأة كاملة أو جزئية.
              </p>
              <p>
                <strong>🧮 الحساب على الأساسي:</strong> القانون نص على
                "آخر أجر" — بعض المحاكم بتفسرها كأجر إجمالي شامل البدلات
                الثابتة. للحساب الأدق، استشير محامي عمل أو
                <a href="/contact" className="text-brand-cyan-dark hover:underline">
                  {" "}اتواصل معانا
                </a>
                .
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-bold text-slate-900 mb-1">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 text-base font-bold text-slate-900 rounded-lg border border-slate-300 bg-white focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 outline-none transition"
      />
    </label>
  );
}
