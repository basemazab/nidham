import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";

type PublicJob = {
  id: string;
  company_id: string;
  title: string;
  department: string | null;
  job_type: string;
  location: string | null;
  remote_ok: boolean;
  salary_min: number | null;
  salary_max: number | null;
  experience_years_min: number | null;
  slug: string | null;
  posted_at: string | null;
};

type Company = { id: string; name: string };

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

function timeAgoArabic(iso: string | null): string {
  if (!iso) return "";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const minutes = Math.floor((now - then) / 60000);
  if (minutes < 1) return "دلوقتي";
  if (minutes < 60) return `من ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `من ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "إمبارح";
  if (days < 30) return `من ${days} يوم`;
  const months = Math.floor(days / 30);
  if (months < 12) return `من ${months} شهر`;
  return `من ${Math.floor(months / 12)} سنة`;
}

export const dynamic = "force-dynamic"; // always fresh — new jobs surface immediately

export default async function PublicJobsPage() {
  const supabase = createPublicClient();

  const { data: jobs } = await supabase
    .from("public_jobs")
    .select("*")
    .order("posted_at", { ascending: false })
    .returns<PublicJob[]>();

  const list = jobs ?? [];

  // Pull the company name for each job in one round-trip
  const companyIds = Array.from(new Set(list.map((j) => j.company_id)));
  const companyMap = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .in("id", companyIds)
      .returns<Company[]>();
    for (const c of companies ?? []) companyMap.set(c.id, c.name);
  }

  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-[calc(100vh-65px)]">
      {/* Hero */}
      <section className="bg-gradient-to-l from-brand-navy via-brand-navy-light to-brand-navy text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-black font-cairo mb-2">
            وظائف مختارة لمستقبلك
          </h1>
          <p className="text-cyan-100 font-cairo text-sm sm:text-base max-w-2xl">
            فرص عمل في شركات مصرية، مع فرز ذكي بالـ AI يحلل سيرتك الذاتية ويوصل
            ملفك للشركة بصورة احترافية.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-cyan-200 font-cairo">
            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20">
              ✦ فرز بالذكاء الاصطناعي
            </span>
            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20">
              📄 ارفع PDF أو الصق نص
            </span>
            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20">
              🇪🇬 شركات مصرية
            </span>
          </div>
        </div>
      </section>

      {/* Jobs list */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-black font-cairo text-slate-800">
            الوظائف المتاحة{" "}
            <span className="text-sm font-normal text-slate-400">
              ({list.length})
            </span>
          </h2>
        </div>

        {list.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 text-center">
            <div className="text-5xl mb-3">📭</div>
            <h3 className="text-lg font-bold font-cairo text-slate-700 mb-2">
              مفيش وظائف منشورة دلوقتي
            </h3>
            <p className="text-slate-500 font-cairo text-sm">
              ارجع تاني قريب — شركات جديدة بتنزل وظائف يوميًا.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {list.map((j) => {
              const company = companyMap.get(j.company_id) ?? "—";
              const salary = formatEGPRange(j.salary_min, j.salary_max);
              return (
                <Link
                  key={j.id}
                  href={`/jobs/${j.slug}`}
                  className="block bg-white rounded-2xl border border-slate-200 p-5 hover:border-brand-cyan/40 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold font-cairo text-slate-800 group-hover:text-brand-cyan-dark transition leading-tight">
                        {j.title}
                      </h3>
                      <p className="text-sm text-slate-500 font-cairo mt-1">
                        🏢 {company}
                        {j.department && ` · ${j.department}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-400 font-cairo">
                      {timeAgoArabic(j.posted_at)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3 text-xs font-cairo">
                    <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                      {JOB_TYPE_LABELS[j.job_type] ?? j.job_type}
                    </span>
                    {j.location && (
                      <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                        📍 {j.location}
                      </span>
                    )}
                    {j.remote_ok && (
                      <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">
                        🌐 Remote
                      </span>
                    )}
                    {typeof j.experience_years_min === "number" &&
                      j.experience_years_min > 0 && (
                        <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                          ⏱ {j.experience_years_min}+ سنين
                        </span>
                      )}
                    {salary && (
                      <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-800">
                        💰 {salary}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
