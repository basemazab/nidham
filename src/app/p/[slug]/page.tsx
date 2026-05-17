// ============================================================================
// /p/[slug] — Public landing page (anonymous, indexable, branded per tenant)
// ============================================================================
//
// Anonymous visitors hit this URL from ads, SMS, WhatsApp, organic search.
// We server-render the page from the landing_pages row (anon SELECT
// policy gated on is_active=true), then hand off to a Client Component
// for tracking + form interactivity.
//
// SEO: each page emits its own <title> and meta description. No noindex —
// the user wants these to be discoverable.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LandingPageClient } from "./landing-page-client";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type LandingPageRow = {
  id: string;
  company_id: string;
  slug: string;
  name: string;
  template: "generic" | "lead_magnet" | "product" | "service" | "event";
  headline: string;
  sub_headline: string | null;
  body: string | null;
  hero_image_url: string | null;
  accent_color: string;
  cta_label: string;
  cta_action: "form" | "whatsapp" | "phone" | "external_url";
  cta_target: string | null;
  form_enabled: boolean;
  form_fields: string[];
  form_submit_label: string;
  form_success_msg: string;
  is_active: boolean;
};

async function loadPage(slug: string): Promise<{
  page: LandingPageRow;
  companyName: string;
} | null> {
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("landing_pages")
    .select(
      "id, company_id, slug, name, template, headline, sub_headline, body, hero_image_url, accent_color, cta_label, cta_action, cta_target, form_enabled, form_fields, form_submit_label, form_success_msg, is_active",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle<LandingPageRow>();

  if (!page) return null;

  // Pull company name in a second query — companies has a separate
  // public read policy (mig 014) gated on "has at least one public+open
  // job", which won't apply here. We try anyway and fall back to a
  // generic label if blocked.
  let companyName = "الشركة";
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", page.company_id)
    .maybeSingle<{ name: string }>();
  if (company?.name) companyName = company.name;

  return { page, companyName };
}

// Per-page SEO metadata
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadPage(slug);
  if (!loaded) {
    return { title: "صفحة غير موجودة" };
  }
  const { page, companyName } = loaded;
  const description =
    page.sub_headline ?? page.body?.slice(0, 160) ?? page.headline;
  return {
    title: `${page.headline} · ${companyName}`,
    description,
    openGraph: {
      title: page.headline,
      description,
      images: page.hero_image_url ? [page.hero_image_url] : undefined,
      type: "website",
    },
  };
}

export default async function PublicLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const loaded = await loadPage(slug);
  if (!loaded) notFound();
  const { page, companyName } = loaded;

  const accent = page.accent_color || "#0891B2";

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50"
    >
      {/* Top bar — minimal brand line */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-bold font-cairo text-slate-700">
            {companyName}
          </div>
          <div className="text-[10px] text-slate-400 font-cairo">
            صفحة آمنة · Nidham
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-10 items-start">
        {/* Left: copy */}
        <div>
          {/* Hero image (if set) */}
          {page.hero_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={page.hero_image_url}
              alt={page.headline}
              className="w-full h-48 object-cover rounded-2xl mb-6 shadow-md"
            />
          )}

          {/* Template chip */}
          <div
            className="inline-block px-3 py-1 rounded-full text-[10px] font-bold mb-3 font-cairo"
            style={{
              backgroundColor: `${accent}15`,
              color: accent,
              borderWidth: 1,
              borderColor: `${accent}40`,
            }}
          >
            {TEMPLATE_LABEL[page.template] ?? "عرض خاص"}
          </div>

          <h1 className="text-3xl md:text-4xl font-black font-cairo text-slate-900 mb-3 leading-tight">
            {page.headline}
          </h1>

          {page.sub_headline && (
            <p className="text-lg text-slate-600 font-cairo leading-relaxed mb-4">
              {page.sub_headline}
            </p>
          )}

          {page.body && (
            <div className="text-base text-slate-700 font-cairo leading-relaxed whitespace-pre-line">
              {page.body}
            </div>
          )}

          {/* Trust line — short, generic */}
          <div className="mt-6 flex items-center gap-4 text-xs text-slate-500 font-cairo">
            <span>✓ رد سريع</span>
            <span>✓ بيانات سرية</span>
            <span>✓ بدون التزام</span>
          </div>
        </div>

        {/* Right: interactive panel */}
        <div className="md:sticky md:top-8">
          <LandingPageClient
            page={{
              slug: page.slug,
              headline: page.headline,
              sub_headline: page.sub_headline,
              body: page.body,
              accent_color: accent,
              cta_label: page.cta_label,
              cta_action: page.cta_action,
              cta_target: page.cta_target,
              form_enabled: page.form_enabled,
              form_fields: page.form_fields ?? [],
              form_submit_label: page.form_submit_label,
              form_success_msg: page.form_success_msg,
              company_name: companyName,
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-12 py-6 text-center text-xs text-slate-400 font-cairo">
        © {new Date().getFullYear()} {companyName} · صفحة منشورة عبر Nidham
      </footer>
    </main>
  );
}

const TEMPLATE_LABEL: Record<string, string> = {
  generic: "✦ عرض خاص",
  lead_magnet: "📥 احصل على دليلنا المجاني",
  product: "🛒 المنتج",
  service: "🛠 الخدمة",
  event: "📅 الحدث",
};
