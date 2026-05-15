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
import { pickAgentModel } from "@/lib/ai-models";

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

عندك ١٠ أدوات. اختار الأداة الصح حسب طلب المستخدم:

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

8. **bulk_import_employees** — أداة تنفيذية لرفع موظفين دفعة واحدة.
   لما المستخدم يرفع ملف **(Excel أو PDF)** ويقولك "ضيف الموظفين دول":
   أ) هتلاقي بيانات الملف داخل رسالة المستخدم كـ JSON منظم
   ب) لخّص في الـ chat: "هضيف X موظف، فيهم Y بدون رقم قومي و Z بدون كود.
      تأكد عايز أضيفهم؟"
   ج) استنى رد إيجابي صريح ("نعم"، "تمام"، "ضيف")
   د) نادي الأداة بـ rows + user_confirmed: true
   ه) ابن الـ rows من البيانات الموجودة في الـ chat، **متخترعش بيانات**

9. **bulk_import_attendance** — أداة تنفيذية لرفع سجلات حضور دفعة واحدة.
   نفس flow rules الـ bulk_import_employees بالضبط. ممكن المستخدم يرفع
   Excel أو PDF (لو PDF، الـ AI استخرج الصفوف لك تلقائياً). كل صف لازم
   فيه: employee_code (للبحث في موظفي الشركة) + date + status. لو الكود
   مش موجود في النظام، الصف يتجاهل.

**ملاحظة عن ملفات الـ PDF**: لو المستخدم رفع PDF وهو **عقد أو مذكرة أو
تقرير** (مش جدول بيانات)، هتلاقي في الرسالة "ملخص المحتوى" بدل JSON.
في الحالة دي، رد على أسئلة المستخدم عن محتوى المستند بدون ما تنادي
bulk_import_* (لأن مفيش بيانات منظمة).

10. **execute_payroll_period** — الأداة الوحيدة الـ destructive.
   بتنشئ دورة مرتبات فعلية في قاعدة البيانات. **ممنوع** تستعملها
   قبل ما تعمل الخطوات دي:

   أ) تنادي propose_payroll_period الأول
   ب) ترد على المستخدم بإجمالي المرتبات + عدد الموظفين
   ج) تسأله **بوضوح**: "تأكد عايز أنفذ؟"
   د) تستنى رد إيجابي صريح (مثلاً: "نعم"، "موافق"، "نفذ"، "تمام"،
      "اعمل"، "أيوة"). أي رد غير ده = ممنوع التنفيذ.

   لو المستخدم قاللك "نفذ" أو "موافق" بدون proposal قبلها → ارجع
   اعمل proposal أولاً ولا تستخدم execute مباشرة.

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
        "**أداة تنفيذية** — اضف موظفين جدد دفعة واحدة لقاعدة البيانات. " +
        "استعملها بس بعد ما المستخدم رفع ملف Excel وقالك صراحة 'ضيف الموظفين دول'. " +
        "كل صف لازم يكون فيه على الأقل full_name. " +
        "بترجع عدد المضافين + المتجاهلين (بسبب اسم ناقص أو تكرار). " +
        "**لا تستعملها بدون موافقة صريحة من المستخدم في الـ chat.**",
      inputSchema: z.object({
        rows: z
          .array(
            z.object({
              full_name: z.string().min(2),
              employee_code: z.string().nullable().optional(),
              job_title: z.string().nullable().optional(),
              department: z.string().nullable().optional(),
              phone: z.string().nullable().optional(),
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

        const inserted: string[] = [];
        const skipped: { row: number; name: string; reason: string }[] = [];

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

          // Dedupe by national_id then by employee_code
          if (r.national_id) {
            const { data: dupe } = await supa
              .from("employees")
              .select("id")
              .eq("company_id", profile.company_id)
              .eq("national_id", r.national_id)
              .maybeSingle();
            if (dupe) {
              skipped.push({
                row: rowIdx,
                name: r.full_name,
                reason: "موجود بنفس الرقم القومي",
              });
              continue;
            }
          }
          if (r.employee_code) {
            const { data: dupe } = await supa
              .from("employees")
              .select("id")
              .eq("company_id", profile.company_id)
              .eq("employee_code", r.employee_code)
              .maybeSingle();
            if (dupe) {
              skipped.push({
                row: rowIdx,
                name: r.full_name,
                reason: "موجود بنفس الكود",
              });
              continue;
            }
          }

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
          skipped_count: skipped.length,
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
  };

  // --------------------------------------------------------------------
  // Stream the response — uses pickAgentModel() for multi-provider
  // fallback. Default order:
  //   Groq Llama 3.3 70B → Groq Llama 3.1 8B → Gemini 2.5 Flash Lite
  // Combined free quota is ~30,000 RPD, ~120 RPM — effectively unlimited
  // for SMB workloads without ever enabling billing. See /lib/ai-models.ts.
  // --------------------------------------------------------------------
  const picked = pickAgentModel();

  const result = streamText({
    model: picked.model,
    system: systemPrompt,
    messages,
    tools,
    // Allow up to 6 steps so the model can: call propose -> see result ->
    // write a confirmation prompt. The execute call happens on the NEXT
    // user turn (after they say "نعم"), so 6 covers both turns
    // generously with headroom for retries.
    stopWhen: stepCountIs(6),
    // Keep temperature low — tool-calling agents are happier with
    // deterministic argument generation.
    temperature: 0.2,
  });

  return result.toUIMessageStreamResponse();
}
