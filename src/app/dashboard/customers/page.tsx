import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { formatEGP } from "@/lib/format";

type Customer = {
  id: string;
  full_name: string;
  contact_name: string | null;
  type: "individual" | "company";
  phone: string | null;
  status: "lead" | "active" | "won" | "lost";
  estimated_value: number | null;
  assigned_to: string | null;
  employees: { full_name: string } | null;
};

const statusLabel: Record<
  Customer["status"],
  { text: string; classes: string }
> = {
  lead: {
    text: "Lead",
    classes: "bg-blue-50 text-blue-700 border-blue-200",
  },
  active: {
    text: "نشط",
    classes: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  won: {
    text: "تم البيع",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  lost: {
    text: "ضاع",
    classes: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

export default async function CustomersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Scope to the caller's company — super-admin sessions (mig 038) can
  // SELECT customers across every tenant otherwise.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const { data: customers } = await supabase
    .from("customers")
    .select(
      "id, full_name, contact_name, type, phone, status, estimated_value, assigned_to, employees:assigned_to(full_name)",
    )
    .eq("company_id", callerCompanyId)
    .order("created_at", { ascending: false })
    .returns<Customer[]>();

  const list = customers ?? [];

  // Quick stats
  const byStatus = {
    lead: list.filter((c) => c.status === "lead").length,
    active: list.filter((c) => c.status === "active").length,
    won: list.filter((c) => c.status === "won").length,
    lost: list.filter((c) => c.status === "lost").length,
  };
  const pipelineValue = list
    .filter((c) => c.status === "lead" || c.status === "active")
    .reduce((s, c) => s + (c.estimated_value ?? 0), 0);

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              العملاء
            </h1>
            <p className="text-sm text-slate-500">
              {list.length === 0
                ? "لسه مفيش عملاء — ابدأ ضيف أول واحد"
                : `${list.length} ${list.length === 1 ? "عميل" : "عملاء"}`}
            </p>
          </div>

          <Link
            href="/dashboard/customers/new"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all font-cairo"
          >
            <span className="text-lg leading-none">+</span>
            <span>إضافة عميل</span>
          </Link>
        </header>

        {/* Pipeline stats */}
        {list.length > 0 && (
          <div className="grid md:grid-cols-5 gap-3 mb-6">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
              <div className="text-xs text-blue-700 mb-1 font-cairo">Leads</div>
              <div className="text-2xl font-black text-blue-700">{byStatus.lead}</div>
            </div>
            <div className="bg-cyan-50 border border-cyan-200 p-4 rounded-xl">
              <div className="text-xs text-cyan-700 mb-1 font-cairo">نشطين</div>
              <div className="text-2xl font-black text-cyan-700">{byStatus.active}</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
              <div className="text-xs text-emerald-700 mb-1 font-cairo">تم البيع</div>
              <div className="text-2xl font-black text-emerald-700">{byStatus.won}</div>
            </div>
            <div className="bg-slate-100 border border-slate-200 p-4 rounded-xl">
              <div className="text-xs text-slate-600 mb-1 font-cairo">ضاع</div>
              <div className="text-2xl font-black text-slate-600">{byStatus.lost}</div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 p-4 rounded-xl">
              <div className="text-xs text-amber-700 mb-1 font-cairo">قيمة الـ Pipeline</div>
              <div className="text-xl font-black text-amber-700">{formatEGP(pipelineValue)}</div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {list.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">💼</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">
              مفيش عملاء بعد
            </h2>
            <p className="text-slate-500 mb-6">
              ضيف أول عميل، وبعدها هنبدأ نربطه بموظفينك في Bridge
            </p>
            <Link
              href="/dashboard/customers/new"
              className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo"
            >
              ضيف أول عميل
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">العميل</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الموبايل</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الحالة</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">المسؤول</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">القيمة</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((customer) => {
                  const status = statusLabel[customer.status];
                  const typeIcon = customer.type === "company" ? "🏢" : "👤";
                  return (
                    <tr key={customer.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-4">
                        <Link href={`/dashboard/customers/${customer.id}`} className="flex items-center gap-3 group">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-sm">
                            {typeIcon}
                          </div>
                          <div>
                            <div className="font-medium text-slate-800 font-cairo group-hover:text-brand-cyan-dark transition">{customer.full_name}</div>
                            {customer.contact_name && (
                              <div className="text-xs text-slate-500">{customer.contact_name}</div>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-mono text-sm" dir="ltr">{customer.phone ?? "—"}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${status.classes} font-cairo`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 text-sm font-cairo">
                        {customer.employees?.full_name ?? "—"}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-700 font-cairo text-sm">
                        {formatEGP(customer.estimated_value)}
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/customers/${customer.id}`}
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
      </div>
    </main>
  );
}
