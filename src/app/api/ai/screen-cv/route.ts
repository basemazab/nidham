import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildScreeningPrompt,
  screeningSchema,
  type JobForScreening,
  type CandidateForScreening,
} from "@/lib/recruitment";

const MODEL = "gemini-2.5-flash";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const maxDuration = 60;

type Body = { applicationId?: string };

type JobRow = JobForScreening & { id: string; company_id: string };
type CandidateRow = CandidateForScreening & { id: string };
type AppRow = {
  id: string;
  company_id: string;
  cv_text: string | null;
  jobs: JobRow | null;
  candidates: CandidateRow | null;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  // HR-only -- this endpoint reads CVs + writes AI scores to applications.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    return jsonError("الفحص الذكي مخصص لـ HR فقط", 403);
  }

  // Rate limit: 40 screenings / 10 minutes per user -- enough to clear an
  // application backlog in a sprint without enabling a runaway loop.
  const rl = checkRateLimit(`ai-screen:${user.id}`, 40, 10 * 60_000);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({
        error: `كتر شويه على الفحص — جرب تاني بعد ${Math.ceil(rl.retryAfterSeconds / 60)} دقيقة`,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfterSeconds),
        },
      },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return jsonError("AI configuration missing — GEMINI_API_KEY not set", 500);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const applicationId = body.applicationId?.trim();
  if (!applicationId) {
    return jsonError("applicationId is required", 400);
  }

  // Pull the application + nested job + candidate. RLS scopes to tenant.
  const { data: app, error: fetchErr } = await supabase
    .from("applications")
    .select(
      `id, company_id, cv_text,
       jobs(id, company_id, title, department, description, requirements, responsibilities, experience_years_min, location, job_type),
       candidates(id, full_name, current_title, years_experience, location)`,
    )
    .eq("id", applicationId)
    .single<AppRow>();

  if (fetchErr || !app) {
    return jsonError("Application not found", 404);
  }
  if (!app.jobs || !app.candidates) {
    return jsonError("Application is missing job or candidate", 400);
  }
  if (!app.cv_text || app.cv_text.trim().length < 30) {
    return jsonError(
      "CV نص فاضي أو قصير جدًا — حط نص السيرة الذاتية الأول",
      400,
    );
  }

  const prompt = buildScreeningPrompt(app.jobs, app.candidates, app.cv_text);

  try {
    const { object } = await generateObject({
      model: google(MODEL),
      schema: screeningSchema,
      prompt,
      temperature: 0.2, // deterministic-ish — we want consistent scoring
    });

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("applications")
      .update({
        ai_score: object.score,
        ai_recommendation: object.recommendation,
        ai_summary: object.summary,
        ai_strengths: object.strengths,
        ai_weaknesses: object.weaknesses,
        ai_interview_questions: object.interview_questions,
        ai_extracted_skills: object.extracted_skills,
        ai_analyzed_at: now,
        ai_model: MODEL,
        ai_error: null,
      })
      .eq("id", applicationId);

    if (updateErr) {
      return jsonError(`Saved AI but DB update failed: ${updateErr.message}`, 500);
    }

    return Response.json({ ok: true, result: object });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Persist the failure so the UI can show "حاول تاني" instead of staying silent
    await supabase
      .from("applications")
      .update({
        ai_error: message.slice(0, 500),
        ai_analyzed_at: new Date().toISOString(),
        ai_model: MODEL,
      })
      .eq("id", applicationId);

    return jsonError(`AI screening failed: ${message}`, 500);
  }
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
