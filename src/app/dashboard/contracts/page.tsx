import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { formatEGP } from "@/lib/format";

type Contract = {
  id: string;
  contract_number: string | null;
  service_type: string | null;
  start_date: string;
  end_date: string;
  contract_value: number | null;
  payment_terms: string | null;
  status: "active" | "expired" | "renewed" | "cancelled";
  customers: { full_name: string } | null;
  employees: { full_name: string } | null;
};

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

// Force the page to revalidate on every request. Without this, Next.js
// caches the row list + counters between requests, so newly-added rows
// from server actions or import flows take minutes to appear.
export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Scope to the caller's company — super-admin sessions can read
  // contracts across every tenant by virtue of mig 038-style policies.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const { data: contracts } = await supabase
    .from("contracts")
    .select(
      "id, contract_number, service_type, start_date, end_date, contract_value, payment_terms, status, customers:customer_id(full_name), employees:assigned_to(full_name)",
    )
    .eq("company_id", callerCompanyId)
    .order("end_date", { ascending: true })
    .returns<Contract[]>();

  const list = contracts ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Compute renewal urgency per contract
  const enriched = list.map((c) => {
    const endDate = new Date(c.end_date + "T00:00:00");
    const daysLeft = daysBetween(today, endDate);
    let urgency: "expired" | "urgent" | "soon" | "ok" = "ok";
    if (daysLeft < 0) urgency = "expired";
    else if (daysLeft <= 7) urgency = "urgent";
    else if (daysLeft <= 30) urgency = "soon";
    return { ...c, daysLeft, urgency };
  });

  const activeContracts = enriched.filter((c) => c.status === "active");
  const expiringSoon = activeContracts.filter(
    (c) => c.urgency === "urgent" || c.urgency === "soon",
  );
  const totalActiveValue = activeContracts.reduce(
    (s, c) => s + (c.contract_value ?? 0),
    0,
  );

  const statusLabel: Record<
    Contract["status"],
    { text: string; classes: string }
  > = {
    active: { text: "نشط", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    expired: { text: "منتهي", classes: "bg-red-50 text-red-700 border-red-200" },
    renewed: { text: "متجدد", classes: "bg-blue-50 text-blue-700 border-blue-200" },
    cancelled: { text: "ملغي", classes: "bg-slate-100 text-slate-600 border-slate-200" },
  };

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
              العقود والصيانة
            </h1>
            <p className="text-sm text-slate-500">
              {list.length === 0
                ? "لسه مفيش عقود — ابدأ ضيف أول عقد"
                : `${list.length} عقد · ${activeContracts.length} نشط`}
            </p>
          </div>

          <Link
            href="/dashboard/contracts/new"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all font-cairo"
          >
            <span className="text-lg leading-none">+</span>
            <span>عقد جديد</span>
          </Link>
        </header>

        {/* Stats + Renewal Alert */}
        {list.length > 0 && (
          <>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200">
                <div className="text-xs text-emerald-700 mb-1 font-cairo">عقود نشطة</div>
                <div className="text-3xl font-black text-emerald-700">{activeContracts.length}</div>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-5 rounded-xl border border-amber-200">
                <div className="text-xs text-amber-700 mb-1 font-cairo">قيمة العقود النشطة</div>
                <div className="text-2xl font-black text-amber-700">{formatEGP(totalActiveValue)}</div>
              </div>
              <div className={`p-5 rounded-xl border ${expiringSoon.length > 0 ? "bg-red-50 border-red-300" : "bg-slate-50 border-slate-200"}`}>
                <div className={`text-xs mb-1 font-cairo ${expiringSoon.length > 0 ? "text-red-700" : "text-slate-500"}`}>
                  محتاج تجديد خلال 30 يوم
                </div>
                <div className={`text-3xl font-black ${expiringSoon.length > 0 ? "text-red-700" : "text-slate-500"}`}>
                  {expiringSoon.length}
                </div>
              </div>
            </div>

            {/* Renewal alert banner */}
            {expiringSoon.length > 0 && (
              <div className="bg-gradient-to-r from-red-50 to-amber-50 border-2 border-red-300 rounded-2xl p-5 mb-6">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">⚠️</div>
                  <div className="flex-1">
                    <h2 className="text-lg font-black font-cairo text-red-800 mb-1">
                      انتباه: عقود محتاجة تجديد قريب
                    </h2>
                    <p className="text-xs text-red-700 mb-3 font-cairo">
                      كلّم العملاء دول دلوقتي. كل عقد يضيع = خسارة سنوية.
                    </p>
                    <div className="space-y-2">
                      {expiringSoon.map((c) => (
                        <Link
                          key={c.id}
                          href={`/dashboard/contracts/${c.id}`}
                          className="block bg-white p-3 rounded-lg border border-red-200 hover:border-red-400 transition"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-800 font-cairo">
                                {c.customers?.full_name ?? "—"}
                              </span>
                              <span className="text-xs text-slate-500 mx-2">·</span>
                              <span className="text-xs text-slate-600 font-cairo">{c.service_type ?? "—"}</span>
                            </div>
                            <div className="text-sm">
                              <span className={`font-bold font-mono ${c.urgency === "urgent" ? "text-red-600" : "text-amber-600"}`}>
                                {c.daysLeft <= 0 ? "اليوم!" : `بعد ${c.daysLeft} يوم`}
                              </span>
                              <span className="text-xs text-slate-400 mx-2">·</span>
                              <span className="text-xs text-slate-500">{formatEGP(c.contract_value)}</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {list.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">
              مفيش عقود بعد
            </h2>
            <p className="text-slate-500 mb-6">
              لو شركتك بتعمل عقود صيانة/خدمة، ضيفهم هنا — هنبعتلك تنبيهات قبل التجديد
            </p>
            <Link
              href="/dashboard/contracts/new"
              className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo"
            >
              ضيف أول عقد
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">رقم العقد</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">العميل</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الخدمة</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">من → إلى</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">القيمة</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الحالة</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">المتبقي</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enriched.map((c) => {
                  const status = statusLabel[c.status];
                  const daysClass =
                    c.urgency === "expired" ? "text-red-700 font-black"
                    : c.urgency === "urgent" ? "text-red-600 font-bold"
                    : c.urgency === "soon" ? "text-amber-600 font-bold"
                    : "text-slate-500";
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/contracts/${c.id}`} className="text-sm text-brand-cyan-dark hover:text-brand-cyan font-cairo font-bold font-mono">
                          {c.contract_number ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800 font-cairo">{c.customers?.full_name ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 font-cairo">{c.service_type ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                        {c.start_date} ← {c.end_date}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-700 font-cairo">
                        {formatEGP(c.contract_value)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${status.classes} font-cairo`}>
                          {status.text}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm font-cairo ${daysClass}`}>
                        {c.urgency === "expired" ? `منتهي من ${Math.abs(c.daysLeft)} يوم` : `${c.daysLeft} يوم`}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/contracts/${c.id}`}
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
