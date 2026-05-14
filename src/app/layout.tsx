import type { Metadata } from "next";
import { Tajawal, Cairo, Reem_Kufi } from "next/font/google";
import "./globals.css";

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
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nidham-seven.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "نِظام — منصة HR + CRM + AI Recruitment للسوق المصري",
    template: "%s | نِظام",
  },
  description:
    "نظام واحد بدل خمس أنظمة منفصلة. HR + CRM + ذكاء اصطناعي. متوافق مع قانون العمل المصري 12/2003 وقانون التأمينات 148/2019. حضور بالـ GPS، رواتب آلية، فحص CVs بالـ AI.",
  applicationName: "Nidham",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
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
      className={`${tajawal.variable} ${cairo.variable} ${reemKufi.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
