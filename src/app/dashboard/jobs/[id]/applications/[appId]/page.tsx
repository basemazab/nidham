import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  rerunScreening,
  updateApplicationStatus,
  saveApplicationNotes,
  deleteApplication,
} from "../../../actions";
import { formatEGP } from "@/lib/format";
import {
  STATUS_LABELS_AR,
  STATUS_CLASSES,
  RECOMMENDATION_LABELS_AR,
  RECOMMENDATION_CLASSES,
  type ApplicationStatus,
  type AiRecommendation,
} from "@/lib/recruitment";

type PageProps = {
  params: Promise<{ id: string; appId: string }>;
};

type Application = {
  id: string;
  job_id: string;
  cv_text: string | null;
  cover_letter: string | null;
  source: string;

  ai_score: number | null;
  ai_recommendation: AiRecommendation | null;
  ai_summary: string | null;
  ai_strengths: string[] | null;
  ai_weaknesses: string[] | null;
  ai_interview_questions: string[] | null;
  ai_extracted_skills: string[] | null;
  ai_analyzed_at: string | null;
  ai_error: string | null;
  ai_model: string | null;

  status: ApplicationStatus;
  hr_notes: string | null;
  interview_at: string | null;
  applied_at: string;

  jobs: { title: string; department: string | null } | null;
  candidates: {
    full_name: string;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
    current_title: string | null;
    current_company: string | null;
    years_experience: number | null;
    location: string | null;
    expected_salary: number | null;
  } | null;
};

