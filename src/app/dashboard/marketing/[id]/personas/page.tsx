// ============================================================================
// /dashboard/marketing/[id]/personas — Audience Builder
// ============================================================================

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";
import { runAudienceBuilder } from "../../actions";
import { AiErrorBanner } from "@/components/ai-error-banner";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generated?: string; error?: string }>;
};

type Persona = {
  id: string;
  name: string;
  demographics: {
    age_range?: string;
    gender?: string;
    location?: string[];
    income_level?: string;
    occupation?: string;
  };
  psychographics: {
    interests?: string[];
    values?: string[];
    media_consumption?: string[];
  };
  pain_points: string[];
  goals: string[];
  buying_journey: {
    triggers?: string[];
    research_channels?: string[];
    objections?: string[];
    decision_factors?: string[];
  };
  meta_targeting: {
    detailed_interests?: string[];
    behaviors?: string[];
    age_min?: number;
    age_max?: number;
    locations?: string[];
    gender?: string;
  };
  google_targeting: {
    in_market_segments?: string[];
    affinity_segments?: string[];
    keyword_themes?: string[];
  };
  priority: number;
};

export default async function PersonasPage({ params, searchParams }: PageProps) {
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

  // Scope personas to caller's company so super-admin sessions don't
  // bleed cross-tenant rows via a forged project_id.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [projectRes, personasRes] = await Promise.all([
    supabase
      .from("marketing_projects")
      .select("id, name, product_summary")
      .eq("id", id)
      .single<{ id: string; name: string; product_summary: string | null }>(),
    supabase
      .from("marketing_personas")
      .select("*")
      .eq("company_id", callerCompanyId)
      .eq("project_id", id)
      .order("priority")
      .returns<Persona[]>(),
  ]);

  if (!projectRes.data) notFound();
  const project = projectRes.data;
  const personas = personasRes.data ?? [];
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

        <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="inline-block px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300 text-[10px] font-bold mb-2 font-cairo">
              🎯 باني الجمهور
            </div>
            <h1 className="text-2xl md:text-3xl font-black font-cairo text-slate-800 mb-1">
              Buyer Personas
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              {personas.length} persona — كل واحد له targeting Facebook + Google جاهز
            </p>
          </div>
          <form action={runAudienceBuilder}>
            <input type="hidden" name="project_id" value={id} />
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm font-cairo shadow-md hover:shadow-lg transition"
            >
              <span>✦</span>
              <span>
                {personas.length === 0 ? "ابني الجمهور بالـ AI" : "أعد التوليد"}
              </span>
            </button>
          </form>
        </header>

        {sp.generated && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-cairo text-sm">
            ✅ تم بناء {personas.length} personas بنجاح. شوفهم تحت + استخدم
            الـ targeting parameters في Facebook/Google Ads Manager.
          </div>
        )}
        <AiErrorBanner message={errorMsg} />

        {personas.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <div className="text-5xl mb-3">🎯</div>
            <h3 className="text-lg font-bold font-cairo text-slate-700 mb-2">
              مفيش personas لسه
            </h3>
            <p className="text-sm text-slate-500 font-cairo max-w-md mx-auto">
              اضغط <strong>ابني الجمهور بالـ AI</strong> فوق وفي خلال 15 ثانية
              هتلاقي 2-4 buyer personas مع كل بياناتهم + targeting Facebook +
              Google.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {personas.map((p, i) => (
              <PersonaCard key={p.id} persona={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function PersonaCard({ persona, index }: { persona: Persona; index: number }) {
  const isPrimary = persona.priority === 1;

  return (
    <div
      className={`bg-white border-2 rounded-2xl p-5 ${
        isPrimary ? "border-amber-400 shadow-md" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-start gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
              isPrimary
                ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {index + 1}
          </div>
          <div>
            <h3 className="text-lg font-black font-cairo text-slate-800 mb-0.5">
              {persona.name}
            </h3>
            {persona.demographics?.occupation && (
              <p className="text-xs text-slate-500 font-cairo">
                {persona.demographics.occupation}
              </p>
            )}
          </div>
        </div>
        {isPrimary && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-black font-cairo">
            ⭐ الجمهور الرئيسي
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Demographics */}
        <Card title="👤 ديموغرافي">
          <DataRow label="السن" value={persona.demographics?.age_range} />
          <DataRow
            label="الجنس"
            value={
              persona.demographics?.gender === "male"
                ? "ذكر"
                : persona.demographics?.gender === "female"
                  ? "أنثى"
                  : "الكل"
            }
          />
          <DataRow
            label="المدن"
            value={persona.demographics?.location?.join("، ")}
          />
          <DataRow
            label="الدخل"
            value={INCOME_LABEL[persona.demographics?.income_level ?? ""]}
          />
        </Card>

        {/* Psychographics */}
        <Card title="🧠 نفسي">
          {persona.psychographics?.interests && (
            <div className="mb-2">
              <div className="text-[10px] text-slate-500 font-bold font-cairo mb-1">
                اهتمامات
              </div>
              <div className="flex flex-wrap gap-1">
                {persona.psychographics.interests.map((x, i) => (
                  <Tag key={i}>{x}</Tag>
                ))}
              </div>
            </div>
          )}
          {persona.psychographics?.media_consumption && (
            <div>
              <div className="text-[10px] text-slate-500 font-bold font-cairo mb-1">
                المنصات
              </div>
              <div className="flex flex-wrap gap-1">
                {persona.psychographics.media_consumption.map((x, i) => (
                  <Tag key={i} tone="cyan">
                    {x}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Pain points */}
        {persona.pain_points && persona.pain_points.length > 0 && (
          <Card title="😣 مشاكله">
            <ul className="text-sm text-slate-700 font-cairo space-y-1">
              {persona.pain_points.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-rose-500 shrink-0">▪</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Goals */}
        {persona.goals && persona.goals.length > 0 && (
          <Card title="🎯 أهدافه">
            <ul className="text-sm text-slate-700 font-cairo space-y-1">
              {persona.goals.map((g, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-500 shrink-0">▪</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Targeting parameters — gold for the actual marketer */}
      <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
        <h4 className="text-sm font-black text-blue-800 mb-3 font-cairo">
          📡 Targeting جاهز للنسخ
        </h4>
        <div className="grid md:grid-cols-2 gap-4">
          {/* Meta */}
          <div>
            <div className="text-[10px] font-bold text-blue-700 mb-2 font-cairo">
              FACEBOOK / INSTAGRAM
            </div>
            <div className="space-y-1.5 text-xs font-cairo text-slate-700">
              <div>
                <strong>السن:</strong>{" "}
                {persona.meta_targeting?.age_min}-
                {persona.meta_targeting?.age_max}
              </div>
              <div>
                <strong>المناطق:</strong>{" "}
                {persona.meta_targeting?.locations?.join("، ")}
              </div>
              {persona.meta_targeting?.detailed_interests &&
                persona.meta_targeting.detailed_interests.length > 0 && (
                  <div>
                    <strong>الاهتمامات (للنسخ في Ads Manager):</strong>
                    <div
                      className="mt-1 p-2 bg-white border border-blue-200 rounded font-mono text-[11px] text-slate-700"
                      dir="ltr"
                    >
                      {persona.meta_targeting.detailed_interests.join(", ")}
                    </div>
                  </div>
                )}
            </div>
          </div>
          {/* Google */}
          <div>
            <div className="text-[10px] font-bold text-blue-700 mb-2 font-cairo">
              GOOGLE ADS
            </div>
            <div className="space-y-1.5 text-xs font-cairo text-slate-700">
              {persona.google_targeting?.in_market_segments && (
                <div>
                  <strong>In-Market:</strong>{" "}
                  {persona.google_targeting.in_market_segments.join("، ")}
                </div>
              )}
              {persona.google_targeting?.affinity_segments && (
                <div>
                  <strong>Affinity:</strong>{" "}
                  {persona.google_targeting.affinity_segments.join("، ")}
                </div>
              )}
              {persona.google_targeting?.keyword_themes && (
                <div>
                  <strong>Keywords:</strong>
                  <div
                    className="mt-1 p-2 bg-white border border-blue-200 rounded font-mono text-[11px] text-slate-700"
                    dir="ltr"
                  >
                    {persona.google_targeting.keyword_themes.join(", ")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const INCOME_LABEL: Record<string, string> = {
  low: "محدود",
  lower_middle: "أقل من المتوسط",
  middle: "متوسط",
  upper_middle: "فوق المتوسط",
  high: "مرتفع",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
      <div className="text-xs font-bold text-slate-700 mb-2 font-cairo">
        {title}
      </div>
      {children}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="text-sm font-cairo flex items-baseline gap-2 py-0.5">
      <span className="text-slate-500 text-xs">{label}:</span>
      <span className="text-slate-800 font-bold">{value ?? "—"}</span>
    </div>
  );
}

function Tag({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "cyan";
}) {
  const cls = {
    slate: "bg-white border-slate-300 text-slate-700",
    cyan: "bg-cyan-50 border-cyan-300 text-cyan-700",
  }[tone];
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-cairo ${cls}`}>
      {children}
    </span>
  );
}
