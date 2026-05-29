import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HELP_CATEGORIES, getArticlesByCategory } from "@/lib/help-content";

export const dynamic = "force-dynamic";

export default async function AcademyCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const category = HELP_CATEGORIES.find((c) => c.slug === slug);
  if (!category) notFound();

  const articles = getArticlesByCategory(slug);

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-sky-50/20 min-h-screen" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Link href="/dashboard/academy" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع للأكاديمية
          </Link>
        </div>

        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{category.icon}</span>
            <div>
              <h1 className="text-3xl font-black font-cairo text-slate-800">
                {category.title}
              </h1>
              <p className="text-sm text-slate-500 font-cairo">
                {category.description} · {articles.length} مقال
              </p>
            </div>
          </div>
        </header>

        {articles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-slate-400 font-cairo">لا توجد مقالات في هذا القسم بعد</p>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={`/dashboard/academy/${slug}/${article.slug}`}
                className="block bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-md transition-all"
              >
                <h3 className="text-base font-black font-cairo text-slate-800 mb-1">
                  {article.title}
                </h3>
                <p className="text-xs text-slate-500 font-cairo mb-2">
                  {article.excerpt}
                </p>
                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-cairo">
                  <span>⏱ {article.estimatedReadMin} دقيقة قراءة</span>
                  <span>📅 {article.lastUpdated}</span>
                  {article.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-200">
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
