// ============================================================================
// /dashboard/marketing/leads — Leads Inbox
// ============================================================================
//
// Surfaces every lead in the tenant with a focus on "what needs my
// attention TODAY". Hot signal at top: stale leads (no contact in 24h+)
// with a one-click "I called them" button.
//
// Filters via URL query params:
//   ?status=lead|contacted|qualified|won|lost|dormant
//   ?source_page=<landing_page_id>
//   ?utm_campaign=<name>
//   ?stale=1   (only leads with last_contacted_at IS NULL AND created > 24h ago)

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";

type SearchParams = Promise<{
  status?: string;
  source_page?: string;
  utm_campaign?: string;
  stale?: string;
  q?: string;
}>;

type LeadRow = {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  status: string;
  source: string | null;
  first_utm_source: string | null;
  first_utm_campaign: string | null;
  landing_page_id: string | null;
  estimated_value: number | null;
  last_contacted_at: string | null;
  created_at: string;
  assigned_to: string | null;
};

type LPMini = { id: string; name: string };

const STATUS_LABEL: Record<string, { label: string; cls: string; icon: string }> = {
  lead: {
    label: "جديد",
    cls: "bg-cyan-100 text-cyan-800 border-cyan-300",
    icon: "🆕",
  },
  contacted: {
    label: "اتواصل",
    cls: "bg-amber-100 text-amber-800 border-amber-300",
    icon: "📞",
  },
  qualified: {
    label: "مهتم",
    cls: "bg-violet-100 text-violet-800 border-violet-300",
    icon: "🎯",
  },
  active: {
    label: "في النقاش",
    cls: "bg-violet-100 text-violet-800 border-violet-300",
    icon: "💬",
  },
  won: {
    label: "عميل",
    cls: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: "🏆",
  },
  lost: {
    label: "ضايع",
    cls: "bg-rose-100 text-rose-800 border-rose-300",
    icon: "❌",
  },
  dormant: {
    label: "خامد",
    cls: "bg-slate-100 text-slate-700 border-slate-300",
    icon: "💤",
  },
};

// Force the page to revalidate on every request. Without this, Next.js
// caches the row list + counters between requests, so newly-added rows
// from server actions or import flows take minutes to appear.
export const dynamic = "force-dynamic";

