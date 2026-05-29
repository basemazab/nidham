import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { computePerformanceAnalytics, OUTCOME_LABELS } from "@/lib/performance-analytics";

export const dynamic = "force-dynamic";

export default async function PerformanceAnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { profile } = await getMyProfile();
  const companyId = profile?.company_id ?? "";

  const { data: reviews } = await supabase
    .from("performance_reviews")
    .select(
      "id, employee_id, period_label, period_start, period_end, manager_rating, self_rating, kpis, outcome, status, created_at, employees(full_name, job_title, department)",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .returns<any[]>();

  const analytics = computePerformanceAnalytics(reviews || []);

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-indigo-50/20 min-h-screen" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <Link href="/dashboard/performance" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع للتقييمات
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-indigo-50 to-amber-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-2 font-cairo">
            📊 تحليلات الأداء
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            تحليلات الأداء
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
            ملخص إجمالي لنتائج تقييمات الأداء — على مستوى الشركة، الأقسام، والموظفين
          </p>
        </header>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <KpiCard icon="📋" label="إجمالي التقييمات" value={String(analytics.totalReviews)} />
          <KpiCard icon="⭐" label="متوسط التقييم" value={analytics.totalReviews > 0 ? `${analytics.avgRating}/5` : "—"} />
          <KpiCard icon="🎯" label="متوسط إنجاز KPIs" value={`${analytics.avgKpiCompletion}%`} />
          <KpiCard icon="📝" label="مسودات" value={String(analytics.reviewCountByStatus.draft || 0)} />
          <KpiCard icon="✅" label="مغلقة" value={String(analytics.reviewCountByStatus.closed || 0)} />
        </div>

        {/* Rating distribution */}
        {Object.keys(analytics.ratingDistribution).length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
            <h2 className="text-base font-black font-cairo text-slate-800 mb-4">توزيع التقييمات</h2>
            <div className="flex items-end gap-2 h-32">
              {[1, 2, 3, 4, 5].map((star) => {
                const count = analytics.ratingDistribution[String(star)] || 0;
                const maxCount = Math.max(...Object.values(analytics.ratingDistribution).filter(v => v > 0), 1);
                const height = (count / maxCount) * 100;
                return (
                  <div key={star} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-slate-500 font-cairo">{count}</span>
                    <div className="w-full bg-indigo-100 rounded-t-lg" style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}>
                      <div className="w-full h-full bg-indigo-500 rounded-t-lg" style={{ height: `${height}%` }} />
                    </div>
                    <span className="text-sm font-bold text-amber-500">{'★'.repeat(star)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Outcome distribution */}
        {Object.keys(analytics.outcomeDistribution).length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
            <h2 className="text-base font-black font-cairo text-slate-800 mb-4">🏁 نتائج التقييمات</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(analytics.outcomeDistribution).sort(([,a],[,b]) => b - a).map(([outcome, count]) => (
                <div key={outcome} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-lg font-black text-slate-800">{count}</div>
                  <div className="text-[10px] text-slate-500 font-cairo">{OUTCOME_LABELS[outcome] || outcome}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Department ranking */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <h2 className="text-base font-black font-cairo text-slate-800 mb-4">ترتيب الأقسام</h2>
          {analytics.departments.length === 0 ? (
            <p className="text-sm text-slate-400 font-cairo">لا توجد بيانات</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-cairo">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-200">
                    <th className="text-right py-2 px-2">القسم</th>
                    <th className="text-center py-2 px-2">الموظفين</th>
                    <th className="text-center py-2 px-2">التقييمات</th>
                    <th className="text-center py-2 px-2">متوسط التقييم</th>
                    <th className="text-center py-2 px-2">إنجاز KPIs</th>
                    <th className="text-center py-2 px-2">الاتجاه</th>
                    <th className="text-center py-2 px-2">النتيجة الأكثر</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.departments.map((d, i) => (
                    <tr key={i} className="border-b border-slate-100 text-slate-700">
                      <td className="py-3 px-2 font-bold">{d.department}</td>
                      <td className="text-center py-3 px-2">{d.employeeCount}</td>
                      <td className="text-center py-3 px-2">{d.reviewCount}</td>
                      <td className="text-center py-3 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          d.avgRating >= 4 ? "bg-emerald-100 text-emerald-700" :
                          d.avgRating >= 3 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                        }`}>
                          {d.avgRating}
                        </span>
                      </td>
                      <td className="text-center py-3 px-2">{d.avgKpiCompletion}%</td>
                      <td className="text-center py-3 px-2">
                        {d.trend === "up" ? "📈" : d.trend === "down" ? "📉" : "➡️"}
                      </td>
                      <td className="text-center py-3 px-2 text-xs">{d.topOutcome ? (OUTCOME_LABELS[d.topOutcome] || d.topOutcome) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Employee ranking */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <h2 className="text-base font-black font-cairo text-slate-800 mb-4">ترتيب الموظفين</h2>
          {analytics.employeeTrends.length === 0 ? (
            <p className="text-sm text-slate-400 font-cairo">لا توجد بيانات</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-cairo">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-200">
                    <th className="text-right py-2 px-2">الموظف</th>
                    <th className="text-center py-2 px-2">القسم</th>
                    <th className="text-center py-2 px-2">متوسط التقييم</th>
                    <th className="text-center py-2 px-2">عدد التقييمات</th>
                    <th className="text-center py-2 px-2">الاتجاه</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.employeeTrends.slice(0, 30).map((e, i) => (
                    <tr key={e.employeeId} className="border-b border-slate-100 text-slate-700">
                      <td className="py-3 px-2 font-bold">{e.employeeName}</td>
                      <td className="text-center py-3 px-2 text-xs">{e.department}</td>
                      <td className="text-center py-3 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          e.avgRating >= 4 ? "bg-emerald-100 text-emerald-700" :
                          e.avgRating >= 3 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                        }`}>
                          {e.avgRating}
                        </span>
                      </td>
                      <td className="text-center py-3 px-2">{e.reviews.length}</td>
                      <td className="text-center py-3 px-2">
                        {e.trend === "up" ? "📈" : e.trend === "down" ? "📉" : "➡️"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Period trends */}
        {analytics.periodComparison.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-base font-black font-cairo text-slate-800 mb-4">اتجاه التقييمات عبر الفترات</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-cairo">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-200">
                    <th className="text-right py-2 px-2">الفترة</th>
                    <th className="text-center py-2 px-2">عدد التقييمات</th>
                    <th className="text-center py-2 px-2">متوسط التقييم</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.periodComparison.map((p, i) => (
                    <tr key={i} className="border-b border-slate-100 text-slate-700">
                      <td className="py-3 px-2 font-bold">{p.period}</td>
                      <td className="text-center py-3 px-2">{p.reviewCount}</td>
                      <td className="text-center py-3 px-2">{p.avgRating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function KpiCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className="text-[10px] text-slate-500 font-cairo">{label}</span>
      </div>
      <div className="text-2xl font-black font-cairo text-slate-800">{value}</div>
    </div>
  );
}
