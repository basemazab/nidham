// ============================================================================
// Next.js config — wrapped with Sentry's withSentryConfig for source-map
// upload + tunnel routing. If the Sentry env vars are unset (local dev,
// preview without secrets), withSentryConfig is a transparent no-op —
// the build still succeeds.
// ============================================================================

import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",

  // Enable React strict mode for development warnings
  reactStrictMode: true,

  // Compress responses with gzip/brotli
  compress: true,

  // Cache static assets aggressively + security headers
  async headers() {
    return [
      {
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },

  // Standalone output traces dependencies automatically
};

export default withSentryConfig(nextConfig, {
  // SaaS Sentry expects an org + project slug to upload source maps. If
  // they're missing, the wrapper falls back to "just instrument errors"
  // — no source map upload, no release artifact, but the SDK still
  // captures events.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Don't fail the build if Sentry's upload step errors. The Next build
  // is more important than the source-map upload — we'd rather ship
  // un-mapped stack traces than block a deploy on Sentry being down.
  silent: !process.env.SENTRY_DSN,

  // Delete uploaded source maps from the build output after upload so
  // they don't leak to clients. (Sentry still keeps a copy on their
  // side so server stack traces resolve to original TypeScript.)
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Tunnel Sentry events through our own /monitoring endpoint to bypass
  // ad-blockers that block sentry.io. The tunnel route is created
  // automatically.
  tunnelRoute: "/monitoring",

  // Suppress noisy console logs from the Sentry build step.
  disableLogger: true,
});
