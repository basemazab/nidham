// AI recruitment helpers -- one endpoint, four modes.
//
//   mode=generate-jd     -> AI writes a full Arabic job description
//                           from minimal input (title + dept + years).
//   mode=match-candidates -> Ranks the tenant's existing candidates
//                           against a job and returns the top N.
//   mode=outreach        -> Personalized Arabic outreach message
//                           for a (candidate × job) pair.
//   mode=boolean-search  -> LinkedIn / Wuzzuf / Google Boolean string
//                           the recruiter can paste into an external
//                           search.
//
// Each mode is HR-only + rate-limited (shared bucket with the other AI
// endpoints) and returns a typed JSON payload via generateObject.

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const MODEL = "gemini-2.5-flash";

// ----------------------------------------------------------------------------
// Schemas, one per mode
// ----------------------------------------------------------------------------

const jdSchema = z.object({
  description: z
    .string()
    .describe(
      "نص تعريفي للوظيفة بالعربي المصري الواضح، 2-3 جمل. يبدأ بـ 'بنبحث عن...'",
    ),
  requirements: z
    .string()
    .describe(
      "المؤهلات والمهارات المطلوبة كـ bullet points بالعربي، كل واحدة على سطر يبدأ بـ '- '",
    ),
  responsibilities: z
    .string()
    .describe(
      "المسؤوليات اليومية كـ bullet points بالعربي، كل واحدة على سطر يبدأ بـ '- '",
    ),
  suggested_salary_min: z
    .number()
    .nullable()
    .describe("اقتراح للحد الأدنى للمرتب بالجنيه المصري للسوق المصري الحالي"),
  suggested_salary_max: z
    .number()
    .nullable()
    .describe("اقتراح للحد الأقصى للمرتب بالجنيه المصري"),
});

const matchSchema = z.object({
  matches: z
    .array(
      z.object({
        candidate_id: z.string().uuid(),
        score: z.number().min(0).max(100),
        reasoning: z
          .string()
          .describe("سطر واحد بالعربي يوضّح ليه ده ترتيبه (نقاط القوة الأساسية)"),
        key_strengths: z
          .array(z.string())
          .max(4)
          .describe("3-4 نقاط قوة محددة من الـ CV / السيرة"),
        gaps: z
          .array(z.string())
          .max(3)
          .describe("نقص أو فجوة محتملة في الـ CV مقارنة بمتطلبات الوظيفة"),
      }),
    )
    .max(20),
});

const outreachSchema = z.object({
  whatsapp_message: z
    .string()
    .describe(
      "رسالة واتساب قصيرة (~5-8 أسطر) بالعربي المصري الودود، تذكر اسم المرشح + المنصب + سبب اختياره. تنتهي بدعوة لمحادثة قصيرة.",
    ),
  email_subject: z
    .string()
    .describe("عنوان إيميل مهني وقصير بالعربي"),
  email_body: z
    .string()
    .describe(
      "نص الإيميل بالعربي الفصيح-المهني (~150 كلمة)، يبدأ بـ 'الأستاذ/...' وينتهي بـ 'تحياتي'",
    ),
});

const booleanSearchSchema = z.object({
  linkedin: z
    .string()
    .describe(
      "Boolean search string for LinkedIn Recruiter / Sales Navigator. Use AND, OR, NOT, quoted phrases, parentheses.",
    ),
  google_xray: z
    .string()
    .describe(
      "Google X-Ray search for LinkedIn public profiles: site:linkedin.com/in (...) -- max 256 chars.",
    ),
  wuzzuf_keywords: z
    .string()
    .describe(
      "Plain Arabic + English keywords for Wuzzuf / Bayt search box, comma-separated.",
    ),
  notes: z
    .string()
    .describe(
      "ملاحظة قصيرة بالعربي عن استعمال السلاسل دي (هل LinkedIn Boolean يحتاج اشتراك Recruiter؟ إلخ)",
    ),
});

// ----------------------------------------------------------------------------
// Request shape
// ----------------------------------------------------------------------------

