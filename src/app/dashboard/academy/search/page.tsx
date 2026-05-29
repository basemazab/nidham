import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HELP_CATEGORIES, searchArticles } from "@/lib/help-content";
import { Suspense } from "react";

export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <Suspense fallback={<div className="text-center py-12 text-slate-400 font-cairo">جاري البحث...</div>}>
      <SearchResults searchParams={searchParams} />
    </Suspense>
  );
}

async function SearchResults({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const query = sp.q?.trim() || "";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const results = searchArticles(query);

  const catMap = new Map(HELP_CATEGORIES.map((c) => [c.slug, c]));

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-sky-50/20 min-h-screen" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Link href="/dashboard/academy" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع للأكاديمية
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-2xl font-black font-cairo text-slate-800 mb-1">
            🔍 نتائج البحث
          </h1>
          {query && (
            <p className="text-sm text-slate-500 font-cairo">
              {results.length} نتيجة لـ &quot;{query}&quot;
            </p>
          )}
        </header>

        {!query ? (
          <div className="text-center py-12 text-slate-400 font-cairo">
            اكتب كلمة للبحث في الأكاديمية
          </div>
        ) : results.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-slate-500 font-cairo">ما لقيناش نتائج لـ &quot;{query}&quot;</p>
            <p className="text-xs text-slate-400 font-cairo mt-1">جرّب كلمات تانية أو راجع التصنيفات</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((article) => {
              const cat = catMap.get(article.category);
              return (
                <Link
                  key={article.slug}
                  href={`/dashboard/academy/${article.category}/${article.slug}`}
                  className="block bg-white border border-slate-200 rounded-2xl p-4 hover:border-sky-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{cat?.icon || "📄"}</span>
                    <span className="text-[10px] text-slate-400 font-cairo">{cat?.title || article.category}</span>
                  </div>
                  <h3 className="text-base font-bold font-cairo text-slate-800 mb-1">
                    {article.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-cairo line-clamp-2">
                    {article.excerpt}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
