import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { formatEGP } from "@/lib/payroll";
import { formatNumber } from "@/lib/format";

type YtdRow = {
  year: number;
  periods_count: number;
  paid_periods_count: number;
  employees_total: number;
  gross_total: number;
  net_total: number;
  deductions_total: number;
  insurance_total: number;
  tax_total: number;
  bonuses_total: number;
};

type SearchParams = Promise<{ freq?: string }>;

type Period = {
  id: string;
  year: number;
  month: number;
  frequency: "monthly" | "weekly" | null;
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "approved" | "paid" | "cancelled";
  working_days: number;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
};

type AggRow = { period_id: string; net_salary: number };

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatCycleLabel(p: Period): string {
  // Prefer the explicit window (migration 026); fall back to the
  // legacy year+month label for any pre-migration row that wasn't
  // backfilled for some reason.
  if (p.start_date && p.end_date) {
    return `${formatIsoDate(p.start_date)} → ${formatIsoDate(p.end_date)}`;
  }
  return `${ARABIC_MONTHS[p.month - 1]} ${p.year}`;
}

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const STATUS_LABELS: Record<Period["status"], { text: string; classes: string }> = {
  draft: { text: "مسودة", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { text: "معتمدة", classes: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  paid: { text: "مدفوعة", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { text: "ملغية", classes: "bg-slate-100 text-slate-600 border-slate-200" },
};

// Force the page to revalidate on every request. Without this, Next.js
// caches the row list + counters between requests, so newly-added rows
// from server actions or import flows take minutes to appear.
export const dynamic = "force-dynamic";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Scope every tenant-scoped query to the caller's company so a
  // super-admin session doesn't pull other tenants' payroll into view.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const sp = await searchParams;
  // Filter periods by frequency from the URL (?freq=weekly|monthly).
  // "all" or missing -> show everything (default).
  const filter: "all" | "monthly" | "weekly" =
    sp.freq === "monthly"
      ? "monthly"
      : sp.freq === "weekly"
        ? "weekly"
        : "all";

  // Fetch periods + per-frequency employee counts + YTD totals in parallel.
  // The employee counts power the buttons in the header. The YTD roll-up
  // sits at the top of the page and tells the owner at a glance how much
  // payroll has cost so far this year + how much went to bonuses, tax,
  // and insurance.
  const [periodsRes, monthlyEmpRes, weeklyEmpRes, ytdRes] = await Promise.all([
    (filter === "all"
      ? supabase
          .from("payroll_periods")
          .select(
            "id, year, month, frequency, start_date, end_date, status, working_days, approved_at, paid_at, created_at",
          )
          .eq("company_id", callerCompanyId)
          .order("start_date", { ascending: false, nullsFirst: false })
          .order("year", { ascending: false })
          .order("month", { ascending: false })
      : supabase
          .from("payroll_periods")
          .select(
            "id, year, month, frequency, start_date, end_date, status, working_days, approved_at, paid_at, created_at",
          )
          .eq("company_id", callerCompanyId)
          .eq("frequency", filter)
          .order("start_date", { ascending: false, nullsFirst: false })
          .order("year", { ascending: false })
          .order("month", { ascending: false })
    ).returns<Period[]>(),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("company_id", callerCompanyId)
      .eq("status", "active")
      .eq("pay_frequency", "monthly"),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("company_id", callerCompanyId)
      .eq("status", "active")
      .eq("pay_frequency", "weekly"),
    supabase.rpc("ytd_payroll_totals"),
  ]);

  const list = periodsRes.data ?? [];
  const monthlyEmpCount = monthlyEmpRes.count ?? 0;
  const weeklyEmpCount = weeklyEmpRes.count ?? 0;
  const ytd =
    (ytdRes.data as YtdRow[] | null)?.[0] ?? null;

  // Aggregate net salary per period
  const { data: entries } = await supabase
    .from("payroll_entries")
    .select("period_id, net_salary")
    .eq("company_id", callerCompanyId)
    .returns<AggRow[]>();

  const totals = new Map<string, { count: number; total: number }>();
  for (const e of entries ?? []) {
    const cur = totals.get(e.period_id) ?? { count: 0, total: 0 };
    cur.count++;
    cur.total += Number(e.net_salary);
    totals.set(e.period_id, cur);
  }

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              الرواتب والمرتبات
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              {list.length === 0
                ? "ابدأ بإنشاء أول فترة مرتبات"
                : `${list.length} فترة مرتبات`}
              {" · "}
              <span className="text-brand-cyan-dark font-bold">
                مصري — قانون 12/2003 + 148/2019
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/dashboard/payroll/advances"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold text-sm hover:bg-emerald-100 transition font-cairo"
            >
              <span>💵</span>
              <span>صرف سلف (الأربعاء)</span>
            </Link>
            <Link
              href="/dashboard/payroll/settings"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition font-cairo"
            >
              <span>⚙</span>
              <span>إعدادات</span>
            </Link>
          </div>
        </header>

        {/* YTD KPI strip — only shown when there's payroll data this year */}
        {ytd && ytd.periods_count > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <YtdCard
              icon="💰"
              label={`الصافي المصروف ${ytd.year}`}
              value={formatEGP(Number(ytd.net_total))}
              tone="emerald"
            />
            <YtdCard
              icon="📋"
              label="دورات معتمدة"
              value={`${formatNumber(Number(ytd.paid_periods_count))}/${formatNumber(Number(ytd.periods_count))}`}
              subtext="مدفوعة / إجمالي"
              tone="cyan"
            />
            <YtdCard
              icon="🎁"
              label="إجمالي المكافآت"
              value={formatEGP(Number(ytd.bonuses_total))}
              tone="amber"
            />
            <YtdCard
              icon="🏛"
              label="تأمينات + ضرايب"
              value={formatEGP(
                Number(ytd.insurance_total) + Number(ytd.tax_total),
              )}
              tone="rose"
            />
          </div>
        )}

        {/* Two prominent "new period" buttons -- one for monthly office
            staff, one for the weekly production roster. The employee
            count badge tells HR at a glance whether each run is
            worthwhile (zero employees of that frequency = no point). */}
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          <Link
            href="/dashboard/payroll/new?freq=monthly"
            className="group bg-white border-2 border-sky-200 hover:border-sky-400 rounded-2xl p-5 transition shadow-sm hover:shadow-md flex items-center justify-between gap-3"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">📅</span>
                <span className="font-black text-slate-800 font-cairo text-base">
                  مرتب شهري جديد
                </span>
              </div>
              <p className="text-xs text-slate-500 font-cairo">
                لموظفي الإدارة والمكاتب
              </p>
            </div>
            <div className="text-left">
              <div className="text-2xl font-black text-sky-700 font-display leading-none">
                {monthlyEmpCount}
              </div>
              <div className="text-[10px] text-sky-700 font-cairo">موظف</div>
            </div>
          </Link>

          <Link
            href="/dashboard/payroll/new?freq=weekly"
            className="group bg-white border-2 border-violet-200 hover:border-violet-400 rounded-2xl p-5 transition shadow-sm hover:shadow-md flex items-center justify-between gap-3"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">📆</span>
                <span className="font-black text-slate-800 font-cairo text-base">
                  مرتب أسبوعي جديد
                </span>
              </div>
              <p className="text-xs text-slate-500 font-cairo">
                لعمال الإنتاج باليومية
              </p>
            </div>
            <div className="text-left">
              <div className="text-2xl font-black text-violet-700 font-display leading-none">
                {weeklyEmpCount}
              </div>
              <div className="text-[10px] text-violet-700 font-cairo">عامل</div>
            </div>
          </Link>
        </div>

        {/* Filter tabs: All / Monthly / Weekly */}
        {list.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <FilterTab
              href="/dashboard/payroll"
              active={filter === "all"}
              label="الكل"
            />
            <FilterTab
              href="/dashboard/payroll?freq=monthly"
              active={filter === "monthly"}
              label="📅 شهري"
            />
            <FilterTab
              href="/dashboard/payroll?freq=weekly"
              active={filter === "weekly"}
              label="📆 أسبوعي"
            />
          </div>
        )}

        {list.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">💰</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">
              لسه مفيش مرتبات مسجلة
            </h2>
            <p className="text-slate-500 mb-6 font-cairo leading-relaxed max-w-md mx-auto">
              النظام بيحسبلك المرتب تلقائيًا من راتب الموظف + حضوره خلال الشهر،
              مع تطبيق التأمينات الاجتماعية (14%) وضريبة الدخل المصرية التصاعدية.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/dashboard/payroll/new?freq=monthly"
                className="px-5 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo"
              >
                📅 ابدأ بأول مرتب شهري
              </Link>
              <Link
                href="/dashboard/payroll/new?freq=weekly"
                className="px-5 py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 transition font-cairo"
              >
                📆 ابدأ بأول مرتب أسبوعي
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الفترة</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">النوع</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">عدد الموظفين</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">إجمالي الصافي</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">أيام العمل</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الحالة</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((p) => {
                  const status = STATUS_LABELS[p.status];
                  const agg = totals.get(p.id) ?? { count: 0, total: 0 };
                  const isWeekly = p.frequency === "weekly";
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-4">
                        <Link href={`/dashboard/payroll/${p.id}`} className="font-bold text-brand-cyan-dark hover:text-brand-cyan font-cairo">
                          {formatCycleLabel(p)}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border font-cairo ${
                            isWeekly
                              ? "bg-violet-50 text-violet-700 border-violet-200"
                              : "bg-sky-50 text-sky-700 border-sky-200"
                          }`}
                        >
                          {isWeekly ? "أسبوعي" : "شهري"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-700 font-bold">{agg.count}</td>
                      <td className="px-5 py-4 font-bold text-emerald-700 font-cairo">{formatEGP(agg.total)}</td>
                      <td className="px-5 py-4 text-slate-600">{p.working_days} يوم</td>
                      <td className="px-5 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${status.classes} font-cairo`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/payroll/${p.id}`}
                          className="text-xs text-brand-cyan-dark hover:text-brand-cyan font-cairo font-bold"
                        >
                          فتح
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

function YtdCard({
  icon,
  label,
  value,
  subtext,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  subtext?: string;
  tone: "emerald" | "cyan" | "amber" | "rose";
}) {
  const bg = {
    emerald: "from-emerald-50 to-white border-emerald-200",
    cyan: "from-cyan-50 to-white border-cyan-200",
    amber: "from-amber-50 to-white border-amber-200",
    rose: "from-rose-50 to-white border-rose-200",
  }[tone];
  const txt = {
    emerald: "text-emerald-700",
    cyan: "text-cyan-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  }[tone];
  return (
    <div
      className={`p-4 rounded-2xl bg-gradient-to-br ${bg} border shadow-sm`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
        <span
          className={`text-[10px] font-bold uppercase font-cairo ${txt} tracking-wider`}
        >
          {label}
        </span>
      </div>
      <div className="text-xl md:text-2xl font-black text-slate-800 font-cairo">
        {value}
      </div>
      {subtext && (
        <div className="text-[11px] text-slate-500 font-cairo mt-1">
          {subtext}
        </div>
      )}
    </div>
  );
}

function FilterTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-1.5 rounded-full text-sm font-bold font-cairo transition ${
        active
          ? "bg-brand-cyan-dark text-white shadow-sm"
          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}
