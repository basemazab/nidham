import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import { updateSubscription, extendTrial } from "./actions";
import { formatEGP } from "@/lib/format";

type CompanyRow = {
  id: string;
  name: string;
  industry: string | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  company_id: string;
  plan: "trial" | "basic" | "pro" | "enterprise";
  status: "trial" | "active" | "past_due" | "cancelled" | "expired";
  starts_at: string;
  ends_at: string;
  monthly_value: number | null;
  invoiced_until: string | null;
  notes: string | null;
};

const PLAN_LABELS: Record<SubscriptionRow["plan"], string> = {
  trial: "تجريبية",
  basic: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
};

const STATUS_LABELS: Record<
  SubscriptionRow["status"],
  { text: string; classes: string }
> = {
  trial: { text: "تجريبية", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  active: { text: "نشطة", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  past_due: { text: "متأخرة", classes: "bg-red-50 text-red-700 border-red-200" },
  cancelled: { text: "ملغية", classes: "bg-slate-100 text-slate-600 border-slate-200" },
  expired: { text: "منتهية", classes: "bg-red-50 text-red-700 border-red-200" },
};

function daysFromToday(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00").getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Authorization check
  const { data: superAdmin } = await supabase
    .from("super_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!superAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md text-center bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-2xl font-black font-cairo mb-2 text-slate-800">
            Access Denied
          </h1>
          <p className="text-sm text-slate-600 mb-6 font-cairo">
            الصفحة دي للـ Super-Admin بتاع نِظام بس.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo"
          >
            الرجوع للـ Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const [companiesRes, subscriptionsRes] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, industry, created_at")
      .order("created_at", { ascending: false })
      .returns<CompanyRow[]>(),
    supabase
      .from("subscriptions")
      .select("id, company_id, plan, status, starts_at, ends_at, monthly_value, invoiced_until, notes")
      .order("ends_at", { ascending: true })
      .returns<SubscriptionRow[]>(),
  ]);

  const companies = companiesRes.data ?? [];
  const subscriptions = subscriptionsRes.data ?? [];
  const subByCompany = new Map(subscriptions.map((s) => [s.company_id, s]));

  // Build joined rows
  const rows = companies.map((c) => {
    const sub = subByCompany.get(c.id) ?? null;
    return {
      company: c,
      sub,
      daysLeft: sub ? daysFromToday(sub.ends_at) : 0,
    };
  });

  // Stats
  const activeSubs = subscriptions.filter((s) => s.status === "active");
  const trialSubs = subscriptions.filter((s) => s.status === "trial");
  const mrr = activeSubs.reduce((sum, s) => sum + (s.monthly_value ?? 0), 0);
  const expiringSoon = subscriptions.filter(
    (s) => s.status === "active" && daysFromToday(s.ends_at) <= 30 && daysFromToday(s.ends_at) >= 0,
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar — unique for admin (no dashboard sidebar) */}
      <header className="bg-gradient-to-r from-navy-900 to-brand-navy text-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md">
            <span className="text-xl">👑</span>
          </div>
          <div>
            <div className="text-lg font-black font-display">Super Admin</div>
            <div className="text-[10px] tracking-widest text-amber-300 font-semibold">
              NIDHAM SAAS · لوحة إدارة الاشتراكات
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/social"
            className="text-sm text-rose-300 hover:text-white font-bold font-cairo px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 transition"
          >
            📣 Social Growth
          </Link>
          <Link
            href="/admin/trials"
            className="text-sm text-amber-300 hover:text-white font-bold font-cairo px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition"
          >
            🧪 تحليل التجريبيين
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-slate-300 hover:text-white font-cairo"
          >
            ← لوحة شركتك
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-red-300 hover:bg-white/10 transition font-cairo"
            >
              تسجيل الخروج
            </button>
          </form>
        </div>
      </header>

      <main className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* MRR + stats */}
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-6 rounded-2xl shadow-lg">
              <div className="text-xs opacity-80 mb-1 font-cairo">💰 الإيراد الشهري (MRR)</div>
              <div className="text-3xl font-black font-display">{formatEGP(mrr)}</div>
              <div className="text-xs opacity-80 mt-1 font-cairo">
                = {formatEGP(mrr * 12)} سنويًا
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-500 mb-1 font-cairo">إجمالي الشركات</div>
              <div className="text-3xl font-black text-slate-800 font-display">{companies.length}</div>
            </div>
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200">
              <div className="text-xs text-emerald-700 mb-1 font-cairo">مشتركين فعليين</div>
              <div className="text-3xl font-black text-emerald-700 font-display">{activeSubs.length}</div>
            </div>
            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200">
              <div className="text-xs text-amber-700 mb-1 font-cairo">على فترة تجريبية</div>
              <div className="text-3xl font-black text-amber-700 font-display">{trialSubs.length}</div>
            </div>
          </div>

          {/* Renewals coming up */}
          {expiringSoon.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
              <h2 className="text-base font-bold font-cairo text-amber-800 mb-2">
                ⏰ {expiringSoon.length} اشتراك محتاج تجديد خلال 30 يوم
              </h2>
              <p className="text-xs text-amber-700 font-cairo">
                كلّم العملاء دول قبل ما اشتراكهم ينتهي.
              </p>
            </div>
          )}

          {/* Table */}
          <h2 className="text-xl font-black font-cairo text-slate-800 mb-3">
            كل الشركات ({rows.length})
          </h2>

          {rows.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
              <p className="text-slate-500 font-cairo">مفيش شركات لسه</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الشركة</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">القطاع</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الخطة</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الحالة</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">القيمة الشهرية</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">تنتهي في</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">المتبقي</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ company, sub, daysLeft }) => {
                    const statusBadge = sub ? STATUS_LABELS[sub.status] : null;
                    return (
                      <tr key={company.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800 font-cairo">{company.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{company.id.slice(0, 8)}…</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 font-cairo">{company.industry ?? "—"}</td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-700 font-cairo">
                          {sub ? PLAN_LABELS[sub.plan] : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {statusBadge && (
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${statusBadge.classes} font-cairo`}>
                              {statusBadge.text}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-700 font-cairo">
                          {sub ? formatEGP(sub.monthly_value) : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                          {sub?.ends_at ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm font-cairo">
                          {sub ? (
                            <span className={
                              daysLeft < 0 ? "text-red-700 font-bold" :
                              daysLeft <= 7 ? "text-red-600 font-bold" :
                              daysLeft <= 30 ? "text-amber-600 font-bold" :
                              "text-slate-500"
                            }>
                              {daysLeft < 0 ? `منتهية` : `${daysLeft} يوم`}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {sub && (
                            <Link
                              href={`/admin/subscriptions/${sub.id}`}
                              className="text-xs text-brand-cyan-dark hover:text-brand-cyan font-cairo font-bold"
                            >
                              إدارة
                            </Link>
                          )}
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

      {/* Hidden form action holder — keeps the action imports tree-shake-safe */}
      <div className="hidden">
        <form action={updateSubscription.bind(null, "")}><input name="plan"/></form>
        <form action={extendTrial.bind(null, "")}><input name="days"/></form>
      </div>
    </div>
  );
}
