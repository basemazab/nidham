// ============================================================================
// /dashboard/performance — Performance reviews overview
// ============================================================================
//
// Two-pane: the latest review per employee at the top, then a recency-
// ordered list of every review below. Filter chips toggle by status
// (draft / submitted / acknowledged / closed). "New review" CTA opens
// the form pre-filled with the period defaults.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type ReviewRow = {
  id: string;
  employee_id: string;
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  manager_rating: number | null;
  self_rating: number | null;
  outcome: string | null;
  status: string;
  created_at: string;
  employees: {
    full_name: string;
    job_title: string | null;
    department: string | null;
    avatar_url: string | null;
  } | null;
};

const STATUS_LABEL: Record<string, { ar: string; cls: string }> = {
  draft:        { ar: "مسودة",      cls: "bg-slate-100 text-slate-700 border-slate-200" },
  submitted:    { ar: "مرسلة",       cls: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  acknowledged: { ar: "تم الإقرار", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  closed:       { ar: "مغلقة",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const OUTCOME_LABEL: Record<string, string> = {
  extend_probation: "تمديد فترة الاختبار",
  continue:         "استمرار",
  promote:          "ترقية",
  pip_30_day:       "خطة تحسين 30 يوم",
  pip_60_day:       "خطة تحسين 60 يوم",
  terminate:        "إنهاء خدمة",
};

export default async function PerformancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const { data: reviews } = await supabase
    .from("performance_reviews")
    .select(
      "id, employee_id, period_label, period_start, period_end, manager_rating, self_rating, outcome, status, created_at, employees(full_name, job_title, department, avatar_url)",
    )
    .eq("company_id", callerCompanyId)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<ReviewRow[]>();

  const list = reviews ?? [];

  // Buckets per status for the KPI strip
  const counts = list.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  // Average manager rating across closed reviews (the rating "of record")
  const closed = list.filter((r) => r.status === "closed" && r.manager_rating);
  const avgManagerRating =
    closed.length === 0
      ? null
      : closed.reduce((s, r) => s + (r.manager_rating ?? 0), 0) / closed.length;

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-amber-50/30 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الـ Dashboard
          </Link>
        </div>

        <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              📊 تقييم الأداء
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              تقييمات شهرية / ربع سنوية / سنوية للموظفين مع KPIs ونتائج
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/performance/analytics"
              className="px-4 py-2.5 rounded-xl bg-white border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-sm shadow-sm font-cairo transition"
            >
              📊 تحليلات
            </Link>
            <Link
              href="/dashboard/performance/new"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold shadow-lg font-cairo text-sm"
            >
              + تقييم جديد
            </Link>
          </div>
        </header>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi icon="📋" label="إجمالي التقييمات" value={list.length.toString()} />
          <Kpi
            icon="✏"
            label="مسودات"
            value={(counts.draft ?? 0).toString()}
          />
          <Kpi
            icon="⏳"
            label="بانتظار الإقرار"
            value={(counts.submitted ?? 0).toString()}
          />
          <Kpi
            icon="⭐"
            label="متوسط التقييم"
            value={avgManagerRating ? `${avgManagerRating.toFixed(1)} / 5` : "—"}
          />
        </div>

        {/* List */}
        {list.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">الموظف</th>
                  <th className="px-4 py-3">الفترة</th>
                  <th className="px-4 py-3">تقييم المدير</th>
                  <th className="px-4 py-3">التقييم الذاتي</th>
                  <th className="px-4 py-3">النتيجة</th>
                  <th className="px-4 py-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r) => {
                  const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.draft;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/performance/${r.id}`}
                          className="flex items-center gap-3 group"
                        >
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-black text-sm overflow-hidden shrink-0">
                            {r.employees?.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={r.employees.avatar_url}
                                alt={r.employees.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{r.employees?.full_name?.[0] ?? "?"}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 truncate font-cairo group-hover:text-amber-700">
                              {r.employees?.full_name ?? "—"}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate font-cairo">
                              {r.employees?.job_title ?? ""}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-cairo">{r.period_label}</td>
                      <td className="px-4 py-3">
                        <Stars n={r.manager_rating} />
                      </td>
                      <td className="px-4 py-3">
                        <Stars n={r.self_rating} muted />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-cairo">
                        {r.outcome ? OUTCOME_LABEL[r.outcome] : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-bold font-cairo ${st.cls}`}
                        >
                          {st.ar}
                        </span>
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

function Stars({ n, muted }: { n: number | null; muted?: boolean }) {
  if (!n) return <span className="text-slate-300">—</span>;
  const baseColor = muted ? "text-slate-400" : "text-amber-500";
  return (
    <div className={`inline-flex ${baseColor}`}>
      {[1, 2, 3, 4, 5].map((i) =>
        i <= n ? (
          <span key={i}>★</span>
        ) : (
          <span key={i} className="text-slate-300">
            ★
          </span>
        ),
      )}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-base font-black font-display text-slate-800">{value}</div>
      <div className="text-[10px] text-slate-500 font-cairo mt-1">{label}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
      <div className="text-5xl mb-3">📊</div>
      <h2 className="text-lg font-bold text-slate-700 font-cairo mb-2">
        مفيش تقييمات لسه
      </h2>
      <p className="text-sm text-slate-500 font-cairo mb-6">
        ابدأ بأول تقييم — حدد الفترة + الموظف + إدي تقييم من 5 على كل KPI
      </p>
      <Link
        href="/dashboard/performance/new"
        className="inline-block px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold font-cairo"
      >
        ابدأ تقييم جديد
      </Link>
    </div>
  );
}
