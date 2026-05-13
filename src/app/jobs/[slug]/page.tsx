import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createPublicClient } from "@/lib/supabase/public";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type Job = {
  id: string;
  company_id: string;
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
  slug: string;
  posted_at: string | null;
};

type Company = { name: string; industry: string | null };

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: "دوام كامل",
  part_time: "دوام جزئي",
  contract: "عقد",
  internship: "تدريب",
  remote: "Remote",
};

function formatEGPRange(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  const fmt = (n: number) =>
    n.toLocaleString("ar-EG", { maximumFractionDigits: 0 });
  if (min !== null && max !== null) return `${fmt(min)} – ${fmt(max)} ج`;
  if (min !== null) return `من ${fmt(min)} ج`;
  return `حتى ${fmt(max!)} ج`;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const supabase = createPublicClient();
  const { data: job } = await supabase
    .from("public_jobs")
    .select("title, department, location")
    .eq("slug", slug)
    .single<{ title: string; department: string | null; location: string | null }>();

  if (!job) return { title: "وظيفة — نِظام" };
  const parts = [job.title, job.department, job.location].filter(Boolean);
  return {
    title: `${parts.join(" · ")} — نِظام`,
    description: `قدم على وظيفة ${job.title} من خلال منصة نِظام`,
  };
}

export const dynamic = "force-dynamic";

export default async function PublicJobDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const supabase = createPublicClient();
  const { data: job } = await supabase
    .from("public_jobs")
    .select("*")
    .eq("slug", slug)
    .single<Job>();

  if (!job) notFound();

  // Company name
  const { data: company } = await supabase
    .from("companies")
    .select("name, industry")
    .eq("id", job.company_id)
    .single<Company>();

  const salary = formatEGPRange(job.salary_min, job.salary_max);

  // Build the canonical URL on the server for the share link
  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const canonical = `${proto}://${host}/jobs/${job.slug}`;
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(`شوف الوظيفة دي — ${job.title}\n${canonical}`)}`;

  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-[calc(100vh-65px)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Back */}
        <div className="mb-6">
          <Link
            href="/jobs"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لكل الوظائف
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 sm:p-8 mb-6">
          <h1 className="text-2xl sm:text-3xl font-black font-cairo text-slate-800 mb-2 leading-tight">
            {job.title}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 font-cairo">
            🏢 {company?.name ?? "—"}
            {company?.industry && (
              <span className="text-slate-400"> · {company.industry}</span>
            )}
          </p>

          <div className="flex flex-wrap gap-2 mt-4 text-xs font-cairo">
            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
              {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
            </span>
            {job.department && (
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
                📂 {job.department}
              </span>
            )}
            {job.location && (
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
                📍 {job.location}
              </span>
            )}
            {job.remote_ok && (
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700">
                🌐 Remote متاح
              </span>
            )}
            {typeof job.experience_years_min === "number" &&
              job.experience_years_min > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
                  ⏱ {job.experience_years_min}+ سنين خبرة
                </span>
              )}
            {salary && (
              <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 font-bold">
                💰 {salary}
              </span>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/jobs/${job.slug}/apply`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all font-cairo"
            >
              ✦ قدم دلوقتي
            </Link>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo"
            >
              📤 شارك
            </a>
          </div>
        </div>

        {/* Description sections */}
        {job.description && (
          <Section title="📋 وصف الوظيفة" text={job.description} />
        )}
        {job.requirements && (
          <Section title="✅ المتطلبات" text={job.requirements} />
        )}
        {job.responsibilities && (
          <Section title="🎯 المسؤوليات" text={job.responsibilities} />
        )}

        {/* Big apply CTA */}
        <div className="bg-gradient-to-br from-cyan-50 to-white border-2 border-brand-cyan/30 rounded-2xl p-6 sm:p-8 mt-6 text-center">
          <h3 className="text-xl font-black font-cairo text-slate-800 mb-2">
            مهتم بالفرصة دي؟
          </h3>
          <p className="text-sm text-slate-600 font-cairo mb-5 max-w-md mx-auto leading-relaxed">
            قدم في أقل من دقيقة — ارفع CV-ك أو الصق النص، والـ AI هيوصل ملفك
            للـ HR مع تقييم احترافي.
          </p>
          <Link
            href={`/jobs/${job.slug}/apply`}
            className="inline-block px-8 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition font-cairo"
          >
            ابدأ التقديم ←
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4">
      <h2 className="text-lg font-bold font-cairo text-slate-800 mb-3">
        {title}
      </h2>
      <p className="text-sm sm:text-base text-slate-700 font-cairo whitespace-pre-line leading-relaxed">
        {text}
      </p>
    </div>
  );
}
