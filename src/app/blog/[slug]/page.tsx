import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  POSTS,
  POST_CONTENT_LOADERS,
  getPostBySlug,
  getAllSlugs,
} from "@/lib/blog/posts";
import { BlogNav, BlogFooter } from "@/components/blog-chrome";
import { BlogPostingSchema, BreadcrumbSchema } from "@/components/json-ld";

// ============================================================================
// /blog/[slug] — render an individual blog post
// ============================================================================
//
// Post content lives in src/content/blog/{slug}.tsx — we import it dynamically
// based on the URL slug. Each content module exports a default function that
// returns the article body (everything inside <article>). Per-post metadata
// (title, description, og, schema) is generated from the POSTS registry.
//
// Why dynamic import instead of a switch statement?
//   • Adding a new post = drop a TSX file + add to POSTS. Zero changes here.
//   • Tree-shaking — unused post bundles don't ship to other routes.
//
// generateStaticParams + generateMetadata make this a fully static page —
// Next.js builds an HTML file per post at build time. Best for Core Web
// Vitals + crawlers.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.nidhamhr.com").replace(/\/$/, "");

type Params = { slug: string };
// In Next.js 16, dynamic route params are async (returned as a Promise) so
// React Server Components don't accidentally rely on URL state during render.
type PageProps = { params: Promise<Params> };

// Tell Next.js to statically generate every post at build time
export async function generateStaticParams(): Promise<Params[]> {
  return getAllSlugs().map((slug) => ({ slug }));
}

// Per-post metadata — feeds <title>, <meta>, OG, Twitter card, canonical
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "مقال غير موجود" };

  const url = `${SITE}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  // Lookup the post's content loader. The loader map is static, so
  // Webpack/Turbopack can see every possible import target at build time
  // and produces one chunk per post (loaded only when that route renders).
  // Falls back to notFound() if a slug is registered in POSTS but missing
  // here (a registry/content mismatch — shouldn't happen if devs follow
  // the "add 1 line to POST_CONTENT_LOADERS" rule).
  const loader = POST_CONTENT_LOADERS[slug];
  if (!loader) notFound();
  const PostContent = (await loader()).default;

  return (
    <div className="min-h-screen bg-white font-cairo flex flex-col">
      <BlogNav />

      {/* JSON-LD for this specific post (Article rich result eligibility) */}
      <BlogPostingSchema
        slug={post.slug}
        title={post.title}
        description={post.description}
        author={post.author}
        publishedAt={post.publishedAt}
        updatedAt={post.updatedAt}
        tags={post.tags}
      />
      <BreadcrumbSchema
        items={[
          { name: "الرئيسية", url: "/" },
          { name: "المدونة", url: "/blog" },
          { name: post.heading, url: `/blog/${post.slug}` },
        ]}
      />

      {/* Article header */}
      <header className="px-6 pt-12 pb-8 max-w-3xl mx-auto w-full">
        {/* Breadcrumb (visible) */}
        <nav aria-label="breadcrumb" className="text-xs text-slate-500 mb-6">
          <Link href="/" className="hover:text-brand-cyan-dark">الرئيسية</Link>
          <span className="mx-2">›</span>
          <Link href="/blog" className="hover:text-brand-cyan-dark">المدونة</Link>
        </nav>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs font-bold px-2.5 py-1 rounded-md bg-cyan-50 text-brand-cyan-dark border border-cyan-100"
            >
              {tag}
            </span>
          ))}
        </div>

        <h1 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight mb-5">
          {post.heading}
        </h1>

        <p className="text-lg text-slate-600 leading-relaxed mb-6">
          {post.description}
        </p>

        <div className="flex items-center gap-3 text-sm text-slate-500 border-y border-slate-100 py-4">
          <span className="font-medium text-slate-700">{post.author}</span>
          <span>·</span>
          <time dateTime={post.publishedAt}>{formatArabicDate(post.publishedAt)}</time>
          <span>·</span>
          <span>{post.readMinutes} دقايق قراءة</span>
        </div>
      </header>

      {/* Article body — wrapped in `prose-ar` for typography defaults */}
      <article className="px-6 pb-16 max-w-3xl mx-auto w-full prose-ar">
        <PostContent />
      </article>

      {/* Bottom CTA — every post funnels into the trial */}
      <section className="px-6 pb-16 max-w-3xl mx-auto w-full">
        <div className="rounded-3xl bg-gradient-to-br from-brand-cyan to-brand-cyan-dark p-8 md:p-10 text-white shadow-xl">
          <h2 className="text-2xl md:text-3xl font-black mb-3">
            عايز تطبق ده على شركتك؟
          </h2>
          <p className="text-cyan-50 mb-6 max-w-xl">
            نِظام HR بيعمل كل الحسابات اللي فوق تلقائياً — التأمينات والضرايب
            وحساب الإجمالي والصافي. 14 يوم تجربة مجانية.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-brand-cyan-dark font-bold shadow-md hover:shadow-lg transition"
            >
              🚀 ابدأ تجربة مجانية
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/15 text-white border border-white/30 font-bold hover:bg-white/20 transition"
            >
              📊 شوف الأسعار
            </Link>
          </div>
        </div>
      </section>

      {/* Related posts */}
      <section className="px-6 pb-20 max-w-3xl mx-auto w-full">
        <h3 className="text-sm font-bold tracking-widest uppercase text-slate-500 mb-4">
          مقالات قد تهمك
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {POSTS.filter((p) => p.slug !== post.slug).slice(0, 2).map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="block rounded-xl border border-slate-200 bg-white p-5 hover:border-brand-cyan hover:shadow-md transition"
            >
              <h4 className="font-bold text-slate-900 mb-2 leading-snug">
                {p.heading}
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">
                {p.excerpt}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <BlogFooter />
    </div>
  );
}

function formatArabicDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}
