import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateSubscription, extendTrial } from "../../actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

type SubscriptionRow = {
  id: string;
  company_id: string;
  plan: string;
  status: string;
  starts_at: string;
  ends_at: string;
  monthly_value: number | null;
  invoiced_until: string | null;
  notes: string | null;
  companies: { name: string; industry: string | null } | null;
};

export default async function AdminSubscriptionPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: superAdmin } = await supabase
    .from("super_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!superAdmin) redirect("/dashboard");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(
      "id, company_id, plan, status, starts_at, ends_at, monthly_value, invoiced_until, notes, companies(name, industry)",
    )
    .eq("id", id)
    .single<SubscriptionRow>();

  if (!subscription) notFound();

  const updateAction = updateSubscription.bind(null, id);
  const extendAction = extendTrial.bind(null, id);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-navy-900 to-brand-navy text-white px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👑</span>
            <div>
              <Link href="/admin" className="text-sm text-slate-300 hover:text-white font-cairo">
                ← لوحة الإدارة
              </Link>
              <div className="text-lg font-black font-display">إدارة اشتراك</div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            {subscription.companies?.name ?? "—"}
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            {subscription.companies?.industry ?? "بدون قطاع محدد"} · ID: <span className="font-mono">{subscription.company_id.slice(0, 8)}…</span>
          </p>
        </header>

        {/* Quick extend trial */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <h2 className="text-base font-bold font-cairo text-slate-800 mb-3">⏰ تمديد سريع</h2>
          <p className="text-xs text-slate-500 mb-4 font-cairo">
            ضيف أيام للاشتراك الحالي بدون ما تغيّر الخطة
          </p>
          <form action={extendAction} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-600 mb-1 font-cairo">عدد الأيام</label>
              <input
                type="number"
                name="days"
                defaultValue="30"
                min="1"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm font-cairo transition"
            >
              مدّد
            </button>
          </form>
        </section>

        {/* Full subscription editor */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-base font-bold font-cairo text-slate-800 mb-1">📝 تعديل تفصيلي</h2>
          <p className="text-xs text-slate-500 mb-5 font-cairo">
            غيّر الخطة، الحالة، تاريخ الانتهاء، أو القيمة الشهرية
          </p>

          <form action={updateAction} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">الخطة</label>
                <select
                  name="plan"
                  defaultValue={subscription.plan}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
                >
                  <option value="trial">تجريبية</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">الحالة</label>
                <select
                  name="status"
                  defaultValue={subscription.status}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
                >
                  <option value="trial">تجريبية</option>
                  <option value="active">نشطة</option>
                  <option value="past_due">متأخرة الدفع</option>
                  <option value="cancelled">ملغية</option>
                  <option value="expired">منتهية</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">تاريخ الانتهاء</label>
                <input
                  type="date"
                  name="ends_at"
                  defaultValue={subscription.ends_at}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">القيمة الشهرية (ج)</label>
                <input
                  type="number"
                  name="monthly_value"
                  step="0.01"
                  min="0"
                  defaultValue={subscription.monthly_value ?? ""}
                  placeholder="1500"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">ملاحظات إدارية</label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={subscription.notes ?? ""}
                placeholder="مثلًا: دفع 18000 ج بنك ترانسفر يوم 12-05-2026"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold font-cairo transition shadow-md"
              >
                حفظ التعديلات
              </button>
              <Link
                href="/admin"
                className="px-6 py-3 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo"
              >
                إلغاء
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
