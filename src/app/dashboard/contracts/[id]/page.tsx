import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { updateContract, deleteContract } from "../actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

type Contract = {
  id: string;
  customer_id: string;
  contract_number: string | null;
  service_type: string | null;
  description: string | null;
  start_date: string;
  end_date: string;
  contract_value: number | null;
  payment_terms: string | null;
  status: "active" | "expired" | "renewed" | "cancelled";
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
};

type Option = { id: string; full_name: string };

export default async function EditContractPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Scope the dropdown lookups to the caller's company (the contract
  // itself is fetched by id which is unguessable, so RLS-only scoping
  // is fine for that single row).
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [contractRes, customersRes, employeesRes] = await Promise.all([
    supabase.from("contracts").select("*").eq("id", id).single<Contract>(),
    supabase.from("customers").select("id, full_name").eq("company_id", callerCompanyId).order("full_name").returns<Option[]>(),
    supabase.from("employees").select("id, full_name").eq("company_id", callerCompanyId).eq("status", "active").order("full_name").returns<Option[]>(),
  ]);

  if (!contractRes.data) notFound();
  const contract = contractRes.data;
  const customers = customersRes.data ?? [];
  const employees = employeesRes.data ?? [];

  const updateAction = updateContract.bind(null, id);
  const deleteAction = async () => {
    "use server";
    await deleteContract(id);
    redirect("/dashboard/contracts?deleted=1");
  };

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard/contracts" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع لليستة العقود
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            تعديل عقد
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            {contract.contract_number ?? "بدون رقم"} · تم إنشاؤه في {new Date(contract.created_at).toLocaleDateString("ar-EG")}
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
              <label htmlFor="customer_id" className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
                العميل <span className="text-red-500">*</span>
              </label>
              <select
                id="customer_id"
                name="customer_id"
                required
                defaultValue={contract.customer_id}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
              >
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
                  defaultValue={contract.contract_number ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-mono"
                />
              </div>
              <div>
                <label htmlFor="service_type" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">نوع الخدمة</label>
                <input
                  id="service_type"
                  name="service_type"
                  type="text"
                  defaultValue={contract.service_type ?? ""}
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
                  defaultValue={contract.start_date}
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
                  defaultValue={contract.end_date}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contract_value" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">قيمة العقد (جنيه)</label>
                <input
                  id="contract_value"
                  name="contract_value"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={contract.contract_value ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="payment_terms" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">شروط الدفع</label>
                <select
                  id="payment_terms"
                  name="payment_terms"
                  defaultValue={contract.payment_terms ?? ""}
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
                  defaultValue={contract.status}
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
                  defaultValue={contract.assigned_to ?? ""}
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
                defaultValue={contract.description ?? ""}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 resize-none"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">ملاحظات</label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                defaultValue={contract.notes ?? ""}
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
                href="/dashboard/contracts"
                className="px-6 py-3 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo"
              >
                إلغاء
              </Link>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-red-100">
            <form action={deleteAction}>
              <ConfirmSubmitButton
                label="🗑 حذف العقد نهائيًا"
                message="هتمسح العقد ده. مفيش رجوع."
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
