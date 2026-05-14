// ============================================================================
// /admin/trials — Trial Engagement Analytics
// ============================================================================
//
// As the founder of Nidham SaaS, Basem needs to see who is actively
// using the trial vs who signed up and abandoned. This page surfaces
// engagement signals per trial tenant so he can:
//
//   - Reach out to "warm" trials with onboarding help before they fade
//   - Identify "cold" trials so he doesn't waste effort following up
//   - Celebrate "active" trials → they're his next paying customers
//
// Engagement is scored from data the tenant actually created:
//   employees + attendance + customers + interactions + payroll periods
//
// Tiers:
//   🟢 active   — created real records (>= 10 across categories)
//   🟡 warm     — tried a few things (1-9 records)
//   🔴 cold     — signed up, never returned (0 records)
//
// Auth: gated on super_admins table. Uses RLS bypass so we see all
// tenants. Mirrors the gate on /admin/page.tsx.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../../login/actions";

type SubRow = {
  id: string;
  company_id: string;
  plan: "trial" | "basic" | "pro" | "enterprise";
  status: "trial" | "active" | "past_due" | "cancelled" | "expired";
  starts_at: string;
  ends_at: string;
};

type CompanyRow = {
  id: string;
  name: string;
  industry: string | null;
  created_at: string;
  created_by: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  company_id: string;
};

type EngagementCounts = {
  employees: number;
  attendance: number;
  customers: number;
  interactions: number;
  payroll_periods: number;
  ai_messages: number;
};

type EngagementTier = "active" | "warm" | "cold";

type TrialRow = {
  company: CompanyRow;
  sub: SubRow;
  ownerName: string | null;
  ownerEmail: string | null;
  counts: EngagementCounts;
  total: number;
  tier: EngagementTier;
  daysSinceSignup: number;
  daysUntilExpiry: number;
};

function pickTier(total: number): EngagementTier {
  if (total >= 10) return "active";
  if (total >= 1) return "warm";
  return "cold";
}

function daysFromToday(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00").getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today.getTime()) / (1000 * 60 * 60 * 24));
}

function daysSince(iso: string): number {
  return Math.max(0, -daysFromToday(iso.slice(0, 10)));
}

