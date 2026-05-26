import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/blog/posts";

// ============================================================================
// /sitemap.xml — Next.js auto-generates this from app/sitemap.ts
// ============================================================================
//
// Lists every public page so Google can discover them quickly. Pages
// requiring auth (/dashboard/*, /admin) are intentionally excluded —
// Google can't crawl them anyway, and we don't want signed-in URLs
// leaking into the index.
//
// Priorities + frequencies follow Egyptian-SaaS SEO best practice:
//   • / and /pricing are top priority (1.0, weekly) — main conversion pages
//   • /product, /crm, /about are 0.9 weekly — secondary conversion
//   • Trust pages (security, integrations) are 0.7 monthly
//   • Legal pages (privacy, terms) are 0.3 yearly — required for indexing
//     but not for ranking

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.nidhamhr.com").replace(/\/$/, "");

type SitemapEntry = MetadataRoute.Sitemap[number];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const entries: SitemapEntry[] = [
    // ── Primary conversion pages ──
    {
      url: `${SITE}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE}/pricing`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE}/product`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE}/crm`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE}/signup`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },

    // ── Trust / explainer pages ──
    {
      url: `${SITE}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE}/customers`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE}/security`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE}/integrations`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE}/api-docs`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE}/help`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },

    // ── Marketing collateral ──
    {
      url: `${SITE}/sales-brochure`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE}/brochure`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },

    // ── Legal (low priority but required for indexing trust) ──
    {
      url: `${SITE}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE}/refund`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE}/beta-terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },

    // ── Auth entry (mostly for "Nidham login" branded searches) ──
    {
      url: `${SITE}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },

    // ── Blog ──
    // Index gets higher priority than individual posts because it links
    // out to everything else. Posts inherit `weekly` so Google revisits
    // them — we update content + add new posts continuously.
    {
      url: `${SITE}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },

    // ── Free tools (link magnets) ──
    // Each calculator is a high-intent landing page. Hub at /tools links
    // to all of them. Priority 0.8 for the hub because it's a strong
    // ranking target on its own ("أدوات HR مجانية").
    {
      url: `${SITE}/tools`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE}/tools/salary-calculator`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE}/tools/end-of-service`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE}/tools/social-insurance`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },

    // ── Industry landing pages ──
    // Each industry page targets high-intent industry-specific keywords
    // (e.g. "نظام HR للمصانع" — much higher conversion than generic terms).
    {
      url: `${SITE}/industries`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE}/industries/manufacturing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE}/industries/logistics`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE}/industries/restaurants`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE}/industries/retail`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  // Blog posts — generated from the POSTS registry. Each entry uses the
  // post's `updatedAt` so Google picks up content revisions immediately.
  for (const post of POSTS) {
    entries.push({
      url: `${SITE}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return entries;
}
