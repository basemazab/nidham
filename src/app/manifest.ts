// ============================================================================
// Web App Manifest — makes Nidham installable from any mobile browser
// ============================================================================
//
// Next.js 15+ convention: exporting a default function from app/manifest.ts
// makes Next serve it at /manifest.webmanifest with the right MIME type +
// automatic inclusion in <head>.
//
// Once a user visits the site on Chrome (Android) or Safari (iOS), they
// can choose "Add to Home Screen" / "Install App" and Nidham becomes an
// icon on their device — full-screen, no browser chrome, just like a
// native app. Cost: $0. App Store reviews: 0. Updates: instant (next
// page load).

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "نِظام — Nidham HR",
    short_name: "Nidham",
    description:
      "نظام HR + CRM + AI واحد للسوق المصري. حضور بالـ GPS، رواتب آلية، طلبات إجازات، شات بوت موظفين.",
    start_url: "/dashboard",
    // standalone = full-screen, no browser UI. Closest to a native app feel.
    display: "standalone",
    // Falls back to "browser" on platforms that don't support standalone.
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "portrait",
    // Brand-cyan matches our Tailwind brand-cyan token (#22d3ee).
    // Chrome paints the status bar this color when the app is open standalone.
    theme_color: "#0891b2",
    background_color: "#f8fafc",
    lang: "ar",
    dir: "rtl",
    scope: "/",
    icons: [
      {
        // Single SVG = scales perfectly to any size. The "any" purpose is
        // required for the install prompt to fire on Chrome 91+.
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        // Maskable variant: tells Android to apply the system-defined
        // adaptive icon mask (circle, squircle, rounded square) so the
        // icon looks native in the launcher.
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    // Shortcuts appear on long-press of the app icon (Android) — fastest
    // path to the two flows employees use most.
    shortcuts: [
      {
        name: "تسجيل حضور",
        short_name: "حضور",
        description: "افتح صفحة تسجيل حضور الموبايل",
        url: "/clock-in",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "افتح لوحة التحكم",
        url: "/dashboard",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
    ],
    // categories help Android put us in the right Play-Store-like context
    // even though we're not actually in Play Store.
    categories: ["business", "productivity", "utilities"],
  };
}
