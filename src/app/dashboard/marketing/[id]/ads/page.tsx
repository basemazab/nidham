// ============================================================================
// /dashboard/marketing/[id]/ads — Ad Copy Generator
// ============================================================================

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";
import { runAdCopyGenerator } from "../../actions";
import { AiErrorBanner } from "@/components/ai-error-banner";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generated?: string; error?: string }>;
};

type Creative = {
  id: string;
  platform: string;
  format: string;
  headline: string;
  body: string;
  cta: string | null;
  hook: string | null;
  creative_concept: string | null;
  status: string;
  created_at: string;
};

type Persona = { id: string; name: string };

const PLATFORM_LABEL: Record<string, { label: string; icon: string }> = {
  meta: { label: "Facebook / Meta", icon: "📘" },
  google: { label: "Google Ads", icon: "🔍" },
  tiktok: { label: "TikTok", icon: "🎵" },
  instagram: { label: "Instagram", icon: "📷" },
  linkedin: { label: "LinkedIn", icon: "💼" },
  snapchat: { label: "Snapchat", icon: "👻" },
};

const FORMAT_LABEL: Record<string, string> = {
  single_image: "صورة واحدة",
  carousel: "Carousel",
  video: "فيديو",
  story: "Story",
  reel: "Reel",
  search_ad: "Search Ad",
  display_ad: "Display Ad",
};

export default async function AdsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await canUseFeature("marketing_studio"))) {
    return <UpgradeRequired feature="marketing_studio" />;
  }

  // Scope personas + creatives to caller's company.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [projectRes, personasRes, creativesRes] = await Promise.all([
    supabase
      .from("marketing_projects")
      .select("id, name")
      .eq("id", id)
      .single<{ id: string; name: string }>(),
    supabase
      .from("marketing_personas")
      .select("id, name")
      .eq("company_id", callerCompanyId)
      .eq("project_id", id)
      .order("priority")
      .returns<Persona[]>(),
    supabase
      .from("marketing_ad_creatives")
      .select("*")
      .eq("company_id", callerCompanyId)
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .returns<Creative[]>(),
  ]);

  if (!projectRes.data) notFound();
  const project = projectRes.data;
  const personas = personasRes.data ?? [];
  const creatives = creativesRes.data ?? [];
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link
            href={`/dashboard/marketing/${id}`}
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← مشروع {project.name}
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold mb-2 font-cairo">
            ✍ كاتب الإعلانات
          </div>
          <h1 className="text-2xl md:text-3xl font-black font-cairo text-slate-800 mb-1">
            مولّد الإعلانات
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            {creatives.length} إعلان · جاهزة للنسخ في Ads Manager
          </p>
        </header>

        {sp.generated && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-cairo text-sm">
            ✅ تم توليد إعلانات جديدة. كل إعلان فيه headline + body + CTA +
            فكرة تصميم.
          </div>
        )}
        <AiErrorBanner message={errorMsg} />

        {/* Generation form */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
          <h2 className="font-black font-cairo text-slate-800 mb-3">
            ✦ ولّد إعلانات جديدة
          </h2>
          <form
            action={runAdCopyGenerator}
            className="grid md:grid-cols-3 gap-3"
          >
            <input type="hidden" name="project_id" value={id} />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                هدف الإعلان
              </label>
              <select
                name="goal"
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-cairo outline-none focus:border-rose-400"
                defaultValue="sales"
              >
                <option value="awareness">Awareness — معرفة بالعلامة</option>
                <option value="engagement">Engagement — تفاعل</option>
                <option value="leads">Leads — جمع عملاء محتملين</option>
                <option value="sales">Sales — مبيعات مباشرة</option>
                <option value="traffic">Traffic — زيارات الموقع</option>
                <option value="messages">Messages — رسائل واتساب/مسنجر</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                الـ Persona المستهدف
              </label>
              <select
                name="persona_id"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-cairo outline-none focus:border-rose-400"
              >
                <option value="">— كل الجمهور —</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-2 font-cairo">
                المنصات (اختر واحدة أو أكتر)
              </label>
              <div className="flex flex-wrap gap-3">
                {(["meta", "google", "tiktok", "instagram"] as const).map(
                  (p) => (
                    <label
                      key={p}
                      className="inline-flex items-center gap-2 cursor-pointer text-sm font-cairo"
                    >
                      <input
                        type="checkbox"
                        name="platforms"
                        value={p}
                        defaultChecked={p === "meta"}
                        className="w-4 h-4"
                      />
                      <span>
                        {PLATFORM_LABEL[p].icon} {PLATFORM_LABEL[p].label}
                      </span>
                    </label>
                  ),
                )}
              </div>
            </div>

            <div className="md:col-span-3">
              <button
                type="submit"
                className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black font-cairo shadow-md hover:shadow-lg transition"
              >
                ✦ ولّد 5 إعلانات بالـ AI
              </button>
            </div>
          </form>
        </section>

        {/* Creatives list */}
        {creatives.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <div className="text-5xl mb-3">✍</div>
            <p className="text-sm text-slate-500 font-cairo">
              مفيش إعلانات لسه. عبّى الفورم فوق واضغط توليد.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {creatives.map((c) => (
              <CreativeCard key={c.id} creative={c} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function CreativeCard({ creative }: { creative: Creative }) {
  const p = PLATFORM_LABEL[creative.platform] ?? {
    label: creative.platform,
    icon: "📢",
  };

  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 hover:border-rose-300 transition">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-bold font-cairo">
          {p.icon} {p.label}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold font-cairo">
          {FORMAT_LABEL[creative.format] ?? creative.format}
        </span>
      </div>

      {creative.hook && (
        <div className="mb-3 p-2 rounded bg-amber-50 border border-amber-200">
          <div className="text-[10px] font-bold text-amber-700 mb-0.5 font-cairo">
            🎬 Hook (أول 3 ثواني فيديو)
          </div>
          <p className="text-sm font-bold text-slate-800 font-cairo">
            {creative.hook}
          </p>
        </div>
      )}

      <div className="mb-2">
        <div className="text-[10px] font-bold text-slate-500 mb-1 font-cairo">
          HEADLINE
        </div>
        <p className="text-base font-black text-slate-800 font-cairo leading-snug">
          {creative.headline}
        </p>
      </div>

      <div className="mb-2">
        <div className="text-[10px] font-bold text-slate-500 mb-1 font-cairo">
          نص الإعلان
        </div>
        <p className="text-sm text-slate-700 font-cairo leading-relaxed">
          {creative.body}
        </p>
      </div>

      {creative.cta && (
        <div className="mb-3">
          <span className="inline-block text-xs px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 border-2 border-emerald-300 font-black font-cairo">
            👉 {creative.cta}
          </span>
        </div>
      )}

      {creative.creative_concept && (
        <div className="mt-3 p-2.5 rounded bg-slate-50 border border-slate-200">
          <div className="text-[10px] font-bold text-slate-600 mb-1 font-cairo">
            🎨 فكرة التصميم
          </div>
          <p className="text-[12px] text-slate-700 font-cairo leading-relaxed">
            {creative.creative_concept}
          </p>
        </div>
      )}
    </div>
  );
}
