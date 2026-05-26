import type { MetadataRoute } from "next";

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
  ];

  return entries;
}
