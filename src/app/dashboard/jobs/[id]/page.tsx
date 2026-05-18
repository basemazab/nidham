import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { deleteJob, changeJobStatus } from "../actions";
import {
  STATUS_LABELS_AR,
  STATUS_CLASSES,
  RECOMMENDATION_LABELS_AR,
  RECOMMENDATION_CLASSES,
  type ApplicationStatus,
  type AiRecommendation,
} from "@/lib/recruitment";
import { CopyButton } from "@/components/copy-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { AISourcingPanel } from "@/components/ai-sourcing-panel";
import { headers } from "next/headers";

type PageProps = {
  params: Promise<{ id: string }>;
};

type Job = {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
  requirements: string | null;
  responsibilities: string | null;
  job_type: string;
  location: string | null;
  remote_ok: boolean;
  salary_min: number | null;
  salary_max: number | null;
  experience_years_min: number | null;
  status: "draft" | "open" | "closed" | "filled" | "cancelled";
  is_public: boolean;
  slug: string | null;
  posted_at: string | null;
};

type Application = {
  id: string;
  status: ApplicationStatus;
  ai_score: number | null;
  ai_recommendation: AiRecommendation | null;
  ai_summary: string | null;
  ai_analyzed_at: string | null;
  ai_error: string | null;
  applied_at: string;
  candidates: {
    full_name: string;
    current_title: string | null;
    years_experience: number | null;
    location: string | null;
  } | null;
};

const JOB_STATUS_LABELS: Record<Job["status"], string> = {
  draft: "مسودة",
  open: "مفتوحة",
  closed: "مغلقة",
  filled: "تم التعيين",
  cancelled: "ملغية",
};

function formatEGPRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return "—";
  const fmt = (n: number) =>
    n.toLocaleString("ar-EG", { maximumFractionDigits: 0 });
  if (min !== null && max !== null) return `${fmt(min)} – ${fmt(max)} ج`;
  if (min !== null) return `من ${fmt(min)} ج`;
  return `حتى ${fmt(max!)} ج`;
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Scope applications list to caller's company.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [jobRes, appsRes] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).single<Job>(),
    supabase
      .from("applications")
      .select(
        `id, status, ai_score, ai_recommendation, ai_summary, ai_analyzed_at, ai_error, applied_at,
         candidates(full_name, current_title, years_experience, location)`,
      )
      .eq("company_id", callerCompanyId)
      .eq("job_id", id)
      .order("ai_score", { ascending: false, nullsFirst: false })
      .returns<Application[]>(),
  ]);

  if (!jobRes.data) notFound();
  const job = jobRes.data;
  const apps = appsRes.data ?? [];

  // Build the public URL when this job is published
  let publicUrl: string | null = null;
  if (job.is_public && job.status === "open" && job.slug) {
    const h = await headers();
    const host = h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    publicUrl = `${proto}://${host}/jobs/${job.slug}`;
  }

  // Funnel stats
  const counts = apps.reduce(
    (acc, a) => {
      acc.total++;
      if (a.status === "new" || a.status === "reviewing") acc.pending++;
      if (a.status === "shortlisted" || a.status === "interview" || a.status === "offer") acc.shortlisted++;
      if (a.status === "hired") acc.hired++;
      if (a.status === "rejected") acc.rejected++;
      return acc;
    },
    { total: 0, pending: 0, shortlisted: 0, hired: 0, rejected: 0 },
  );

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard/jobs" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع لقائمة الوظائف
          </Link>
        </div>

        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-black font-cairo text-slate-800">{job.title}</h1>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 font-cairo">
                {JOB_STATUS_LABELS[job.status]}
              </span>
            </div>
            <p className="text-sm text-slate-500 font-cairo flex flex-wrap gap-x-3 gap-y-1">
              {job.department && <span>📂 {job.department}</span>}
              {job.location && <span>📍 {job.location}</span>}
              {typeof job.experience_years_min === "number" && job.experience_years_min > 0 && (
                <span>⏱ {job.experience_years_min}+ سنين خبرة</span>
              )}
              <span>💰 {formatEGPRange(job.salary_min, job.salary_max)}</span>
              {job.remote_ok && <span>🌐 Remote متاح</span>}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/jobs/${id}/applications/new`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-sm shadow-md hover:shadow-lg transition font-cairo"
            >
              <span>+</span> إضافة مرشح
            </Link>
            <Link
              href={`/dashboard/jobs/${id}/edit`}
              className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition font-cairo"
            >
              تعديل
            </Link>
            {job.status === "open" && (
              <form action={async () => { "use server"; await changeJobStatus(id, "closed"); }}>
                <ConfirmSubmitButton
                  label="إغلاق"
                  message={`هتقفل الوظيفة "${job.title}". مش هيقدر حد يقدّم عليها من صفحة الـ public بعد الإغلاق.`}
                  confirmLabel="نعم اقفلها"
                  className="px-4 py-2 rounded-lg border border-amber-200 text-amber-700 font-bold text-sm hover:bg-amber-50 transition font-cairo cursor-pointer"
                />
              </form>
            )}
            {job.status === "closed" && (
              <form action={async () => { "use server"; await changeJobStatus(id, "open"); }}>
                <ConfirmSubmitButton
                  label="إعادة فتح"
                  message={`هتفتح الوظيفة "${job.title}" تاني، وهتظهر للمتقدمين في صفحة الوظائف العامة.`}
                  confirmLabel="نعم افتحها"
                  className="px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 font-bold text-sm hover:bg-emerald-50 transition font-cairo cursor-pointer"
                />
              </form>
            )}
            <form action={async () => { "use server"; await deleteJob(id); }}>
              <ConfirmSubmitButton
                label="حذف"
                message={`هتمسح الوظيفة "${job.title}" وكل المرشحين المرتبطين بيها. مفيش رجوع.`}
                confirmLabel="نعم احذف"
                className="px-4 py-2 rounded-lg border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 transition font-cairo cursor-pointer"
              />
            </form>
          </div>
        </header>

        {/* Public URL banner */}
        {publicUrl && (
          <div className="mb-6 bg-gradient-to-l from-cyan-50 to-emerald-50 border-2 border-brand-cyan/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-cyan-700 mb-1 font-cairo">
                ✦ الوظيفة منشورة على بورتال نِظام
              </div>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-slate-700 hover:text-brand-cyan-dark truncate block"
                dir="ltr"
              >
                {publicUrl}
              </a>
            </div>
            <CopyButton
              text={publicUrl}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-cyan-200 text-cyan-700 font-bold text-xs hover:bg-cyan-50 transition font-cairo"
              copiedClassName="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs font-cairo"
            />
          </div>
        )}

        {/* Funnel cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <FunnelCard label="المتقدمين" value={counts.total} color="slate" />
          <FunnelCard label="تحت المراجعة" value={counts.pending} color="amber" />
          <FunnelCard label="قائمة قصيرة" value={counts.shortlisted} color="cyan" />
          <FunnelCard label="تم التعيين" value={counts.hired} color="emerald" />
          <FunnelCard label="مرفوضين" value={counts.rejected} color="red" />
        </div>

        {/* AI sourcing tools -- match candidates / boolean search / outreach */}
        <div className="mb-6">
          <AISourcingPanel jobId={id} />
        </div>

        {/* Job description (collapsible look) */}
        {(job.description || job.requirements || job.responsibilities) && (
          <details className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 overflow-hidden">
            <summary className="px-6 py-4 cursor-pointer font-bold font-cairo text-slate-800 hover:bg-slate-50 transition">
              📋 وصف الوظيفة والمتطلبات
            </summary>
            <div className="px-6 pb-6 space-y-4 text-sm font-cairo text-slate-700">
              {job.description && (
                <Section title="نظرة عامة" text={job.description} />
              )}
              {job.requirements && (
                <Section title="المتطلبات" text={job.requirements} />
              )}
              {job.responsibilities && (
                <Section title="المسؤوليات" text={job.responsibilities} />
              )}
            </div>
          </details>
        )}

        {/* Applicants table */}
        <h2 className="text-xl font-black font-cairo text-slate-800 mb-3">
          المتقدمين <span className="text-sm font-normal text-slate-400">— مرتبين بـ AI Score</span>
        </h2>

        {apps.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-12 text-center">
            <div className="text-5xl mb-3">📄</div>
            <p className="text-slate-500 font-cairo mb-4">مفيش متقدمين لسه للوظيفة دي.</p>
            <Link
              href={`/dashboard/jobs/${id}/applications/new`}
              className="inline-block px-5 py-2.5 rounded-lg bg-brand-cyan-dark text-white font-bold text-sm hover:bg-brand-cyan transition font-cairo"
            >
              + إضافة أول مرشح
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {apps.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/jobs/${id}/applications/${a.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-slate-50 transition"
                  >
                    {/* Score circle */}
                    <ScoreCircle score={a.ai_score} hasError={!!a.ai_error} />

                    {/* Identity + summary */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-bold text-slate-800 font-cairo">
                          {a.candidates?.full_name ?? "—"}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CLASSES[a.status]} font-cairo`}
                        >
                          {STATUS_LABELS_AR[a.status]}
                        </span>
                        {a.ai_recommendation && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RECOMMENDATION_CLASSES[a.ai_recommendation]} font-cairo`}
                          >
                            {RECOMMENDATION_LABELS_AR[a.ai_recommendation]}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-cairo">
                        {a.candidates?.current_title ?? "—"}
                        {typeof a.candidates?.years_experience === "number" &&
                          ` · ${a.candidates.years_experience} سنين خبرة`}
                        {a.candidates?.location && ` · ${a.candidates.location}`}
                      </div>
                      {a.ai_summary && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2 font-cairo">
                          {a.ai_summary}
                        </p>
                      )}
                      {a.ai_error && !a.ai_recommendation && (
                        <p className="text-xs text-amber-700 mt-1 font-cairo">
                          ⚠ التحليل فشل — افتح المرشح وحاول تاني
                        </p>
                      )}
                    </div>

                    <span className="text-xs text-slate-400 font-cairo whitespace-nowrap">
                      {new Date(a.applied_at).toLocaleDateString("ar-EG", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function FunnelCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "slate" | "amber" | "cyan" | "emerald" | "red";
}) {
  const classes = {
    slate: "bg-white border-slate-200 text-slate-700",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    cyan: "bg-cyan-50 border-cyan-200 text-cyan-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    red: "bg-red-50 border-red-200 text-red-700",
  }[color];

  return (
    <div className={`p-4 rounded-xl border ${classes}`}>
      <div className="text-2xl font-black font-cairo">{value}</div>
      <div className="text-xs font-bold font-cairo">{label}</div>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1 font-cairo">{title}</h3>
      <p className="whitespace-pre-line text-slate-700 leading-relaxed">{text}</p>
    </div>
  );
}

function ScoreCircle({ score, hasError }: { score: number | null; hasError: boolean }) {
  if (score === null) {
    return (
      <div
        className={`shrink-0 w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center ${
          hasError
            ? "border-amber-300 bg-amber-50 text-amber-700"
            : "border-slate-200 bg-slate-50 text-slate-400"
        }`}
      >
        <span className="text-[10px] font-bold font-cairo">
          {hasError ? "—" : "..."}
        </span>
      </div>
    );
  }

  const tone =
    score >= 85
      ? "border-emerald-400 bg-emerald-50 text-emerald-700"
      : score >= 70
        ? "border-cyan-400 bg-cyan-50 text-cyan-700"
        : score >= 50
          ? "border-amber-400 bg-amber-50 text-amber-700"
          : "border-red-300 bg-red-50 text-red-700";

  return (
    <div
      className={`shrink-0 w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center font-cairo ${tone}`}
    >
      <span className="text-lg font-black leading-none">{score}</span>
      <span className="text-[9px] font-bold opacity-70">Score</span>
    </div>
  );
}
