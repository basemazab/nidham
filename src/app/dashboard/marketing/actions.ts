"use server";

// ============================================================================
// Marketing Studio server actions
// ============================================================================
//
// Five action groups, one per tool:
//   - Projects: create / archive / update product summary
//   - Personas: regenerate from product summary
//   - Ad creatives: generate + save + approve
//   - SEO keywords: generate + save + status updates
//   - Campaign strategy: generate + save
//
// All AI calls run through /lib/marketing-ai.ts which uses the Groq -> Gemini
// multi-provider fallback. Failures degrade gracefully — the page renders
// the error and lets the user retry.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHR } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { arabicizeDbError } from "@/lib/i18n";
import {
  analyzeProduct,
  generatePersonas,
  generateAdCopy,
  suggestKeywords,
  generateCampaignStrategy,
} from "@/lib/marketing-ai";

async function gateEnterprise() {
  const { profile, supabase } = await requireHR();
  if (!(await canUseFeature("marketing_studio"))) {
    redirect(
      "/dashboard?error=" +
        encodeURIComponent("Marketing Studio متاح للنسخة Enterprise فقط"),
    );
  }
  return { profile, supabase };
}

// ----------------------------------------------------------------------------
// Projects
// ----------------------------------------------------------------------------
export async function createMarketingProject(formData: FormData) {
  const { profile, supabase } = await gateEnterprise();

  const name = String(formData.get("name") ?? "").trim();
  const product_summary = String(formData.get("product_summary") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim() || null;
  const target_market =
    String(formData.get("target_market") ?? "").trim() || "Egypt";

  if (name.length < 2) {
    redirect(
      "/dashboard/marketing?error=" +
        encodeURIComponent("اسم المشروع لازم 2 حروف على الأقل"),
    );
  }

  const { data, error } = await supabase
    .from("marketing_projects")
    .insert({
      company_id: profile.company_id,
      name,
      product_summary: product_summary || null,
      industry,
      target_market,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(
      "/dashboard/marketing?error=" +
        encodeURIComponent(arabicizeDbError(error?.message ?? "فشل الإنشاء")),
    );
  }

  revalidatePath("/dashboard/marketing");
  redirect(`/dashboard/marketing/${data.id}`);
}

export async function archiveMarketingProject(formData: FormData) {
  const { profile, supabase } = await gateEnterprise();
  const projectId = String(formData.get("project_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) {
    redirect("/dashboard/marketing");
  }
  await supabase
    .from("marketing_projects")
    .update({ status: "archived" })
    .eq("id", projectId)
    .eq("company_id", profile.company_id);

  revalidatePath("/dashboard/marketing");
  redirect("/dashboard/marketing");
}

// ----------------------------------------------------------------------------
// Product Analyzer — run AI + save the analysis to the project
// ----------------------------------------------------------------------------
export async function runProductAnalysis(formData: FormData) {
  const { profile, supabase } = await gateEnterprise();
  const projectId = String(formData.get("project_id") ?? "").trim();

  const { data: project } = await supabase
    .from("marketing_projects")
    .select("id, name, product_summary, industry, target_market")
    .eq("id", projectId)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (!project || !project.product_summary) {
    redirect(
      `/dashboard/marketing/${projectId}?error=` +
        encodeURIComponent("اكتب وصف للمنتج أولاً"),
    );
  }

  try {
    const analysis = await analyzeProduct({
      product_summary: project.product_summary,
      industry: project.industry,
      target_market: project.target_market ?? "Egypt",
    });
    await supabase
      .from("marketing_projects")
      .update({ ai_analysis: analysis, updated_at: new Date().toISOString() })
      .eq("id", projectId);
  } catch (err) {
    redirect(
      `/dashboard/marketing/${projectId}?error=` +
        encodeURIComponent(
          err instanceof Error
            ? err.message.slice(0, 150)
            : "فشل التحليل — جرّب تاني",
        ),
    );
  }

  revalidatePath(`/dashboard/marketing/${projectId}`);
  redirect(`/dashboard/marketing/${projectId}?analyzed=1`);
}

// ----------------------------------------------------------------------------
// Audience Builder — generate personas
// ----------------------------------------------------------------------------
export async function runAudienceBuilder(formData: FormData) {
  const { profile, supabase } = await gateEnterprise();
  const projectId = String(formData.get("project_id") ?? "").trim();

  const { data: project } = await supabase
    .from("marketing_projects")
    .select("id, product_summary, industry, ai_analysis")
    .eq("id", projectId)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (!project || !project.product_summary) {
    redirect(
      `/dashboard/marketing/${projectId}?error=` +
        encodeURIComponent("اكتب وصف للمنتج أولاً"),
    );
  }

  try {
    const result = await generatePersonas({
      product_summary: project.product_summary,
      industry: project.industry,
      analysis: project.ai_analysis as
        | Awaited<ReturnType<typeof analyzeProduct>>
        | undefined,
    });

    // Wipe existing personas + insert new
    await supabase.from("marketing_personas").delete().eq("project_id", projectId);

    const rows = result.personas.map((p, i) => ({
      company_id: profile.company_id,
      project_id: projectId,
      name: p.name,
      demographics: p.demographics,
      psychographics: p.psychographics,
      pain_points: p.pain_points,
      goals: p.goals,
      buying_journey: p.buying_journey,
      meta_targeting: p.meta_targeting,
      google_targeting: p.google_targeting,
      tiktok_targeting: {},
      priority: i === result.primary_persona_index ? 1 : i + 2,
    }));

    const { error } = await supabase.from("marketing_personas").insert(rows);
    if (error) {
      redirect(
        `/dashboard/marketing/${projectId}/personas?error=` +
          encodeURIComponent(arabicizeDbError(error.message)),
      );
    }
  } catch (err) {
    redirect(
      `/dashboard/marketing/${projectId}/personas?error=` +
        encodeURIComponent(
          err instanceof Error
            ? err.message.slice(0, 150)
            : "فشل توليد الـ personas — جرّب تاني",
        ),
    );
  }

  revalidatePath(`/dashboard/marketing/${projectId}/personas`);
  redirect(`/dashboard/marketing/${projectId}/personas?generated=1`);
}

// ----------------------------------------------------------------------------
// Ad Copy Generator
// ----------------------------------------------------------------------------
export async function runAdCopyGenerator(formData: FormData) {
  const { profile, supabase } = await gateEnterprise();
  const projectId = String(formData.get("project_id") ?? "").trim();
  const goal = String(formData.get("goal") ?? "sales").trim();
  const platforms = formData
    .getAll("platforms")
    .map((p) => String(p))
    .filter((p) =>
      ["meta", "google", "tiktok", "instagram"].includes(p),
    ) as ("meta" | "google" | "tiktok" | "instagram")[];
  const personaId = String(formData.get("persona_id") ?? "").trim() || null;

  if (platforms.length === 0) {
    redirect(
      `/dashboard/marketing/${projectId}/ads?error=` +
        encodeURIComponent("اختر منصة واحدة على الأقل"),
    );
  }

  const { data: project } = await supabase
    .from("marketing_projects")
    .select("product_summary")
    .eq("id", projectId)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (!project?.product_summary) {
    redirect(
      `/dashboard/marketing/${projectId}/ads?error=` +
        encodeURIComponent("اكتب وصف المنتج أولاً"),
    );
  }

  let persona = null;
  if (personaId && /^[0-9a-f-]{36}$/i.test(personaId)) {
    const { data: p } = await supabase
      .from("marketing_personas")
      .select("*")
      .eq("id", personaId)
      .eq("company_id", profile.company_id)
      .maybeSingle();
    persona = p;
  }

  try {
    const result = await generateAdCopy({
      product_summary: project.product_summary,
      persona: persona as Parameters<typeof generateAdCopy>[0]["persona"],
      platforms,
      goal,
      count: 5,
    });

    const rows = result.creatives.map((c) => ({
      company_id: profile.company_id,
      project_id: projectId,
      persona_id: personaId,
      platform: c.platform,
      format: c.format,
      headline: c.headline,
      body: c.body,
      cta: c.cta,
      hook: c.hook,
      creative_concept: c.creative_concept,
    }));

    const { error } = await supabase.from("marketing_ad_creatives").insert(rows);
    if (error) {
      redirect(
        `/dashboard/marketing/${projectId}/ads?error=` +
          encodeURIComponent(arabicizeDbError(error.message)),
      );
    }
  } catch (err) {
    redirect(
      `/dashboard/marketing/${projectId}/ads?error=` +
        encodeURIComponent(
          err instanceof Error
            ? err.message.slice(0, 150)
            : "فشل توليد الإعلانات",
        ),
    );
  }

  revalidatePath(`/dashboard/marketing/${projectId}/ads`);
  redirect(`/dashboard/marketing/${projectId}/ads?generated=1`);
}

// ----------------------------------------------------------------------------
// SEO Master
// ----------------------------------------------------------------------------
export async function runSeoMaster(formData: FormData) {
  const { profile, supabase } = await gateEnterprise();
  const projectId = String(formData.get("project_id") ?? "").trim();
  const currentUrl = String(formData.get("current_url") ?? "").trim() || null;

  const { data: project } = await supabase
    .from("marketing_projects")
    .select("product_summary, industry")
    .eq("id", projectId)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (!project?.product_summary) {
    redirect(
      `/dashboard/marketing/${projectId}/seo?error=` +
        encodeURIComponent("اكتب وصف المنتج أولاً"),
    );
  }

  try {
    const result = await suggestKeywords({
      product_summary: project.product_summary,
      industry: project.industry,
      current_url: currentUrl,
    });

    await supabase
      .from("marketing_keywords")
      .delete()
      .eq("project_id", projectId);

    const rows = result.keywords.map((k) => ({
      company_id: profile.company_id,
      project_id: projectId,
      keyword: k.keyword,
      intent: k.intent,
      search_volume: k.search_volume_estimate,
      difficulty: k.difficulty_estimate,
      content_type: k.content_type,
      suggested_title: k.suggested_title,
      content_outline: k.content_outline,
      priority: k.priority,
    }));

    const { error } = await supabase.from("marketing_keywords").insert(rows);
    if (error) {
      redirect(
        `/dashboard/marketing/${projectId}/seo?error=` +
          encodeURIComponent(arabicizeDbError(error.message)),
      );
    }

    // Save strategy text into the project's ai_analysis under "seo_strategy"
    await supabase
      .from("marketing_projects")
      .update({
        ai_analysis: {
          ...(project as { ai_analysis?: Record<string, unknown> }).ai_analysis,
          seo_strategy: result.content_strategy,
          quick_wins: result.quick_wins,
          long_term_focus: result.long_term_focus,
        },
      })
      .eq("id", projectId);
  } catch (err) {
    redirect(
      `/dashboard/marketing/${projectId}/seo?error=` +
        encodeURIComponent(
          err instanceof Error
            ? err.message.slice(0, 150)
            : "فشل تحليل SEO",
        ),
    );
  }

  revalidatePath(`/dashboard/marketing/${projectId}/seo`);
  redirect(`/dashboard/marketing/${projectId}/seo?generated=1`);
}

// ----------------------------------------------------------------------------
// Campaign Strategy
// ----------------------------------------------------------------------------
export async function runCampaignWizard(formData: FormData) {
  const { profile, supabase } = await gateEnterprise();
  const projectId = String(formData.get("project_id") ?? "").trim();
  const goal = String(formData.get("goal") ?? "sales").trim();
  const totalBudget = parseFloat(String(formData.get("total_budget") ?? "0"));
  const durationDays = parseInt(String(formData.get("duration_days") ?? "30"), 10);

  if (!Number.isFinite(totalBudget) || totalBudget <= 0) {
    redirect(
      `/dashboard/marketing/${projectId}/campaign?error=` +
        encodeURIComponent("الميزانية لازم تكون أكبر من صفر"),
    );
  }

  const { data: project } = await supabase
    .from("marketing_projects")
    .select("product_summary")
    .eq("id", projectId)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (!project?.product_summary) {
    redirect(
      `/dashboard/marketing/${projectId}/campaign?error=` +
        encodeURIComponent("اكتب وصف المنتج أولاً"),
    );
  }

  // Pull existing personas (if any) to feed into the strategy
  const { data: personas } = await supabase
    .from("marketing_personas")
    .select(
      "name, demographics, psychographics, pain_points, goals, buying_journey, meta_targeting, google_targeting",
    )
    .eq("project_id", projectId)
    .eq("company_id", profile.company_id)
    .order("priority");

  try {
    const strategy = await generateCampaignStrategy({
      product_summary: project.product_summary,
      goal,
      total_budget: totalBudget,
      duration_days: durationDays,
      personas: personas as Parameters<
        typeof generateCampaignStrategy
      >[0]["personas"],
    });

    const { data: created, error } = await supabase
      .from("marketing_campaigns")
      .insert({
        company_id: profile.company_id,
        project_id: projectId,
        name: strategy.campaign_name,
        goal: strategy.recommended_goal,
        platforms: strategy.budget_allocation.map((b) => b.platform),
        budget_total: totalBudget,
        budget_daily: strategy.daily_budget_recommendation.recommended_daily,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date(Date.now() + durationDays * 86400000)
          .toISOString()
          .slice(0, 10),
        ai_strategy: strategy,
      })
      .select("id")
      .single();

    if (error || !created) {
      redirect(
        `/dashboard/marketing/${projectId}/campaign?error=` +
          encodeURIComponent(arabicizeDbError(error?.message ?? "فشل الحفظ")),
      );
    }
  } catch (err) {
    redirect(
      `/dashboard/marketing/${projectId}/campaign?error=` +
        encodeURIComponent(
          err instanceof Error
            ? err.message.slice(0, 150)
            : "فشل توليد الاستراتيجية",
        ),
    );
  }

  revalidatePath(`/dashboard/marketing/${projectId}/campaign`);
  redirect(`/dashboard/marketing/${projectId}/campaign?generated=1`);
}
