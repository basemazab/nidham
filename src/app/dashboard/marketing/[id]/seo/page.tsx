// ============================================================================
// /dashboard/marketing/[id]/seo — SEO Master (keyword strategy)
// ============================================================================

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";
import { runSeoMaster } from "../../actions";
import { AiErrorBanner } from "@/components/ai-error-banner";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generated?: string; error?: string }>;
};

type Keyword = {
  id: string;
  keyword: string;
  intent: string | null;
  search_volume: number | null;
  difficulty: number | null;
  content_type: string | null;
  suggested_title: string | null;
  content_outline: string | null;
  priority: number;
  status: string;
};

const INTENT_LABEL: Record<string, { label: string; cls: string }> = {
  informational: {
    label: "معلومات",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
  },
  commercial: {
    label: "بحث شرائي",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
  },
  transactional: {
    label: "شراء",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  navigational: {
    label: "ملاحة",
    cls: "bg-slate-50 text-slate-700 border-slate-200",
  },
};

const CONTENT_TYPE_LABEL: Record<string, string> = {
  blog_post: "مقال",
  product_page: "صفحة منتج",
  landing_page: "صفحة هبوط",
  category_page: "صفحة فئة",
  faq: "أسئلة شائعة",
  guide: "دليل شامل",
  comparison: "مقارنة",
};

export default async function SeoPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await canUseFeature("marketing_studio"))) {
    return <UpgradeRequired feature="marketing_studio" />;
  }

  // Scope keywords to caller's company.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [projectRes, keywordsRes] = await Promise.all([
    supabase
      .from("marketing_projects")
      .select("id, name, ai_analysis")
      .eq("id", id)
      .single<{
        id: string;
        name: string;
        ai_analysis: Record<string, unknown> | null;
      }>(),
    supabase
      .from("marketing_keywords")
      .select("*")
      .eq("company_id", callerCompanyId)
      .eq("project_id", id)
      .order("priority")
      .returns<Keyword[]>(),
  ]);

  if (!projectRes.data) notFound();
  const project = projectRes.data;
  const keywords = keywordsRes.data ?? [];
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  const seoStrategy = (project.ai_analysis as
    | { seo_strategy?: string; quick_wins?: string[]; long_term_focus?: string[] }
    | null) ?? null;

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link
            href={`/dashboard/marketing/${id}`}
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← مشروع {project.name}
          </Link>
        </div>

        <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold mb-2 font-cairo">
              🔍 ماستر SEO
            </div>
            <h1 className="text-2xl md:text-3xl font-black font-cairo text-slate-800 mb-1">
              استراتيجية محركات البحث
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              {keywords.length} keyword · استراتيجية محتوى للسوق المصري
            </p>
          </div>
          <form action={runSeoMaster}>
            <input type="hidden" name="project_id" value={id} />
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm font-cairo shadow-md hover:shadow-lg transition"
            >
              <span>🔍</span>
              <span>
                {keywords.length === 0 ? "ابحث عن Keywords" : "أعد التحليل"}
              </span>
            </button>
          </form>
        </header>

        {sp.generated && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-cairo text-sm">
            ✅ تم بناء استراتيجية SEO كاملة. ركّز على Quick Wins أولاً.
          </div>
        )}
        <AiErrorBanner message={errorMsg} />

        {/* Strategy summary */}
        {seoStrategy?.seo_strategy && (
          <section className="mb-5 p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-cyan-50 border-2 border-emerald-200">
            <h2 className="font-black font-cairo text-slate-800 mb-2">
              ✦ استراتيجية المحتوى
            </h2>
            <p className="text-sm text-slate-700 font-cairo leading-relaxed mb-4 whitespace-pre-line">
              {seoStrategy.seo_strategy}
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              {seoStrategy.quick_wins && seoStrategy.quick_wins.length > 0 && (
                <div className="bg-white rounded-xl border border-emerald-300 p-3">
                  <div className="text-xs font-black text-emerald-800 mb-2 font-cairo">
                    🎯 Quick Wins (نتايج في ~30 يوم)
                  </div>
                  <ul className="text-sm text-slate-700 font-cairo space-y-1">
                    {seoStrategy.quick_wins.map((q, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 shrink-0">▶</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {seoStrategy.long_term_focus &&
                seoStrategy.long_term_focus.length > 0 && (
                  <div className="bg-white rounded-xl border border-amber-300 p-3">
                    <div className="text-xs font-black text-amber-800 mb-2 font-cairo">
                      🌳 طويل المدى (3-6 شهور)
                    </div>
                    <ul className="text-sm text-slate-700 font-cairo space-y-1">
                      {seoStrategy.long_term_focus.map((q, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-500 shrink-0">▶</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          </section>
        )}

        {/* Keywords list */}
        {keywords.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-sm text-slate-500 font-cairo">
              مفيش keywords لسه. اضغط &quot;ابحث عن Keywords&quot; فوق.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-right text-sm font-cairo min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    الكلمة المفتاحية
                  </th>
                  <th className="px-3 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    النية
                  </th>
                  <th className="px-3 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    حجم بحث
                  </th>
                  <th className="px-3 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    صعوبة
                  </th>
                  <th className="px-3 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    نوع محتوى
                  </th>
                  <th className="px-3 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    أولوية
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {keywords.map((k) => {
                  const intent = INTENT_LABEL[k.intent ?? ""] ?? null;
                  return (
                    <tr key={k.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-800">
                          {k.keyword}
                        </div>
                        {k.suggested_title && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            ✦ {k.suggested_title}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {intent ? (
                          <span
                            className={`inline-block text-[10px] px-2 py-0.5 rounded-full border font-bold ${intent.cls}`}
                          >
                            {intent.label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs" dir="ltr">
                        {k.search_volume ? k.search_volume.toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {k.difficulty !== null ? (
                          <DifficultyBar value={k.difficulty} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">
                        {CONTENT_TYPE_LABEL[k.content_type ?? ""] ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-block w-7 h-7 rounded-full text-xs font-black text-white flex items-center justify-center ${
                            k.priority <= 3
                              ? "bg-emerald-500"
                              : k.priority <= 6
                                ? "bg-amber-500"
                                : "bg-slate-400"
                          }`}
                        >
                          {k.priority}
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

function DifficultyBar({ value }: { value: number }) {
  const color =
    value < 30
      ? "bg-emerald-500"
      : value < 60
        ? "bg-amber-500"
        : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700">{value}</span>
    </div>
  );
}