export default async function TrialsAnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Gate: super_admin only
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

  // Step 1: load all trial subs + companies
  const [subsRes, companiesRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, company_id, plan, status, starts_at, ends_at")
      .eq("plan", "trial")
      .returns<SubRow[]>(),
    supabase
      .from("companies")
      .select("id, name, industry, created_at, created_by")
      .returns<CompanyRow[]>(),
  ]);

  const subs = subsRes.data ?? [];
  const companies = companiesRes.data ?? [];
  const companyById = new Map(companies.map((c) => [c.id, c]));

  // Owner profile per company (for the contact name in the table)
  const ownerUserIds = companies
    .map((c) => c.created_by)
    .filter((x): x is string => !!x);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, company_id")
    .in("id", ownerUserIds.length > 0 ? ownerUserIds : ["00000000-0000-0000-0000-000000000000"])
    .returns<ProfileRow[]>();
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Step 2: for each trial company, count records (parallel batches).
  // Using `head: true + count: exact` keeps payload tiny — we don't fetch
  // any rows, just the count. RLS bypass for super_admin returns the
  // right numbers per tenant.
  const trialCompanyIds = subs.map((s) => s.company_id);

  const countsByCompany = new Map<string, EngagementCounts>();
  for (const cid of trialCompanyIds) {
    countsByCompany.set(cid, {
      employees: 0,
      attendance: 0,
      customers: 0,
      interactions: 0,
      payroll_periods: 0,
      ai_messages: 0,
    });
  }

  if (trialCompanyIds.length > 0) {
    const fetches = trialCompanyIds.map(async (cid) => {
      const [emp, att, cust, intr, pay] = await Promise.all([
        supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid),
        supabase
          .from("attendance")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid),
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid),
        supabase
          .from("interactions")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid),
        supabase
          .from("payroll_periods")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid),
      ]);
      countsByCompany.set(cid, {
        employees: emp.count ?? 0,
        attendance: att.count ?? 0,
        customers: cust.count ?? 0,
        interactions: intr.count ?? 0,
        payroll_periods: pay.count ?? 0,
        ai_messages: 0,
      });
    });
    await Promise.all(fetches);
  }

  // Step 3: build the rich row objects
  const rows: TrialRow[] = [];
  for (const sub of subs) {
    const company = companyById.get(sub.company_id);
    if (!company) continue;
    const counts = countsByCompany.get(sub.company_id) ?? {
      employees: 0,
      attendance: 0,
      customers: 0,
      interactions: 0,
      payroll_periods: 0,
      ai_messages: 0,
    };
    const total =
      counts.employees +
      counts.attendance +
      counts.customers +
      counts.interactions +
      counts.payroll_periods;
    const tier = pickTier(total);
    const ownerProfile = company.created_by
      ? profileById.get(company.created_by)
      : null;
    rows.push({
      company,
      sub,
      ownerName: ownerProfile?.full_name ?? null,
      ownerEmail: null, // requires auth.admin API; out of scope for V1
      counts,
      total,
      tier,
      daysSinceSignup: daysSince(company.created_at),
      daysUntilExpiry: daysFromToday(sub.ends_at),
    });
  }

  // Sort: active first (highest total), then warm (most recent), then cold
  rows.sort((a, b) => {
    const order: Record<EngagementTier, number> = {
      active: 0,
      warm: 1,
      cold: 2,
    };
    const t = order[a.tier] - order[b.tier];
    if (t !== 0) return t;
    return b.total - a.total;
  });

  const stats = {
    total: rows.length,
    active: rows.filter((r) => r.tier === "active").length,
    warm: rows.filter((r) => r.tier === "warm").length,
    cold: rows.filter((r) => r.tier === "cold").length,
    expiringSoon: rows.filter(
      (r) => r.daysUntilExpiry >= 0 && r.daysUntilExpiry <= 3,
    ).length,
    activeRate: 0,
  };
  stats.activeRate =
    stats.total === 0
      ? 0
      : Math.round((stats.active / stats.total) * 100);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-gradient-to-r from-navy-900 to-brand-navy text-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md">
            <span className="text-xl">👑</span>
          </div>
          <div>
            <div className="text-lg font-black font-display">Super Admin</div>
            <div className="text-[10px] tracking-widest text-amber-300 font-semibold">
              NIDHAM SAAS · تحليل المستخدمين التجريبيين
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-sm text-slate-300 hover:text-white font-cairo"
          >
            ← لوحة الاشتراكات
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-slate-300 hover:text-white font-cairo"
          >
            لوحة شركتك
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
          <h1 className="text-2xl font-black font-cairo text-slate-800 mb-1">
            🧪 المستخدمين التجريبيين
          </h1>
          <p className="text-sm text-slate-500 font-cairo mb-6">
            مين بيجرب النظام بجد، ومين سجل وما رجعش — اعرف هتركز جهودك مع
            مين.
          </p>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <KpiCard
              icon="🧪"
              label="إجمالي تجريبي"
              value={stats.total}
              color="slate"
            />
            <KpiCard
              icon="🟢"
              label="نشطين"
              value={stats.active}
              color="emerald"
            />
            <KpiCard
              icon="🟡"
              label="جربوا شويه"
              value={stats.warm}
              color="amber"
            />
            <KpiCard
              icon="🔴"
              label="ما رجعوش"
              value={stats.cold}
              color="rose"
            />
            <KpiCard
              icon="📊"
              label="نسبة التحوّل المحتملة"
              value={`${stats.activeRate}%`}
              color="cyan"
              subtext="من النشطين"
            />
          </div>

          {stats.expiringSoon > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-6">
              <h2 className="text-sm font-bold font-cairo text-rose-800 mb-1">
                ⚠ {stats.expiringSoon} تجريبي بينتهي خلال ٣ أيام
              </h2>
              <p className="text-xs text-rose-700 font-cairo">
                كلّمهم النهارده قبل ما يضيعوا — خصوصاً اللي في تصنيف
                <strong className="mx-1">نشطين</strong>.
              </p>
            </div>
          )}

          {/* Empty state */}
          {rows.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
              <div className="text-5xl mb-3">🧪</div>
              <p className="text-slate-500 font-cairo">
                مفيش مستخدمين تجريبيين دلوقتي
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <Th>الشركة</Th>
                    <Th>صاحبها</Th>
                    <Th>المرحلة</Th>
                    <Th>تفاعل</Th>
                    <Th>سجّل من</Th>
                    <Th>ينتهي بعد</Th>
                    <Th>تفاصيل</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <TrialRowItem key={r.sub.id} row={r} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------------
// TrialRowItem
// ----------------------------------------------------------------------------
function TrialRowItem({ row }: { row: TrialRow }) {
  const { company, sub, counts, total, tier, daysSinceSignup, daysUntilExpiry } =
    row;

  const tierBadge = {
    active: {
      label: "🟢 نشط",
      classes: "bg-emerald-100 text-emerald-800 border-emerald-300",
    },
    warm: {
      label: "🟡 جرب شويه",
      classes: "bg-amber-100 text-amber-800 border-amber-300",
    },
    cold: {
      label: "🔴 ما رجعش",
      classes: "bg-rose-100 text-rose-800 border-rose-300",
    },
  }[tier];

  return (
    <tr className="hover:bg-slate-50 transition">
      <td className="px-4 py-3">
        <div className="font-bold text-slate-800 font-cairo">{company.name}</div>
        <div className="text-[10px] text-slate-400 font-mono">
          {company.id.slice(0, 8)}…
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700 font-cairo">
        {row.ownerName ?? "—"}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${tierBadge.classes} font-cairo`}
        >
          {tierBadge.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-bold text-slate-700 font-cairo">
            {total} سجل
          </div>
          <div className="text-[10px] text-slate-500 font-cairo flex flex-wrap gap-x-2">
            {counts.employees > 0 && <span>👥{counts.employees}</span>}
            {counts.attendance > 0 && <span>⏰{counts.attendance}</span>}
            {counts.customers > 0 && <span>💼{counts.customers}</span>}
            {counts.interactions > 0 && <span>💬{counts.interactions}</span>}
            {counts.payroll_periods > 0 && (
              <span>💰{counts.payroll_periods}</span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 font-cairo">
        {daysSinceSignup === 0
          ? "النهارده"
          : daysSinceSignup === 1
            ? "إمبارح"
            : `${daysSinceSignup} يوم`}
      </td>
      <td className="px-4 py-3 text-sm font-cairo">
        <span
          className={
            daysUntilExpiry < 0
              ? "text-rose-700 font-bold"
              : daysUntilExpiry <= 3
                ? "text-rose-600 font-bold"
                : daysUntilExpiry <= 7
                  ? "text-amber-600 font-bold"
                  : "text-slate-500"
          }
        >
          {daysUntilExpiry < 0
            ? "منتهية"
            : daysUntilExpiry === 0
              ? "النهارده"
              : `${daysUntilExpiry} يوم`}
        </span>
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/admin/subscriptions/${sub.id}`}
          className="text-xs text-brand-cyan-dark hover:text-brand-cyan font-cairo font-bold"
        >
          إدارة →
        </Link>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------------
// KpiCard
// ----------------------------------------------------------------------------
function KpiCard({
  icon,
  label,
  value,
  color,
  subtext,
}: {
  icon: string;
  label: string;
  value: number | string;
  color: "emerald" | "amber" | "rose" | "cyan" | "slate";
  subtext?: string;
}) {
  const bg: Record<typeof color, string> = {
    emerald: "from-emerald-50 to-white border-emerald-200",
    amber: "from-amber-50 to-white border-amber-200",
    rose: "from-rose-50 to-white border-rose-200",
    cyan: "from-cyan-50 to-white border-cyan-200",
    slate: "from-slate-50 to-white border-slate-200",
  };
  const txt: Record<typeof color, string> = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
    cyan: "text-cyan-700",
    slate: "text-slate-700",
  };
  return (
    <div
      className={`p-4 rounded-2xl bg-gradient-to-br ${bg[color]} border shadow-sm`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
        <span className={`text-[10px] font-bold uppercase font-cairo ${txt[color]}`}>
          {label}
        </span>
      </div>
      <div className="text-3xl font-black text-slate-800 font-display">
        {value}
      </div>
      {subtext && (
        <div className="text-[10px] text-slate-500 font-cairo mt-1">
          {subtext}
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
      {children}
    </th>
  );
}
