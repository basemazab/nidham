// ============================================================================
// /dashboard/help — Help Center
// ============================================================================
//
// Categorized library of how-to articles. Search is client-side over a
// static articles array (lib/help-content.ts) so there's zero DB round-
// trip; the whole thing renders in one server pass.

import Link from "next/link";
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  getArticlesByCategory,
  searchArticles,
  type HelpCategory,
} from "@/lib/help-content";

type SearchParams = Promise<{ q?: string }>;

const COLOR_CLS: Record<
  HelpCategory["color"],
  { bg: string; border: string; text: string; hoverBorder: string }
> = {
  cyan:    { bg: "from-cyan-50",    border: "border-cyan-200",    text: "text-cyan-800",    hoverBorder: "hover:border-cyan-400" },
  amber:   { bg: "from-amber-50",   border: "border-amber-200",   text: "text-amber-800",   hoverBorder: "hover:border-amber-400" },
  emerald: { bg: "from-emerald-50", border: "border-emerald-200", text: "text-emerald-800", hoverBorder: "hover:border-emerald-400" },
  violet:  { bg: "from-violet-50",  border: "border-violet-200",  text: "text-violet-800",  hoverBorder: "hover:border-violet-400" },
  rose:    { bg: "from-rose-50",    border: "border-rose-200",    text: "text-rose-800",    hoverBorder: "hover:border-rose-400" },
  blue:    { bg: "from-blue-50",    border: "border-blue-200",    text: "text-blue-800",    hoverBorder: "hover:border-blue-400" },
  slate:   { bg: "from-slate-50",   border: "border-slate-200",   text: "text-slate-800",   hoverBorder: "hover:border-slate-400" },
};

export default async function HelpCenterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const searchResults = query ? searchArticles(query) : [];

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white min-h-screen">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-indigo-100 to-blue-100 border border-indigo-300 text-indigo-800 text-xs font-bold mb-2 font-cairo">
            📚 مركز المساعدة
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            مركز المساعدة والشروحات
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            {HELP_ARTICLES.length} مقالة · {HELP_CATEGORIES.length} تصنيف ·
            دلائل خطوة بخطوة لكل feature في النظام
          </p>
        </header>

        {/* Search */}
        <form
          action="/dashboard/help"
          className="bg-white border-2 border-indigo-200 rounded-2xl p-4 mb-6 flex items-center gap-3"
        >
          <span className="text-2xl">🔍</span>
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="ابحث عن أي حاجة... (مثلاً: 'GPS', 'تأمينات', 'AI', 'landing page')"
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-400 outline-none text-sm font-cairo"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm font-cairo"
          >
            بحث
          </button>
          {query && (
            <Link
              href="/dashboard/help"
              className="text-xs text-slate-500 hover:text-rose-600 font-cairo"
            >
              امسح
            </Link>
          )}
        </form>

        {/* Search results */}
        {query && (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-slate-700 mb-3 font-cairo">
              نتائج البحث عن &quot;{query}&quot; ({searchResults.length})
            </h2>
            {searchResults.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                <div className="text-5xl mb-3">🤷‍♂️</div>
                <p className="text-sm text-slate-500 font-cairo">
                  مفيش نتيجة. جرّب كلمات مفتاحية تانية.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((a) => (
                  <ArticleListItem key={a.slug} article={a} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Categories grid */}
        {!query && (
          <>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 font-cairo">
              التصنيفات
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {HELP_CATEGORIES.map((c) => {
                const articles = getArticlesByCategory(c.slug);
                const cls = COLOR_CLS[c.color];
                return (
                  <Link
                    key={c.slug}
                    href={`#cat-${c.slug}`}
                    className={`group bg-gradient-to-br ${cls.bg} to-white border-2 ${cls.border} ${cls.hoverBorder} rounded-2xl p-5 transition hover:shadow-lg hover:-translate-y-0.5`}
                  >
                    <div className="text-3xl mb-2">{c.icon}</div>
                    <h3
                      className={`text-base font-black font-cairo ${cls.text} mb-1`}
                    >
                      {c.title}
                    </h3>
                    <p className="text-xs text-slate-600 font-cairo leading-snug mb-3">
                      {c.description}
                    </p>
                    <div className="text-[11px] text-slate-500 font-cairo font-bold">
                      {articles.length} مقالة ←
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Categories sections */}
            {HELP_CATEGORIES.map((c) => {
              const articles = getArticlesByCategory(c.slug);
              if (articles.length === 0) return null;
              const cls = COLOR_CLS[c.color];
              return (
                <section key={c.slug} id={`cat-${c.slug}`} className="mb-8 scroll-mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{c.icon}</span>
                    <h2
                      className={`text-lg font-black font-cairo ${cls.text}`}
                    >
                      {c.title}
                    </h2>
                    <span className="text-xs text-slate-400 font-cairo">
                      · {articles.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {articles.map((a) => (
                      <ArticleListItem key={a.slug} article={a} />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}

        {/* Help footer / contact */}
        <section className="mt-10 p-5 bg-gradient-to-br from-emerald-50 to-cyan-50 border border-emerald-200 rounded-2xl">
          <h3 className="text-base font-black text-slate-800 mb-1 font-cairo">
            💬 محتاج مساعدة شخصية؟
          </h3>
          <p className="text-sm text-slate-600 font-cairo mb-3">
            لو ما لقيتش إجابة لسؤالك، كلّمنا واتساب على الرقم الموحد.
          </p>
          <a
            href="https://wa.me/201553641615"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm font-cairo transition"
          >
            <span>💬</span>
            <span>كلّمنا على واتساب</span>
          </a>
        </section>
      </div>
    </main>
  );
}

function ArticleListItem({
  article,
}: {
  article: (typeof HELP_ARTICLES)[number];
}) {
  return (
    <Link
      href={`/dashboard/help/${article.slug}`}
      className="block bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm rounded-xl p-4 transition group"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black font-cairo text-slate-800 group-hover:text-indigo-700 mb-1">
            {article.title}
          </h3>
          <p className="text-xs text-slate-600 font-cairo leading-relaxed">
            {article.excerpt}
          </p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[10px] text-slate-400 font-cairo">
              ⏱ {article.estimatedReadMin} د
            </span>
            {article.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 font-cairo"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="text-slate-400 group-hover:text-indigo-600 transition">
          ←
        </div>
      </div>
    </Link>
  );
}