type Body =
  | {
      mode: "generate-jd";
      title: string;
      department?: string;
      experience_years_min?: number;
      job_type?: string;
      location?: string;
    }
  | {
      mode: "match-candidates";
      job_id: string;
    }
  | {
      mode: "outreach";
      job_id: string;
      candidate_id: string;
    }
  | {
      mode: "boolean-search";
      job_id: string;
    };

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single<{ role: string; company_id: string }>();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    return Response.json({ error: "متاح لـ HR فقط" }, { status: 403 });
  }

  // Shared bucket across all AI recruitment helpers.
  const rl = checkRateLimit(`ai-recruit:${user.id}`, 30, 10 * 60_000);
  if (!rl.ok) {
    return Response.json(
      {
        error: `كتر شويه على المساعد -- استنى ${Math.ceil(rl.retryAfterSeconds / 60)} دقيقة`,
      },
      { status: 429 },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "AI configuration missing -- GEMINI_API_KEY not set" },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  try {
    if (body.mode === "generate-jd") {
      return await handleGenerateJD(body, google);
    }
    if (body.mode === "match-candidates") {
      return await handleMatchCandidates(body, supabase, profile.company_id, google);
    }
    if (body.mode === "outreach") {
      return await handleOutreach(body, supabase, profile.company_id, google);
    }
    if (body.mode === "boolean-search") {
      return await handleBooleanSearch(body, supabase, profile.company_id, google);
    }
    return Response.json({ error: "Unknown mode" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
     
    console.warn("ai-recruit failed:", msg);
    return Response.json(
      { error: `الـ AI ما قدرش يكمّل: ${msg.slice(0, 200)}` },
      { status: 500 },
    );
  }
}

// ----------------------------------------------------------------------------
// generate-jd
// ----------------------------------------------------------------------------

async function handleGenerateJD(
  body: Extract<Body, { mode: "generate-jd" }>,
  google: ReturnType<typeof createGoogleGenerativeAI>,
) {
  if (!body.title || body.title.trim().length < 2) {
    return Response.json({ error: "اكتب اسم الوظيفة" }, { status: 400 });
  }

  const prompt = `أنت خبير موارد بشرية في السوق المصري. اكتب وصف وظيفي احترافي للوظيفة التالية:

- المسمى: ${body.title}
- القسم: ${body.department ?? "غير محدد"}
- الخبرة المطلوبة: ${body.experience_years_min ?? 0} سنين
- نوع التعاقد: ${body.job_type ?? "دوام كامل"}
- الموقع: ${body.location ?? "غير محدد"}

المطلوب:
1. وصف وظيفي جذاب وواضح بالعربي المصري (مش فصحى ثقيلة).
2. متطلبات واقعية للسوق المصري -- متبالغش في عدد سنين الخبرة أو الشهادات.
3. مسؤوليات يومية محددة وعملية.
4. اقتراح راتب يتناسب مع السوق المصري الحالي (2026) للمستوى ده.

استعمل اللغة الواضحة والمحترمة، لا فصحى مبالغ فيها ولا عامية مفرطة.`;

  const { object } = await generateObject({
    model: google(MODEL),
    schema: jdSchema,
    prompt,
    temperature: 0.4,
  });

  return Response.json({ ok: true, ...object });
}

// ----------------------------------------------------------------------------
// match-candidates
// ----------------------------------------------------------------------------

type Candidate = {
  id: string;
  full_name: string;
  current_title: string | null;
  current_company: string | null;
  years_experience: number | null;
  location: string | null;
  expected_salary: number | null;
};

async function handleMatchCandidates(
  body: Extract<Body, { mode: "match-candidates" }>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  google: ReturnType<typeof createGoogleGenerativeAI>,
) {
  // Fetch the job
  const { data: job } = await supabase
    .from("jobs")
    .select(
      "title, department, description, requirements, responsibilities, experience_years_min, location, salary_min, salary_max",
    )
    .eq("id", body.job_id)
    .eq("company_id", companyId)
    .single();

  if (!job) {
    return Response.json({ error: "الوظيفة مش موجودة" }, { status: 404 });
  }

  // Fetch all candidates for the tenant. Cap at 200 to keep prompt size sane.
  const { data: candidates } = await supabase
    .from("candidates")
    .select(
      "id, full_name, current_title, current_company, years_experience, location, expected_salary",
    )
    .eq("company_id", companyId)
    .limit(200)
    .returns<Candidate[]>();

  if (!candidates || candidates.length === 0) {
    return Response.json(
      {
        ok: true,
        matches: [],
        notes:
          "مفيش مرشحين في قاعدة بياناتك لسه. ضيف مرشحين من /dashboard/jobs/[id]/applications/new أو ارفع CVs.",
      },
    );
  }

  const prompt = `أنت خبير اختيار مرشحين للوظائف. عندك:

## الوظيفة:
- المسمى: ${job.title}
- القسم: ${job.department ?? "—"}
- خبرة مطلوبة: ${job.experience_years_min ?? 0} سنين
- الموقع: ${job.location ?? "—"}
- المرتب: ${job.salary_min ?? "—"} - ${job.salary_max ?? "—"} ج
- الوصف: ${job.description ?? "—"}
- المتطلبات: ${job.requirements ?? "—"}

## المرشحين المتاحين (${candidates.length} مرشح):
${candidates
  .map(
    (c, i) =>
      `${i + 1}. [${c.id}] ${c.full_name} -- ${c.current_title ?? "—"} في ${c.current_company ?? "—"}، ${c.years_experience ?? "?"} سنين خبرة، ${c.location ?? "—"}، يطلب ${c.expected_salary ?? "—"} ج`,
  )
  .join("\n")}

المطلوب:
- قيّم كل مرشح من 0-100 على مطابقته للوظيفة دي.
- رجّع **أحسن 10 مرشحين فقط** (مرتبين تنازليًا).
- لو في أقل من 10 مرشحين كويسين (سكور > 40)، رجّع اللي عدوا الـ 40 بس.
- في reasoning: سطر واحد عربي يوضّح ليه ده الترتيب ده.
- في key_strengths: 3-4 نقاط قوة حقيقية مذكورة في بيانات المرشح.
- في gaps: 0-3 نقاط ضعف محتملة (نقص في الخبرة، الموقع بعيد، إلخ).
- استعمل candidate_id من الـ ID المعروض بين الأقواس المربعة [...].`;

  const { object } = await generateObject({
    model: google(MODEL),
    schema: matchSchema,
    prompt,
    temperature: 0.2,
  });

  // Enrich with candidate names so the UI can render without a second roundtrip
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const enriched = object.matches
    .map((m) => {
      const c = byId.get(m.candidate_id);
      return c ? { ...m, candidate: c } : null;
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  return Response.json({ ok: true, matches: enriched });
}

// ----------------------------------------------------------------------------
// outreach
// ----------------------------------------------------------------------------

async function handleOutreach(
  body: Extract<Body, { mode: "outreach" }>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  google: ReturnType<typeof createGoogleGenerativeAI>,
) {
  const [{ data: job }, { data: candidate }, { data: company }] = await Promise.all([
    supabase
      .from("jobs")
      .select("title, department, location, salary_min, salary_max")
      .eq("id", body.job_id)
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("candidates")
      .select(
        "full_name, current_title, current_company, years_experience, location",
      )
      .eq("id", body.candidate_id)
      .eq("company_id", companyId)
      .single(),
    supabase.from("companies").select("name").eq("id", companyId).single(),
  ]);

  if (!job || !candidate) {
    return Response.json({ error: "بيانات ناقصة" }, { status: 404 });
  }

  const prompt = `اكتب رسالتين تواصل مع مرشح:

## الشركة: ${company?.name ?? "شركتنا"}

## الوظيفة:
${job.title} -- ${job.department ?? "—"} -- ${job.location ?? "—"} -- مرتب ${job.salary_min ?? "—"} الى ${job.salary_max ?? "—"} ج

## المرشح:
${candidate.full_name} -- ${candidate.current_title ?? "—"} في ${candidate.current_company ?? "—"} -- ${candidate.years_experience ?? "?"} سنين خبرة

ولّد:
1. رسالة WhatsApp قصيرة، عربي مصري ودود، تذكر اسمه الأول + المنصب + ليه اختاريناه + دعوة لمحادثة 15 دقيقة. ما تستخدمش "سيد" أو "حضرتك" -- بساطة.
2. عنوان إيميل قصير ومهني.
3. نص إيميل بالعربي المهني (~150 كلمة): تحية + تعريف بالشركة + الوظيفة + لماذا مهتمين به + دعوة لمكالمة.`;

  const { object } = await generateObject({
    model: google(MODEL),
    schema: outreachSchema,
    prompt,
    temperature: 0.6,
  });

  return Response.json({ ok: true, ...object });
}

// ----------------------------------------------------------------------------
// boolean-search
// ----------------------------------------------------------------------------

async function handleBooleanSearch(
  body: Extract<Body, { mode: "boolean-search" }>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  google: ReturnType<typeof createGoogleGenerativeAI>,
) {
  const { data: job } = await supabase
    .from("jobs")
    .select(
      "title, department, requirements, experience_years_min, location",
    )
    .eq("id", body.job_id)
    .eq("company_id", companyId)
    .single();

  if (!job) {
    return Response.json({ error: "الوظيفة مش موجودة" }, { status: 404 });
  }

  const prompt = `ولّد سلاسل بحث Boolean لـ recruiter يبحث عن مرشحين خارجيًا (الـ Nidham عندو DB داخلي بس HR محتاج برضو يدوّر برّه):

## الوظيفة:
- المسمى: ${job.title}
- القسم: ${job.department ?? "—"}
- خبرة: ${job.experience_years_min ?? 0}+ سنين
- الموقع: ${job.location ?? "Cairo / Egypt"}
- المتطلبات: ${(job.requirements ?? "—").slice(0, 500)}

ولّد:
1. **linkedin**: Boolean string للـ LinkedIn Recruiter. استعمل AND / OR / NOT / "phrases" / (parentheses). جمع الـ synonyms للمسمى (مثلا "Backend Engineer" OR "Backend Developer" OR "API Developer"). استبعد الـ "Junior" أو "Intern" لو الخبرة المطلوبة كبيرة.
2. **google_xray**: X-ray search على LinkedIn العام: site:linkedin.com/in (...) -- أقل من 256 حرف.
3. **wuzzuf_keywords**: كلمات مفتاحية عربي + إنجليزي مفصولة بفاصلة لخانة البحث في Wuzzuf / Bayt.
4. **notes**: ملاحظة قصيرة بالعربي عن المتطلبات (مثلاً: "LinkedIn Boolean يحتاج اشتراك Recruiter أو Sales Navigator").`;

  const { object } = await generateObject({
    model: google(MODEL),
    schema: booleanSearchSchema,
    prompt,
    temperature: 0.3,
  });

  return Response.json({ ok: true, ...object });
}
