import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { updateCustomer, deleteCustomer } from "../actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

type Customer = {
  id: string;
  full_name: string;
  contact_name: string | null;
  type: "individual" | "company";
  phone: string | null;
  email: string | null;
  status: "lead" | "active" | "won" | "lost";
  assigned_to: string | null;
  estimated_value: number | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  // Shipping-industry fields (mig 069) — nullable for non-shipping users
  fleet_size: number | null;
  shipments_per_month: number | null;
  current_tms: string | null;
  decision_maker: string | null;
  decision_maker_role: string | null;
};

type EmployeeOption = { id: string; full_name: string };

export default async function EditCustomerPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Scope the employees dropdown to the caller's company — the customer
  // row itself is fetched by unguessable id so RLS handles it.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [customerRes, employeesRes] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single<Customer>(),
    supabase
      .from("employees")
      .select("id, full_name")
      .eq("company_id", callerCompanyId)
      .eq("status", "active")
      .order("full_name")
      .returns<EmployeeOption[]>(),
  ]);

  if (!customerRes.data) notFound();
  const customer = customerRes.data;
  const employeeList = employeesRes.data ?? [];

  const updateAction = updateCustomer.bind(null, id);
  const deleteAction = async () => {
    "use server";
    await deleteCustomer(id);
    redirect("/dashboard/customers?deleted=1");
  };

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
            تعديل بيانات العميل
          </h1>
          <p className="text-sm text-slate-500">
            {customer.full_name} · تم إضافته في {new Date(customer.created_at).toLocaleDateString("ar-EG")}
          </p>
        </header>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
              ⚠ {decodeURIComponent(error)}
            </div>
          )}

          <form action={updateAction} className="space-y-5">
            <div>
              <label htmlFor="full_name" className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
                اسم العميل <span className="text-red-500">*</span>
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                defaultValue={customer.full_name}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">نوع العميل</label>
                <select
                  id="type"
                  name="type"
                  defaultValue={customer.type}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                >
                  <option value="individual">👤 فرد</option>
                  <option value="company">🏢 شركة</option>
                </select>
              </div>
              <div>
                <label htmlFor="contact_name" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">جهة الاتصال</label>
                <input
                  id="contact_name"
                  name="contact_name"
                  type="text"
                  defaultValue={customer.contact_name ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">الموبايل</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  dir="ltr"
                  defaultValue={customer.phone ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-right"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">الإيميل</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={customer.email ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">الحالة</label>
                <select
                  id="status"
                  name="status"
                  defaultValue={customer.status}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                >
                  <option value="lead">Lead — لسه مهتم</option>
                  <option value="active">نشط — بنفاوض</option>
                  <option value="won">تم البيع</option>
                  <option value="lost">ضاع</option>
                </select>
              </div>
              <div>
                <label htmlFor="source" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">مصدر العميل</label>
                <select
                  id="source"
                  name="source"
                  defaultValue={customer.source ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                >
                  <option value="">— غير محدد —</option>
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
                <label htmlFor="assigned_to" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">مسؤول المتابعة</label>
                <select
                  id="assigned_to"
                  name="assigned_to"
                  defaultValue={customer.assigned_to ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                >
                  <option value="">— غير محدد —</option>
                  {employeeList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="estimated_value" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">قيمة الصفقة (جنيه)</label>
                <input
                  id="estimated_value"
                  name="estimated_value"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={customer.estimated_value ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
            </div>

            {/* Shipping-industry fields — useful for B2B software sales
                to logistics customers (mig 069). All optional; blank
                rows hide visually thanks to defaultValue="". */}
            <div className="bg-gradient-to-br from-cyan-50/50 to-amber-50/30 rounded-2xl border-2 border-cyan-100 p-5">
              <h3 className="text-sm font-bold font-cairo text-slate-800 mb-3 flex items-center gap-2">
                <span>🚚</span>
                <span>معلومات إضافية (لشركات الشحن / Logistics)</span>
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="fleet_size"
                    className="block text-xs font-medium text-slate-700 mb-1 font-cairo"
                  >
                    🚛 حجم الأسطول (عدد السيارات)
                  </label>
                  <input
                    id="fleet_size"
                    name="fleet_size"
                    type="number"
                    min="0"
                    defaultValue={customer.fleet_size ?? ""}
                    placeholder="مثلاً: 50"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="shipments_per_month"
                    className="block text-xs font-medium text-slate-700 mb-1 font-cairo"
                  >
                    📦 شحنات/شهر (متوسط)
                  </label>
                  <input
                    id="shipments_per_month"
                    name="shipments_per_month"
                    type="number"
                    min="0"
                    defaultValue={customer.shipments_per_month ?? ""}
                    placeholder="مثلاً: 2000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="current_tms"
                    className="block text-xs font-medium text-slate-700 mb-1 font-cairo"
                  >
                    🖥 الـ TMS المستخدم حالياً
                  </label>
                  <input
                    id="current_tms"
                    name="current_tms"
                    type="text"
                    defaultValue={customer.current_tms ?? ""}
                    placeholder="مثلاً: Oracle TMS / Excel / Zoho / مفيش"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="decision_maker"
                    className="block text-xs font-medium text-slate-700 mb-1 font-cairo"
                  >
                    👤 صاحب القرار
                  </label>
                  <input
                    id="decision_maker"
                    name="decision_maker"
                    type="text"
                    defaultValue={customer.decision_maker ?? ""}
                    placeholder="مثلاً: أحمد محمد"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
                  />
                </div>
                <div className="md:col-span-2">
                  <label
                    htmlFor="decision_maker_role"
                    className="block text-xs font-medium text-slate-700 mb-1 font-cairo"
                  >
                    💼 منصبه
                  </label>
                  <input
                    id="decision_maker_role"
                    name="decision_maker_role"
                    type="text"
                    defaultValue={customer.decision_maker_role ?? ""}
                    placeholder="مثلاً: COO، مدير العمليات، CEO"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-3 font-cairo">
                💡 هذه الحقول اختيارية — مفيدة بشكل خاص لو بتبيع لشركات
                logistics أو شحن
              </p>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">ملاحظات</label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={customer.notes ?? ""}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo"
              >
                حفظ التعديلات
              </button>
              <Link
                href="/dashboard/customers"
                className="px-6 py-3 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo"
              >
                إلغاء
              </Link>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-red-100">
            <form action={deleteAction}>
              <ConfirmSubmitButton
                label="🗑 حذف العميل نهائيًا"
                message={`هتمسح "${customer.full_name}" وكل التفاعلات والعقود المرتبطة بيه. مفيش رجوع.`}
                confirmLabel="نعم احذف"
                className="text-sm text-red-600 hover:text-red-800 font-cairo cursor-pointer"
              />
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
