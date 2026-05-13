import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generatePayrollPeriod } from "../actions";
import { SubmitButton } from "@/components/submit-button";

type SearchParams = Promise<{ error?: string }>;

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export default async function NewPayrollPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get count of active employees
  const { count: empCount } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  const { count: empWithSalary } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .gt("basic_salary", 0);

  const now = new Date();
  // Default to previous month (most common use case)
  let defaultYear = now.getFullYear();
  let defaultMonth = now.getMonth(); // 1-indexed but JS gives 0-indexed prev
  if (defaultMonth === 0) {
    defaultMonth = 12;
    defaultYear--;
  }

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard/payroll" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع لقائمة المرتبات
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            شهر مرتبات جديد
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed">
            النظام هيحسب المرتب لكل موظف تلقائيًا بناءً على راتبه + حضوره + التأمينات والضريبة.
          </p>
        </header>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(error)}
          </div>
        )}

        {/* Warning if some employees don't have salary set */}
        {(empCount ?? 0) > 0 && (empWithSalary ?? 0) < (empCount ?? 0) && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <h3 className="font-bold text-amber-800 mb-1 font-cairo">
              ⚠ {(empCount ?? 0) - (empWithSalary ?? 0)} موظف بدون راتب أساسي
            </h3>
            <p className="text-sm text-amber-700 font-cairo">
              ضبط الراتب الأساسي + البدلات لكل موظف من <Link href="/dashboard/employees" className="underline font-bold">صفحة الموظفين</Link> قبل ما تعمل شهر مرتبات.
            </p>
          </div>
        )}

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          <form action={generatePayrollPeriod} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="month" className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
                  الشهر <span className="text-red-500">*</span>
                </label>
                <select
                  id="month"
                  name="month"
                  required
                  defaultValue={defaultMonth}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                >
                  {ARABIC_MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="year" className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
                  السنة <span className="text-red-500">*</span>
                </label>
                <select
                  id="year"
                  name="year"
                  required
                  defaultValue={defaultYear}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="working_days" className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
                أيام العمل في الشهر <span className="text-red-500">*</span>
              </label>
              <input
                id="working_days"
                name="working_days"
                type="number"
                min="20"
                max="31"
                required
                defaultValue="22"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
              <p className="text-xs text-slate-500 mt-1 font-cairo">
                عادة 22 يوم (6 أيام أسبوعيًا — جمعة فقط) أو 26 (لو سبت وأحد كمان عمل)
              </p>
            </div>

            <div className="bg-cyan-50 border border-cyan-200 p-4 rounded-lg text-sm text-slate-700 font-cairo">
              <strong className="text-cyan-700">📋 خلاصة الحساب:</strong>
              <ul className="mt-2 space-y-1 text-xs">
                <li>✓ راتب أساسي + بدلات (سكن + انتقال + أخرى)</li>
                <li>✓ خصم الغياب (Pro-rated من إجمالي الراتب اليومي)</li>
                <li>✓ التأمينات الاجتماعية = 14% (حد أقصى 12,600 ج)</li>
                <li>✓ ضريبة الدخل التصاعدية المصرية (2024-2025)</li>
                <li>✓ الإعفاء الشخصي = 20,000 ج/سنة</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              <SubmitButton
                loadingText="جاري الحساب..."
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo"
              >
                احسب المرتبات
              </SubmitButton>
              <Link
                href="/dashboard/payroll"
                className="px-6 py-3 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo"
              >
                إلغاء
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
