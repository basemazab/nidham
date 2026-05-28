import type { Metadata, Viewport } from "next";
import { Tajawal, Cairo, Reem_Kufi } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import "./globals.css";
import { UrlToasts } from "@/components/url-toasts";
import { ThemeProvider } from "@/components/theme-provider";
import { MetaPixel } from "@/components/meta-pixel";
import { PWAInstaller } from "@/components/pwa-installer";
import { AppProviders } from "@/lib/providers/app-providers";
import {
  OrganizationSchema,
  SoftwareApplicationSchema,
  WebsiteSchema,
} from "@/components/json-ld";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
});

const reemKufi = Reem_Kufi({
  variable: "--font-reem-kufi",
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
});

// metadataBase is required for OG / Twitter card resolution. NEXT_PUBLIC_SITE_URL
// is read at build time on Vercel; fall back to the canonical Cloud URL if it's
// missing (e.g. local dev) so social-link unfurls still work in staging.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nidhamhr.com";

// Viewport must be in its own export per Next.js 15+ convention. The
// theme-color paints the Android status bar + iOS PWA chrome to match
// our brand cyan so the installed app feels integrated, not webview-y.
export const viewport: Viewport = {
  themeColor: "#0891b2",
  width: "device-width",
  initialScale: 1,
  // iOS-only: prevent zoom on input focus (annoying on signup forms)
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // SEO O2: title front-loads the most-searched Egyptian Arabic keywords
  // ("نظام إدارة موارد بشرية", "مرتبات", "مصر") to maximize click-through
  // from search results. 60-char limit respected. Brand at the end —
  // it's strong enough to stand without being first.
  title: {
    default:
      "نظام إدارة موارد بشرية ومرتبات للشركات المصرية | نِظام",
    template: "%s | نِظام HR",
  },
  description:
    "أفضل نظام HR ومرتبات مصري بـ AI — متوافق مع قانون 12/2003 والتأمينات 148/2019. حضور بالـ GPS، حساب رواتب آلي، نماذج تأمينات، توقيع إلكتروني. تجربة 14 يوم مجاناً.",
  keywords: [
    // ── Primary Arabic intent keywords ──
    "نظام HR مصري",
    "برنامج موارد بشرية",
    "نظام مرتبات مصري",
    "برنامج مرتبات للشركات",
    "نظام حضور وانصراف",
    "حضور وانصراف GPS",
    "نظام تأمينات اجتماعية",
    "حساب التأمينات والضرايب",
    "نموذج 1 تأمينات",
    "نموذج 6 تأمينات",
    "شهادة خبرة جاهزة",
    "حساب نهاية الخدمة",
    "نظام CRM مصري",
    "برنامج إدارة العملاء",
    // ── Comparative / alternative ──
    "بديل Bayzat",
    "بديل ZenHR",
    "Bayzat alternative Egypt",
    // ── English ──
    "egyptian hr software",
    "egypt payroll system",
    "hr software egypt",
    "egypt labor law compliance",
    "arabic hr system",
    // ── Brand ──
    "نِظام",
    "Nidham HR",
    "نظام نظام",
  ],
  applicationName: "Nidham",
  // PWA / install metadata
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nidham",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
    shortcut: "/icon.svg",
  },
  openGraph: {
    type: "website",
    siteName: "Nidham HR",
    title: "نظام إدارة موارد بشرية ومرتبات للشركات المصرية | نِظام",
    description:
      "أفضل نظام HR ومرتبات مصري بـ AI — متوافق مع قانون 12/2003. حضور بالـ GPS، نماذج تأمينات، توقيع إلكتروني. 14 يوم مجاناً.",
    locale: "ar_EG",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title: "نظام HR ومرتبات للشركات المصرية | نِظام",
    description:
      "أفضل نظام HR + Payroll + AI مصري · متوافق قانونياً · حضور GPS · 14 يوم مجاناً.",
    site: "@nidham_hr",
  },
  // SEO O2: explicit canonical to prevent www / non-www duplication
  alternates: {
    canonical: siteUrl,
    languages: {
      "ar-EG": siteUrl,
      "x-default": siteUrl,
    },
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      // suppressHydrationWarning is required by next-themes — the
      // provider sets `class="dark"` on <html> BEFORE React hydrates,
      // and React would otherwise complain about the className
      // mismatch between the SSR'd output and the client tree.
      suppressHydrationWarning
      className={`${tajawal.variable} ${cairo.variable} ${reemKufi.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* SEO: schema.org structured data on every page.
            Organization + SoftwareApplication + WebSite power
            Google's Knowledge Panel, rich card results, and the
            sitelinks search box. */}
        <OrganizationSchema />
        <SoftwareApplicationSchema />
        <WebsiteSchema />
        <ThemeProvider>
          <AppProviders>
          {children}
          {/* Sonner toaster — top-center so RTL feels natural. richColors
              gives success / error a subtle tint instead of the plain
              dark default. theme="system" lets sonner pick light/dark
              based on the resolved next-themes value. */}
          <Toaster
            position="top-center"
            dir="rtl"
            richColors
            theme="system"
            expand={false}
            closeButton={false}
            toastOptions={{
              classNames: {
                toast:
                  "font-cairo !shadow-lg !rounded-2xl !border !px-4 !py-3 !text-sm",
                title: "font-bold",
                description: "text-slate-600",
              },
            }}
          />
          <Suspense fallback={null}>
            <UrlToasts />
          </Suspense>
          {/* Meta Pixel — no-ops until NEXT_PUBLIC_META_PIXEL_ID is set in
              Vercel env. Lives outside ThemeProvider so theme transitions
              don't trigger spurious PageView re-fires. */}
          <MetaPixel />
          {/* PWA bootstrap — registers the service worker + captures the
              `beforeinstallprompt` event so <PWAInstallButton /> can fire
              it on user demand. Headless component. */}
          <PWAInstaller />
          </AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
