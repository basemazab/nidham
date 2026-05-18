import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";

type Job = {
  id: string;
  title: string;
  department: string | null;
  job_type: string;
  location: string | null;
  status: "draft" | "open" | "closed" | "filled" | "cancelled";
  experience_years_min: number | null;
  salary_min: number | null;
  salary_max: number | null;
  posted_at: string | null;
  created_at: string;
};

type AppRow = { job_id: string; ai_score: number | null; status: string };

const STATUS_LABELS: Record<Job["status"], { text: string; classes: string }> = {
  draft: { text: "مسودة", classes: "bg-slate-100 text-slate-600 border-slate-200" },
  open: { text: "مفتوح", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  closed: { text: "مغلق", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  filled: { text: "تم التعيين", classes: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  cancelled: { text: "ملغي", classes: "bg-red-50 text-red-600 border-red-200" },
};

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: "دوام كامل",
  part_time: "دوام جزئي",
  contract: "عقد",
  internship: "تدريب",
  remote: "Remote",
};

// Force the page to revalidate on every request. Without this, Next.js
// caches the row list + counters between requests, so newly-added rows
// from server actions or import flows take minutes to appear.
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Scope to caller's company — super-admin sessions can otherwise
  // read jobs/applications across every tenant.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [jobsRes, appsRes] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, title, department, job_type, location, status, experience_years_min, salary_min, salary_max, posted_at, created_at",
      )
      .eq("company_id", callerCompanyId)
      .order("created_at", { ascending: false })
      .returns<Job[]>(),
    supabase
      .from("applications")
      .select("job_id, ai_score, status")
      .eq("company_id", callerCompanyId)
      .returns<AppRow[]>(),
  ]);

  const jobs = jobsRes.data ?? [];
  const apps = appsRes.data ?? [];

  // Per-job aggregates
  const stats = new Map<
    string,
    { total: number; reviewing: number; shortlisted: number; topScore: number | null }
  >();
  for (const a of apps) {
    const s = stats.get(a.job_id) ?? {
      total: 0,
      reviewing: 0,
      shortlisted: 0,
      topScore: null as number | null,
    };
    s.total++;
    if (a.status === "reviewing" || a.status === "new") s.reviewing++;
    if (a.status === "shortlisted" || a.status === "interview" || a.status === "offer") s.shortlisted++;
    if (typeof a.ai_score === "number") {
      s.topScore = s.topScore === null ? a.ai_score : Math.max(s.topScore, a.ai_score);
    }
    stats.set(a.job_id, s);
  }

  const openJobs = jobs.filter((j) => j.status === "open").length;
  const totalApplicants = apps.length;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              التوظيف الذكي
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              {jobs.length === 0
                ? "انشر أول وظيفة شاغرة وخلي الـ AI يفرز المتقدمين"
                : `${jobs.length} وظيفة · ${openJobs} مفتوحة · ${totalApplicants} متقدم`}
              {" · "}
              <span className="text-brand-cyan-dark font-bold">
                Gemini AI Screening ✦
              </span>
            </p>
          </div>

          <Link
            href="/dashboard/jobs/new"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all font-cairo"
          >
            <span className="text-lg leading-none">+</span>
            <span>وظيفة جديدة</span>
          </Link>
        </header>

        {jobs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">
              مفيش وظائف لسه
            </h2>
            <p className="text-slate-500 mb-6 font-cairo leading-relaxed max-w-md mx-auto">
              انشر وظيفة، الصق السيرة الذاتية لكل مرشح، والـ AI هيقيّمه ويرتّب
              المتقدمين بناءً على مدى مطابقتهم للوظيفة — مع توصية واضحة لكل واحد.
            </p>
            <Link
              href="/dashboard/jobs/new"
              className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo"
            >
              انشر أول وظيفة
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {jobs.map((j) => {
              const s = stats.get(j.id) ?? {
                total: 0,
                reviewing: 0,
                shortlisted: 0,
                topScore: null,
              };
              const status = STATUS_LABELS[j.status];
              return (
                <Link
                  key={j.id}
                  href={`/dashboard/jobs/${j.id}`}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md hover:border-brand-cyan/30 transition group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-lg font-bold font-cairo text-slate-800 group-hover:text-brand-cyan-dark transition">
                      {j.title}
                    </h3>
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${status.classes} font-cairo whitespace-nowrap`}
                    >
                      {status.text}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 mb-3 font-cairo space-y-0.5">
                    {j.department && <div>📂 {j.department}</div>}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>💼 {JOB_TYPE_LABELS[j.job_type] ?? j.job_type}</span>
                      {j.location && <span>📍 {j.location}</span>}
                      {typeof j.experience_years_min === "number" &&
                        j.experience_years_min > 0 && (
                          <span>⏱ {j.experience_years_min}+ سنين خبرة</span>
                        )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center mt-3 pt-3 border-t border-slate-100">
                    <Mini label="متقدمين" value={String(s.total)} />
                    <Mini label="مرشحين" value={String(s.shortlisted)} accent="cyan" />
                    <Mini
                      label="أعلى Score"
                      value={s.topScore === null ? "—" : String(s.topScore)}
                      accent={
                        s.topScore !== null && s.topScore >= 70 ? "emerald" : "slate"
                      }
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Mini({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "cyan" | "emerald" | "slate";
}) {
  const color =
    accent === "cyan"
      ? "text-brand-cyan-dark"
      : accent === "emerald"
        ? "text-emerald-700"
        : "text-slate-700";
  return (
    <div>
      <div className={`text-base font-black font-cairo ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-400 font-cairo">{label}</div>
    </div>
  );
}
