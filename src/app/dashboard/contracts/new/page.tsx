import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { createContract } from "../actions";

type SearchParams = Promise<{ error?: string }>;
type Option = { id: string; full_name: string };

export default async function NewContractPage({
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

  // Scope dropdowns to the caller's company so super-admin sessions
  // don't see cross-tenant customers/employees in the picker.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [customersRes, employeesRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, full_name")
      .eq("company_id", callerCompanyId)
      .order("full_name")
      .returns<Option[]>(),
    supabase
      .from("employees")
      .select("id, full_name")
      .eq("company_id", callerCompanyId)
      .eq("status", "active")
      .order("full_name")
      .returns<Option[]>(),
  ]);

  const customers = customersRes.data ?? [];
  const employees = employeesRes.data ?? [];

  const today = new Date().toISOString().split("T")[0];
  const oneYearLater = new Date();
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  const oneYearLaterIso = oneYearLater.toISOString().split("T")[0];

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/contracts"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لليستة العقود
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            عقد جديد
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            سجّل العقد مرة واحدة، النظام هينبهك قبل التجديد بـ 30 يوم تلقائيًا
          </p>
        </header>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
              ⚠ {decodeURIComponent(error)}
            </div>
          )}

          {customers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 mb-4 font-cairo">لازم تضيف عميل الأول</p>
              <Link
                href="/dashboard/customers/new"
                className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo"
              >
                ضيف عميل
              </Link>
            </div>
          ) : (
            <form action={createContract} className="space-y-5">
              <div>
                <label htmlFor="customer_id" className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
                  العميل <span className="text-red-500">*</span>
                </label>
                <select
                  id="customer_id"
                  name="customer_id"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                >
                  <option value="">— اختار —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contract_number" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">رقم العقد</label>
                  <input
                    id="contract_number"
                    name="contract_number"
                    type="text"
                    placeholder="C-2026-001"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="service_type" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">نوع الخدمة</label>
                  <input
                    id="service_type"
                    name="service_type"
                    type="text"
                    placeholder="صيانة تكييف"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start_date" className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
                    تاريخ البدء <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="start_date"
                    name="start_date"
                    type="date"
                    required
                    defaultValue={today}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="end_date" className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
                    تاريخ الانتهاء <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="end_date"
                    name="end_date"
                    type="date"
                    required
                    defaultValue={oneYearLaterIso}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contract_value" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    قيمة العقد (جنيه)
                  </label>
                  <input
                    id="contract_value"
                    name="contract_value"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="50000"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="payment_terms" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    شروط الدفع
                  </label>
                  <select
                    id="payment_terms"
                    name="payment_terms"
                    defaultValue=""
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                  >
                    <option value="">— اختار —</option>
                    <option value="monthly">شهري</option>
                    <option value="quarterly">ربع سنوي</option>
                    <option value="annual">سنوي</option>
                    <option value="one_time">دفعة واحدة</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">الحالة</label>
                  <select
                    id="status"
                    name="status"
                    defaultValue="active"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                  >
                    <option value="active">نشط</option>
                    <option value="expired">منتهي</option>
                    <option value="renewed">متجدد</option>
                    <option value="cancelled">ملغي</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="assigned_to" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">المسؤول</label>
                  <select
                    id="assigned_to"
                    name="assigned_to"
                    defaultValue=""
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                  >
                    <option value="">— غير محدد —</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">وصف الخدمة</label>
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  placeholder="تفاصيل الخدمة، النطاق، الزيارات الشهرية، إلخ"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 resize-none"
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">ملاحظات</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  placeholder="أي ملاحظات داخلية"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo"
                >
                  حفظ العقد
                </button>
                <Link
                  href="/dashboard/contracts"
                  className="px-6 py-3 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo"
                >
                  إلغاء
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
