"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireHR } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";
import { bustDashboardCache } from "@/lib/cache";

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function asText(value: FormDataEntryValue | null): string | null {
  // Reject non-string FormData entries (e.g., File objects) instead of
  // letting String() coerce them to "[object File]".
  if (value === null || typeof value !== "string") return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

function asNumber(value: FormDataEntryValue | null): number | null {
  const t = asText(value);
  if (t === null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function asInt(value: FormDataEntryValue | null): number | null {
  const t = asText(value);
  if (t === null) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function asBool(value: FormDataEntryValue | null): boolean {
  return value !== null && (value === "on" || value === "true" || value === "1");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[؀-ۿ\s]+/g, "-") // Arabic chars + spaces → dash
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function getCurrentCompanyId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (error || !data) throw new Error("Profile not found");
  return data.company_id as string;
}

// ----------------------------------------------------------------------------
// Jobs
// ----------------------------------------------------------------------------

export async function createJob(formData: FormData) {
  await requireHR();
  const supabase = await createClient();
  const companyId = await getCurrentCompanyId(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const title = asText(formData.get("title"));
  if (!title) {
    redirect(
      "/dashboard/jobs/new?error=" +
        encodeURIComponent("المسمى الوظيفي مطلوب"),
    );
  }

  // Generate a unique-ish slug. If collision, append a short suffix.
  let slug = slugify(title);
  if (slug.length === 0) slug = "job-" + Date.now().toString(36);
  const suffix = Math.random().toString(36).slice(2, 6);
  slug = `${slug}-${suffix}`;

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      company_id: companyId,
      title,
      department: asText(formData.get("department")),
      description: asText(formData.get("description")),
      requirements: asText(formData.get("requirements")),
      responsibilities: asText(formData.get("responsibilities")),
      job_type: asText(formData.get("job_type")) ?? "full_time",
      location: asText(formData.get("location")),
      remote_ok: asBool(formData.get("remote_ok")),
      salary_min: asNumber(formData.get("salary_min")),
      salary_max: asNumber(formData.get("salary_max")),
      experience_years_min: asInt(formData.get("experience_years_min")) ?? 0,
      status: asText(formData.get("status")) ?? "open",
      is_public: asBool(formData.get("is_public")),
      slug,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(
      "/dashboard/jobs/new?error=" +
        encodeURIComponent(arabicizeDbError(error?.message ?? "فشل إنشاء الوظيفة")),
    );
  }

  revalidatePath("/dashboard/jobs");
  bustDashboardCache();
  redirect(`/dashboard/jobs/${data.id}`);
}

export async function updateJob(jobId: string, formData: FormData) {
  const { profile } = await requireHR();
  const supabase = await createClient();

  const title = asText(formData.get("title"));
  if (!title) {
    redirect(
      `/dashboard/jobs/${jobId}/edit?error=` +
        encodeURIComponent("المسمى الوظيفي مطلوب"),
    );
  }

  // RLS hardening: company_id clamp prevents cross-tenant updates under
  // super-admin sessions (mig 038).
  const { error } = await supabase
    .from("jobs")
    .update({
      title,
      department: asText(formData.get("department")),
      description: asText(formData.get("description")),
      requirements: asText(formData.get("requirements")),
      responsibilities: asText(formData.get("responsibilities")),
      job_type: asText(formData.get("job_type")) ?? "full_time",
      location: asText(formData.get("location")),
      remote_ok: asBool(formData.get("remote_ok")),
      salary_min: asNumber(formData.get("salary_min")),
      salary_max: asNumber(formData.get("salary_max")),
      experience_years_min: asInt(formData.get("experience_years_min")) ?? 0,
      status: asText(formData.get("status")) ?? "open",
      is_public: asBool(formData.get("is_public")),
    })
    .eq("id", jobId)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/jobs/${jobId}/edit?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath(`/dashboard/jobs/${jobId}`);
  revalidatePath("/dashboard/jobs");
  bustDashboardCache();
  redirect(`/dashboard/jobs/${jobId}`);
}

export async function deleteJob(jobId: string) {
  const { profile } = await requireHR();
  const supabase = await createClient();
  // RLS hardening: company_id clamp prevents cross-tenant deletes under
  // super-admin sessions (mig 038).
  await supabase
    .from("jobs")
    .delete()
    .eq("id", jobId)
    .eq("company_id", profile.company_id);
  revalidatePath("/dashboard/jobs");
  bustDashboardCache();
  redirect("/dashboard/jobs");
}

export async function changeJobStatus(jobId: string, status: string) {
  const { profile } = await requireHR();
  const supabase = await createClient();
  // RLS hardening: company_id clamp prevents cross-tenant status flips
  // under super-admin sessions (mig 038).
  await supabase
    .from("jobs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("company_id", profile.company_id);
  revalidatePath(`/dashboard/jobs/${jobId}`);
  revalidatePath("/dashboard/jobs");
  bustDashboardCache();
}

// ----------------------------------------------------------------------------
// Applications
// ----------------------------------------------------------------------------

/**
 * Adds a candidate + creates the application + (best effort) kicks the AI
 * screening on the same request. We don't fail the whole flow if AI errors —
 * the application is created and the user can re-run AI from its detail page.
 */
export async function addApplicantToJob(jobId: string, formData: FormData) {
  await requireHR();
  const supabase = await createClient();
  const companyId = await getCurrentCompanyId(supabase);

  const fullName = asText(formData.get("full_name"));
  const cvText = asText(formData.get("cv_text"));

  if (!fullName) {
    redirect(
      `/dashboard/jobs/${jobId}/applications/new?error=` +
        encodeURIComponent("اسم المرشح مطلوب"),
    );
  }
  if (!cvText || cvText.length < 30) {
    redirect(
      `/dashboard/jobs/${jobId}/applications/new?error=` +
        encodeURIComponent("نص الـ CV لازم يكون 30 حرف على الأقل"),
    );
  }

  // 1. Upsert candidate by email-within-company (if email provided), else insert fresh.
  const email = asText(formData.get("email"));
  let candidateId: string | null = null;

  if (email) {
    const { data: existing } = await supabase
      .from("candidates")
      .select("id")
      .eq("company_id", companyId)
      .eq("email", email)
      .maybeSingle();
    if (existing) candidateId = existing.id;
  }

  if (!candidateId) {
    const { data: newCand, error: candErr } = await supabase
      .from("candidates")
      .insert({
        company_id: companyId,
        full_name: fullName,
        email,
        phone: asText(formData.get("phone")),
        linkedin_url: asText(formData.get("linkedin_url")),
        current_title: asText(formData.get("current_title")),
        current_company: asText(formData.get("current_company")),
        years_experience: asNumber(formData.get("years_experience")),
        location: asText(formData.get("location")),
        expected_salary: asNumber(formData.get("expected_salary")),
      })
      .select("id")
      .single();

    if (candErr || !newCand) {
      redirect(
        `/dashboard/jobs/${jobId}/applications/new?error=` +
          encodeURIComponent(arabicizeDbError(candErr?.message ?? "فشل حفظ بيانات المرشح")),
      );
    }
    candidateId = newCand.id;
  } else {
    // Update the existing record with any newly-provided fields
    await supabase
      .from("candidates")
      .update({
        full_name: fullName,
        phone: asText(formData.get("phone")) ?? undefined,
        linkedin_url: asText(formData.get("linkedin_url")) ?? undefined,
        current_title: asText(formData.get("current_title")) ?? undefined,
        current_company: asText(formData.get("current_company")) ?? undefined,
        years_experience:
          asNumber(formData.get("years_experience")) ?? undefined,
        location: asText(formData.get("location")) ?? undefined,
        expected_salary: asNumber(formData.get("expected_salary")) ?? undefined,
      })
      .eq("id", candidateId);
  }

  // 2. Check the application doesn't already exist (unique constraint)
  const { data: dupe } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", jobId)
    .eq("candidate_id", candidateId)
    .maybeSingle();

  if (dupe) {
    redirect(`/dashboard/jobs/${jobId}/applications/${dupe.id}`);
  }

  // 3. Create the application
  const { data: app, error: appErr } = await supabase
    .from("applications")
    .insert({
      company_id: companyId,
      job_id: jobId,
      candidate_id: candidateId,
      cv_text: cvText,
      cover_letter: asText(formData.get("cover_letter")),
      source: "manual",
      status: "new",
    })
    .select("id")
    .single();

  if (appErr || !app) {
    redirect(
      `/dashboard/jobs/${jobId}/applications/new?error=` +
        encodeURIComponent(arabicizeDbError(appErr?.message ?? "فشل حفظ المرشح")),
    );
  }

  // 4. Fire-and-forget the AI screening — best effort. The detail page will
  //    show the result or a "rerun" button if it failed.
  try {
    await screenApplication(app.id);
  } catch {
    // Swallow; the row already has ai_error populated if it was the route.
  }

  revalidatePath(`/dashboard/jobs/${jobId}`);
  redirect(`/dashboard/jobs/${jobId}/applications/${app.id}`);
}

export async function updateApplicationStatus(
  applicationId: string,
  status: string,
  redirectTo: string,
) {
  const { profile } = await requireHR();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS hardening: company_id clamp prevents cross-tenant status flips
  // under super-admin sessions (mig 038).
  await supabase
    .from("applications")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
    })
    .eq("id", applicationId)
    .eq("company_id", profile.company_id);

  revalidatePath(redirectTo);
  redirect(redirectTo);
}

export async function saveApplicationNotes(
  applicationId: string,
  formData: FormData,
) {
  const { profile } = await requireHR();
  const supabase = await createClient();
  const notes = asText(formData.get("hr_notes"));
  const interviewAt = asText(formData.get("interview_at"));

  // RLS hardening: company_id clamp prevents cross-tenant note edits
  // under super-admin sessions (mig 038).
  await supabase
    .from("applications")
    .update({
      hr_notes: notes,
      interview_at: interviewAt,
    })
    .eq("id", applicationId)
    .eq("company_id", profile.company_id);

  // Stay on the same page — scope the lookup too so we don't reveal a
  // job_id belonging to another tenant via the redirect path.
  const { data } = await supabase
    .from("applications")
    .select("job_id")
    .eq("id", applicationId)
    .eq("company_id", profile.company_id)
    .single();

  if (data) {
    revalidatePath(`/dashboard/jobs/${data.job_id}/applications/${applicationId}`);
  }
}

export async function deleteApplication(applicationId: string, jobId: string) {
  const { profile } = await requireHR();
  const supabase = await createClient();
  // RLS hardening: company_id clamp prevents cross-tenant deletes under
  // super-admin sessions (mig 038).
  await supabase
    .from("applications")
    .delete()
    .eq("id", applicationId)
    .eq("company_id", profile.company_id);
  revalidatePath(`/dashboard/jobs/${jobId}`);
  redirect(`/dashboard/jobs/${jobId}`);
}

/**
 * Run AI screening from a server action. We invoke the screening logic
 * inline rather than fetching our own /api/ai/screen-cv route, because
 * a server action can't trivially forward its Supabase auth cookies on
 * a same-origin fetch. The route stays available for client-side calls.
 */
export async function screenApplication(applicationId: string) {
  return screenApplicationInline(applicationId);
}

async function screenApplicationInline(applicationId: string) {
  const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
  const { generateObject } = await import("ai");
  const { buildScreeningPrompt, screeningSchema } = await import(
    "@/lib/recruitment"
  );

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not set");
  }

  const supabase = await createClient();
  const MODEL = "gemini-2.5-flash";

    const { data: app } = await supabase
    .from("applications")
    .select(
      `id, company_id, cv_text,
       jobs(title, department, description, requirements, responsibilities, experience_years_min, location, job_type),
       candidates(full_name, current_title, years_experience, location)`,
    )
    .eq("id", applicationId)
    .single();

  if (!app || !app.jobs || !app.candidates || !app.cv_text) {
    throw new Error("Application missing job/candidate/CV");
  }

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const prompt = buildScreeningPrompt(
    app.jobs as unknown as Parameters<typeof buildScreeningPrompt>[0],
    app.candidates as unknown as Parameters<typeof buildScreeningPrompt>[1],
    app.cv_text,
  );

  try {
    const { object } = await generateObject({
      model: google(MODEL),
      schema: screeningSchema,
      prompt,
      temperature: 0.2,
    });

    await supabase
      .from("applications")
      .update({
        ai_score: object.score,
        ai_recommendation: object.recommendation,
        ai_summary: object.summary,
        ai_strengths: object.strengths,
        ai_weaknesses: object.weaknesses,
        ai_interview_questions: object.interview_questions,
        ai_extracted_skills: object.extracted_skills,
        ai_analyzed_at: new Date().toISOString(),
        ai_model: MODEL,
        ai_error: null,
      })
      .eq("id", applicationId)
      .eq("company_id", app.company_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("applications")
      .update({
        ai_error: message.slice(0, 500),
        ai_analyzed_at: new Date().toISOString(),
        ai_model: MODEL,
      })
      .eq("id", applicationId)
      .eq("company_id", app.company_id);
    throw err;
  }
}

export async function rerunScreening(applicationId: string, jobId: string) {
  try {
    await screenApplicationInline(applicationId);
  } catch {
    // ai_error already persisted
  }
  revalidatePath(`/dashboard/jobs/${jobId}/applications/${applicationId}`);
}
