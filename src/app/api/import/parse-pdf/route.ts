// PDF -> structured employee records via Gemini.
//
// Used by /dashboard/employees/import to let HR upload an arbitrary
// "employee roster" PDF (printed from HR software, an offer letter
// archive, an old Excel export converted to PDF, ...) and have the AI
// extract the rows. The endpoint never writes to the DB -- it returns
// the parsed array as JSON so the page can show a preview + confirm
// table. A separate server action does the actual INSERT after the
// user reviews.

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { extractPdfText } from "@/lib/pdf-extract";
import { checkRateLimit } from "@/lib/rate-limit";

const MODEL = "gemini-2.5-flash";

// Schema we want the model to return. Every field except full_name
// is optional -- the AI must use null when uncertain so we don't get
// hallucinated phone numbers or salaries.
const employeeSchema = z.object({
  full_name: z
    .string()
    .min(2)
    .describe("Employee full name in Arabic exactly as written in the document"),
  employee_code: z
    .string()
    .nullable()
    .describe("Employee ID / code if explicitly shown; otherwise null"),
  job_title: z.string().nullable().describe("Job title / role; null if not in the doc"),
  department: z.string().nullable().describe("Department; null if not in the doc"),
  phone: z
    .string()
    .nullable()
    .describe("Mobile phone in Egyptian format (e.g. 010...); null if missing"),
  email: z.string().nullable().describe("Email address; null if missing"),
  hire_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe("ISO date yyyy-mm-dd; null if missing or unparseable"),
  basic_salary: z
    .number()
    .nullable()
    .describe(
      "Basic monthly salary in EGP as a number; null if missing or written as range",
    ),
  national_id: z
    .string()
    .nullable()
    .describe("14-digit Egyptian national ID; null if not present or wrong length"),
});

const responseSchema = z.object({
  employees: z
    .array(employeeSchema)
    .max(200)
    .describe("All employee records found in the document"),
  notes: z
    .string()
    .describe(
      "Brief Arabic note about parsing quality / caveats (e.g. 'تم استخراج 12 موظف بدون رقم قومي')",
    ),
});

const PROMPT_TEMPLATE = `أنت مساعد لاستخراج بيانات الموظفين من ملفات PDF.
المطلوب: تقرأ النص التالي وتستخرج كل صفوف الموظفين الموجودة فيه كـ JSON.

قواعد:
1. استخرج الاسم الكامل بنفس الصياغة الموجودة (عربي زي ما هو).
2. استخدم null لأي حقل غير موجود أو غير واضح - **متختلقش بيانات**.
3. التاريخ بصيغة yyyy-mm-dd بس. لو في الـ PDF "15/3/2024" حوّله لـ "2024-03-15".
4. التليفون بصيغة مصرية: 010xxxxxxxx أو 011 أو 012 أو 015. لو دولي شيل +20.
5. الرقم القومي 14 رقم بالظبط. لو غير ده، خليه null.
6. المرتب رقم بالجنيه. لو في "5,000" حوّله لـ 5000.
7. لو الـ PDF فيه جدول رواتب فيه أسطر مش موظفين (مثل إجمالي / Total / متوسط) -- تجاهلها.
8. لو ما لقيتش أي موظفين، رجّع array فاضية مع notes توضّح.

نص الـ PDF:
---
%TEXT%
---`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // HR-only (admin/manager). Mirrors /api/ai/chat.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    return Response.json(
      { error: "رفع PDF بالـ AI متاح لـ HR فقط" },
      { status: 403 },
    );
  }

  // Rate limit -- this hits Gemini hard. 10 parses / 10 minutes / user.
  const rl = checkRateLimit(`pdf-import:${user.id}`, 10, 10 * 60_000);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({
        error: `كتر شويه على القراءة الذكية -- استنى ${Math.ceil(rl.retryAfterSeconds / 60)} دقيقة وحاول تاني`,
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
    return Response.json(
      { error: "AI configuration missing -- GEMINI_API_KEY not set" },
      { status: 500 },
    );
  }

  let pdfText: string;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "ارفع ملف PDF" }, { status: 400 });
    }
    pdfText = await extractPdfText(file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "غير معروف";
    return Response.json({ error: msg }, { status: 400 });
  }

  // Truncate to keep token usage predictable. ~30k chars ≈ 6-8k tokens.
  const truncated = pdfText.slice(0, 30000);

  try {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    const { object } = await generateObject({
      model: google(MODEL),
      schema: responseSchema,
      prompt: PROMPT_TEMPLATE.replace("%TEXT%", truncated),
      temperature: 0.1, // deterministic-ish
    });

    return Response.json({
      ok: true,
      employees: object.employees,
      notes: object.notes,
      pageBytes: pdfText.length,
      truncated: pdfText.length > 30000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn("parse-pdf failed:", msg);
    return Response.json(
      { error: `الـ AI ما قدرش يقرا الملف -- جرب ملف تاني أو استخدم Excel: ${msg.slice(0, 120)}` },
      { status: 500 },
    );
  }
}
