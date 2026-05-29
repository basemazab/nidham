import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HELP_CATEGORIES, getArticleBySlug, getRelatedArticles } from "@/lib/help-content";

export const dynamic = "force-dynamic";

function renderBody(body: string): string {
  let html = body
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-black font-cairo text-slate-800 mt-6 mb-2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold font-cairo text-slate-800 mt-4 mb-1">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-slate-800">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-100 text-sky-700 text-[11px] font-mono">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="text-sm text-slate-700 font-cairo leading-relaxed mr-4 list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="text-sm text-slate-700 font-cairo leading-relaxed mb-2">')
    .replace(/\|(.+)\|/g, (match) => {
      if (match.includes("---")) return '<hr class="my-2 border-slate-200" />';
      const cells = match.split("|").filter(Boolean).map((c) => c.trim());
      return `<td class="px-3 py-1.5 text-xs font-cairo text-slate-700 border border-slate-200">${cells.join("</td><td class='px-3 py-1.5 text-xs font-cairo text-slate-700 border border-slate-200'>")}</td>`;
    });

  return `<p class="text-sm text-slate-700 font-cairo leading-relaxed mb-2">${html}</p>`;
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string; articleSlug: string }>;
}) {
  const { slug, articleSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const category = HELP_CATEGORIES.find((c) => c.slug === slug);
  if (!category) notFound();

  const article = getArticleBySlug(articleSlug);
  if (!article || article.category !== slug) notFound();

  const related = getRelatedArticles(article);

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-sky-50/20 min-h-screen" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-500 font-cairo">
          <Link href="/dashboard/academy" className="hover:text-sky-700">الأكاديمية</Link>
          <span>/</span>
          <Link href={`/dashboard/academy/${slug}`} className="hover:text-sky-700">{category.title}</Link>
          <span>/</span>
          <span className="text-slate-700">{article.title}</span>
        </div>

        <article className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <header className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{category.icon}</span>
              <div>
                <h1 className="text-2xl md:text-3xl font-black font-cairo text-slate-800">
                  {article.title}
                </h1>
                <p className="text-sm text-slate-500 font-cairo mt-1">
                  {article.excerpt}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-400 font-cairo flex-wrap">
              <span>⏱ {article.estimatedReadMin} دقيقة قراءة</span>
              <span>📅 آخر تحديث: {article.lastUpdated}</span>
              {article.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-200">
                  {tag}
                </span>
              ))}
            </div>
          </header>

          <div
            className="prose prose-slate max-w-none [&_table]:w-full [&_table]:border-collapse [&_table]:mb-4 [&_th]:bg-slate-50 [&_th]:text-xs [&_th]:font-bold [&_th]:text-slate-600 [&_th]:px-3 [&_th]:py-2 [&_th]:border [&_th]:border-slate-200 [&_tr]:border [&_tr]:border-slate-200 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderBody(article.body) }}
          />

          {/* Related articles */}
          {related.length > 0 && (
            <section className="mt-8 pt-6 border-t border-slate-200">
              <h2 className="text-base font-black font-cairo text-slate-800 mb-3">
                📚 مقالات ذات صلة
              </h2>
              <div className="grid md:grid-cols-2 gap-3">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/dashboard/academy/${r.category}/${r.slug}`}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-sky-300 transition"
                  >
                    <div className="text-sm font-bold text-slate-800 font-cairo mb-1">{r.title}</div>
                    <div className="text-[11px] text-slate-500 font-cairo">{r.excerpt}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </div>
    </main>
  );
}
