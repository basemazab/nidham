import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { calculateEosGratuity, EosInvalidDateError } from "@/lib/eos";

// ============================================================================
// EOS Gratuity Calculator (مكافأة نهاية الخدمة)
// ============================================================================
//
// HR enters: employee + hypothetical termination date. Shows the full
// breakdown per year + final total. Pure GET-driven — no actions, no
// mutations. Refreshable / shareable URL.
//
// Query params:
//   employee_id   — required to compute
//   term_date     — required to compute (defaults to today)
//
// Use cases:
//   - "Should we keep this employee or let them go this year vs. next?"
//   - "What's the gratuity if termination is at 5-year mark vs. 5y 1m?"
//   - Quick what-if before a termination conversation

export const dynamic = "force-dynamic";

type Employee = {
  id: string;
  full_name: string;
  hire_date: string | null;
  basic_salary: number | null;
  housing_allowance: number | null;
  transport_allowance: number | null;
  department: string | null;
  job_title: string | null;
};

type SearchParams = Promise<{
  employee_id?: string;
  term_date?: string;
  use_total?: string; // optional: include allowances
}>;

function formatEGP(n: number): string {
  return n.toLocaleString("ar-EG", { maximumFractionDigits: 2 }) + " ج";
}

export default async function EosCalculatorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getMyProfile();
  const companyId = profile?.company_id ?? "";

  const params = await searchParams;
  const selectedEmpId = params.employee_id ?? "";
  const todayIso = new Date().toISOString().split("T")[0];
  const termDate = params.term_date ?? todayIso;
  const useTotal = params.use_total === "1";

  // Load all active employees for the dropdown
  const { data: empList } = await supabase
    .from("employees")
    .select(
      "id, full_name, hire_date, basic_salary, housing_allowance, transport_allowance, department, job_title",
    )
    .eq("company_id", companyId)
    .order("full_name")
    .returns<Employee[]>();

  const employees = empList ?? [];
  const selected = employees.find((e) => e.id === selectedEmpId);

  const baseSalary = selected
    ? useTotal
      ? Number(selected.basic_salary ?? 0) +
        Number(selected.housing_allowance ?? 0) +
        Number(selected.transport_allowance ?? 0)
      : Number(selected.basic_salary ?? 0)
    : 0;

  // J6: catch EosInvalidDateError so termination-before-hire shows a
  // clear error instead of silently rendering "0 EGP gratuity" on an
  // official certificate-style page.
  let calc = null;
  let calcError: string | null = null;
  if (selected && selected.hire_date && baseSalary > 0) {
    try {
      calc = calculateEosGratuity(selected.hire_date, termDate, baseSalary);
    } catch (err) {
      if (err instanceof EosInvalidDateError) {
        calcError = err.message;
      } else {
        throw err;
      }
    }
  }

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-200 text-amber-700 text-xs font-bold mb-2 font-cairo">
            ⚖ قانون 12/2003 — مادة 122
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            حاسبة مكافأة نهاية الخدمة
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-3xl">
            احسب المكافأة المستحقة لأي موظف لو اتنهت خدمته في تاريخ محدد.
            النظام بيحسب حسب القانون: نصف شهر للسنوات الخمس الأولى، وشهر كامل
            عن كل سنة بعد كده.
          </p>
        </header>

        {/* Filter form */}
        <form
          method="get"
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
            <div>
              <label
                htmlFor="employee_id"
                className="block text-xs font-medium text-slate-600 mb-1 font-cairo"
              >
                الموظف
              </label>
              <select
                id="employee_id"
                name="employee_id"
                defaultValue={selectedEmpId}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
              >
                <option value="">— اختار موظف —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                    {e.department ? ` — ${e.department}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="term_date"
                className="block text-xs font-medium text-slate-600 mb-1 font-cairo"
              >
                تاريخ نهاية الخدمة (افتراضي)
              </label>
              <input
                type="date"
                id="term_date"
                name="term_date"
                defaultValue={termDate}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full px-5 py-2 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-sm font-cairo transition shadow-sm"
              >
                احسب
              </button>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-600 font-cairo cursor-pointer">
            <input
              type="checkbox"
              name="use_total"
              value="1"
              defaultChecked={useTotal}
              className="w-4 h-4"
            />
            استخدم المرتب الإجمالي (أساسي + بدلات) بدل الأساسي فقط
            <span className="text-[10px] text-amber-700">
              (سياسة شركتك — مش إجباري بالقانون)
            </span>
          </label>
        </form>

        {/* Empty state */}
        {!selected && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
            <div className="text-5xl mb-3">⚖</div>
            <h2 className="text-lg font-bold font-cairo text-slate-700 mb-1">
              اختار موظف علشان نحسب
            </h2>
            <p className="text-sm text-slate-500 font-cairo">
              النتيجة هتظهر هنا بتفصيل سنة بسنة.
            </p>
          </div>
        )}

        {/* J6: calculation error (e.g., termination before hire) */}
        {calcError && (
          <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-6 font-cairo">
            <div className="font-bold text-rose-900 mb-1">⚠ خطأ في الحساب</div>
            <p className="text-sm text-rose-800">{calcError}</p>
          </div>
        )}

        {/* No hire date warning */}
        {selected && !selected.hire_date && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 font-cairo">
            <div className="font-bold text-amber-900 mb-1">
              ⚠ مفيش تاريخ تعيين مسجّل لـ {selected.full_name}
            </div>
            <p className="text-sm text-amber-800">
              مش هنقدر نحسب من غيره.{" "}
              <Link
                href={`/dashboard/employees/${selected.id}`}
                className="underline font-bold"
              >
                افتح ملف الموظف وضيفه
              </Link>
            </p>
          </div>
        )}

        {/* No salary warning */}
        {selected && selected.hire_date && baseSalary <= 0 && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 font-cairo">
            <div className="font-bold text-amber-900 mb-1">
              ⚠ مفيش راتب أساسي مسجّل لـ {selected.full_name}
            </div>
            <p className="text-sm text-amber-800">
              ضيف الراتب الأساسي في ملف الموظف علشان نقدر نحسب.
            </p>
          </div>
        )}

        {/* Results */}
        {calc && selected && (
          <>
            <div className="bg-gradient-to-br from-emerald-50 via-cyan-50 to-white border-2 border-emerald-200 rounded-2xl p-6 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-emerald-700 font-bold mb-1 font-cairo">
                    الموظف
                  </div>
                  <div className="text-xl font-black text-slate-800 font-cairo">
                    {selected.full_name}
                  </div>
                  <div className="text-sm text-slate-600 font-cairo">
                    {selected.job_title}
                    {selected.department && ` · ${selected.department}`}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-emerald-700 font-bold mb-1 font-cairo">
                    مدة الخدمة
                  </div>
                  <div className="text-xl font-black text-slate-800 font-cairo">
                    {calc.yearsCompleted} سنة
                    {calc.monthsBeyondLastFullYear > 0 &&
                      ` و ${calc.monthsBeyondLastFullYear} شهر`}
                  </div>
                  <div className="text-xs text-slate-500 font-cairo">
                    من {selected.hire_date} → {termDate}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-emerald-700 font-bold mb-1 font-cairo">
                    إجمالي المكافأة
                  </div>
                  <div className="text-3xl font-black text-emerald-700 font-display">
                    {formatEGP(calc.totalAmountEgp)}
                  </div>
                  <div className="text-xs text-slate-500 font-cairo">
                    {calc.totalMonthsEarned.toFixed(2)} شهر ×{" "}
                    {formatEGP(calc.basicSalary)}
                  </div>
                </div>
              </div>
            </div>

            {/* Breakdown table */}
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-800 font-cairo">
                  📋 التفصيل السنوي
                </h2>
                <p className="text-xs text-slate-500 font-cairo mt-0.5">
                  حسب مادة 122 من قانون العمل المصري 12/2003
                </p>
              </div>
              <table className="w-full text-right">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2 text-xs font-bold text-slate-600 font-cairo">
                      السنة
                    </th>
                    <th className="px-4 py-2 text-xs font-bold text-slate-600 font-cairo">
                      المعدل
                    </th>
                    <th className="px-4 py-2 text-xs font-bold text-slate-600 font-cairo">
                      الأشهر المستحقة
                    </th>
                    <th className="px-4 py-2 text-xs font-bold text-emerald-700 font-cairo">
                      المبلغ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calc.breakdown.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-700 font-mono">
                        {row.yearNumber}
                      </td>
                      <td className="px-4 py-2 text-slate-700 font-cairo text-sm">
                        {row.fractionOfMonth === 0.5
                          ? "½ شهر"
                          : "شهر كامل"}
                        {row.note && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {row.note}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-700 font-mono">
                        {row.monthsEarned.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-emerald-700 font-mono font-bold">
                        {formatEGP(row.amountEgp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-3 text-slate-800 font-cairo font-bold text-sm"
                    >
                      الإجمالي
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-mono font-bold">
                      {calc.totalMonthsEarned.toFixed(2)} شهر
                    </td>
                    <td className="px-4 py-3 text-emerald-700 font-mono font-black text-lg">
                      {formatEGP(calc.totalAmountEgp)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Legal note */}
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-cairo leading-relaxed">
              <strong>⚖ ملاحظة قانونية:</strong> المكافأة دي مستحقة حسب
              قانون 12/2003 لو الإنهاء كان من جانب صاحب العمل بدون سبب جوهري،
              أو الموظف استقال بإخطار صحيح. في حالة الإنهاء بسبب خطأ جسيم
              (مادة 69)، الموظف يفقد المكافأة. الحسابات دي للتخطيط — قبل أي
              إنهاء فعلي راجع مع المستشار القانوني.
            </div>
          </>
        )}
      </div>
    </main>
  );
}
