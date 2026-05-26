import type { Metadata, Viewport } from "next";
import { Tajawal, Cairo, Reem_Kufi } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import "./globals.css";
import { UrlToasts } from "@/components/url-toasts";
import { ThemeProvider } from "@/components/theme-provider";
import { MetaPixel } from "@/components/meta-pixel";
import { PWAInstaller } from "@/components/pwa-installer";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700", "900"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
  weight: ["400", "600", "700", "900"],
});

const reemKufi = Reem_Kufi({
  variable: "--font-reem-kufi",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
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
  title: {
    default: "نِظام — منصة HR + CRM + AI Recruitment للسوق المصري",
    template: "%s | نِظام",
  },
  description:
    "نظام واحد بدل خمس أنظمة منفصلة. HR + CRM + ذكاء اصطناعي. متوافق مع قانون العمل المصري 12/2003 وقانون التأمينات 148/2019. حضور بالـ GPS، رواتب آلية، فحص CVs بالـ AI.",
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
    siteName: "Nidham",
    title: "نِظام — منصة HR + CRM + AI Recruitment للسوق المصري",
    description:
      "نظام واحد بدل خمس أنظمة منفصلة. HR + CRM + ذكاء اصطناعي. متوافق مع قانون العمل المصري والتأمينات.",
    locale: "ar_EG",
  },
  twitter: {
    card: "summary_large_image",
    title: "نِظام — منصة HR + CRM + AI Recruitment",
    description:
      "نظام HR + CRM + AI واحد للسوق المصري. متوافق قانونيًا. حضور بالـ GPS وفحص CVs بالـ AI.",
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
        <ThemeProvider>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
