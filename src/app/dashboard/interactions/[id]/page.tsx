import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { updateInteraction, deleteInteraction } from "../actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

type Interaction = {
  id: string;
  employee_id: string;
  customer_id: string;
  date: string;
  type: "call" | "whatsapp" | "meeting" | "email" | "visit" | "other";
  outcome: "positive" | "neutral" | "negative";
  notes: string | null;
  created_at: string;
};

type Option = { id: string; full_name: string };

export default async function EditInteractionPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Scope the dropdown lookups to the caller's company — the interaction
  // row itself is unguessable-by-id so RLS suffices for that single row.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [interactionRes, employeesRes, customersRes] = await Promise.all([
    supabase.from("interactions").select("*").eq("id", id).single<Interaction>(),
    supabase.from("employees").select("id, full_name").eq("company_id", callerCompanyId).eq("status", "active").order("full_name").returns<Option[]>(),
    supabase.from("customers").select("id, full_name").eq("company_id", callerCompanyId).order("created_at", { ascending: false }).returns<Option[]>(),
  ]);

  if (!interactionRes.data) notFound();
  const interaction = interactionRes.data;
  const employees = employeesRes.data ?? [];
  const customers = customersRes.data ?? [];

  const updateAction = updateInteraction.bind(null, id);
  const deleteAction = async () => {
    "use server";
    await deleteInteraction(id);
    redirect("/dashboard/interactions?deleted=1");
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard/interactions" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع لليستة التفاعلات
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">تعديل تفاعل</h1>
          <p className="text-sm text-slate-500 font-cairo">
            بتاريخ {interaction.date}
          </p>
        </header>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
              ⚠ {decodeURIComponent(error)}
            </div>
          )}

          <form action={updateAction} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">الموظف *</label>
              <select name="employee_id" required defaultValue={interaction.employee_id} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo">
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">العميل *</label>
              <select name="customer_id" required defaultValue={interaction.customer_id} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo">
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">التاريخ</label>
              <input type="date" name="date" defaultValue={interaction.date} max={today} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">نوع التفاعل *</label>
              <select name="type" required defaultValue={interaction.type} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo">
                <option value="call">📞 مكالمة</option>
                <option value="whatsapp">💬 واتساب</option>
                <option value="meeting">🤝 اجتماع</option>
                <option value="email">✉️ إيميل</option>
                <option value="visit">🚶 زيارة</option>
                <option value="other">📋 أخرى</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">النتيجة *</label>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-emerald-200 bg-emerald-50 cursor-pointer hover:border-emerald-400 transition has-[input:checked]:border-emerald-500 has-[input:checked]:bg-emerald-100">
                  <input type="radio" name="outcome" value="positive" required defaultChecked={interaction.outcome === "positive"} className="accent-emerald-500" />
                  <span className="text-sm font-bold text-emerald-700 font-cairo">✓ إيجابية</span>
                </label>
                <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 cursor-pointer hover:border-amber-400 transition has-[input:checked]:border-amber-500 has-[input:checked]:bg-amber-100">
                  <input type="radio" name="outcome" value="neutral" defaultChecked={interaction.outcome === "neutral"} className="accent-amber-500" />
                  <span className="text-sm font-bold text-amber-700 font-cairo">◐ متابعة</span>
                </label>
                <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-red-200 bg-red-50 cursor-pointer hover:border-red-400 transition has-[input:checked]:border-red-500 has-[input:checked]:bg-red-100">
                  <input type="radio" name="outcome" value="negative" defaultChecked={interaction.outcome === "negative"} className="accent-red-500" />
                  <span className="text-sm font-bold text-red-700 font-cairo">✗ سلبية</span>
                </label>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">ملاحظات</label>
              <textarea name="notes" rows={3} defaultValue={interaction.notes ?? ""} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 resize-none" />
            </div>
            <div className="md:col-span-2 flex gap-3 pt-2">
              <button type="submit" className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo">
                حفظ التعديلات
              </button>
              <Link href="/dashboard/interactions" className="px-6 py-3 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo">
                إلغاء
              </Link>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-red-100">
            <form action={deleteAction}>
              <ConfirmSubmitButton
                label="🗑 حذف التفاعل نهائيًا"
                message="هتمسح التفاعل ده. مفيش رجوع."
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
