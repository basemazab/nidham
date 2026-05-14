// ============================================================================
// /api/ai/parse-file — Server-side file parsing for the AI chat.
// ============================================================================
//
// The AI chat lets users upload Excel/CSV files and ask the agent to act
// on them (e.g. "ضيف الموظفين دول"). This endpoint does the heavy lifting:
//
//   1) Accept the file via FormData
//   2) Detect type (Excel / CSV)
//   3) Parse → produce structured headers + rows
//   4) Return JSON the client can embed in the next chat message
//
// The AI then uses tools (bulk_import_employees / bulk_import_attendance)
// to act on the structured data. Field mapping is handled by the LLM since
// Egyptian SMB Excel files come in dozens of column-name variants.
//
// PDF parsing is intentionally NOT here — the existing /api/import/parse-pdf
// endpoint handles PDFs via Gemini multimodal, and PDF imports go through
// the dedicated /dashboard/employees/import flow with a manual review step.
// V2 may unify these.

import * as XLSX from "xlsx";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

// PDFs need a bit more time because Gemini runs OCR + structured
// output on top of vision. 60s is the Vercel hobby/pro hard ceiling.
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 500; // hard cap so we don't blow up Gemini context

type ParsedRow = Record<string, string | number | null>;

export async function POST(req: Request) {
  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // HR-only (admin/manager) — same gate as /api/ai/agent
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    return Response.json(
      { error: "رفع الملفات للمساعد الذكي مخصص لـ HR فقط" },
      { status: 403 },
    );
  }

  // Rate limit
  const rl = checkRateLimit(`ai-file:${user.id}`, 15, 10 * 60_000);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({
        error: `كتر شويه على رفع الملفات — جرب تاني بعد ${Math.ceil(rl.retryAfterSeconds / 60)} دقيقة`,
      }),
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  // Read + validate
  let file: File;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File) || f.size === 0) {
      return Response.json({ error: "ارفع ملف" }, { status: 400 });
    }
    if (f.size > MAX_BYTES) {
      return Response.json(
        {
          error: `الملف كبير جدًا (${(f.size / 1024 / 1024).toFixed(1)} MB). الحد الأقصى 5 MB.`,
        },
        { status: 400 },
      );
    }
    file = f;
  } catch {
    return Response.json({ error: "فشل قراءة الملف" }, { status: 400 });
  }

  const lowerName = file.name.toLowerCase();
  const isExcel =
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".csv");
  const isPdf =
    lowerName.endsWith(".pdf") || file.type === "application/pdf";

  if (!isExcel && !isPdf) {
    return Response.json(
      {
        error: "النوع ده مش مدعوم. ارفع Excel (.xlsx, .xls), CSV, أو PDF.",
      },
      { status: 400 },
    );
  }

  // ============================== PDF PATH ===============================
  // Gemini Flash 2.5 multimodal — same approach as /api/import/parse-pdf.
  // We ask it to classify the document AND extract structured rows so
  // the response shape matches the Excel path exactly. The AI Agent then
  // doesn't care which file type was uploaded.
  if (isPdf) {
    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        { error: "AI configuration missing — GEMINI_API_KEY not set" },
        { status: 500 },
      );
    }
    return parsePdfWithGemini(file);
  }

  // Parse Excel
  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    return Response.json({ error: "فشل قراءة محتوى الملف" }, { status: 400 });
  }

  // Try multiple codepages (cp1256 first for Arabic, then UTF-8 / cp1252)
  // This is the same defense the /dashboard/employees/import uses against
  // ZK fingerprint Excels that mis-declare their encoding.
  const codepages = [1256, 65001, 1252, 0];
  let workbook: XLSX.WorkBook | null = null;
  for (const cp of codepages) {
    try {
      workbook = XLSX.read(bytes, {
        type: "array",
        cellDates: false,
        codepage: cp || undefined,
      });
      break;
    } catch {
      // try next codepage
    }
  }
  if (!workbook || workbook.SheetNames.length === 0) {
    return Response.json(
      { error: "فشل فك ضغط الملف. تأكد إنه Excel سليم." },
      { status: 400 },
    );
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  // header: 1 returns raw rows as arrays (no auto-key inference)
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: null,
  }) as unknown[][];

  if (matrix.length === 0) {
    return Response.json(
      { error: "الملف فاضي" },
      { status: 400 },
    );
  }

  // Smart header detection: scan first 15 rows for the one with the most
  // non-empty string cells (best heuristic for HR-tool exports that
  // include a logo/title row before the actual table)
  const headerRowIndex = pickHeaderRow(matrix);
  const headersRaw = (matrix[headerRowIndex] ?? []) as unknown[];
  const headers = headersRaw
    .map((h) => (typeof h === "string" ? h.trim() : String(h ?? "").trim()))
    .filter(Boolean);

  if (headers.length === 0) {
    return Response.json(
      { error: "ما عرفش يلاقي عناوين الأعمدة. تأكد إن الصف الأول هو العناوين." },
      { status: 400 },
    );
  }

  // Data rows = everything after the header row
  const dataRows = matrix.slice(headerRowIndex + 1);
  const parsed: ParsedRow[] = [];
  for (const raw of dataRows) {
    if (!Array.isArray(raw)) continue;
    const obj: ParsedRow = {};
    let hasAnyValue = false;
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      const cell = raw[i];
      if (cell === null || cell === undefined || cell === "") {
        obj[key] = null;
        continue;
      }
      if (typeof cell === "number") {
        obj[key] = cell;
        hasAnyValue = true;
      } else {
        const s = String(cell).trim();
        obj[key] = s.length ? s : null;
        if (s.length) hasAnyValue = true;
      }
    }
    if (hasAnyValue) parsed.push(obj);
    if (parsed.length >= MAX_ROWS) break;
  }

  // Heuristic detection of file type so the AI can pick the right tool
  const hint = detectHint(headers);

  return Response.json({
    ok: true,
    filename: file.name,
    size: file.size,
    sheet_name: sheetName,
    headers,
    row_count: parsed.length,
    truncated: dataRows.length > MAX_ROWS,
    rows: parsed,
    hint, // 'employees' | 'attendance' | 'unknown'
    notes: buildNotes(parsed.length, dataRows.length, hint),
  });
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function pickHeaderRow(matrix: unknown[][]): number {
  let bestIdx = 0;
  let bestScore = -1;
  const max = Math.min(matrix.length, 15);
  for (let i = 0; i < max; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    let nonEmpty = 0;
    for (const c of row) {
      if (typeof c === "string" && c.trim().length > 0) nonEmpty++;
      else if (typeof c === "number") nonEmpty++;
    }
    // Prefer rows with 3+ non-empty cells (likely actual headers, not
    // a logo line or document title)
    if (nonEmpty >= 3 && nonEmpty > bestScore) {
      bestScore = nonEmpty;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// Lightweight pattern matching to hint at file type. Not authoritative —
// the AI agent confirms via the user before importing.
function detectHint(headers: string[]): "employees" | "attendance" | "unknown" {
  const blob = headers.join(" ").toLowerCase();
  const hasName =
    blob.includes("اسم") ||
    blob.includes("الاسم") ||
    blob.includes("name") ||
    blob.includes("الإسم");
  const hasCode =
    blob.includes("كود") ||
    blob.includes("code") ||
    blob.includes("رقم الموظف") ||
    blob.includes("id");
  const hasSalary =
    blob.includes("راتب") ||
    blob.includes("مرتب") ||
    blob.includes("salary") ||
    blob.includes("الأساسي");
  const hasJobTitle =
    blob.includes("وظيف") || blob.includes("title") || blob.includes("مسمى");
  const hasDate =
    blob.includes("تاريخ") || blob.includes("date") || blob.includes("اليوم");
  const hasTime =
    blob.includes("وقت") ||
    blob.includes("time") ||
    blob.includes("الحضور") ||
    blob.includes("الانصراف") ||
    blob.includes("بصمة") ||
    blob.includes("البصمه");

  if (hasName && (hasSalary || hasJobTitle)) return "employees";
  if (hasDate && hasTime) return "attendance";
  if (hasName && hasCode && !hasSalary) return "employees"; // fallback
  return "unknown";
}

function buildNotes(parsedCount: number, totalCount: number, hint: string): string {
  const parts: string[] = [];
  parts.push(`اتقرى ${parsedCount} صف من الملف`);
  if (totalCount > MAX_ROWS) {
    parts.push(`(الحد الأقصى ${MAX_ROWS} صف، الباقي اتجاهل)`);
  }
  if (hint === "employees") parts.push("الملف يبدو إنه كشف موظفين");
  else if (hint === "attendance") parts.push("الملف يبدو إنه كشف حضور");
  return parts.join(" · ");
}

// ============================================================================
// PDF parsing via Gemini multimodal
// ============================================================================
//
// We send the raw PDF bytes to Gemini Flash 2.5 and ask for a structured
// JSON response. The schema covers TWO data shapes (employees, attendance)
// plus a free-form summary for "other" documents (contracts, memos, etc).
// We normalize whichever branch came back into the same { headers, rows }
// shape the Excel path returns — so the chat UI + the AI Agent's
// bulk_import_* tools don't care which file type was uploaded.

const employeeRowSchema = z.object({
  full_name: z.string().describe("اسم الموظف كما هو في الملف"),
  employee_code: z.string().nullable().describe("كود الموظف لو موجود"),
  job_title: z.string().nullable(),
  department: z.string().nullable(),
  phone: z.string().nullable().describe("11 رقم مصري، شيل +20 لو موجود"),
  email: z.string().nullable(),
  hire_date: z
    .string()
    .nullable()
    .describe("YYYY-MM-DD فقط، null لو غير واضح"),
  basic_salary: z
    .number()
    .nullable()
    .describe("راتب أساسي بالجنيه كرقم، null لو مدى أو ناقص"),
  national_id: z
    .string()
    .nullable()
    .describe("14 رقم بالظبط، أي حاجة تانية = null"),
});

const attendanceRowSchema = z.object({
  employee_name: z
    .string()
    .nullable()
    .describe("اسم الموظف اللي السجل بتاعه"),
  employee_code: z.string().nullable(),
  date: z.string().describe("YYYY-MM-DD"),
  status: z
    .enum([
      "present",
      "absent",
      "half_day",
      "leave",
      "holiday",
      "weekend",
    ])
    .nullable(),
  check_in: z
    .string()
    .nullable()
    .describe("HH:MM أو HH:MM:SS، null لو ناقص"),
  check_out: z.string().nullable(),
  tardiness_minutes: z.number().nullable(),
  early_leave_minutes: z.number().nullable(),
});

const pdfSchema = z.object({
  // Gemini picks ONE based on what's in the PDF
  type: z
    .enum(["employees", "attendance", "other"])
    .describe(
      "نوع المحتوى: employees لو كشف موظفين، attendance لو كشف حضور، other لو حاجة تانية (عقد، مذكرة...)",
    ),
  employees: z
    .array(employeeRowSchema)
    .max(200)
    .describe("لو type='employees', الموظفين المستخرجين. لو لا، []"),
  attendance: z
    .array(attendanceRowSchema)
    .max(500)
    .describe("لو type='attendance', سجلات الحضور المستخرجة. لو لا، []"),
  text_summary: z
    .string()
    .describe(
      "لو type='other', ملخص بالعربي (٥-١٠ سطور) للمحتوى. غير ده، فاضي.",
    ),
  notes: z
    .string()
    .describe(
      "ملاحظة قصيرة عن جودة الاستخراج (مثلاً: 'تم استخراج 12 موظف، 8 منهم بدون رقم قومي')",
    ),
});

const PDF_SYSTEM_INSTRUCTIONS = `أنت مساعد لاستخراج بيانات من ملفات PDF لشركات مصرية.
شوف الـ PDF بصريًا (صور + نصوص) وحدد:

1) **نوع المحتوى**:
   - employees لو فيه قائمة موظفين (أسماء + بياناتهم)
   - attendance لو فيه سجلات حضور وانصراف (تواريخ + حالة + وقت بصمة)
   - other لو حاجة تانية (عقد، مذكرة، تقرير...)

2) **استخرج كل صفوف البيانات**:
   - لو employees: استخدم نفس الـ schema (full_name + كل الحقول الاختيارية)
   - لو attendance: استخدم schema الحضور (employee_name + date + status...)
   - لو other: حط فقط text_summary بملخص قصير

3) **قواعد مهمة**:
   - تواريخ output yyyy-mm-dd بس. "15/3/2024" → "2024-03-15"
   - تليفون 11 رقم مصري. شيل +20 لو موجود
   - رقم قومي 14 رقم بالظبط. غير كده → null
   - الراتب رقم بالجنيه. "5,000" → 5000. مدى "5000-7000" → null
   - تجاهل أسطر الإجمالي والمتوسط (Total, Summary, Average)
   - **متخترعش بيانات** — لو ما لقيتش حقل، حط null
   - status للحضور لازم يكون واحد من: present, absent, half_day, leave, holiday, weekend
   - لو الـ status مكتوب بالعربي (حاضر, غايب, إجازة...) حوّله للإنجليزي

4) **notes بالعربي**: عدد الصفوف + أي ملاحظات.
`;

async function parsePdfWithGemini(file: File): Promise<Response> {
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return Response.json(
      { error: "فشل قراءة محتوى الـ PDF" },
      { status: 400 },
    );
  }

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  let object: z.infer<typeof pdfSchema>;
  try {
    const result = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: pdfSchema,
      temperature: 0.1,
      system: PDF_SYSTEM_INSTRUCTIONS,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `استخرج البيانات من الـ PDF المرفق (${file.name}). صنّف نوعه واستخرج كل الصفوف.`,
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
    object = result.object;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        error: `الـ AI ما قدرش يقرا الـ PDF — جرب ملف تاني أو حوّله لـ Excel. (${msg.slice(0, 150)})`,
      },
      { status: 500 },
    );
  }

  // ----------------------------------------------------------------------
  // Normalize the response to the same shape as the Excel path so the
  // chat UI + the AI Agent see consistent data.
  // ----------------------------------------------------------------------
  let headers: string[] = [];
  let rows: ParsedRow[] = [];
  let hint: "employees" | "attendance" | "unknown" = "unknown";
  let notes = object.notes || "";

  if (object.type === "employees") {
    hint = "employees";
    headers = [
      "full_name",
      "employee_code",
      "job_title",
      "department",
      "phone",
      "email",
      "hire_date",
      "basic_salary",
      "national_id",
    ];
    rows = object.employees.map((e) => ({
      full_name: e.full_name,
      employee_code: e.employee_code,
      job_title: e.job_title,
      department: e.department,
      phone: e.phone,
      email: e.email,
      hire_date: e.hire_date,
      basic_salary: e.basic_salary,
      national_id: e.national_id,
    }));
  } else if (object.type === "attendance") {
    hint = "attendance";
    headers = [
      "employee_name",
      "employee_code",
      "date",
      "status",
      "check_in",
      "check_out",
      "tardiness_minutes",
      "early_leave_minutes",
    ];
    rows = object.attendance.map((a) => ({
      employee_name: a.employee_name,
      employee_code: a.employee_code,
      date: a.date,
      status: a.status,
      check_in: a.check_in,
      check_out: a.check_out,
      tardiness_minutes: a.tardiness_minutes,
      early_leave_minutes: a.early_leave_minutes,
    }));
  } else {
    // type === "other" — surface the text summary as the message body.
    // No structured rows; the AI agent will see the summary inline and
    // can answer questions about it. No bulk_import_* tool fires.
    hint = "unknown";
    notes = object.text_summary
      ? `${notes ? notes + " · " : ""}ملخص المحتوى:\n${object.text_summary}`
      : notes;
  }

  return Response.json({
    ok: true,
    filename: file.name,
    size: file.size,
    sheet_name: "PDF",
    headers,
    row_count: rows.length,
    truncated: false,
    rows,
    hint,
    notes: notes || buildNotes(rows.length, rows.length, hint),
    is_pdf: true,
    pdf_type: object.type,
    text_summary: object.text_summary || null,
  });
}
