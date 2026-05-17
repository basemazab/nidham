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

  // Note: we deliberately DON'T expose the owning company's name on the
  // public landing page. Visitors who hit /p/<slug> from an ad shouldn't
  // see the tenant's legal entity (e.g. "المصرية الالمانية") — they came
  // for the offer, not for our internal multi-tenancy plumbing. Branding
  // is fixed to "Nidham" so every landing page reads like a Nidham
  // product page, which is what Basem wants while he uses the SaaS as
  // his own marketing surface.
  return { page };
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
  const { page } = loaded;
  const description =
    page.sub_headline ?? page.body?.slice(0, 160) ?? page.headline;
  return {
    // Title is just the offer headline. We intentionally drop the owning
    // tenant name from the page title so SERPs / OG previews lead with
    // the offer, not the legal entity.
    title: page.headline,
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
  const { page } = loaded;

  const accent = page.accent_color || "#0891B2";

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50"
    >
      {/* Top bar — Nidham branding only. The owning company's name is
          deliberately NOT shown to public visitors. */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-black font-cairo text-slate-800">
            Nidham
          </div>
          <div className="text-[10px] text-slate-400 font-cairo">
            صفحة آمنة 🔒
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
            }}
          />
        </div>
      </div>

      {/* Footer — Nidham-branded only. The tenant's company name is
          intentionally omitted (see loadPage rationale). */}
      <footer className="border-t border-slate-200 mt-12 py-6 text-center text-xs text-slate-400 font-cairo">
        © {new Date().getFullYear()} Nidham · صفحة آمنة محمية
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
