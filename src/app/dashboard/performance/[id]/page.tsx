// ============================================================================
// /dashboard/performance/[id] — Review detail with status transitions
// ============================================================================

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import {
  submitReview,
  acknowledgeReview,
  closeReview,
} from "../actions";

export const dynamic = "force-dynamic";

type Review = {
  id: string;
  employee_id: string;
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  manager_rating: number | null;
  self_rating: number | null;
  strengths: string | null;
  areas_to_improve: string | null;
  manager_notes: string | null;
  employee_response: string | null;
  kpis: Array<{
    name: string;
    target: number | null;
    achieved: number | null;
    weight: number | null;
    score: number | null;
  }>;
  outcome: string | null;
  status: "draft" | "submitted" | "acknowledged" | "closed";
  submitted_at: string | null;
  acknowledged_at: string | null;
  closed_at: string | null;
  created_at: string;
  employees: {
    full_name: string;
    job_title: string | null;
    department: string | null;
    avatar_url: string | null;
  } | null;
};

const OUTCOME_LABEL: Record<string, string> = {
  extend_probation: "تمديد فترة الاختبار",
  continue:         "استمرار",
  promote:          "ترقية",
  pip_30_day:       "خطة تحسين 30 يوم",
  pip_60_day:       "خطة تحسين 60 يوم",
  terminate:        "إنهاء خدمة",
};

type SearchParams = Promise<{
  submitted?: string;
  acknowledged?: string;
  closed?: string;
}>;

