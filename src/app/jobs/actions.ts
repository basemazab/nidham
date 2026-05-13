"use server";

import { redirect } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { extractPdfText } from "@/lib/pdf-extract";

function asText(value: FormDataEntryValue | null): string | null {
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

/**
 * Public form submission for /jobs/[slug]/apply.
 *
 * Validation:
 *  - honeypot field must be empty (bot trap)
 *  - either a PDF file or pasted CV text must be present
 *  - PDF (if any) is text-extracted server-side
 *
 * The actual write goes through the `submit_public_application` RPC which
 * runs `security definer` — it validates the job is public+open and creates
 * the candidate + application atomically. We then kick off AI screening
 * inline so the HR sees a scored applicant on first view.
 */
export async function submitPublicApplication(
  slug: string,
  formData: FormData,
) {
  // 1. Honeypot — bots fill every input; humans don't see this one.
  // We silently redirect to the public listing rather than back to the
  // form with an error, which would leak that the trap was triggered.
  const honey = asText(formData.get("website"));
  if (honey) {
    redirect("/jobs");
  }

  const fullName = asText(formData.get("full_name"));
  const email = asText(formData.get("email"));
  const phone = asText(formData.get("phone"));
  const currentTitle = asText(formData.get("current_title"));
  const location = asText(formData.get("location"));
  const yearsExperience = asNumber(formData.get("years_experience"));
  const coverLetter = asText(formData.get("cover_letter"));
  const pastedCv = asText(formData.get("cv_text"));

  if (!fullName) {
    redirect(`/jobs/${slug}/apply?error=` + encodeURIComponent("الاسم مطلوب"));
  }
  if (!email) {
    redirect(
      `/jobs/${slug}/apply?error=` + encodeURIComponent("الإيميل مطلوب"),
    );
  }

  // 2. Resolve CV text: PDF takes precedence over pasted text
  const pdfEntry = formData.get("cv_pdf");
  const pdfFile =
    pdfEntry instanceof File && pdfEntry.size > 0 ? pdfEntry : null;

  let cvText: string | null = null;
  if (pdfFile) {
    try {
      cvText = await extractPdfText(pdfFile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فشل قراءة PDF";
      redirect(`/jobs/${slug}/apply?error=` + encodeURIComponent(msg));
    }
  } else if (pastedCv && pastedCv.length >= 30) {
    cvText = pastedCv;
  } else {
    redirect(
      `/jobs/${slug}/apply?error=` +
        encodeURIComponent("لازم ترفع CV أو تلصق النص (30 حرف على الأقل)"),
    );
  }

  // 3. Submit via the RPC — runs as security definer
  const supabase = createPublicClient();
  const { data: appId, error: rpcErr } = await supabase.rpc(
    "submit_public_application",
    {
      p_job_slug: slug,
      p_full_name: fullName,
      p_email: email,
      p_phone: phone,
      p_current_title: currentTitle,
      p_location: location,
      p_years_experience: yearsExperience,
      p_cv_text: cvText,
      p_cv_pdf_url: null, // Phase 2.5: storage upload
      p_cover_letter: coverLetter,
    },
  );

  if (rpcErr || !appId) {
    const message = rpcErr?.message ?? "فشل التقديم";
    redirect(`/jobs/${slug}/apply?error=` + encodeURIComponent(message));
  }

  // 4. Best-effort AI screening — don't block the redirect on it.
  try {
    await screenApplicationInline(appId as string);
  } catch {
    // ai_error is already persisted by the inline helper
  }

  redirect(`/jobs/applied/${appId}`);
}

// ----------------------------------------------------------------------------
// AI screening, callable without a user session (uses the public client).
// We can't rely on RLS here because the candidate isn't logged in — and the
// dashboard's `screenApplicationInline` requires the cookie-based client.
// ----------------------------------------------------------------------------
async function screenApplicationInline(applicationId: string) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not set");
  }

  const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
  const { generateObject } = await import("ai");
  const { buildScreeningPrompt, screeningSchema } = await import(
    "@/lib/recruitment"
  );

  const MODEL = "gemini-2.5-flash";

  // The RLS public select policy only exposes jobs that are public+open, so
  // when we read back the application we need its company-scoped row. The
  // RPC runs as definer, but reads here are anon — so we use a dedicated
  // RPC to fetch the bits we need.
  const supabase = createPublicClient();

  const { data: row, error: readErr } = await supabase.rpc(
    "fetch_application_for_screening",
    { p_app_id: applicationId },
  );

  if (readErr || !row || !Array.isArray(row) || row.length === 0) {
    throw new Error(readErr?.message ?? "Application not readable");
  }

  const r = row[0] as {
    cv_text: string | null;
    job_title: string;
    job_department: string | null;
    job_description: string | null;
    job_requirements: string | null;
    job_responsibilities: string | null;
    job_experience_years_min: number | null;
    job_location: string | null;
    job_type: string | null;
    candidate_full_name: string;
    candidate_current_title: string | null;
    candidate_years_experience: number | null;
    candidate_location: string | null;
  };

  if (!r.cv_text || r.cv_text.length < 30) {
    throw new Error("CV text missing");
  }

  const prompt = buildScreeningPrompt(
    {
      title: r.job_title,
      department: r.job_department,
      description: r.job_description,
      requirements: r.job_requirements,
      responsibilities: r.job_responsibilities,
      experience_years_min: r.job_experience_years_min,
      location: r.job_location,
      job_type: r.job_type,
    },
    {
      full_name: r.candidate_full_name,
      current_title: r.candidate_current_title,
      years_experience: r.candidate_years_experience,
      location: r.candidate_location,
    },
    r.cv_text,
  );

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  try {
    const { object } = await generateObject({
      model: google(MODEL),
      schema: screeningSchema,
      prompt,
      temperature: 0.2,
    });

    await supabase.rpc("save_screening_result", {
      p_app_id: applicationId,
      p_score: object.score,
      p_recommendation: object.recommendation,
      p_summary: object.summary,
      p_strengths: object.strengths,
      p_weaknesses: object.weaknesses,
      p_interview_questions: object.interview_questions,
      p_extracted_skills: object.extracted_skills,
      p_model: MODEL,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.rpc("save_screening_error", {
      p_app_id: applicationId,
      p_error: message.slice(0, 500),
      p_model: MODEL,
    });
    throw err;
  }
}
