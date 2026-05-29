import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HELP_CATEGORIES, getArticlesByCategory } from "@/lib/help-content";

export const dynamic = "force-dynamic";

const CATEGORY_COLORS: Record<string, string> = {
  cyan: "from-cyan-50 to-white border-cyan-200 hover:border-cyan-400 text-cyan-700",
  blue: "from-blue-50 to-white border-blue-200 hover:border-blue-400 text-blue-700",
  amber: "from-amber-50 to-white border-amber-200 hover:border-amber-400 text-amber-700",
  emerald: "from-emerald-50 to-white border-emerald-200 hover:border-emerald-400 text-emerald-700",
  violet: "from-violet-50 to-white border-violet-200 hover:border-violet-400 text-violet-700",
  rose: "from-rose-50 to-white border-rose-200 hover:border-rose-400 text-rose-700",
  slate: "from-slate-50 to-white border-slate-200 hover:border-slate-400 text-slate-700",
};

export default async function AcademyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const totalArticles = HELP_CATEGORIES.reduce(
    (acc, cat) => acc + getArticlesByCategory(cat.slug).length,
    0,
  );

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-sky-50/20 min-h-screen" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 text-sky-700 text-xs font-bold mb-2 font-cairo">
            🎓 أكاديمية Nidham
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            أكاديمية Nidham
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
            {totalArticles} مقالة تعليمية — من البداية السريعة لحل المشاكل التقنية.
            دليل كامل لاستخدام Nidham HR خطوة بخطوة.
          </p>
        </header>

        {/* Search bar */}
        <div className="mb-8">
          <form action="/dashboard/academy/search" method="get" className="relative">
            <input
              type="text"
              name="q"
              placeholder="ابحث في الأكاديمية..."
              className="w-full px-5 py-3.5 pr-12 rounded-2xl border-2 border-slate-200 bg-white text-sm font-cairo focus:border-sky-400 focus:ring-4 focus:ring-sky-100 outline-none transition-all shadow-sm"
            />
            <button
              type="submit"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-600"
            >
              🔍
            </button>
          </form>
        </div>

        {/* Categories grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {HELP_CATEGORIES.map((cat) => {
            const articles = getArticlesByCategory(cat.slug);
            const color = CATEGORY_COLORS[cat.color] || CATEGORY_COLORS.slate;
            return (
              <Link
                key={cat.slug}
                href={`/dashboard/academy/${cat.slug}`}
                className={`group bg-white border-2 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all ${color}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-50 to-indigo-50 border border-sky-200 flex items-center justify-center text-2xl">
                    {cat.icon}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-200 font-bold font-cairo">
                    {articles.length} مقال
                  </span>
                </div>
                <h3 className="text-base font-black font-cairo text-slate-800 mb-1 group-hover:text-sky-700 transition">
                  {cat.title}
                </h3>
                <p className="text-[11px] text-slate-500 font-cairo leading-relaxed line-clamp-2">
                  {cat.description}
                </p>
                <div className="mt-4 space-y-1">
                  {articles.slice(0, 3).map((article) => (
                    <div key={article.slug} className="text-[11px] text-slate-400 font-cairo truncate">
                      • {article.title}
                    </div>
                  ))}
                  {articles.length > 3 && (
                    <div className="text-[10px] text-sky-600 font-bold font-cairo">
                      + {articles.length - 3} مقالات أخرى
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
