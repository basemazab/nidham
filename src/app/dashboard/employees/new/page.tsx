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

            <div className="grid md:grid-cols-2 gap-4">
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