export default async function LeadsInbox({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await canUseFeature("marketing_studio"))) {
    return <UpgradeRequired feature="marketing_studio" />;
  }

  const sp = await searchParams;
  const statusFilter = sp.status;
  const sourcePageFilter = sp.source_page;
  const utmCampaignFilter = sp.utm_campaign;
  const staleOnly = sp.stale === "1";
  const searchQuery = (sp.q ?? "").trim();

  // Scope to the caller's company — super-admin sessions can otherwise
  // pull customers + landing_pages across every tenant.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  // Build query
  let q = supabase
    .from("customers")
    .select(
      "id, full_name, phone, whatsapp, email, status, source, first_utm_source, first_utm_campaign, landing_page_id, estimated_value, last_contacted_at, created_at, assigned_to",
    )
    .eq("company_id", callerCompanyId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (statusFilter && STATUS_LABEL[statusFilter]) {
    q = q.eq("status", statusFilter);
  }
  if (sourcePageFilter && /^[0-9a-f-]{36}$/i.test(sourcePageFilter)) {
    q = q.eq("landing_page_id", sourcePageFilter);
  }
  if (utmCampaignFilter) {
    q = q.eq("first_utm_campaign", utmCampaignFilter);
  }
  if (searchQuery) {
    q = q.or(
      `full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`,
    );
  }

  const { data: leadsData, error: leadsErr } = await q.returns<LeadRow[]>();
  let leads = leadsData ?? [];

  // Capture "now" once per request to keep the render deterministic.
  // Server Components run once per request, not on a React reconciliation
  // loop — the purity rule isn't meaningful here, but the lint plugin
  // can't tell the difference, so we disable it for this one line.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  // Client-side stale filter (Postgres expression is awkward in PostgREST)
  if (staleOnly) {
    const dayAgo = nowMs - 24 * 60 * 60 * 1000;
    leads = leads.filter(
      (l) =>
        l.last_contacted_at === null &&
        new Date(l.created_at).getTime() < dayAgo &&
        (l.status === "lead" || l.status === "contacted"),
    );
  }

  // Detect table-missing
  const tableMissing =
    !!leadsErr &&
    /relation .* does not exist|42P01|column .* does not exist|PGRST/i.test(
      leadsErr.message ?? "",
    );

  // Resolve landing_page names for display
  const pageIds = Array.from(
    new Set(leads.map((l) => l.landing_page_id).filter((x): x is string => !!x)),
  );
  let pageNames = new Map<string, string>();
  if (pageIds.length > 0) {
    const { data: pagesData } = await supabase
      .from("landing_pages")
      .select("id, name")
      .eq("company_id", callerCompanyId)
      .in("id", pageIds)
      .returns<LPMini[]>();
    pageNames = new Map((pagesData ?? []).map((p) => [p.id, p.name]));
  }

  // KPI calculations across the full result set (post-filter)
  const stats = {
    total: leads.length,
    new: leads.filter((l) => l.status === "lead").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    qualified: leads.filter(
      (l) => l.status === "qualified" || l.status === "active",
    ).length,
    won: leads.filter((l) => l.status === "won").length,
    lost: leads.filter((l) => l.status === "lost").length,
  };

  const stale = leads.filter((l) => {
    if (l.last_contacted_at !== null) return false;
    if (l.status !== "lead" && l.status !== "contacted") return false;
    const ageHours = (nowMs - new Date(l.created_at).getTime()) / 3600000;
    return ageHours > 24;
  });

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard/marketing"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← استوديو التسويق
          </Link>
        </div>

        <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-violet-100 to-purple-100 border border-violet-300 text-violet-800 text-xs font-bold mb-2 font-cairo">
              📥 Leads Inbox
            </div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              صندوق العملاء المحتملين
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              {leads.length} lead في الـ view الحالي · يلا نشتغل عليهم
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/marketing/leads/pipeline"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-800 font-bold text-sm font-cairo transition"
            >
              <span>🎯</span>
              <span>Pipeline View</span>
            </Link>
            <Link
              href="/dashboard/marketing/analytics"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-sm font-cairo transition"
            >
              <span>📊</span>
              <span>Analytics</span>
            </Link>
            <Link
              href="/dashboard/marketing/landing-pages"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-100 hover:bg-cyan-200 text-cyan-800 font-bold text-sm font-cairo transition"
            >
              <span>🏠</span>
              <span>Landing Pages</span>
            </Link>
          </div>
        </header>

        {/* Migration missing banner */}
        {tableMissing && (
          <div className="mb-5 bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 font-cairo">
            <h3 className="font-black text-amber-900 mb-2 text-base">
              ⚠ Migration 039 لسه ما اتطبّقتش
            </h3>
            <p className="text-sm text-amber-800">
              جدول customers محتاج الأعمدة الجديدة (first_utm_*, landing_page_id...). طبّق Migration 039 على Supabase.
            </p>
          </div>
        )}

        {/* Stale alert */}
        {stale.length > 0 && !staleOnly && (
          <div className="mb-5 p-5 rounded-2xl bg-rose-50 border-2 border-rose-300">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-black font-cairo text-rose-900 mb-1">
                  🚨 {stale.length} lead محدش كلّمه من أكتر من 24 ساعة
                </h2>
                <p className="text-xs text-rose-700 font-cairo">
                  دول لسه طازج وممكن يضيعوا لو ما اتواصلتش معاهم
                  النهارده.
                </p>
              </div>
              <Link
                href="/dashboard/marketing/leads?stale=1"
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs font-cairo"
              >
                اعرض الـ stale leads فقط →
              </Link>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <section className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <Kpi label="إجمالي" value={stats.total} icon="📊" />
          <Kpi label="جدد" value={stats.new} icon="🆕" tint="cyan" />
          <Kpi label="اتواصل" value={stats.contacted} icon="📞" tint="amber" />
          <Kpi label="مهتم" value={stats.qualified} icon="🎯" tint="violet" />
          <Kpi label="عملاء" value={stats.won} icon="🏆" tint="emerald" />
          <Kpi label="ضايع" value={stats.lost} icon="❌" tint="rose" />
        </section>

        {/* Filter chips */}
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <FilterChip label="الكل" href="/dashboard/marketing/leads" active={!statusFilter && !staleOnly} />
          <FilterChip label="🆕 جدد" href="?status=lead" active={statusFilter === "lead"} />
          <FilterChip label="📞 اتواصل" href="?status=contacted" active={statusFilter === "contacted"} />
          <FilterChip label="🎯 مهتم" href="?status=qualified" active={statusFilter === "qualified"} />
          <FilterChip label="🏆 عملاء" href="?status=won" active={statusFilter === "won"} />
          <FilterChip label="❌ ضايع" href="?status=lost" active={statusFilter === "lost"} />
          <FilterChip
            label="🚨 محتاجين متابعة"
            href="?stale=1"
            active={staleOnly}
            danger
          />

          {/* Search box */}
          <form className="ml-auto flex items-center gap-2" action="/dashboard/marketing/leads">
            <input
              type="text"
              name="q"
              defaultValue={searchQuery}
              placeholder="ابحث باسم/تليفون/إيميل"
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-cairo outline-none focus:border-cyan-400 w-56"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold font-cairo"
            >
              🔍
            </button>
          </form>
        </div>

        {/* Leads table */}
        {leads.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-sm text-slate-500 font-cairo mb-3">
              {staleOnly
                ? "مفيش leads محتاجين متابعة دلوقتي! 🎉"
                : "مفيش leads بالـ filter ده"}
            </p>
            <Link
              href="/dashboard/marketing/landing-pages"
              className="inline-block text-xs text-cyan-700 hover:text-cyan-900 font-bold font-cairo"
            >
              ابدأ landing page جديدة عشان تجيب leads ←
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
            <table className="w-full text-right text-sm font-cairo min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <Th>الاسم</Th>
                  <Th>التواصل</Th>
                  <Th>الحالة</Th>
                  <Th>المصدر</Th>
                  <Th>آخر تواصل</Th>
                  <Th>اتسجّل</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((l) => {
                  const status = STATUS_LABEL[l.status] ?? STATUS_LABEL.lead;
                  const ageHours =
                    (nowMs - new Date(l.created_at).getTime()) / 3600000;
                  const isStale =
                    l.last_contacted_at === null &&
                    ageHours > 24 &&
                    (l.status === "lead" || l.status === "contacted");
                  return (
                    <tr
                      key={l.id}
                      className={`hover:bg-slate-50 transition ${isStale ? "bg-rose-50/50" : ""}`}
                    >
                      <td className="px-3 py-3">
                        <Link
                          href={`/dashboard/marketing/leads/${l.id}`}
                          className="font-bold text-slate-800 hover:text-cyan-700"
                        >
                          {l.full_name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-600" dir="ltr">
                        {l.phone ?? l.whatsapp ?? l.email ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-block text-[10px] px-2 py-1 rounded-full border font-bold ${status.cls}`}
                        >
                          {status.icon} {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">
                        {l.landing_page_id
                          ? pageNames.get(l.landing_page_id) ?? "🏠 صفحة هبوط"
                          : l.first_utm_source
                            ? `↗ ${l.first_utm_source}`
                            : l.source ?? "—"}
                        {l.first_utm_campaign && (
                          <div className="text-[10px] text-slate-400">
                            {l.first_utm_campaign}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {l.last_contacted_at ? (
                          <span className="text-emerald-700 font-bold">
                            {timeAgo(l.last_contacted_at, nowMs)}
                          </span>
                        ) : (
                          <span
                            className={isStale ? "text-rose-700 font-bold" : "text-slate-500"}
                          >
                            مفيش
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {timeAgo(l.created_at, nowMs)}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/dashboard/marketing/leads/${l.id}`}
                          className="text-xs text-cyan-700 hover:text-cyan-900 font-bold"
                        >
                          فتح ←
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

// Pure helper — accepts an explicit "now" so the caller controls render
// determinism (Date.now() inside the body would trip react-hooks/purity).
function timeAgo(iso: string, nowMs: number): string {
  const ms = nowMs - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  const hr = Math.floor(ms / 3600000);
  const day = Math.floor(ms / 86400000);
  if (min < 1) return "دلوقتي";
  if (min < 60) return `${min} د`;
  if (hr < 24) return `${hr} س`;
  if (day === 1) return "إمبارح";
  if (day < 30) return `${day} يوم`;
  if (day < 365) return `${Math.floor(day / 30)} شهر`;
  return `${Math.floor(day / 365)} سنة`;
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
      {children}
    </th>
  );
}

function Kpi({
  label,
  value,
  icon,
  tint = "slate",
}: {
  label: string;
  value: number;
  icon: string;
  tint?: "slate" | "cyan" | "amber" | "violet" | "emerald" | "rose";
}) {
  const cls: Record<string, string> = {
    slate: "from-slate-50 to-white border-slate-200 text-slate-800",
    cyan: "from-cyan-50 to-white border-cyan-200 text-cyan-800",
    amber: "from-amber-50 to-white border-amber-200 text-amber-800",
    violet: "from-violet-50 to-white border-violet-200 text-violet-800",
    emerald: "from-emerald-50 to-white border-emerald-200 text-emerald-800",
    rose: "from-rose-50 to-white border-rose-200 text-rose-800",
  };
  return (
    <div className={`p-3 rounded-xl bg-gradient-to-br border ${cls[tint]}`}>
      <div className="flex items-center justify-between mb-1">
        <span>{icon}</span>
      </div>
      <div className="text-xl font-black font-display">
        {value.toLocaleString("ar-EG")}
      </div>
      <div className="text-[10px] font-cairo opacity-80">{label}</div>
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
  danger,
}: {
  label: string;
  href: string;
  active: boolean;
  danger?: boolean;
}) {
  const base =
    "inline-block text-xs px-3 py-1.5 rounded-full font-bold font-cairo transition border";
  const cls = active
    ? danger
      ? "bg-rose-600 text-white border-rose-700"
      : "bg-slate-800 text-white border-slate-900"
    : danger
      ? "bg-white text-rose-700 border-rose-300 hover:bg-rose-50"
      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50";
  return (
    <Link href={href} className={`${base} ${cls}`}>
      {label}
    </Link>
  );
}