const STATUS_OPTIONS: ApplicationStatus[] = [
  "new",
  "reviewing",
  "shortlisted",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
];

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { id, appId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: app } = await supabase
    .from("applications")
    .select(
      `*,
       jobs(title, department),
       candidates(full_name, email, phone, linkedin_url, current_title, current_company, years_experience, location, expected_salary)`,
    )
    .eq("id", appId)
    .single<Application>();

  if (!app) notFound();

  const cand = app.candidates;
  const job = app.jobs;
  const here = `/dashboard/jobs/${id}/applications/${appId}`;

  const rerunAction = async () => {
    "use server";
    await rerunScreening(appId, id);
  };

  const deleteAction = async () => {
    "use server";
    await deleteApplication(appId, id);
  };

  const saveNotesAction = saveApplicationNotes.bind(null, appId);

  const scoreTone =
    app.ai_score === null
      ? "bg-slate-100 text-slate-500 border-slate-200"
      : app.ai_score >= 85
        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
        : app.ai_score >= 70
          ? "bg-cyan-50 text-cyan-700 border-cyan-300"
          : app.ai_score >= 50
            ? "bg-amber-50 text-amber-700 border-amber-300"
            : "bg-red-50 text-red-700 border-red-300";

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href={`/dashboard/jobs/${id}`} className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع لـ {job?.title ?? "الوظيفة"}
          </Link>
        </div>

        {/* Hero */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
                {cand?.full_name ?? "—"}
              </h1>
              <p className="text-sm text-slate-500 font-cairo">
                {cand?.current_title ?? "—"}
                {cand?.current_company && ` @ ${cand.current_company}`}
                {typeof cand?.years_experience === "number" &&
                  ` · ${cand.years_experience} سنين خبرة`}
                {cand?.location && ` · ${cand.location}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${STATUS_CLASSES[app.status]} font-cairo`}>
                  {STATUS_LABELS_AR[app.status]}
                </span>
                {app.ai_recommendation && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${RECOMMENDATION_CLASSES[app.ai_recommendation]} font-cairo`}>
                    🤖 {RECOMMENDATION_LABELS_AR[app.ai_recommendation]}
                  </span>
                )}
                {cand?.email && (
                  <a
                    href={`mailto:${cand.email}`}
                    className="px-3 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition font-mono"
                    dir="ltr"
                  >
                    📧 {cand.email}
                  </a>
                )}
                {cand?.phone && (
                  <a
                    href={`tel:${cand.phone}`}
                    className="px-3 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition font-mono"
                    dir="ltr"
                  >
                    📱 {cand.phone}
                  </a>
                )}
                {cand?.linkedin_url && (
                  <a
                    href={cand.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                  >
                    LinkedIn ↗
                  </a>
                )}
              </div>
            </div>

            {/* Score */}
            <div className={`shrink-0 w-28 h-28 rounded-2xl border-2 flex flex-col items-center justify-center ${scoreTone}`}>
              <div className="text-4xl font-black font-cairo leading-none">
                {app.ai_score ?? "—"}
              </div>
              <div className="text-[10px] font-bold mt-1 font-cairo">AI Match Score</div>
              {app.ai_analyzed_at && (
                <div className="text-[9px] opacity-60 mt-0.5">
                  {new Date(app.ai_analyzed_at).toLocaleDateString("ar-EG", {
                    day: "2-digit",
                    month: "short",
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Error State */}
        {app.ai_error && !app.ai_recommendation && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-amber-800 mb-1 font-cairo">⚠ التحليل الذكي فشل</h3>
              <p className="text-sm text-amber-700 font-cairo">
                السبب: <span className="font-mono text-xs">{app.ai_error}</span>
              </p>
            </div>
            <form action={rerunAction}>
              <button className="px-4 py-2 rounded-lg bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 transition font-cairo">
                حاول تاني
              </button>
            </form>
          </div>
        )}

        {/* AI Summary */}
        {app.ai_summary && (
          <div className="bg-gradient-to-br from-cyan-50 to-white p-6 rounded-2xl border-2 border-brand-cyan/30 mb-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="text-lg font-bold font-cairo text-slate-800 flex items-center gap-2">
                <span>🤖</span> ملخص الـ AI
              </h2>
              <form action={rerunAction}>
                <button className="text-xs px-3 py-1.5 rounded-lg border border-cyan-300 text-cyan-700 hover:bg-cyan-50 transition font-cairo">
                  ↻ إعادة الفرز
                </button>
              </form>
            </div>
            <p className="text-sm text-slate-700 font-cairo leading-relaxed">
              {app.ai_summary}
            </p>
          </div>
        )}

        {/* Strengths / Weaknesses grid */}
        {(app.ai_strengths?.length || app.ai_weaknesses?.length) && (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {app.ai_strengths && app.ai_strengths.length > 0 && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100">
                <h3 className="text-sm font-bold text-emerald-700 mb-3 font-cairo flex items-center gap-1">
                  ✅ نقاط القوة
                </h3>
                <ul className="space-y-2">
                  {app.ai_strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700 font-cairo">
                      <span className="text-emerald-500 mt-1">●</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {app.ai_weaknesses && app.ai_weaknesses.length > 0 && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-100">
                <h3 className="text-sm font-bold text-red-700 mb-3 font-cairo flex items-center gap-1">
                  ⚠ الفجوات
                </h3>
                <ul className="space-y-2">
                  {app.ai_weaknesses.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700 font-cairo">
                      <span className="text-red-500 mt-1">●</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Interview questions */}
        {app.ai_interview_questions && app.ai_interview_questions.length > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
            <h3 className="text-base font-bold text-slate-800 mb-3 font-cairo">
              🎤 أسئلة مقترحة للمقابلة
            </h3>
            <ol className="space-y-2">
              {app.ai_interview_questions.map((q, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700 font-cairo">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <span>{q}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Extracted skills */}
        {app.ai_extracted_skills && app.ai_extracted_skills.length > 0 && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6">
            <h3 className="text-sm font-bold text-slate-800 mb-3 font-cairo">
              💡 المهارات اللي رصدها الـ AI من الـ CV
            </h3>
            <div className="flex flex-wrap gap-2">
              {app.ai_extracted_skills.map((s, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold font-cairo"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Pipeline + Notes */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Status pipeline */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-3 font-cairo">
              🔄 المسار الوظيفي
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((st) => {
                const isActive = app.status === st;
                const action = updateApplicationStatus.bind(null, appId, st, here);
                return (
                  <form key={st} action={action}>
                    <button
                      type="submit"
                      className={`w-full px-3 py-2 rounded-lg text-xs font-bold transition font-cairo border ${
                        isActive
                          ? `${STATUS_CLASSES[st]} ring-2 ring-offset-1 ring-current`
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {STATUS_LABELS_AR[st]}
                    </button>
                  </form>
                );
              })}
            </div>
          </div>

          {/* HR Notes + Interview date */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-3 font-cairo">
              📝 ملاحظات الـ HR
            </h3>
            <form action={saveNotesAction} className="space-y-3">
              <div>
                <label htmlFor="interview_at" className="block text-xs text-slate-500 mb-1 font-cairo">
                  موعد المقابلة (اختياري)
                </label>
                <input
                  id="interview_at"
                  name="interview_at"
                  type="datetime-local"
                  defaultValue={app.interview_at ? app.interview_at.slice(0, 16) : ""}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-sm"
                />
              </div>
              <div>
                <label htmlFor="hr_notes" className="block text-xs text-slate-500 mb-1 font-cairo">
                  ملاحظات
                </label>
                <textarea
                  id="hr_notes"
                  name="hr_notes"
                  rows={4}
                  defaultValue={app.hr_notes ?? ""}
                  placeholder="انطباع المقابلة، نقاط متابعة، إلخ..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-sm font-cairo resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 transition font-cairo"
              >
                حفظ الملاحظات
              </button>
            </form>
          </div>
        </div>

        {/* CV text + cover letter (collapsed) */}
        <details className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6">
          <summary className="px-6 py-4 cursor-pointer font-bold font-cairo text-slate-800 hover:bg-slate-50 transition">
            📄 عرض الـ CV الأصلي
          </summary>
          <div className="px-6 pb-6 space-y-4">
            {app.cv_text && (
              <pre className="whitespace-pre-wrap text-xs text-slate-700 leading-relaxed font-mono bg-slate-50 p-4 rounded-lg border border-slate-100">
                {app.cv_text}
              </pre>
            )}
            {app.cover_letter && (
              <div>
                <h4 className="font-bold text-slate-800 mb-2 font-cairo">خطاب التقديم</h4>
                <p className="whitespace-pre-wrap text-sm text-slate-700 font-cairo leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
                  {app.cover_letter}
                </p>
              </div>
            )}
          </div>
        </details>

        {/* Metadata + danger */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 text-xs text-slate-400 font-cairo">
          <div>
            تقدم في {new Date(app.applied_at).toLocaleString("ar-EG")}
            {app.ai_model && ` · AI: ${app.ai_model}`}
            {` · المصدر: ${app.source}`}
          </div>
          <form action={deleteAction}>
            <button className="text-red-500 hover:text-red-700 font-cairo">
              🗑 حذف المرشح
            </button>
          </form>
        </div>

        {/* Expected salary footer */}
        {cand?.expected_salary && (
          <div className="mt-4 text-center text-sm text-slate-500 font-cairo">
            الراتب المتوقع للمرشح: <strong className="text-slate-700">{formatEGP(cand.expected_salary)}</strong>
          </div>
        )}
      </div>
    </main>
  );
}
