// ============================================================================
// AI Agent route — the "employee with superpowers"
// ============================================================================
//
// This upgrades the AI from a Q&A chatbot to a tool-calling agent that can
// actually DO things on the user's behalf — search employees, summarize
// attendance, find duplicates, and most importantly: close payroll cycles
// on command.
//
// Architecture
// ------------
// Uses Vercel AI SDK 6.x `streamText({ tools, stopWhen })`. The model
// (Gemini Flash 2.5) decides which tools to call based on the user's
// Arabic request. Read-only tools execute immediately. The one
// destructive tool — `execute_payroll_period` — is wrapped by the
// system prompt with a hard rule: ALWAYS call `propose_payroll_period`
// first, present the numbers, and wait for the user's explicit "نعم"
// before executing.
//
// Security
// --------
// - Same gate as /api/ai/chat: admin/manager only, rate-limited
// - Every tool re-checks auth via createClient() before reading data
// - Tools that mutate (`execute_payroll_period`) go through the same
//   server-action helpers that the dashboard buttons use, so RLS +
//   permission checks are enforced consistently.
// - The model NEVER receives data outside the caller's company_id
//   (RLS handles tenant isolation).

import { streamText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { calculatePayroll, type AttendanceBreakdown } from "@/lib/payroll";
import {
  analyzeAll,
  type EmployeeSignals,
  monthsBetween,
} from "@/lib/retention";
import { pickAgentModelLargeContext } from "@/lib/ai-models";

export const maxDuration = 60;

// ----------------------------------------------------------------------------
// Message normalisation (same shape as /api/ai/chat — UI sends UIMessage parts)
// ----------------------------------------------------------------------------
type UIMessagePart = { type: string; text?: string };
type IncomingMessage = {
  role: "user" | "assistant" | "system";
  parts?: UIMessagePart[];
  content?: string;
};

function normalizeMessages(
  raw: unknown,
): { role: "user" | "assistant" | "system"; content: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is IncomingMessage => m && typeof m === "object" && "role" in m)
    .map((m) => {
      let content = "";
      if (Array.isArray(m.parts)) {
        content = m.parts
          .filter((p) => p && p.type === "text" && typeof p.text === "string")
          .map((p) => p.text!)
          .join("");
      } else if (typeof m.content === "string") {
        content = m.content;
      }
      return { role: m.role, content };
    })
    .filter((m) => m.content.length > 0);
}

// ----------------------------------------------------------------------------
// System prompt — defines the agent's persona + flow rules
// ----------------------------------------------------------------------------
function buildSystemPrompt(companyName: string, userName: string): string {
  const today = new Date().toISOString().split("T")[0];

  return `
أنت "نِظام AI" — مساعد ذكي ومتخصص في الموارد البشرية للسوق المصري،
بتشتغل كأنك موظف HR فعلي جوه شركة "${companyName}" بس بقدرات خارقة:
عندك أدوات (tools) بتقدر تستخدمها علشان تنفذ مهام حقيقية، مش بس
بترد على أسئلة.

التاريخ النهاردة: ${today}
المستخدم: ${userName}

## الأدوات المتاحة (Tools)

عندك ١٥ أداة. اختار الأداة الصح حسب طلب المستخدم:

1. **search_employees** — لما المستخدم بيسأل عن موظف معين أو بيقولك
   "إيه أداء سعيد"، "إجازات أحمد"، "موظف رقم 102". رجع البيانات
   الأساسية + لو محتاج اعمل نداء تاني لأدوات تانية.

2. **get_attendance_summary** — لما بيسأل عن الحضور في فترة معينة.
   ممكن يكون لموظف واحد أو لكل الشركة.

3. **count_employees_by_pay_frequency** — لما بيسأل "عندي كام موظف
   شهري وكام أسبوعي". مفيد قبل أي عملية قفل مرتبات.

4. **list_pending_requests** — لما بيسأل "في طلبات إجازة منتظرة؟"
   أو "في طلبات سلف معلقة؟"

5. **find_duplicate_employees** — لما بيسأل عن تكرارات في قاعدة بيانات
   الموظفين.

6. **propose_payroll_period** — أداة قراءة فقط بتحسب المرتبات لفترة
   معينة وبترجع الإجمالي + قائمة بـ صافي كل موظف، **بدون ما تنفذ**.
   استعمالها إجباري قبل execute_payroll_period.

7. **analyze_retention** — حلل فريق الشركة وارجع توصيات احتفاظ:
   "مين يستحق زيادة"، "مين يستحق مكافأة"، "في حد ممكن يستقيل قريب"،
   "ذكريات تعيين قادمة". لما المستخدم بيسأل عن أي حاجة من دي، نادي
   الأداة دي مباشرة بدون براميترز ولخّص النتايج. كل توصية فيها reasoning
   تفصيلي بالعربي — استخدمه في الرد.

8. **bulk_import_employees** — أداة تنفيذية لرفع موظفين دفعة واحدة،
   **بـ merge ذكي عند التكرار**.
   لما المستخدم يرفع ملف **(Excel أو PDF)** ويقولك "ضيف الموظفين دول":
   أ) هتلاقي بيانات الملف داخل رسالة المستخدم كـ JSON منظم
   ب) لخّص في الـ chat: "هضيف X موظف، فيهم Y بدون رقم قومي و Z بدون كود.
      الموجودين أصلاً هـ-merge عليهم بس الحقول الفاضية (مش هتغيّر اللي
      موجود). تأكد عايز أضيفهم؟"
   ج) استنى رد إيجابي صريح ("نعم"، "تمام"، "ضيف")
   د) نادي الأداة بـ rows + user_confirmed: true
   ه) ابن الـ rows من البيانات الموجودة في الـ chat، **متخترعش بيانات**

   **عند الرد للمستخدم بعد التنفيذ**، الأداة بترجع 3 أرقام:
     - inserted_count: موظفين جدد اتضافوا
     - merged_count: موظفين موجودين أصلاً واتـ-enrich بحقول كانت فاضية
       (مثلاً موظف موجود من غير كود بصمة → الكود اللي في الـ Excel
       اتضاف عليه؛ مرتبه كان 0 → اترفع للقيمة الجديدة).
     - skipped_count: صفوف مفيش فيها أي قيمة جديدة نضيفها / صفوف فيها
       اسم ناقص / national_id غلط
   لخّص الـ 3 أرقام للمستخدم بكلام عربي بسيط: مثلاً
   "اتضاف 25 موظف جديد · 50 موظف موجود اترفعت بياناتهم · 5 صفوف اتجاهلوا".

   ⚠️ **خريطة الأعمدة المهمة جداً** (الـ Excel المصري بيستخدم تسميات
   مختلفة لنفس الحقل — لازم تـ-map صح وإلا الـ field هيضيع):

   | عناوين Excel ممكنة | الحقل في الأداة |
   |---|---|
   | "كود البصمة" / "رقم البصمة" / "بصمة" / "كود" / "كود الموظف" / "Code" | **employee_code** |
   | "الاسم" / "اسم الموظف" / "Name" / "Full Name" | **full_name** |
   | "الوظيفة" / "المسمى الوظيفي" / "Job Title" | **job_title** |
   | "القسم" / "الإدارة" / "Department" | **department** |
   | "تليفون" / "موبايل" / "هاتف" / "Phone" / "Mobile" | **phone** |
   | "الإيميل" / "بريد إلكتروني" / "Email" | **email** |
   | "تاريخ التعيين" / "تاريخ بدء العمل" / "Hire Date" | **hire_date** |
   | "الراتب الأساسي" / "المرتب الأساسي" / "الأساسي" / "Basic Salary" | **basic_salary** |
   | "بدل سكن" / "سكن" / "Housing" | **housing_allowance** |
   | "بدل انتقال" / "مواصلات" / "انتقال" / "Transport" | **transport_allowance** |
   | "بدلات أخرى" / "أخرى" / "Other" | **other_allowances** |
   | "حافز" / "حوافز" / "Incentive" | **incentive_allowance** |
   | "رقم قومي" / "البطاقة" / "National ID" | **national_id** |
   | "تأمين اجتماعي" / "رقم التأمين" | **social_insurance_number** |
   | "البنك" / "Bank" | **bank_name** |
   | "حساب البنك" / "رقم الحساب" / "IBAN" | **bank_account_number** |

   **القاعدة الذهبية**: لو شفت عمود اسمه "كود البصمة" أو "رقم البصمة"
   أو حتى "بصمة" — ده دايماً **employee_code**. في الشركات المصرية اللي
   عندها جهاز ZKTeco، كود البصمة هو نفسه كود الموظف اللي بيربط الموظف
   بالجهاز. لا تتجاهل العمود ده أبداً.

9. **bulk_import_attendance** — أداة تنفيذية لرفع سجلات حضور دفعة واحدة.
   نفس flow rules الـ bulk_import_employees بالضبط. ممكن المستخدم يرفع
   Excel أو PDF (لو PDF، الـ AI استخرج الصفوف لك تلقائياً). كل صف لازم
   فيه: employee_code (للبحث في موظفي الشركة) + date + status. لو الكود
   مش موجود في النظام، الصف يتجاهل.

**ملاحظة عن ملفات الـ PDF**: لو المستخدم رفع PDF وهو **عقد أو مذكرة أو
تقرير** (مش جدول بيانات)، هتلاقي في الرسالة "ملخص المحتوى" بدل JSON.
في الحالة دي، رد على أسئلة المستخدم عن محتوى المستند بدون ما تنادي
bulk_import_* (لأن مفيش بيانات منظمة).

10. **execute_payroll_period** — الأداة الوحيدة الـ destructive من النوع
   الكبير (بتنشئ دورة مرتبات فعلية). **ممنوع** تستعملها قبل ما تعمل
   الخطوات دي:

   أ) تنادي propose_payroll_period الأول
   ب) ترد على المستخدم بإجمالي المرتبات + عدد الموظفين
   ج) تسأله **بوضوح**: "تأكد عايز أنفذ؟"
   د) تستنى رد إيجابي صريح (مثلاً: "نعم"، "موافق"، "نفذ"، "تمام"،
      "اعمل"، "أيوة"). أي رد غير ده = ممنوع التنفيذ.

   لو المستخدم قاللك "نفذ" أو "موافق" بدون proposal قبلها → ارجع
   اعمل proposal أولاً ولا تستخدم execute مباشرة.

## أدوات تعديل البيانات الفردية (Mutations)

دي ٥ أدوات بتعدّل سجلات فردية. كلها بتشتغل بنفس النمط:
**preview أولاً → استنى موافقة → نفّذ**.

11. **update_employee** — عدّل حقول موظف موجود (الاسم، المسمى الوظيفي،
    القسم، الراتب الأساسي، البدلات، تكرار الراتب، الحالة).
    **flow إجباري:**
    أ) نادي الأداة بـ user_confirmed=false → ترجع لك القيم الحالية +
       التعديلات المقترحة.
    ب) لخّص للمستخدم: "هعدّل [اسم الموظف] — راتبه من X لـ Y. تأكد؟"
    ج) استنى "نعم" / "موافق" / "تمام" أو ما يشابه.
    د) نادي الأداة تاني بـ user_confirmed=true ونفس البراميترز.

12. **create_employee** — أضف موظف جديد فردي (للحالات اللي مفيش فيها
    Excel/PDF — مثلاً المستخدم بيقولك "ضيف أحمد كذا، راتبه كذا").
    نفس flow الـ user_confirmed. لو ناقص بيانات إجبارية (full_name،
    basic_salary، pay_frequency) — اسأل المستخدم قبل ما تنادي الأداة.

13. **adjust_payroll_entry** — عدّل entry مرتبات موظف معين في دورة
    معينة (إضافة bonus، خصم استثنائي، تعديل overtime).
    flow: preview ← لخّص ← استنى موافقة ← نفّذ.

14. **approve_request** — وافق على طلب إجازة أو سلفة معلق.
    flow: المستخدم بيقولك "وافق على طلب أحمد" → تستخدم list_pending_requests
    لو محتاج تشوف الطلبات → تتأكد المستخدم اختار طلب محدد → تنفذ.

15. **record_attendance_entry** — سجّل حضور لموظف في يوم معين
    (للحالات الفردية مش الجماعية — للجماعي استخدم bulk_import_attendance).
    flow: preview ← لخّص ← استنى موافقة ← نفّذ.

**قاعدة عامة للـ mutations**: لو المستخدم قال "عدّل، أضف، احذف، نفّذ"
بدون preview → اعمل preview الأول (user_confirmed: false) واسأله.
**ممنوع تنفذ أي mutation بدون موافقة صريحة من المستخدم في الـ chat**.

## قواعد الرد العامة

- **العربي المصري الواضح** — مفيش فصحى.
- لما بترجع نتائج tool، استعمل الأرقام الفعلية اللي رجعت لك،
  مش أرقام افتراضية.
- لما تحسب مرتبات، اعرض الإجمالي بتنسيق "250,000 ج" وكشف سريع.
- لو tool رجع error، فسر للمستخدم بالعربي إيه اللي حصل بدون تقني زيادة.
- لو المستخدم سأل سؤال HR قانوني (مش محتاج tool) — رد مباشرة بعلمك
  بقانون العمل المصري 12/2003 + التأمينات 148/2019 + شرائح الضريبة 2024.

## مثال لـ flow صحيح

المستخدم: "اقفلي مرتبات الموظفين الشهريين من ٢١ أبريل لـ ٢٠ مايو"

أنت:
1. تنادي propose_payroll_period({ frequency: "monthly",
   start_date: "2026-04-21", end_date: "2026-05-20", working_days: 22 })
2. ترد: "هقفل ٢٥ موظف شهري بإجمالي صافي ٢٥٠,٠٠٠ ج، وخصومات
   إجمالية ١٢,٣٠٠ ج. تأكد عايز أنفذ؟"
3. تستنى رد المستخدم.
4. لو قال "نعم" → تنادي execute_payroll_period بنفس البراميترز.
5. لو قال "لا" → تسأله عايز يعدل إيه.

## مثال لـ flow ممنوع

المستخدم: "اقفل المرتبات بسرعة وخلصني"

أنت: **لا تنادي execute_payroll_period مباشرة**. ترد:
"تمام، بس محتاج تحدد لي: شهري ولا أسبوعي؟ والفترة (من تاريخ - لتاريخ)؟
وعدد أيام العمل في الفترة دي؟"

ابدأ كل محادثة بشكل ودي ومحترم، واتعامل مع المستخدم كأنك زميل مخلص
بيساعده يخلص شغله بدقة وسرعة.
`.trim();
}

