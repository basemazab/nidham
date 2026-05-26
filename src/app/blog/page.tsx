import type { Metadata } from "next";
import Link from "next/link";
import { POSTS } from "@/lib/blog/posts";
import { BlogNav, BlogFooter } from "@/components/blog-chrome";

// ============================================================================
// /blog — index page listing all posts
// ============================================================================
//
// Static rendering: POSTS is a hard-coded array, so this page is fully
// static. Next.js will ISR-revalidate on deploy. Good for crawlers (fast
// First Byte, full HTML) and good for ranking (zero JS for first paint).

export const metadata: Metadata = {
  title: "مدونة نِظام HR — مقالات عن إدارة الموارد البشرية والمرتبات في مصر",
  description:
    "مقالات تفصيلية للـ HR والـ Founders المصريين: حساب المرتبات، التأمينات، قانون العمل، مقارنات أنظمة HR، أدلة عملية بالأمثلة.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    type: "website",
    title: "مدونة نِظام HR — موارد للـ HR في مصر",
    description:
      "حساب المرتبات، التأمينات، قانون العمل، مقارنات أنظمة HR في مصر.",
    url: "/blog",
  },
};

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen bg-white font-cairo flex flex-col">
      <BlogNav />

      {/* Hero */}
      <section className="px-6 py-16 md:py-20 bg-gradient-to-b from-cyan-50/40 via-white to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold mb-6">
            ✦ مدونة نِظام HR
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-5">
            موارد عملية لإدارة الـ HR والمرتبات
            <br />
            <span style={{ color: "#0891b2" }}>في الشركات المصرية</span>
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            أدلة، حسابات، مقارنات، وشرح قانوني — كلها مكتوبة من فريق بيتعامل
            يومياً مع الـ HR والمرتبات في السوق المصري.
          </p>
        </div>
      </section>

      {/* Posts grid */}
      <section className="px-6 py-12 max-w-6xl mx-auto w-full flex-1">
        <div className="grid md:grid-cols-2 gap-6">
          {POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block rounded-2xl border border-slate-200 bg-white p-6 hover:border-brand-cyan hover:shadow-lg transition"
            >
              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-bold px-2.5 py-1 rounded-md bg-cyan-50 text-brand-cyan-dark border border-cyan-100"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <h2 className="text-2xl font-black text-slate-900 leading-tight mb-3 group-hover:text-brand-cyan-dark transition">
                {post.heading}
              </h2>

              <p className="text-slate-600 leading-relaxed mb-5">
                {post.excerpt}
              </p>

              <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-4">
                <span>{post.author}</span>
                <span className="flex items-center gap-3">
                  <time dateTime={post.publishedAt}>
                    {formatArabicDate(post.publishedAt)}
                  </time>
                  <span>·</span>
                  <span>{post.readMinutes} دقايق قراءة</span>
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Mid-page CTA */}
        <div className="mt-16 rounded-3xl bg-gradient-to-br from-brand-cyan to-brand-cyan-dark p-8 md:p-12 text-white text-center shadow-xl">
          <h2 className="text-2xl md:text-3xl font-black mb-3">
            بدل ما تقرا — جرّب النظام مباشرة
          </h2>
          <p className="text-cyan-50 mb-6 max-w-xl mx-auto">
            14 يوم تجربة مجانية. مفيش credit card. شغّال على شركتك في 5 دقايق.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-brand-cyan-dark font-bold shadow-md hover:shadow-lg transition"
          >
            🚀 ابدأ تجربة مجانية
          </Link>
        </div>
      </section>

      <BlogFooter />
    </div>
  );
}

// Helper — render the date in Arabic. Uses Intl.DateTimeFormat with the
// Egyptian Arabic locale so months come out as "مايو" not "May".
function formatArabicDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}
