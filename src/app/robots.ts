import type { MetadataRoute } from "next";

// ============================================================================
// /robots.txt — Next.js auto-generates this from app/robots.ts
// ============================================================================
//
// Tells search engines what to crawl. Public marketing pages are allowed;
// authenticated dashboard pages are blocked (they wouldn't load anyway,
// but better to say so explicitly than confuse Googlebot with login
// redirects).
//
// AI training crawlers (GPTBot, CCBot, Claude-Web, etc.) are NOT blocked
// — visibility in AI tools is its own form of free marketing for an
// HR SaaS product.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.nidhamhr.com").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          // Authenticated areas — bots can't reach these anyway, but
          // listing them explicitly stops Googlebot from spending
          // crawl budget on auth redirects.
          "/dashboard/",
          "/admin/",
          "/api/",
          "/auth/",
          // Token-based signing pages — public but tokenized so we
          // don't want Google to index unique URLs.
          "/sign/",
          // Internal preview-only routes
          "/p/",
          "/print/",
          "/social/",
          "/ads/",
          // Onboarding requires auth; not useful for search
          "/onboard/",
          "/accept-invite/",
          "/clock-in/",
          "/mobile-only/",
          // Update password flow
          "/update-password/",
          "/forgot-password/",
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