// ----------------------------------------------------------------------------
// Helpers used inside tool execute() functions
// ----------------------------------------------------------------------------
async function getAuthedContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id, full_name, role, companies(name)")
    .eq("id", user.id)
    .single<{
      id: string;
      company_id: string;
      full_name: string | null;
      role: string;
      companies: { name: string } | null;
    }>();

  if (!profile) throw new Error("Profile not found");
  if (profile.role !== "admin" && profile.role !== "manager") {
    throw new Error("Forbidden");
  }

  return { supabase, profile };
}

// ----------------------------------------------------------------------------
// Route handler
// ----------------------------------------------------------------------------
export async function POST(req: Request) {
  let authed;
  try {
    authed = await getAuthedContext();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    const status = msg === "Forbidden" ? 403 : 401;
    return new Response(
      JSON.stringify({
        error:
          status === 403
            ? "المساعد الذكي مخصص لـ HR فقط"
            : "Unauthorized",
      }),
      { status },
    );
  }

  const { profile } = authed;

  // Rate-limit: tool calls cost more than text-only, so we set a tighter
  // ceiling than /api/ai/chat — 20 agent turns per 10 minutes per user.
  const rl = checkRateLimit(`ai-agent:${profile.id}`, 20, 10 * 60_000);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({
        error: `كتر شويه على المساعد — جرب تاني بعد ${Math.ceil(rl.retryAfterSeconds / 60)} دقيقة`,
      }),
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  // Pre-flight: at least ONE provider key must be configured. The actual
  // model is picked later via pickAgentModel(). If neither key is set,
  // surface a clear bilingual error so the operator knows what to do.
  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "إعدادات الذكاء الاصطناعي ناقصة — ابعت GROQ_API_KEY أو GEMINI_API_KEY في Vercel Environment Variables",
      }),
      { status: 500 },
    );
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
    });
  }

  const messages = normalizeMessages(body.messages);
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages received" }), {
      status: 400,
    });
  }

  // Fetch company name once for the system prompt
  const { supabase } = authed;
  const { data: companyRow } = await supabase
    .from("companies")
    .select("name")
    .eq("id", profile.company_id)
    .maybeSingle<{ name: string }>();

  const systemPrompt = buildSystemPrompt(
    companyRow?.name ?? "—",
    profile.full_name ?? "المستخدم",
  );

  // --------------------------------------------------------------------
  // TOOLS — defined inline so each `execute` closes over the supabase
  // client + profile. AI SDK 6.x uses `tool({...})` + `inputSchema` (zod).
  // --------------------------------------------------------------------

  const tools = {
    // ----------- Tool 1: search_employees -----------
    search_employees: tool({
      description:
        "ابحث في موظفي الشركة بالاسم أو الكود الوظيفي. " +
        "بترجع لحد ١٠ نتائج تطابق + البيانات الأساسية لكل موظف. " +
        "استعملها لما المستخدم بيسأل عن موظف معين أو شريحة موظفين.",
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe(
            "كلمة البحث — اسم كامل، جزء من اسم، كود موظف، أو حتى قسم.",
          ),
      }),
      execute: async ({ query }) => {
        const supa = await createClient();
        // Search by name (ilike) OR employee_code OR department
        const { data, error } = await supa
          .from("employees")
          .select(
            "id, employee_code, full_name, job_title, department, status, pay_frequency, basic_salary, hire_date",
          )
          .or(
            `full_name.ilike.%${query}%,employee_code.ilike.%${query}%,department.ilike.%${query}%,job_title.ilike.%${query}%`,
          )
          .order("full_name")
          .limit(10);

        if (error) {
          return { ok: false, error: error.message, results: [] };
        }
        return {
          ok: true,
          count: data?.length ?? 0,
          results: data ?? [],
        };
      },
    }),

    // ----------- Tool 2: get_attendance_summary -----------
    get_attendance_summary: tool({
      description:
        "احصل على ملخص حضور لفترة معينة. " +
        "ممكن يكون للشركة كلها أو لموظف واحد. " +
        "بترجع عدد أيام الحضور / الغياب / نص يوم / الإجازات + " +
        "إجمالي دقايق التأخير والانصراف المبكر.",
      inputSchema: z.object({
        start_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("تاريخ بداية الفترة — صيغة YYYY-MM-DD."),
        end_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("تاريخ نهاية الفترة — صيغة YYYY-MM-DD."),
        employee_id: z
          .string()
          .uuid()
          .optional()
          .describe(
            "اختياري — لو محدد، الملخص لموظف واحد. لو لا، الملخص للشركة كلها.",
          ),
      }),
      execute: async ({ start_date, end_date, employee_id }) => {
        const supa = await createClient();
        let q = supa
          .from("attendance")
          .select(
            "employee_id, status, tardiness_minutes, early_leave_minutes",
          )
          .gte("date", start_date)
          .lte("date", end_date);
        if (employee_id) q = q.eq("employee_id", employee_id);

        const { data, error } = await q;
        if (error) return { ok: false, error: error.message };

        const rows = data ?? [];
        const present = rows.filter((r) => r.status === "present").length;
        const absent = rows.filter((r) => r.status === "absent").length;
        const halfDay = rows.filter((r) => r.status === "half_day").length;
        const leave = rows.filter((r) => r.status === "leave").length;
        const tardinessMins = rows.reduce(
          (s, r) => s + (r.tardiness_minutes ?? 0),
          0,
        );
        const earlyLeaveMins = rows.reduce(
          (s, r) => s + (r.early_leave_minutes ?? 0),
          0,
        );

        return {
          ok: true,
          start_date,
          end_date,
          employee_id: employee_id ?? null,
          total_records: rows.length,
          present,
          absent,
          half_day: halfDay,
          leave,
          tardiness_minutes_total: tardinessMins,
          early_leave_minutes_total: earlyLeaveMins,
        };
      },
    }),

    // ----------- Tool 3: count_employees_by_pay_frequency -----------
    count_employees_by_pay_frequency: tool({
      description:
        "اعد عدد الموظفين النشطين حسب تكرار الراتب (شهري vs أسبوعي). " +
        "مفيد قبل أي عملية قفل مرتبات علشان تعرف عدد المتأثرين.",
      inputSchema: z.object({}),
      execute: async () => {
        const supa = await createClient();
        const { data, error } = await supa
          .from("employees")
          .select("pay_frequency, status")
          .eq("status", "active");

        if (error) return { ok: false, error: error.message };
        const rows = data ?? [];
        const monthly = rows.filter((r) => r.pay_frequency === "monthly").length;
        const weekly = rows.filter((r) => r.pay_frequency === "weekly").length;

        return {
          ok: true,
          total_active: rows.length,
          monthly,
          weekly,
        };
      },
    }),

    // ----------- Tool 4: list_pending_requests -----------
    list_pending_requests: tool({
      description:
        "اعرض طلبات الإجازات والسلف المعلقة (status='pending'). " +
        "بترجع طلبات الإجازة + طلبات السلف اللي بتنتظر موافقة HR.",
      inputSchema: z.object({}),
      execute: async () => {
        const supa = await createClient();
        const [leavesRes, advancesRes] = await Promise.all([
          supa
            .from("leave_requests")
            .select(
              "id, employee_id, leave_type, start_date, end_date, days_count, reason, created_at",
            )
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(20),
          supa
            .from("advance_requests")
            .select("id, employee_id, amount, reason, created_at")
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        return {
          ok: true,
          pending_leaves: leavesRes.data ?? [],
          pending_advances: advancesRes.data ?? [],
          counts: {
            leaves: leavesRes.data?.length ?? 0,
            advances: advancesRes.data?.length ?? 0,
          },
        };
      },
    }),

    // ----------- Tool 5: find_duplicate_employees -----------
    find_duplicate_employees: tool({
      description:
        "اكتشف الموظفين المكررين في قاعدة البيانات. " +
        "بترجع مجموعات موظفين بنفس الاسم/الكود/الرقم القومي/الايميل/التليفون. " +
        "كل مجموعة فيها أكثر من سجل واحد لنفس الشخص.",
      inputSchema: z.object({}),
      execute: async () => {
        const supa = await createClient();
        const { data, error } = await supa.rpc("find_duplicate_employees");
        if (error) return { ok: false, error: error.message, groups: [] };
        return {
          ok: true,
          groups_count: Array.isArray(data) ? data.length : 0,
          groups: data ?? [],
        };
      },
    }),

    // ----------- Tool 6: propose_payroll_period (read-only) -----------
    propose_payroll_period: tool({
      description:
        "اقترح دورة مرتبات بدون ما تنفذها فعلياً. " +
        "بتحسب صافي المرتبات لكل موظف في الفترة المحددة وبترجع الإجمالي + " +
        "كشف بالأرقام. **هي خطوة إجبارية قبل execute_payroll_period.**",
      inputSchema: z.object({
        frequency: z
          .enum(["monthly", "weekly"])
          .describe(
            "نوع الدورة — monthly للموظفين الشهريين، weekly للأسبوعيين.",
          ),
        start_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("تاريخ بداية الفترة — YYYY-MM-DD."),
        end_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("تاريخ نهاية الفترة — YYYY-MM-DD."),
        working_days: z
          .number()
          .int()
          .min(1)
          .max(31)
          .default(22)
          .describe("عدد أيام العمل في الفترة. الافتراضي ٢٢ للشهر."),
      }),
      execute: async ({ frequency, start_date, end_date, working_days }) => {
        const supa = await createClient();

        // Idempotency: if a period already exists for this freq+start, warn.
        const { data: existing } = await supa
          .from("payroll_periods")
          .select("id, status")
          .eq("company_id", profile.company_id)
          .eq("frequency", frequency)
          .eq("start_date", start_date)
          .maybeSingle();

        const [empRes, attRes, companyRes] = await Promise.all([
          supa
            .from("employees")
            .select(
              "id, full_name, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, pay_frequency",
            )
            .eq("status", "active")
            .eq("pay_frequency", frequency),
          supa
            .from("attendance")
            .select(
              "employee_id, status, tardiness_minutes, early_leave_minutes",
            )
            .gte("date", start_date)
            .lte("date", end_date),
          supa
            .from("companies")
            .select("social_insurance_enabled, income_tax_enabled")
            .eq("id", profile.company_id)
            .maybeSingle<{
              social_insurance_enabled: boolean | null;
              income_tax_enabled: boolean | null;
            }>(),
        ]);

        if (empRes.error)
          return { ok: false, error: empRes.error.message };

        const employees = empRes.data ?? [];
        const attendance = attRes.data ?? [];
        const settings = {
          socialInsuranceEnabled:
            companyRes.data?.social_insurance_enabled === true,
          incomeTaxEnabled: companyRes.data?.income_tax_enabled === true,
        };

        let totalGross = 0;
        let totalNet = 0;
        let totalDeductions = 0;
        const details = employees.map((emp) => {
          const empAtt = attendance.filter((a) => a.employee_id === emp.id);
          const attended = empAtt.filter((a) => a.status === "present").length;
          const halfDay = empAtt.filter((a) => a.status === "half_day").length;
          const absent = empAtt.filter((a) => a.status === "absent").length;
          const leave = Math.max(
            0,
            empAtt.length - attended - halfDay - absent,
          );
          const tardinessMinutes = empAtt
            .filter((a) => a.status === "present" || a.status === "half_day")
            .reduce((s, a) => s + (a.tardiness_minutes ?? 0), 0);
          const earlyLeaveMinutes = empAtt
            .filter((a) => a.status === "present" || a.status === "half_day")
            .reduce((s, a) => s + (a.early_leave_minutes ?? 0), 0);

          const breakdown: AttendanceBreakdown = {
            attended,
            halfDay,
            leave,
            absent,
            tardinessMinutes,
            earlyLeaveMinutes,
          };
          const res = calculatePayroll(
            {
              basicSalary: emp.basic_salary ?? 0,
              housingAllowance: emp.housing_allowance ?? 0,
              transportAllowance: emp.transport_allowance ?? 0,
              otherAllowances: emp.other_allowances ?? 0,
              incentiveAllowance: emp.incentive_allowance ?? 0,
            },
            breakdown,
            working_days,
            settings,
          );
          totalGross += res.grossSalary;
          totalNet += res.netSalary;
          totalDeductions += res.totalDeductions;
          return {
            employee_id: emp.id,
            employee_name: emp.full_name,
            attended,
            absent,
            half_day: halfDay,
            leave,
            gross_salary: res.grossSalary,
            net_salary: res.netSalary,
            total_deductions: res.totalDeductions,
          };
        });

        return {
          ok: true,
          frequency,
          start_date,
          end_date,
          working_days,
          employee_count: employees.length,
          total_gross: Math.round(totalGross * 100) / 100,
          total_deductions: Math.round(totalDeductions * 100) / 100,
          total_net: Math.round(totalNet * 100) / 100,
          per_employee: details,
          existing_period: existing
            ? {
                id: existing.id,
                status: existing.status,
                warning:
                  "في دورة مرتبات موجودة بنفس البراميترز — التنفيذ هيرجع نفس الـ ID",
              }
            : null,
        };
      },
    }),

    // ----------- Tool 7: analyze_retention -----------
    analyze_retention: tool({
      description:
        "حلل فريق الشركة وارجع توصيات الاحتفاظ بالموظفين: " +
        "مين يستحق زيادة، مين يستحق مكافأة، مين عنده إشارات تنبيه " +
        "محتمل يستقيل، وذكريات التعيين القادمة في الـ ٣٠ يوم. " +
        "استعملها لما المستخدم بيسأل 'مين يستحق زيادة؟'، 'في حد ممكن يستقيل؟'، " +
        "'مين أحسن موظف الشهر ده؟'، أو 'إيه الذكريات القريبة؟'.",
      inputSchema: z.object({}),
      execute: async () => {
        const supa = await createClient();

        const today = new Date();
        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(today.getDate() - 90);
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const sixtyDaysAgo = new Date(today);
        sixtyDaysAgo.setDate(today.getDate() - 60);
        const ninetyIso = ninetyDaysAgo.toISOString().split("T")[0];
        const thirtyIso = thirtyDaysAgo.toISOString().split("T")[0];
        const sixtyIso = sixtyDaysAgo.toISOString().split("T")[0];
        const todayIso = today.toISOString().split("T")[0];

        const [empRes, attRes, salaryRes, leaveRes] = await Promise.all([
          supa
            .from("employees")
            .select(
              "id, full_name, job_title, department, hire_date, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, pay_frequency, status",
            )
            .eq("status", "active"),
          supa
            .from("attendance")
            .select(
              "employee_id, date, status, tardiness_minutes, early_leave_minutes",
            )
            .gte("date", ninetyIso)
            .lte("date", todayIso),
          supa
            .from("salary_history")
            .select("employee_id, change_date")
            .order("change_date", { ascending: false }),
          supa
            .from("leave_requests")
            .select("employee_id, days_count, status")
            .gte("start_date", thirtyIso)
            .lte("start_date", todayIso)
            .eq("status", "approved"),
        ]);

        if (empRes.error) {
          return {
            ok: false,
            error: empRes.error.message,
            note: "السبب الشائع: migration 035 لسه ما اتطبقش على Supabase",
          };
        }

        const employees = empRes.data ?? [];
        const attendance = attRes.data ?? [];
        const salaryHistory = salaryRes.data ?? [];
        const leaves = leaveRes.data ?? [];

        const lastRaiseDate = new Map<string, string>();
        for (const r of salaryHistory) {
          if (!lastRaiseDate.has(r.employee_id))
            lastRaiseDate.set(r.employee_id, r.change_date);
        }
        const recentLeaveDaysMap = new Map<string, number>();
        for (const r of leaves) {
          recentLeaveDaysMap.set(
            r.employee_id,
            (recentLeaveDaysMap.get(r.employee_id) ?? 0) + (r.days_count ?? 0),
          );
        }

        const signals: EmployeeSignals[] = [];
        for (const emp of employees) {
          if (!emp.hire_date) continue;
          const empAtt = attendance.filter((a) => a.employee_id === emp.id);
          const present = empAtt.filter((a) => a.status === "present").length;
          const halfDay = empAtt.filter((a) => a.status === "half_day").length;
          const absent = empAtt.filter((a) => a.status === "absent").length;
          const leave = empAtt.filter((a) => a.status === "leave").length;
          const workingRecords = present + halfDay + absent + leave;
          const attendanceRate =
            workingRecords === 0
              ? 1
              : (present + halfDay * 0.5) / workingRecords;
          const workdayRows = empAtt.filter(
            (a) => a.status === "present" || a.status === "half_day",
          );
          const tardiSum = workdayRows.reduce(
            (s, a) => s + (a.tardiness_minutes ?? 0),
            0,
          );
          const earlySum = workdayRows.reduce(
            (s, a) => s + (a.early_leave_minutes ?? 0),
            0,
          );
          const tardinessMinutesAvgPerDay =
            workdayRows.length === 0 ? 0 : tardiSum / workdayRows.length;
          const earlyLeaveMinutesAvgPerDay =
            workdayRows.length === 0 ? 0 : earlySum / workdayRows.length;

          const last30 = empAtt.filter((a) => a.date >= thirtyIso);
          const prev60 = empAtt.filter(
            (a) => a.date >= sixtyIso && a.date < thirtyIso,
          );
          const rateFor = (rows: typeof empAtt): number => {
            const p = rows.filter((r) => r.status === "present").length;
            const h = rows.filter((r) => r.status === "half_day").length;
            const ab = rows.filter((r) => r.status === "absent").length;
            const lv = rows.filter((r) => r.status === "leave").length;
            const tot = p + h + ab + lv;
            return tot === 0 ? 1 : (p + h * 0.5) / tot;
          };
          const attendanceRateDelta = rateFor(last30) - rateFor(prev60);

          const tenureMonths = monthsBetween(emp.hire_date, today);
          const lastChange = lastRaiseDate.get(emp.id) ?? emp.hire_date;
          const monthsSinceLastRaise = monthsBetween(lastChange, today);

          const totalCompensation =
            (emp.basic_salary ?? 0) +
            (emp.housing_allowance ?? 0) +
            (emp.transport_allowance ?? 0) +
            (emp.other_allowances ?? 0) +
            (emp.incentive_allowance ?? 0);

          signals.push({
            id: emp.id,
            fullName: emp.full_name,
            jobTitle: emp.job_title,
            department: emp.department,
            hireDate: emp.hire_date,
            basicSalary: emp.basic_salary ?? 0,
            totalCompensation,
            payFrequency:
              (emp.pay_frequency as "monthly" | "weekly") ?? "monthly",
            tenureMonths,
            monthsSinceLastRaise,
            attendanceRate,
            totalAttendanceDays: workingRecords,
            absentDays: absent,
            tardinessMinutesAvgPerDay,
            earlyLeaveMinutesAvgPerDay,
            attendanceRateDelta,
            recentLeaveDays: recentLeaveDaysMap.get(emp.id) ?? 0,
          });
        }

        const insights = analyzeAll(signals, today);
        const counts = {
          raise: insights.filter((i) => i.insightType === "raise").length,
          bonus: insights.filter((i) => i.insightType === "bonus").length,
          flight_risk: insights.filter((i) => i.insightType === "flight_risk")
            .length,
          anniversary: insights.filter((i) => i.insightType === "anniversary")
            .length,
        };

        return {
          ok: true,
          analyzed_employees: signals.length,
          insight_counts: counts,
          insights: insights.map((i) => ({
            employee_name: i.employeeName,
            job_title: i.jobTitle,
            type: i.insightType,
            score: i.score,
            reasoning: i.reasoning,
            suggested_amount: i.suggestedAmount,
          })),
          dashboard_url: "/dashboard/retention",
        };
      },
    }),

    // ----------- Tool 8: bulk_import_employees (destructive) -----------
    bulk_import_employees: tool({
      description:
        "**أداة تنفيذية** — أضف موظفين دفعة واحدة، **مع merge ذكي لو فيه تكرار**. " +
        "استعملها بعد ما المستخدم رفع ملف Excel وقالك 'ضيف الموظفين دول'. " +
        "كل صف لازم يكون فيه على الأقل full_name. " +
        "**سلوك التكرار (مهم)**: لو الموظف موجود بنفس الـ national_id أو " +
        "employee_code أو full_name، الأداة **مش بتتجاهله** — بدل كده " +
        "بتـ-MERGE: تملا بس الحقول اللي فاضية في السجل الحالي بالقيم الجديدة، " +
        "بدون ما تغيّر القيم الموجودة. بترجع: " +
        "  - inserted_count: موظفين جدد اتضافوا " +
        "  - merged_count: موظفين موجودين أصلاً واتـ-enrich بحقول كانت فاضية " +
        "  - skipped_count: صفوف ما فيش فيها قيم جديدة (كل البيانات موجودة) " +
        "**لا تستعملها بدون موافقة صريحة من المستخدم في الـ chat.**",
      inputSchema: z.object({
        rows: z
          .array(
            z.object({
              full_name: z
                .string()
                .min(2)
                .describe('من عمود "الاسم" / "اسم الموظف" / "Name"'),
              employee_code: z
                .string()
                .nullable()
                .optional()
                .describe(
                  'من عمود "كود البصمة" / "رقم البصمة" / "بصمة" / "كود الموظف" / "Code". ' +
                    "في الشركات المصرية ده هو نفسه كود ربط الموظف بجهاز ZKTeco. " +
                    "لا تتجاهله أبداً لو موجود في الـ Excel.",
                ),
              job_title: z
                .string()
                .nullable()
                .optional()
                .describe('من "الوظيفة" / "المسمى الوظيفي" / "Job Title"'),
              department: z
                .string()
                .nullable()
                .optional()
                .describe('من "القسم" / "الإدارة" / "Department"'),
              phone: z
                .string()
                .nullable()
                .optional()
                .describe('من "تليفون" / "موبايل" / "هاتف" / "Phone"'),
              email: z.string().nullable().optional(),
              hire_date: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .nullable()
                .optional(),
              basic_salary: z.number().nullable().optional(),
              housing_allowance: z.number().nullable().optional(),
              transport_allowance: z.number().nullable().optional(),
              other_allowances: z.number().nullable().optional(),
              incentive_allowance: z.number().nullable().optional(),
              national_id: z.string().nullable().optional(),
              pay_frequency: z.enum(["monthly", "weekly"]).optional(),
            }),
          )
          .min(1)
          .max(200),
        user_confirmed: z
          .boolean()
          .describe(
            "**إجباري true** — لازم المستخدم وافق صراحة في الـ chat.",
          ),
      }),
      execute: async ({ rows, user_confirmed }) => {
        if (!user_confirmed) {
          return {
            ok: false,
            error: "ممنوع تنفذ من غير موافقة صريحة من المستخدم.",
          };
        }
        const supa = await createClient();

        // Three outcomes per row instead of two:
        //   - inserted: brand-new employee created
        //   - merged:   employee existed; we filled empty fields with new data
        //   - skipped:  row unusable (no name) or nothing to merge
        const inserted: string[] = [];
        const merged: {
          id: string;
          name: string;
          fields_added: string[];
        }[] = [];
        const skipped: { row: number; name: string; reason: string }[] = [];

        // Fields that can be back-filled from the import row. Order
        // matches the schema columns we select below.
        type MergeField =
          | "employee_code"
          | "job_title"
          | "department"
          | "phone"
          | "email"
          | "hire_date"
          | "basic_salary"
          | "housing_allowance"
          | "transport_allowance"
          | "other_allowances"
          | "incentive_allowance"
          | "national_id"
          | "pay_frequency";
        const MERGEABLE_FIELDS: MergeField[] = [
          "employee_code",
          "job_title",
          "department",
          "phone",
          "email",
          "hire_date",
          "basic_salary",
          "housing_allowance",
          "transport_allowance",
          "other_allowances",
          "incentive_allowance",
          "national_id",
          "pay_frequency",
        ];

        // Helper: a stored value counts as "empty" when it's null /
        // undefined / "" / 0. The 0-check matters for salary columns
        // — an employee row at 0 EGP is almost always a stub that
        // should be filled from the new import.
        const isEmpty = (v: unknown): boolean =>
          v === null ||
          v === undefined ||
          (typeof v === "string" && v.trim() === "") ||
          (typeof v === "number" && v === 0);

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const rowIdx = i + 1;
          if (!r.full_name || r.full_name.trim().length < 2) {
            skipped.push({
              row: rowIdx,
              name: r.full_name ?? "",
              reason: "ناقص اسم",
            });
            continue;
          }
          if (r.national_id && !/^\d{14}$/.test(r.national_id)) {
            skipped.push({
              row: rowIdx,
              name: r.full_name,
              reason: "رقم قومي مش 14 رقم",
            });
            continue;
          }

          // Look for an existing employee in PRIORITY order:
          //   1) national_id (strongest identity)
          //   2) employee_code
          //   3) exact full_name match
          // Each query is .maybeSingle() so 0 or 1 rows is fine.
          type ExistingRow = Partial<
            Record<MergeField | "id" | "full_name", unknown>
          > & { id: string };
          let existing: ExistingRow | null = null;
          const selectCols =
            "id, full_name, employee_code, job_title, department, phone, email, hire_date, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, national_id, pay_frequency";

          if (r.national_id) {
            const { data } = await supa
              .from("employees")
              .select(selectCols)
              .eq("company_id", profile.company_id)
              .eq("national_id", r.national_id)
              .maybeSingle<ExistingRow>();
            if (data) existing = data;
          }
          if (!existing && r.employee_code) {
            const { data } = await supa
              .from("employees")
              .select(selectCols)
              .eq("company_id", profile.company_id)
              .eq("employee_code", r.employee_code)
              .maybeSingle<ExistingRow>();
            if (data) existing = data;
          }
          if (!existing) {
            const { data } = await supa
              .from("employees")
              .select(selectCols)
              .eq("company_id", profile.company_id)
              .eq("full_name", r.full_name.trim())
              .maybeSingle<ExistingRow>();
            if (data) existing = data;
          }

          // ============= MERGE PATH =============
          if (existing) {
            const updates: Partial<Record<MergeField, unknown>> = {};
            const fieldsAdded: string[] = [];
            for (const f of MERGEABLE_FIELDS) {
              const incoming = (r as unknown as Record<string, unknown>)[f];
              if (incoming === undefined || incoming === null) continue;
              if (typeof incoming === "string" && incoming.trim() === "")
                continue;
              if (isEmpty(existing[f])) {
                updates[f] = incoming;
                fieldsAdded.push(f);
              }
            }

            if (Object.keys(updates).length === 0) {
              skipped.push({
                row: rowIdx,
                name: r.full_name,
                reason: "موجود بكل البيانات — مفيش حاجة جديدة نضيفها",
              });
              continue;
            }

            const { error: updErr } = await supa
              .from("employees")
              .update({
                ...updates,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
            if (updErr) {
              skipped.push({
                row: rowIdx,
                name: r.full_name,
                reason: `merge فشل: ${updErr.message.slice(0, 80)}`,
              });
            } else {
              merged.push({
                id: existing.id,
                name: r.full_name,
                fields_added: fieldsAdded,
              });
            }
            continue;
          }

          // ============= INSERT PATH =============
          const { data, error } = await supa
            .from("employees")
            .insert({
              company_id: profile.company_id,
              full_name: r.full_name.trim(),
              employee_code: r.employee_code ?? null,
              job_title: r.job_title ?? null,
              department: r.department ?? null,
              phone: r.phone ?? null,
              email: r.email ?? null,
              hire_date: r.hire_date ?? null,
              basic_salary: r.basic_salary ?? null,
              housing_allowance: r.housing_allowance ?? null,
              transport_allowance: r.transport_allowance ?? null,
              other_allowances: r.other_allowances ?? null,
              incentive_allowance: r.incentive_allowance ?? null,
              national_id: r.national_id ?? null,
              pay_frequency: r.pay_frequency ?? "monthly",
              status: "active",
            })
            .select("id")
            .single();

          if (error) {
            skipped.push({
              row: rowIdx,
              name: r.full_name,
              reason: error.message.slice(0, 80),
            });
          } else if (data) {
            inserted.push(data.id);
          }
        }

        return {
          ok: true,
          inserted_count: inserted.length,
          merged_count: merged.length,
          skipped_count: skipped.length,
          merged_details: merged.slice(0, 10),
          skipped_details: skipped.slice(0, 10),
          dashboard_url: "/dashboard/employees",
        };
      },
    }),

    // ----------- Tool 9: bulk_import_attendance (destructive) -----------
    bulk_import_attendance: tool({
      description:
        "**أداة تنفيذية** — اضف سجلات حضور دفعة واحدة. " +
        "استعملها بعد ما المستخدم رفع ملف حضور (مثلاً من جهاز بصمة) " +
        "وقالك 'ضيف الحضور ده'. كل صف لازم فيه employee_id (أو employee_code للبحث) " +
        "+ date + status. " +
        "**لا تستعملها بدون موافقة صريحة.**",
      inputSchema: z.object({
        rows: z
          .array(
            z.object({
              employee_code: z.string().optional(),
              employee_id: z.string().uuid().optional(),
              date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              status: z.enum([
                "present",
                "absent",
                "half_day",
                "leave",
                "holiday",
                "weekend",
              ]),
              check_in: z
                .string()
                .regex(/^\d{1,2}:\d{2}(:\d{2})?$/)
                .nullable()
                .optional(),
              check_out: z
                .string()
                .regex(/^\d{1,2}:\d{2}(:\d{2})?$/)
                .nullable()
                .optional(),
              tardiness_minutes: z.number().int().min(0).max(720).optional(),
              early_leave_minutes: z.number().int().min(0).max(720).optional(),
            }),
          )
          .min(1)
          .max(500),
        user_confirmed: z.boolean(),
      }),
      execute: async ({ rows, user_confirmed }) => {
        if (!user_confirmed) {
          return { ok: false, error: "ممنوع تنفذ من غير موافقة صريحة." };
        }
        const supa = await createClient();
        const batchId = crypto.randomUUID();
        const importedAt = new Date().toISOString();

        // Resolve employee_code -> employee_id once
        const codes = Array.from(
          new Set(
            rows
              .filter((r) => !r.employee_id && r.employee_code)
              .map((r) => r.employee_code!),
          ),
        );
        const codeMap = new Map<string, string>();
        if (codes.length > 0) {
          const { data: emps } = await supa
            .from("employees")
            .select("id, employee_code")
            .eq("company_id", profile.company_id)
            .in("employee_code", codes);
          for (const e of emps ?? []) {
            if (e.employee_code) codeMap.set(e.employee_code, e.id);
          }
        }

        let inserted = 0;
        const skipped: { reason: string; count: number }[] = [];
        const skipReasons = new Map<string, number>();
        const bump = (r: string) =>
          skipReasons.set(r, (skipReasons.get(r) ?? 0) + 1);

        const records: Record<string, unknown>[] = [];
        for (const r of rows) {
          const empId =
            r.employee_id ?? (r.employee_code ? codeMap.get(r.employee_code) : null);
          if (!empId) {
            bump("الموظف مش موجود في النظام");
            continue;
          }
          records.push({
            company_id: profile.company_id,
            employee_id: empId,
            date: r.date,
            status: r.status,
            check_in: r.check_in ?? null,
            check_out: r.check_out ?? null,
            tardiness_minutes: r.tardiness_minutes ?? 0,
            early_leave_minutes: r.early_leave_minutes ?? 0,
            import_batch_id: batchId,
            imported_at: importedAt,
          });
        }

        if (records.length > 0) {
          const { count, error } = await supa
            .from("attendance")
            .upsert(records, {
              onConflict: "employee_id,date",
              count: "exact",
            });
          if (error) {
            return { ok: false, error: error.message };
          }
          inserted = count ?? records.length;
        }

        for (const [r, c] of skipReasons) skipped.push({ reason: r, count: c });

        return {
          ok: true,
          inserted_count: inserted,
          skipped: skipped,
          batch_id: batchId,
          review_url: `/dashboard/attendance/review?batch=${batchId}&just_imported=1`,
        };
      },
    }),

    // ----------- Tool 10: execute_payroll_period (destructive) -----------
    execute_payroll_period: tool({
      description:
        "**أداة تنفيذية** — أنشئ دورة مرتبات فعلية في قاعدة البيانات. " +
        "ممنوع تستعملها قبل ما تنادي propose_payroll_period وتاخد موافقة " +
        "صريحة من المستخدم (مثلاً: 'نعم'، 'موافق'، 'نفذ'). " +
        "النتيجة بترجع period_id اللي ممكن المستخدم يفتحه على " +
        "/dashboard/payroll/{id}.",
      inputSchema: z.object({
        frequency: z.enum(["monthly", "weekly"]),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        working_days: z.number().int().min(1).max(31).default(22),
        user_confirmed: z
          .boolean()
          .describe(
            "**إجباري true** — لازم المستخدم وافق صراحة في الـ chat. " +
              "لو ما وافقش، رد بـ 'لا'.",
          ),
      }),
      execute: async ({
        frequency,
        start_date,
        end_date,
        working_days,
        user_confirmed,
      }) => {
        if (!user_confirmed) {
          return {
            ok: false,
            error:
              "ممنوع تنفذ من غير موافقة صريحة من المستخدم في الـ chat.",
          };
        }

        const supa = await createClient();

        // Idempotency check (same as the server action)
        const { data: existing } = await supa
          .from("payroll_periods")
          .select("id")
          .eq("company_id", profile.company_id)
          .eq("frequency", frequency)
          .eq("start_date", start_date)
          .maybeSingle();
        if (existing) {
          return {
            ok: true,
            already_exists: true,
            period_id: existing.id,
            url: `/dashboard/payroll/${existing.id}`,
          };
        }

        const start = new Date(start_date + "T00:00:00");
        const year = start.getFullYear();
        const month = start.getMonth() + 1;

        const { data: period, error: periodErr } = await supa
          .from("payroll_periods")
          .insert({
            company_id: profile.company_id,
            year,
            month,
            frequency,
            start_date,
            end_date,
            working_days,
            status: "draft",
          })
          .select("id")
          .single();

        if (periodErr || !period) {
          return {
            ok: false,
            error: periodErr?.message ?? "Failed to create period",
          };
        }

        const [empRes, attRes, companyRes] = await Promise.all([
          supa
            .from("employees")
            .select(
              "id, full_name, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, pay_frequency",
            )
            .eq("status", "active")
            .eq("pay_frequency", frequency),
          supa
            .from("attendance")
            .select(
              "employee_id, status, tardiness_minutes, early_leave_minutes",
            )
            .gte("date", start_date)
            .lte("date", end_date),
          supa
            .from("companies")
            .select("social_insurance_enabled, income_tax_enabled")
            .eq("id", profile.company_id)
            .maybeSingle<{
              social_insurance_enabled: boolean | null;
              income_tax_enabled: boolean | null;
            }>(),
        ]);

        const employees = empRes.data ?? [];
        const attendance = attRes.data ?? [];
        const settings = {
          socialInsuranceEnabled:
            companyRes.data?.social_insurance_enabled === true,
          incomeTaxEnabled: companyRes.data?.income_tax_enabled === true,
        };

        // Auto-link advances per employee (same as the dashboard action)
        const advanceDeductions = new Map<string, number>();
        await Promise.all(
          employees.map(async (emp) => {
            const { data } = await supa.rpc(
              "compute_advance_deduction_for_period",
              {
                p_employee_id: emp.id,
                p_period_start: start_date,
                p_period_end: end_date,
              },
            );
            advanceDeductions.set(
              emp.id,
              typeof data === "number" ? data : 0,
            );
          }),
        );

        const entries = employees.map((emp) => {
          const empAtt = attendance.filter((a) => a.employee_id === emp.id);
          const attended = empAtt.filter((a) => a.status === "present").length;
          const halfDay = empAtt.filter((a) => a.status === "half_day").length;
          const absent = empAtt.filter((a) => a.status === "absent").length;
          const leave = Math.max(
            0,
            empAtt.length - attended - halfDay - absent,
          );
          const tardinessMinutes = empAtt
            .filter((a) => a.status === "present" || a.status === "half_day")
            .reduce((s, a) => s + (a.tardiness_minutes ?? 0), 0);
          const earlyLeaveMinutes = empAtt
            .filter((a) => a.status === "present" || a.status === "half_day")
            .reduce((s, a) => s + (a.early_leave_minutes ?? 0), 0);

          const breakdown: AttendanceBreakdown = {
            attended,
            halfDay,
            leave,
            absent,
            tardinessMinutes,
            earlyLeaveMinutes,
          };
          const loanDeduction = advanceDeductions.get(emp.id) ?? 0;
          const res = calculatePayroll(
            {
              basicSalary: emp.basic_salary ?? 0,
              housingAllowance: emp.housing_allowance ?? 0,
              transportAllowance: emp.transport_allowance ?? 0,
              otherAllowances: emp.other_allowances ?? 0,
              incentiveAllowance: emp.incentive_allowance ?? 0,
              loanDeduction,
            },
            breakdown,
            working_days,
            settings,
          );
          return {
            company_id: profile.company_id,
            period_id: period.id,
            employee_id: emp.id,
            attended_days: attended,
            half_day_days: halfDay,
            leave_days: leave,
            absent_days: absent,
            basic_salary: emp.basic_salary ?? 0,
            housing_allowance: emp.housing_allowance ?? 0,
            transport_allowance: emp.transport_allowance ?? 0,
            other_allowances: emp.other_allowances ?? 0,
            incentive_allowance: emp.incentive_allowance ?? 0,
            bonuses: 0,
            overtime: 0,
            gross_salary: res.grossSalary,
            absence_deduction: res.absenceDeduction,
            tardiness_deduction: res.tardinessDeduction,
            social_insurance: res.socialInsurance,
            income_tax: res.incomeTax,
            loan_deduction: loanDeduction,
            other_deductions: 0,
            total_deductions: res.totalDeductions,
            net_salary: res.netSalary,
          };
        });

        if (entries.length > 0) {
          await supa.from("payroll_entries").upsert(entries, {
            onConflict: "period_id,employee_id",
          });
        }

        const totalNet = entries.reduce((s, e) => s + e.net_salary, 0);
        return {
          ok: true,
          already_exists: false,
          period_id: period.id,
          url: `/dashboard/payroll/${period.id}`,
          employee_count: entries.length,
          total_net: Math.round(totalNet * 100) / 100,
        };
      },
    }),

    // ============================================================
    // MUTATION TOOLS — every one uses the preview-then-confirm flow.
    // The system prompt enforces this; the execute() body double-
    // checks `user_confirmed` and returns a preview when it's false.
    // ============================================================

    // ----------- Tool 11: update_employee -----------
    update_employee: tool({
      description:
        "عدّل حقول موظف موجود (الاسم / المسمى / القسم / الراتب / البدلات / " +
        "تكرار الراتب / الحالة). " +
        "**flow إجباري**: نادي الأداة بـ user_confirmed=false أولاً علشان " +
        "ترجع القيم الحالية + المقترح، لخّص للمستخدم، استنى موافقة صريحة، " +
        "وبعدين نادي تاني بـ user_confirmed=true.",
      inputSchema: z.object({
        employee_id: z
          .string()
          .uuid()
          .describe("الـ UUID بتاع الموظف. استخدم search_employees لو محتاج تجيبه."),
        updates: z
          .object({
            full_name: z.string().min(2).optional(),
            job_title: z.string().optional(),
            department: z.string().optional(),
            basic_salary: z.number().nonnegative().optional(),
            housing_allowance: z.number().nonnegative().optional(),
            transport_allowance: z.number().nonnegative().optional(),
            other_allowances: z.number().nonnegative().optional(),
            incentive_allowance: z.number().nonnegative().optional(),
            pay_frequency: z.enum(["monthly", "weekly"]).optional(),
            status: z
              .enum(["active", "inactive", "terminated", "on_leave"])
              .optional(),
            phone: z.string().optional(),
            // Plain string (not z.string().email()) — the email regex
            // zod generates uses negative lookahead which some AI
            // providers' JSON-Schema validators reject as not valid
            // ECMA-262 regex. We accept any string and let the model
            // judge "looks like an email"; downstream DB constraints
            // handle the validation rigorously.
            email: z.string().optional(),
          })
          .describe(
            "الحقول المراد تعديلها. أي حقل مش مذكور = مش هيتغيّر.",
          ),
        user_confirmed: z
          .boolean()
          .describe(
            "حطّها true بس بعد ما المستخدم وافق صراحة في الـ chat. " +
              "الأول دايماً false (preview).",
          ),
      }),
      execute: async ({ employee_id, updates, user_confirmed }) => {
        const supa = await createClient();

        // Always fetch current state — we use it for the preview AND
        // for the post-execute summary.
        const { data: current, error: fetchErr } = await supa
          .from("employees")
          .select(
            "id, full_name, employee_code, job_title, department, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, pay_frequency, status, phone, email",
          )
          .eq("id", employee_id)
          .single();
        if (fetchErr || !current) {
          return {
            ok: false,
            error: `الموظف مش موجود: ${fetchErr?.message ?? "not found"}`,
          };
        }

        if (!user_confirmed) {
          // Build a diff so the model can present it cleanly.
          const diff: Record<string, { from: unknown; to: unknown }> = {};
          for (const [key, value] of Object.entries(updates)) {
            if (value === undefined) continue;
            const before = (current as Record<string, unknown>)[key];
            if (before !== value) {
              diff[key] = { from: before, to: value };
            }
          }
          return {
            ok: true,
            preview: true,
            employee: {
              id: current.id,
              code: current.employee_code,
              name: current.full_name,
            },
            changes: diff,
            changes_count: Object.keys(diff).length,
            confirmation_prompt:
              Object.keys(diff).length === 0
                ? "مفيش تغييرات حقيقية في المقترح — الحقول دي زي ما هي."
                : "تأكد عايز أعدّل التغييرات دي؟",
          };
        }

        // user_confirmed = true → write to DB
        const { error: updErr } = await supa
          .from("employees")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", employee_id);
        if (updErr) {
          return { ok: false, error: updErr.message };
        }
        return {
          ok: true,
          applied: true,
          employee_id,
          employee_name: current.full_name,
          applied_updates: updates,
        };
      },
    }),

    // ----------- Tool 12: create_employee -----------
    create_employee: tool({
      description:
        "أضف موظف جديد فردي (مش للجماعي — للجماعي استخدم bulk_import_employees). " +
        "**flow إجباري**: نادي بـ user_confirmed=false أولاً للـ preview، " +
        "لخّص البيانات، استنى موافقة، نادي تاني بـ user_confirmed=true.",
      inputSchema: z.object({
        full_name: z
          .string()
          .min(2)
          .describe("اسم الموظف الكامل (إجباري)."),
        basic_salary: z
          .number()
          .nonnegative()
          .describe("الراتب الأساسي بالجنيه (إجباري)."),
        pay_frequency: z
          .enum(["monthly", "weekly"])
          .describe("شهري أو أسبوعي (إجباري)."),
        employee_code: z
          .string()
          .optional()
          .describe("كود الموظف الداخلي (لو فاضي، يتولّد تلقائياً)."),
        job_title: z.string().optional(),
        department: z.string().optional(),
        hire_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("YYYY-MM-DD. الافتراضي اليوم."),
        housing_allowance: z.number().nonnegative().optional(),
        transport_allowance: z.number().nonnegative().optional(),
        other_allowances: z.number().nonnegative().optional(),
        phone: z.string().optional(),
        // Plain string — see comment in update_employee. zod's email
        // regex breaks JSON-Schema strict ECMA-262 validation.
        email: z.string().optional(),
        national_id: z.string().optional(),
        user_confirmed: z
          .boolean()
          .describe("حطّها true فقط بعد موافقة المستخدم الصريحة في الـ chat."),
      }),
      execute: async ({ user_confirmed, ...payload }) => {
        const supa = await createClient();

        if (!user_confirmed) {
          return {
            ok: true,
            preview: true,
            proposed: payload,
            confirmation_prompt: `هضيف موظف جديد: ${payload.full_name} براتب ${payload.basic_salary} جنيه (${payload.pay_frequency === "monthly" ? "شهري" : "أسبوعي"}). تأكد؟`,
          };
        }

        // Resolve company_id from caller's profile
        const {
          data: { user },
        } = await supa.auth.getUser();
        if (!user) return { ok: false, error: "Unauthorized" };
        const { data: prof } = await supa
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single<{ company_id: string }>();
        if (!prof) return { ok: false, error: "Profile not found" };

        const insertRow: Record<string, unknown> = {
          company_id: prof.company_id,
          full_name: payload.full_name,
          basic_salary: payload.basic_salary,
          pay_frequency: payload.pay_frequency,
          status: "active",
          hire_date: payload.hire_date ?? new Date().toISOString().split("T")[0],
        };
        if (payload.employee_code) insertRow.employee_code = payload.employee_code;
        if (payload.job_title) insertRow.job_title = payload.job_title;
        if (payload.department) insertRow.department = payload.department;
        if (payload.housing_allowance !== undefined)
          insertRow.housing_allowance = payload.housing_allowance;
        if (payload.transport_allowance !== undefined)
          insertRow.transport_allowance = payload.transport_allowance;
        if (payload.other_allowances !== undefined)
          insertRow.other_allowances = payload.other_allowances;
        if (payload.phone) insertRow.phone = payload.phone;
        if (payload.email) insertRow.email = payload.email;
        if (payload.national_id) insertRow.national_id = payload.national_id;

        const { data: created, error } = await supa
          .from("employees")
          .insert(insertRow)
          .select("id, employee_code, full_name")
          .single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, created };
      },
    }),

    // ----------- Tool 13: adjust_payroll_entry -----------
    adjust_payroll_entry: tool({
      description:
        "عدّل سطر مرتب لموظف معين في دورة معينة — أضف bonus، أو خصم استثنائي، " +
        "أو عدّل overtime / other_deductions. الـ net بيتحدث تلقائياً. " +
        "**flow إجباري**: preview بـ user_confirmed=false → موافقة → execute.",
      inputSchema: z.object({
        period_id: z
          .string()
          .uuid()
          .describe("UUID الـ payroll period."),
        employee_id: z.string().uuid(),
        adjustments: z
          .object({
            bonuses: z.number().nonnegative().optional(),
            overtime: z.number().nonnegative().optional(),
            other_deductions: z.number().nonnegative().optional(),
          })
          .describe("الحقول اللي عايز تعدّلها. غير المذكور = ما يتغيّرش."),
        user_confirmed: z.boolean(),
      }),
      execute: async ({
        period_id,
        employee_id,
        adjustments,
        user_confirmed,
      }) => {
        const supa = await createClient();

        const { data: entry, error: fetchErr } = await supa
          .from("payroll_entries")
          .select(
            "id, gross_salary, bonuses, overtime, total_deductions, net_salary, other_deductions, social_insurance, income_tax, absence_deduction, tardiness_deduction, loan_deduction, employees(full_name)",
          )
          .eq("period_id", period_id)
          .eq("employee_id", employee_id)
          .single<{
            id: string;
            gross_salary: number;
            bonuses: number;
            overtime: number;
            total_deductions: number;
            net_salary: number;
            other_deductions: number;
            social_insurance: number;
            income_tax: number;
            absence_deduction: number;
            tardiness_deduction: number;
            loan_deduction: number;
            employees: { full_name: string } | null;
          }>();
        if (fetchErr || !entry) {
          return {
            ok: false,
            error: `سطر المرتب مش موجود: ${fetchErr?.message ?? "not found"}`,
          };
        }

        const nextBonuses = adjustments.bonuses ?? entry.bonuses;
        const nextOvertime = adjustments.overtime ?? entry.overtime;
        const nextOtherDed =
          adjustments.other_deductions ?? entry.other_deductions;

        // Net = gross + bonuses + overtime - (social_insurance + income_tax
        //       + absence_deduction + tardiness_deduction + loan + other)
        const newTotalDed =
          entry.social_insurance +
          entry.income_tax +
          entry.absence_deduction +
          entry.tardiness_deduction +
          entry.loan_deduction +
          nextOtherDed;
        const newNet =
          entry.gross_salary + nextBonuses + nextOvertime - newTotalDed;

        if (!user_confirmed) {
          return {
            ok: true,
            preview: true,
            employee_name: entry.employees?.full_name,
            current: {
              bonuses: entry.bonuses,
              overtime: entry.overtime,
              other_deductions: entry.other_deductions,
              net_salary: entry.net_salary,
            },
            after: {
              bonuses: nextBonuses,
              overtime: nextOvertime,
              other_deductions: nextOtherDed,
              net_salary: Math.round(newNet * 100) / 100,
            },
            confirmation_prompt: `الصافي الجديد لـ ${entry.employees?.full_name} هيبقى ${Math.round(newNet).toLocaleString("ar-EG")} جنيه. تأكد؟`,
          };
        }

        const { error: updErr } = await supa
          .from("payroll_entries")
          .update({
            bonuses: nextBonuses,
            overtime: nextOvertime,
            other_deductions: nextOtherDed,
            total_deductions: Math.round(newTotalDed * 100) / 100,
            net_salary: Math.round(newNet * 100) / 100,
            updated_at: new Date().toISOString(),
          })
          .eq("id", entry.id);
        if (updErr) return { ok: false, error: updErr.message };

        return {
          ok: true,
          applied: true,
          entry_id: entry.id,
          new_net: Math.round(newNet * 100) / 100,
        };
      },
    }),

    // ----------- Tool 14: approve_request -----------
    approve_request: tool({
      description:
        "وافق (أو ارفض) طلب إجازة أو سلفة معلق. " +
        "**flow إجباري**: preview بـ user_confirmed=false (يرجع تفاصيل الطلب) → " +
        "لخّص للمستخدم → موافقة صريحة → user_confirmed=true.",
      inputSchema: z.object({
        request_type: z.enum(["leave", "advance"]),
        request_id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]).default("approved"),
        notes: z.string().optional(),
        user_confirmed: z.boolean(),
      }),
      execute: async ({
        request_type,
        request_id,
        decision,
        notes,
        user_confirmed,
      }) => {
        const supa = await createClient();
        const table =
          request_type === "leave" ? "leave_requests" : "advance_requests";

        const { data: request, error: fetchErr } = await supa
          .from(table)
          .select(
            request_type === "leave"
              ? "id, status, leave_type, start_date, end_date, days_count, reason, employees(full_name)"
              : "id, status, amount, reason, employees(full_name)",
          )
          .eq("id", request_id)
          .single<Record<string, unknown> & { employees: { full_name: string } | null }>();
        if (fetchErr || !request) {
          return {
            ok: false,
            error: `الطلب مش موجود: ${fetchErr?.message ?? "not found"}`,
          };
        }
        if (request.status !== "pending") {
          return {
            ok: false,
            error: `الطلب ده مش معلق — حالته الحالية: ${request.status}`,
          };
        }

        if (!user_confirmed) {
          return {
            ok: true,
            preview: true,
            request_type,
            employee_name: request.employees?.full_name,
            details: request,
            decision,
            confirmation_prompt: `${decision === "approved" ? "هوافق" : "هرفض"} ${request_type === "leave" ? "طلب الإجازة" : "طلب السلفة"} لـ ${request.employees?.full_name}. تأكد؟`,
          };
        }

        const { error: updErr } = await supa
          .from(table)
          .update({
            status: decision,
            decided_at: new Date().toISOString(),
            decision_notes: notes ?? null,
          })
          .eq("id", request_id);
        if (updErr) return { ok: false, error: updErr.message };

        return {
          ok: true,
          applied: true,
          request_id,
          decision,
        };
      },
    }),

    // ----------- Tool 15: record_attendance_entry -----------
    record_attendance_entry: tool({
      description:
        "سجّل حضور لموظف في يوم معين (الحالات الفردية بس). " +
        "للجماعي استخدم bulk_import_attendance. " +
        "**flow إجباري**: preview بـ user_confirmed=false → موافقة → execute.",
      inputSchema: z.object({
        employee_id: z.string().uuid(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("YYYY-MM-DD"),
        status: z.enum(["present", "absent", "half_day", "leave"]),
        check_in: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional()
          .describe("HH:MM (24h). للحالات present / half_day بس."),
        check_out: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional(),
        tardiness_minutes: z.number().nonnegative().optional(),
        early_leave_minutes: z.number().nonnegative().optional(),
        notes: z.string().optional(),
        user_confirmed: z.boolean(),
      }),
      execute: async ({ user_confirmed, ...payload }) => {
        const supa = await createClient();

        // Make sure the employee exists + belongs to caller's company (RLS
        // handles the tenant filter, this is just for the friendly error).
        const { data: emp } = await supa
          .from("employees")
          .select("full_name")
          .eq("id", payload.employee_id)
          .single<{ full_name: string }>();
        if (!emp) return { ok: false, error: "الموظف مش موجود" };

        if (!user_confirmed) {
          return {
            ok: true,
            preview: true,
            employee_name: emp.full_name,
            proposed: payload,
            confirmation_prompt: `هسجّل لـ ${emp.full_name} يوم ${payload.date} (${payload.status}). تأكد؟`,
          };
        }

        // Resolve company_id for the insert (RLS already gates, but the
        // schema requires it explicitly).
        const {
          data: { user },
        } = await supa.auth.getUser();
        const { data: prof } = await supa
          .from("profiles")
          .select("company_id")
          .eq("id", user!.id)
          .single<{ company_id: string }>();
        if (!prof) return { ok: false, error: "Profile not found" };

        const { error: upsertErr } = await supa
          .from("attendance")
          .upsert(
            {
              company_id: prof.company_id,
              employee_id: payload.employee_id,
              date: payload.date,
              status: payload.status,
              check_in: payload.check_in ?? null,
              check_out: payload.check_out ?? null,
              tardiness_minutes: payload.tardiness_minutes ?? 0,
              early_leave_minutes: payload.early_leave_minutes ?? 0,
              notes: payload.notes ?? null,
            },
            { onConflict: "employee_id,date" },
          );
        if (upsertErr) return { ok: false, error: upsertErr.message };

        return { ok: true, applied: true };
      },
    }),
  };

  // --------------------------------------------------------------------
  // Stream the response — uses pickAgentModelLargeContext() which prefers
  // Gemini Flash for the agent route because:
  //   - File uploads dump 5-12k tokens of JSON into the message thread
  //   - Tool calls + multi-turn confirmations stack history quickly
  //   - The system prompt is large (~3k tokens of Arabic + tool docs)
  // Groq's free tier caps gpt-oss-120b at 8k TPM per request, which 80-
  // employee imports routinely exceed. Gemini's per-request budget is
  // 1M+ tokens, so it's the safer default for tool-calling agents.
  // For Marketing Studio etc. (small requests, latency matters more)
  // the regular pickAgentModel() still picks Groq first.
  // --------------------------------------------------------------------
  const picked = pickAgentModelLargeContext();

  const result = streamText({
    model: picked.model,
    system: systemPrompt,
    messages,
    tools,
    // Allow up to 10 steps. Mutation tools added in this commit need a
    // two-step flow per call (user_confirmed=false → preview → wait for
    // user → user_confirmed=true → execute). A single conversation can
    // chain multiple mutations (e.g. "update Ahmed's salary AND approve
    // his leave request"), so the extra budget covers compound asks
    // without truncating mid-flow.
    stopWhen: stepCountIs(10),
    // Keep temperature low — tool-calling agents are happier with
    // deterministic argument generation.
    temperature: 0.2,
  });

  return result.toUIMessageStreamResponse();
}
