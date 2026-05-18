import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { logInteraction, deleteInteraction } from "./actions";

type SearchParams = Promise<{ error?: string; saved?: string }>;

type Option = { id: string; full_name: string };

type Interaction = {
  id: string;
  date: string;
  type: "call" | "whatsapp" | "meeting" | "email" | "visit" | "other";
  outcome: "positive" | "neutral" | "negative";
  notes: string | null;
  employees: { full_name: string } | null;
  customers: { full_name: string } | null;
};

const typeLabel: Record<Interaction["type"], string> = {
  call: "📞 مكالمة",
  whatsapp: "💬 واتساب",
  meeting: "🤝 اجتماع",
  email: "✉️ إيميل",
  visit: "🚶 زيارة",
  other: "📋 أخرى",
};

const outcomeLabel: Record<
  Interaction["outcome"],
  { text: string; classes: string }
> = {
  positive: {
    text: "✓ إيجابية",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  neutral: {
    text: "◐ متابعة",
    classes: "bg-amber-50 text-amber-700 border-amber-200",
  },
  negative: {
    text: "✗ سلبية",
    classes: "bg-red-50 text-red-700 border-red-200",
  },
};

// Force the page to revalidate on every request. Without this, Next.js
// caches the row list + counters between requests, so newly-added rows
// from server actions or import flows take minutes to appear.
export const dynamic = "force-dynamic";

export default async function InteractionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0];

  // Scope to the caller's company — super-admin sessions (mig 038) can
  // otherwise read employees/customers/interactions across every tenant.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [employeesRes, customersRes, interactionsRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name")
      .eq("company_id", callerCompanyId)
      .eq("status", "active")
      .order("full_name")
      .returns<Option[]>(),
    supabase
      .from("customers")
      .select("id, full_name")
      .eq("company_id", callerCompanyId)
      .order("created_at", { ascending: false })
      .returns<Option[]>(),
    supabase
      .from("interactions")
      .select(
        "id, date, type, outcome, notes, employees:employee_id(full_name), customers:customer_id(full_name)",
      )
      .eq("company_id", callerCompanyId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<Interaction[]>(),
  ]);

  const employees = employeesRes.data ?? [];
  const customers = customersRes.data ?? [];
  const interactions = interactionsRes.data ?? [];

  const blocked = employees.length === 0 || customers.length === 0;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold mb-2 font-cairo">
            ✦ Bridge
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            تفاعلات الموظفين مع العملاء
          </h1>
          <p className="text-sm text-slate-500">
            كل مكالمة، كل شات، كل اجتماع — سجّله هنا، والـ Bridge هيوريك مين شاطر فعلًا.
          </p>
        </header>

        {/* Success/Error */}
        {params.saved && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-cairo">
            ✓ تم تسجيل التفاعل
          </div>
        )}
        {params.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(params.error)}
          </div>
        )}

        {blocked ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">⚠</div>
            <h2 className="text-lg font-bold font-cairo mb-2 text-amber-800">
              قبل ما تسجّل تفاعل، لازم يكون عندك:
            </h2>
            <p className="text-sm text-amber-700 mb-4 font-cairo">
              {employees.length === 0 && "✗ مفيش موظفين نشطين "}
              {customers.length === 0 && "✗ مفيش عملاء "}
            </p>
            <div className="flex gap-3 justify-center">
              {employees.length === 0 && (
                <Link
                  href="/dashboard/employees/new"
                  className="px-5 py-2 rounded-lg bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo text-sm"
                >
                  ضيف موظف
                </Link>
              )}
              {customers.length === 0 && (
                <Link
                  href="/dashboard/customers/new"
                  className="px-5 py-2 rounded-lg bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo text-sm"
                >
                  ضيف عميل
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Quick log form */}
            <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 mb-6">
              <h2 className="text-lg font-bold font-cairo text-slate-800 mb-4">
                ✦ سجّل تفاعل جديد
              </h2>

              <form action={logInteraction} className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">
                    الموظف <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="employee_id"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
                  >
                    <option value="">— اختار —</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">
                    العميل <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="customer_id"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
                  >
                    <option value="">— اختار —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">
                    التاريخ
                  </label>
                  <input
                    type="date"
                    name="date"
                    defaultValue={today}
                    max={today}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">
                    نوع التفاعل <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="type"
                    required
                    defaultValue="whatsapp"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
                  >
                    <option value="call">📞 مكالمة</option>
                    <option value="whatsapp">💬 واتساب</option>
                    <option value="meeting">🤝 اجتماع</option>
                    <option value="email">✉️ إيميل</option>
                    <option value="visit">🚶 زيارة</option>
                    <option value="other">📋 أخرى</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">
                    النتيجة <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-emerald-200 bg-emerald-50 cursor-pointer hover:border-emerald-400 transition has-[input:checked]:border-emerald-500 has-[input:checked]:bg-emerald-100">
                      <input type="radio" name="outcome" value="positive" required className="accent-emerald-500" />
                      <span className="text-sm font-bold text-emerald-700 font-cairo">✓ إيجابية</span>
                    </label>
                    <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 cursor-pointer hover:border-amber-400 transition has-[input:checked]:border-amber-500 has-[input:checked]:bg-amber-100">
                      <input type="radio" name="outcome" value="neutral" className="accent-amber-500" />
                      <span className="text-sm font-bold text-amber-700 font-cairo">◐ متابعة</span>
                    </label>
                    <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-red-200 bg-red-50 cursor-pointer hover:border-red-400 transition has-[input:checked]:border-red-500 has-[input:checked]:bg-red-100">
                      <input type="radio" name="outcome" value="negative" className="accent-red-500" />
                      <span className="text-sm font-bold text-red-700 font-cairo">✗ سلبية</span>
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">
                    ملاحظات (اختياري)
                  </label>
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder="مثلًا: اتفقنا على المعاينة الخميس، أو رفض العرض لأن السعر عالي..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 resize-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo"
                  >
                    سجّل التفاعل
                  </button>
                </div>
              </form>
            </div>

            {/* Recent interactions */}
            <h2 className="text-lg font-bold font-cairo text-slate-800 mb-3">
              آخر التفاعلات ({interactions.length})
            </h2>

            {interactions.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-12 text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-slate-500 font-cairo">لسه مفيش تفاعلات مسجّلة</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">التاريخ</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الموظف</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">العميل</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">النوع</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">النتيجة</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الملاحظات</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {interactions.map((i) => {
                      const out = outcomeLabel[i.outcome];
                      return (
                        <tr key={i.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">{i.date}</td>
                          <td className="px-4 py-3 text-sm text-slate-800 font-cairo">{i.employees?.full_name ?? "—"}</td>
                          <td className="px-4 py-3 text-sm text-slate-800 font-cairo">{i.customers?.full_name ?? "—"}</td>
                          <td className="px-4 py-3 text-sm font-cairo whitespace-nowrap">{typeLabel[i.type]}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold border ${out.classes} font-cairo whitespace-nowrap`}>
                              {out.text}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate" title={i.notes ?? ""}>
                            {i.notes ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/dashboard/interactions/${i.id}`}
                              className="text-xs text-brand-cyan-dark hover:text-brand-cyan font-cairo font-bold"
                            >
                              تعديل
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
