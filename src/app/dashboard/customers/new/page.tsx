import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { createCustomer } from "../actions";

type SearchParams = Promise<{ error?: string }>;

type EmployeeOption = { id: string; full_name: string };

export default async function NewCustomerPage({
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

  // Scope the employees dropdown to the caller's company so a super-admin
  // session can't accidentally assign cross-tenant employees as owners.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  // Load active employees for the "assigned to" dropdown
  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("company_id", callerCompanyId)
    .eq("status", "active")
    .order("full_name")
    .returns<EmployeeOption[]>();

  const employeeList = employees ?? [];

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/customers"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لليستة العملاء
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            إضافة عميل جديد
          </h1>
          <p className="text-sm text-slate-500">
            ضيف العميل وحدد المسؤول من فريقك — هتقدر تتبّع تفاعلاتهم بعدين
          </p>
        </header>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
              ⚠ {decodeURIComponent(error)}
            </div>
          )}

          <form action={createCustomer} className="space-y-5">
            {/* Required: Full name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
                اسم العميل <span className="text-red-500">*</span>
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                placeholder="مثلًا: شركة الفجر للمقاولات / أو أحمد عبد الحميد"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  نوع العميل
                </label>
                <select
                  id="type"
                  name="type"
                  defaultValue="individual"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                >
                  <option value="individual">👤 فرد</option>
                  <option value="company">🏢 شركة</option>
                </select>
              </div>

              <div>
                <label htmlFor="contact_name" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  جهة الاتصال
                  <span className="text-slate-400 text-xs"> (لو شركة)</span>
                </label>
                <input
                  id="contact_name"
                  name="contact_name"
                  type="text"
                  placeholder="اسم الشخص اللي بنكلمه"
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
                  placeholder="client@example.com"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  الحالة
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue="lead"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                >
                  <option value="lead">Lead — لسه مهتم</option>
                  <option value="active">نشط — بنفاوض</option>
                  <option value="won">تم البيع</option>
                  <option value="lost">ضاع</option>
                </select>
              </div>

              <div>
                <label htmlFor="source" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  مصدر العميل
                </label>
                <select
                  id="source"
                  name="source"
                  defaultValue=""
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                >
                  <option value="">— اختار —</option>
                  <option value="whatsapp">واتساب</option>
                  <option value="facebook">فيسبوك</option>
                  <option value="instagram">إنستجرام</option>
                  <option value="referral">ترشيح من عميل</option>
                  <option value="walkin">دخل المكتب</option>
                  <option value="phone">اتصال مباشر</option>
                  <option value="other">آخر</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="assigned_to" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  مسؤول المتابعة
                </label>
                <select
                  id="assigned_to"
                  name="assigned_to"
                  defaultValue=""
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                >
                  <option value="">— غير محدد —</option>
                  {employeeList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
                {employeeList.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1 font-cairo">
                    ⚠ مفيش موظفين بعد — ضيف موظفين الأول
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="estimated_value" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  قيمة الصفقة المتوقعة (جنيه)
                </label>
                <input
                  id="estimated_value"
                  name="estimated_value"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="50000"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                ملاحظات
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="تفاصيل، اهتمامات، أي معلومة مفيدة..."
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo"
              >
                حفظ العميل
              </button>
              <Link
                href="/dashboard/customers"
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
