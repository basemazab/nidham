// PDF -> structured employee records via Gemini.
//
// Sends the PDF bytes directly to Gemini 2.5 Flash as a `file` content
// part instead of pre-extracting text on our side. Three wins over the
// old pdf-parse path:
//
//   1. No more DOMMatrix-is-not-defined crash on Vercel. pdf-parse v2
//      pulls in pdfjs-dist which needs a browser-only DOM API our
//      Node.js runtime doesn't ship.
//   2. Works on scanned PDFs (images-only, no text layer). Gemini
//      does the OCR step transparently.
//   3. Better at messy table layouts -- Gemini sees the visual layout,
//      not just the raw text stream.
//
// The endpoint never writes to the DB. It returns the parsed array as
// JSON so the page can show a preview + confirm table; a separate
// server action handles the actual INSERT.

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const MODEL = "gemini-2.5-flash";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB -- Gemini accepts up to 20

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

const SYSTEM_INSTRUCTIONS = `أنت مساعد لاستخراج بيانات الموظفين من ملفات PDF لشركات مصرية.
هتشوف الـ PDF بصريًا كصور / نصوص، استخرج كل صفوف الموظفين الموجودة كـ JSON.

قواعد دقيقة:
1. استخرج الاسم الكامل بنفس الصياغة الموجودة (عربي زي ما هو، بدون تعديل).
2. استعمل null لأي حقل مش موجود أو مش واضح في الـ PDF -- **متختلقش بيانات أبدًا**.
3. التاريخ بصيغة yyyy-mm-dd حصرًا. لو في "15/3/2024" حوّله لـ "2024-03-15".
4. التليفون بصيغة مصرية محلية: 010xxxxxxxx أو 011 أو 012 أو 015. شيل +20 لو موجود.
5. الرقم القومي 14 رقم بالظبط. لو غير ده، خليه null.
6. المرتب رقم بالجنيه. "5,000" -> 5000. لو في مدى "5000-7000" -> null.
7. تجاهل الأسطر اللي مش موظفين: إجمالي، مجموع، متوسط، Total، Summary، Header.
8. لو ما لقيتش أي موظفين، رجّع employees فاضي مع notes توضّح السبب.
9. notes لازم تكون بالعربي وتحدد عدد الصفوف المستخرجة وأي ملاحظات (مثل: تم تجاهل صف الإجمالي).`;

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

  // Read the uploaded PDF into a Buffer + run cheap sanity checks
  // before paying for an AI call.
  let pdfBytes: Uint8Array;
  let fileName: string;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "ارفع ملف PDF" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json(
        {
          error: `الملف كبير جدًا (${(file.size / 1024 / 1024).toFixed(1)} MB). الحد الأقصى 5 MB.`,
        },
        { status: 400 },
      );
    }
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".pdf") && file.type !== "application/pdf") {
      return Response.json({ error: "لازم الملف يكون PDF" }, { status: 400 });
    }
    pdfBytes = new Uint8Array(await file.arrayBuffer());
    fileName = file.name;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "غير معروف";
    return Response.json({ error: `فشل قراءة الملف: ${msg}` }, { status: 400 });
  }

  try {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    // Send the PDF directly as a file part. Gemini handles the OCR /
    // text extraction internally -- works on text-based and scanned
    // PDFs alike.
    const { object } = await generateObject({
      model: google(MODEL),
      schema: responseSchema,
      temperature: 0.1, // deterministic-ish
      system: SYSTEM_INSTRUCTIONS,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `استخرج بيانات الموظفين من الـ PDF المرفق (${fileName}).`,
            },
            {
              type: "file",
              data: pdfBytes,
              mediaType: "application/pdf",
            },
          ],
        },
      ],
    });

    return Response.json({
      ok: true,
      employees: object.employees,
      notes: object.notes,
      fileSize: pdfBytes.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn("parse-pdf failed:", msg);
    return Response.json(
      {
        error: `الـ AI ما قدرش يقرا الملف -- جرب ملف تاني أو استخدم Excel: ${msg.slice(0, 200)}`,
      },
      { status: 500 },
    );
  }
}