export default async function ReviewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const { data: review } = await supabase
    .from("performance_reviews")
    .select(
      "*, employees(full_name, job_title, department, avatar_url)",
    )
    .eq("id", id)
    .eq("company_id", callerCompanyId)
    .single<Review>();

  if (!review) notFound();

  const totalWeight = review.kpis.reduce(
    (s, k) => s + (k.weight ?? 0),
    0,
  );
  const weightedAvgScore =
    totalWeight > 0
      ? review.kpis.reduce(
          (s, k) => s + ((k.score ?? 0) * (k.weight ?? 0)) / totalWeight,
          0,
        )
      : 0;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-amber-50/30 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/dashboard/performance"
          className="text-sm text-slate-500 hover:text-amber-700 font-cairo"
        >
          ← الرجوع للتقييمات
        </Link>

        {/* Status banner after a transition */}
        {sp.submitted && (
          <div className="mt-3 p-3 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-800 text-sm font-cairo">
            ✓ التقييم اتبعت — في انتظار إقرار الموظف
          </div>
        )}
        {sp.acknowledged && (
          <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm font-cairo">
            ✓ الموظف أقرّ بالتقييم — جاهز للإغلاق
          </div>
        )}
        {sp.closed && (
          <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-cairo">
            ✓ التقييم اتقفل وأصبح ضمن السجلات
          </div>
        )}

        {/* Header */}
        <header className="mt-4 mb-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-black text-xl overflow-hidden">
                {review.employees?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={review.employees.avatar_url}
                    alt={review.employees.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{review.employees?.full_name?.[0] ?? "?"}</span>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-black font-cairo text-slate-800">
                  {review.employees?.full_name ?? "—"}
                </h1>
                <p className="text-sm text-slate-500 font-cairo">
                  {review.employees?.job_title ?? "—"}
                  {review.employees?.department && (
                    <> · {review.employees.department}</>
                  )}
                </p>
                <p className="text-sm text-amber-700 font-bold font-cairo mt-1">
                  📅 فترة التقييم: {review.period_label}
                </p>
              </div>
            </div>

            <StatusBadge status={review.status} />
          </div>
        </header>

        {/* Ratings */}
        <section className="grid md:grid-cols-3 gap-4 mb-6">
          <RatingCard label="تقييم المدير" value={review.manager_rating} />
          <RatingCard label="التقييم الذاتي" value={review.self_rating} muted />
          <RatingCard
            label="متوسط KPIs مرجّح"
            value={weightedAvgScore > 0 ? Math.round(weightedAvgScore * 10) / 10 : null}
            decimal
          />
        </section>

        {/* KPIs */}
        {review.kpis.length > 0 && (
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
            <h2 className="text-base font-black font-cairo text-slate-800 mb-3">
              🎯 الـ KPIs
            </h2>
            <table className="w-full text-sm font-cairo">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-200">
                  <th className="text-right py-2">الاسم</th>
                  <th className="text-center">الهدف</th>
                  <th className="text-center">المتحقق</th>
                  <th className="text-center">الوزن %</th>
                  <th className="text-center">التقييم</th>
                </tr>
              </thead>
              <tbody>
                {review.kpis.map((k, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-800">{k.name}</td>
                    <td className="text-center text-slate-600 font-mono">
                      {k.target ?? "—"}
                    </td>
                    <td className="text-center text-slate-600 font-mono">
                      {k.achieved ?? "—"}
                    </td>
                    <td className="text-center text-slate-600">
                      {k.weight ? `${k.weight}%` : "—"}
                    </td>
                    <td className="text-center">
                      {k.score ? (
                        <span className="text-amber-500">
                          {"★".repeat(k.score)}
                          <span className="text-slate-300">
                            {"★".repeat(5 - k.score)}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Free-text sections */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <TextCard
            title="💪 نقاط القوة"
            content={review.strengths}
            empty="ما اتسجلتش نقاط قوة"
          />
          <TextCard
            title="🎯 نقاط التحسين"
            content={review.areas_to_improve}
            empty="ما اتسجلتش نقاط تحسين"
          />
          <TextCard
            title="📝 ملاحظات المدير"
            content={review.manager_notes}
            empty="مفيش ملاحظات إضافية"
          />
          <TextCard
            title="💬 رد الموظف"
            content={review.employee_response}
            empty="الموظف ما ردّش بعد"
          />
        </div>

        {/* Outcome */}
        {review.outcome && (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 font-cairo">
            <span className="text-xs text-amber-700 font-bold">النتيجة:</span>
            <span className="ms-2 text-base font-black text-amber-900">
              🏁 {OUTCOME_LABEL[review.outcome] ?? review.outcome}
            </span>
          </section>
        )}

        {/* Status transitions */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 font-cairo">
          <h2 className="text-sm font-black text-slate-800 mb-3">⚙ تحريك الحالة</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {review.status === "draft" && (
              <form action={submitReview.bind(null, review.id)}>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-sm"
                >
                  📤 ابعت للموظف
                </button>
              </form>
            )}
            {review.status === "submitted" && (
              <form action={acknowledgeReview.bind(null, review.id)}>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm"
                >
                  ✓ الموظف أقرّ بالتقييم
                </button>
              </form>
            )}
            {review.status === "acknowledged" && (
              <form action={closeReview.bind(null, review.id)}>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm"
                >
                  🔒 اقفل التقييم
                </button>
              </form>
            )}
            {review.status === "closed" && (
              <p className="text-sm text-slate-500">
                التقييم مغلق ولا يمكن تعديله. تقدر تعمل تقييم جديد للفترة
                الجاية.
              </p>
            )}
          </div>

          <div className="mt-4 text-[10px] text-slate-500 font-mono">
            تاريخ الإنشاء: {new Date(review.created_at).toLocaleString("ar-EG")}
            {review.submitted_at && (
              <> · مُرسل: {new Date(review.submitted_at).toLocaleString("ar-EG")}</>
            )}
            {review.acknowledged_at && (
              <> · أُقرّ: {new Date(review.acknowledged_at).toLocaleString("ar-EG")}</>
            )}
            {review.closed_at && (
              <> · مغلق: {new Date(review.closed_at).toLocaleString("ar-EG")}</>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusBadge({
  status,
}: {
  status: "draft" | "submitted" | "acknowledged" | "closed";
}) {
  const map = {
    draft:        { ar: "مسودة",        cls: "bg-slate-100 text-slate-700 border-slate-200" },
    submitted:    { ar: "مُرسل",        cls: "bg-cyan-50 text-cyan-700 border-cyan-200" },
    acknowledged: { ar: "تم الإقرار",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
    closed:       { ar: "مغلق",         cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  const s = map[status];
  return (
    <span
      className={`text-xs px-3 py-1 rounded-full border font-bold font-cairo ${s.cls}`}
    >
      {s.ar}
    </span>
  );
}

function RatingCard({
  label,
  value,
  muted,
  decimal,
}: {
  label: string;
  value: number | null;
  muted?: boolean;
  decimal?: boolean;
}) {
  const baseColor = muted ? "text-slate-400" : "text-amber-500";
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-center">
      <div className="text-xs text-slate-500 font-cairo mb-1">{label}</div>
      {value !== null && value > 0 ? (
        <>
          <div className={`text-2xl ${baseColor}`}>
            {decimal ? (
              <span className="font-black font-display">{value.toFixed(1)} / 5</span>
            ) : (
              <>
                {"★".repeat(Math.round(value))}
                <span className="text-slate-300">
                  {"★".repeat(5 - Math.round(value))}
                </span>
              </>
            )}
          </div>
          {!decimal && (
            <div className="text-xs text-slate-500 mt-1 font-mono">
              {value} / 5
            </div>
          )}
        </>
      ) : (
        <div className="text-slate-300 text-xl">— لم يُحدد —</div>
      )}
    </div>
  );
}

function TextCard({
  title,
  content,
  empty,
}: {
  title: string;
  content: string | null;
  empty: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 font-cairo">
      <h3 className="text-sm font-bold text-slate-800 mb-2">{title}</h3>
      {content ? (
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
          {content}
        </p>
      ) : (
        <p className="text-xs text-slate-400 italic">{empty}</p>
      )}
    </div>
  );
}
