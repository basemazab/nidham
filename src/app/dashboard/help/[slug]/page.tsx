// ============================================================================
// /dashboard/help/[slug] — Single article view
// ============================================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  HELP_CATEGORIES,
  getArticleBySlug,
  getRelatedArticles,
} from "@/lib/help-content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: "مقالة غير موجودة" };
  return {
    title: `${article.title} · Nidham Help`,
    description: article.excerpt,
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const category = HELP_CATEGORIES.find((c) => c.slug === article.category);
  const related = getRelatedArticles(article);

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white min-h-screen">
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-4 text-sm text-slate-500 font-cairo">
          <Link
            href="/dashboard/help"
            className="hover:text-indigo-700"
          >
            📚 مركز المساعدة
          </Link>
          {category && (
            <>
              <span className="mx-2">/</span>
              <Link
                href={`/dashboard/help#cat-${category.slug}`}
                className="hover:text-indigo-700"
              >
                {category.icon} {category.title}
              </Link>
            </>
          )}
        </div>

        {/* Article header */}
        <article className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <header className="mb-6 pb-5 border-b border-slate-100">
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-2 leading-tight">
              {article.title}
            </h1>
            <p className="text-base text-slate-600 font-cairo leading-relaxed mb-3">
              {article.excerpt}
            </p>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-cairo flex-wrap">
              <span>⏱ قراءة {article.estimatedReadMin} د</span>
              <span>·</span>
              <span>
                آخر تحديث:{" "}
                {new Date(article.lastUpdated).toLocaleDateString("ar-EG", {
                  dateStyle: "medium",
                })}
              </span>
              {article.tags.length > 0 && (
                <>
                  <span>·</span>
                  <div className="flex gap-1 flex-wrap">
                    {article.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </header>

          {/* Body */}
          <div className="prose-cairo text-slate-700 font-cairo leading-relaxed">
            <ArticleBody body={article.body} />
          </div>
        </article>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-black text-slate-700 mb-3 font-cairo">
              📖 مقالات متعلقة
            </h2>
            <div className="space-y-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/dashboard/help/${r.slug}`}
                  className="block bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm rounded-xl p-3 transition"
                >
                  <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-700 font-cairo">
                    {r.title}
                  </h3>
                  <p className="text-xs text-slate-600 font-cairo">
                    {r.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Bottom CTA */}
        <section className="mt-8 p-4 bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-slate-800 font-cairo">
              المقالة دي ساعدتك؟
            </h3>
            <p className="text-xs text-slate-600 font-cairo">
              لو لسه عندك سؤال، كلّمنا.
            </p>
          </div>
          <a
            href="https://wa.me/201055356622"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs font-cairo whitespace-nowrap"
          >
            💬 واتساب
          </a>
        </section>

        <div className="mt-6 text-center">
          <Link
            href="/dashboard/help"
            className="text-sm text-slate-500 hover:text-indigo-700 font-cairo"
          >
            ← رجوع لكل المقالات
          </Link>
        </div>
      </div>
    </main>
  );
}

// ============================================================================
// ArticleBody — minimal markdown renderer
// ============================================================================
// Handles:
//   ## Heading (h2 — h3 if nested)
//   **bold**
//   `inline code`
//   ```code blocks```
//   - bullet lists
//   | tables |
//   blank lines = paragraph break
// Kept tiny on purpose; no markdown library in the bundle.

function ArticleBody({ body }: { body: string }) {
  const blocks = parseBlocks(body);
  return (
    <>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </>
  );
}

type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "para"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; text: string }
  | { type: "table"; rows: string[][] };

function parseBlocks(body: string): Block[] {
  const lines = body.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Heading
    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", text: trimmed.slice(4) });
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", text: trimmed.slice(3) });
      i++;
      continue;
    }

    // Fenced code
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // closing ```
      blocks.push({ type: "code", text: codeLines.join("\n") });
      continue;
    }

    // Table — naive: lines starting with |
    if (trimmed.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i]
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        // Skip separator rows like |---|---|
        if (!cells.every((c) => /^-+:?$/.test(c) || c === "")) {
          rows.push(cells);
        }
        i++;
      }
      if (rows.length > 0) blocks.push({ type: "table", rows });
      continue;
    }

    // Unordered list
    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list (1. ١.)
    if (/^[\d٠-٩]+[\.\)]/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[\d٠-٩]+[\.\)]/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[\d٠-٩]+[\.\)]\s*/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Paragraph — gather until blank
    const paraLines: string[] = [trimmed];
    i++;
    while (i < lines.length && lines[i].trim() && !lines[i].trim().match(/^[#`|-]|^[\d٠-٩]+[\.\)]/)) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "para", text: paraLines.join(" ") });
  }

  return blocks;
}

function Block({ block }: { block: Block }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 className="text-xl font-black text-slate-800 font-cairo mt-6 mb-3 pb-2 border-b border-slate-100">
          {renderInline(block.text)}
        </h2>
      );
    case "h3":
      return (
        <h3 className="text-base font-black text-slate-700 font-cairo mt-5 mb-2">
          {renderInline(block.text)}
        </h3>
      );
    case "para":
      return (
        <p className="text-sm md:text-base text-slate-700 font-cairo leading-relaxed mb-4">
          {renderInline(block.text)}
        </p>
      );
    case "ul":
      return (
        <ul className="list-disc pr-6 space-y-1.5 mb-4 text-sm md:text-base text-slate-700 font-cairo">
          {block.items.map((it, i) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal pr-6 space-y-1.5 mb-4 text-sm md:text-base text-slate-700 font-cairo">
          {block.items.map((it, i) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ol>
      );
    case "code":
      return (
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs overflow-x-auto mb-4" dir="ltr">
          <code>{block.text}</code>
        </pre>
      );
    case "table":
      if (block.rows.length === 0) return null;
      const [header, ...rest] = block.rows;
      return (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-right text-sm font-cairo border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {header.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-xs font-bold text-slate-700">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rest.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-sm text-slate-700">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

// Inline: **bold**, `code`, [link](url)
function renderInline(text: string): React.ReactNode {
  // Split on the three patterns then reassemble.
  // Order matters: handle code first (so we don't bold inside code).
  const parts: React.ReactNode[] = [];
  const remaining = text;
  let key = 0;

  // Helper to push processed inline of remaining string
  const pushStyled = (str: string) => {
    // bold
    const boldSplit = str.split(/\*\*(.+?)\*\*/g);
    boldSplit.forEach((seg, i) => {
      if (i % 2 === 1) {
        parts.push(
          <strong key={`b-${key++}`} className="font-black text-slate-900">
            {seg}
          </strong>,
        );
      } else {
        // Try link [text](url)
        const linkRegex = /\[(.+?)\]\((.+?)\)/g;
        let lastEnd = 0;
        let m: RegExpExecArray | null;
        while ((m = linkRegex.exec(seg)) !== null) {
          if (m.index > lastEnd) {
            parts.push(seg.slice(lastEnd, m.index));
          }
          parts.push(
            <a
              key={`l-${key++}`}
              href={m[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-700 hover:text-indigo-900 underline"
            >
              {m[1]}
            </a>,
          );
          lastEnd = m.index + m[0].length;
        }
        if (lastEnd < seg.length) parts.push(seg.slice(lastEnd));
      }
    });
  };

  // First split out inline `code`
  const codeSplit = remaining.split(/`([^`]+)`/g);
  codeSplit.forEach((seg, i) => {
    if (i % 2 === 1) {
      parts.push(
        <code
          key={`c-${key++}`}
          className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[0.85em] font-mono"
          dir="ltr"
        >
          {seg}
        </code>,
      );
    } else {
      pushStyled(seg);
    }
  });

  return parts;
}
