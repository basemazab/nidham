import Link from "next/link";
import { createEmployee } from "../actions";

type SearchParams = Promise<{ error?: string }>;

export default async function NewEmployeePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-2xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/dashboard/employees"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لليستة الموظفين
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            إضافة موظف جديد
          </h1>
          <p className="text-sm text-slate-500">
            املا البيانات اللي عندك دلوقتي — تقدر تكمّل الباقي بعدين
          </p>
        </header>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
              ⚠ {decodeURIComponent(error)}
            </div>
          )}

          <form action={createEmployee} className="space-y-5">
            {/* Required: Full Name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
                الاسم الكامل <span className="text-red-500">*</span>
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                placeholder="مثلًا: أحمد محمد سيد"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="employee_code" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                كود الموظف (لربط البصمة)
                <span className="text-slate-400 text-xs mr-2">— نفس الكود اللي في جهاز ZKTeco</span>
              </label>
              <input
                id="employee_code"
                name="employee_code"
                type="text"
                placeholder="مثلًا: 100 أو EMP-042"
                dir="ltr"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-right font-mono"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="job_title" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  المسمى الوظيفي
                </label>
                <input
                  id="job_title"
                  name="job_title"
                  type="text"
                  placeholder="Sales Rep"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="department" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  القسم
                </label>
                <input
                  id="department"
                  name="department"
                  type="text"
                  placeholder="المبيعات"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  الموبايل
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="01XXXXXXXXX"
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-right"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  الإيميل
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="employee@company.com"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="hire_date" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  تاريخ التعيين
                </label>
                <input
                  id="hire_date"
                  name="hire_date"
                  type="date"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="date_of_birth" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  تاريخ الميلاد 🎂
                  <span className="text-xs text-slate-400 font-normal mr-1">(للاحتفالات)</span>
                </label>
                <input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
            </div>

            {/* Salary structure — feeds the payroll module */}
            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-800 mb-1 font-cairo">💰 هيكل الراتب</h3>
              <p className="text-xs text-slate-500 mb-3 font-cairo">
                دي القيم اللي السيستم هيستخدمها لما تحسب المرتب الشهري. اتركها صفر لو الموظف لسه مش معتمد عليه راتب.
              </p>

              <div className="mb-4">
                <label htmlFor="pay_frequency" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  دورة الصرف
                  <span className="text-xs text-slate-400 mr-2 font-normal">
                    (بيتحسب معاهم في أي فترة مرتبات)
                  </span>
                </label>
                <select
                  id="pay_frequency"
                  name="pay_frequency"
                  defaultValue="monthly"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                >
                  <option value="monthly">شهري — موظف إدارة / مكاتب</option>
                  <option value="weekly">أسبوعي — عامل إنتاج باليومية</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1 font-cairo">
                  الموظفين الشهريين بياخدوا مرتب مع فترة شهرية، والأسبوعيين مع فترة أسبوعية.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="basic_salary" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    الراتب الأساسي (جنيه)
                  </label>
                  <input
                    id="basic_salary"
                    name="basic_salary"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="5000"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="housing_allowance" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    بدل سكن
                  </label>
                  <input
                    id="housing_allowance"
                    name="housing_allowance"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="transport_allowance" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    بدل انتقال
                  </label>
                  <input
                    id="transport_allowance"
                    name="transport_allowance"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="other_allowances" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    بدلات أخرى
                  </label>
                  <input
                    id="other_allowances"
                    name="other_allowances"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="incentive_allowance" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    حافز شهري
                    <span className="text-xs text-slate-400 mr-2 font-normal">
                      (Hafiz / incentive)
                    </span>
                  </label>
                  <input
                    id="incentive_allowance"
                    name="incentive_allowance"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                  />
                  <p className="text-[11px] text-slate-500 mt-1 font-cairo">
                    حافز ثابت كل شهر. مكافأة لمرة واحدة (مُكافأة) ضيفها من شهر المرتب نفسه.
                  </p>
                </div>
              </div>
            </div>

            {/* Identity & compliance */}
            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-800 mb-1 font-cairo">🪪 بيانات قانونية</h3>
              <p className="text-xs text-slate-500 mb-3 font-cairo">
                مهمة للقسائم والتأمينات والضريبة — لو مش متوفرة دلوقتي ممكن تضيفها بعدين.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="national_id" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    الرقم القومي
                  </label>
                  <input
                    id="national_id"
                    name="national_id"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="14 رقم"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-right font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="social_insurance_number" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    رقم التأمينات
                  </label>
                  <input
                    id="social_insurance_number"
                    name="social_insurance_number"
                    type="text"
                    dir="ltr"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-right font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="bank_name" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    البنك
                  </label>
                  <input
                    id="bank_name"
                    name="bank_name"
                    type="text"
                    placeholder="مثلًا: CIB"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="bank_account_number" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    رقم الحساب البنكي / IBAN
                  </label>
                  <input
                    id="bank_account_number"
                    name="bank_account_number"
                    type="text"
                    dir="ltr"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-right font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                الحالة
              </label>
              <select
                id="status"
                name="status"
                defaultValue="active"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              >
                <option value="active">نشط</option>
                <option value="on_leave">في إجازة</option>
                <option value="terminated">منتهي العمل</option>
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                ملاحظات
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="أي ملاحظات إضافية..."
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo"
              >
                حفظ الموظف
              </button>
              <Link
                href="/dashboard/employees"
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
