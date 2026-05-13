import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Use our env var name (GEMINI_API_KEY) instead of the SDK's default
// (GOOGLE_GENERATIVE_AI_API_KEY). One provider instance for the whole route.
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

type UIMessagePart = { type: string; text?: string };
type IncomingMessage = {
  role: "user" | "assistant" | "system";
  parts?: UIMessagePart[];
  content?: string;
};

function normalizeMessages(raw: unknown): { role: "user" | "assistant" | "system"; content: string }[] {
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

export const maxDuration = 30;

type AttendanceRow = { employee_id: string; status: string; date: string };
type InteractionRow = {
  employee_id: string;
  customer_id: string;
  outcome: string;
  date: string;
};
type EmployeeRow = {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  status: string;
};
type CustomerRow = {
  id: string;
  full_name: string;
  status: string;
  estimated_value: number | null;
  source: string | null;
};

function startOfMonthIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

async function buildCompanyContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "";

  const startMonth = startOfMonthIso();
  const today = todayIso();

  // Fetch in parallel — RLS scopes everything to the user's company
  const [profileRes, employeesRes, customersRes, attendanceRes, interactionsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, companies(name)")
        .eq("id", user.id)
        .single(),
      supabase
        .from("employees")
        .select("id, full_name, job_title, department, status")
        .order("full_name")
        .returns<EmployeeRow[]>(),
      supabase
        .from("customers")
        .select("id, full_name, status, estimated_value, source")
        .order("created_at", { ascending: false })
        .limit(30)
        .returns<CustomerRow[]>(),
      supabase
        .from("attendance")
        .select("employee_id, status, date")
        .gte("date", startMonth)
        .lte("date", today)
        .returns<AttendanceRow[]>(),
      supabase
        .from("interactions")
        .select("employee_id, customer_id, outcome, date")
        .gte("date", startMonth)
        .lte("date", today)
        .returns<InteractionRow[]>(),
    ]);

  const profile = profileRes.data as
    | { full_name: string | null; companies: { name: string } | null }
    | null;
  const employees = employeesRes.data ?? [];
  const customers = customersRes.data ?? [];
  const attendance = attendanceRes.data ?? [];
  const interactions = interactionsRes.data ?? [];

  // Per-employee stats this month
  const employeeStats = employees.map((emp) => {
    const empAttendance = attendance.filter((a) => a.employee_id === emp.id);
    const present = empAttendance.filter((a) => a.status === "present").length;
    const absent = empAttendance.filter((a) => a.status === "absent").length;
    const halfDay = empAttendance.filter((a) => a.status === "half_day").length;
    const leaves = empAttendance.filter((a) => a.status === "leave").length;
    const total = empAttendance.length;
    const rate = total === 0 ? 0 : Math.round(((present + halfDay * 0.5) / total) * 100);

    const empInteractions = interactions.filter((i) => i.employee_id === emp.id);
    const positive = empInteractions.filter((i) => i.outcome === "positive").length;
    const negative = empInteractions.filter((i) => i.outcome === "negative").length;
    const distinctCustomers = new Set(empInteractions.map((i) => i.customer_id)).size;

    return {
      ...emp,
      attendance: { present, absent, halfDay, leaves, rate },
      crm: {
        positive,
        negative,
        total: empInteractions.length,
        customers: distinctCustomers,
      },
    };
  });

  const totalPipelineValue = customers
    .filter((c) => c.status === "lead" || c.status === "active")
    .reduce((s, c) => s + (c.estimated_value ?? 0), 0);

  const companyName = profile?.companies?.name ?? "—";
  const userName = profile?.full_name ?? "المستخدم";

  // Format as concise text (saves tokens). The prompt is split into
  // two halves: a (static) HR-expert preamble that gives the model the
  // domain knowledge it needs to answer Egyptian labor-law questions,
  // and a (dynamic) company-data context for "how is my team doing
  // this month?" style questions. The model handles both gracefully.
  return `
أنت "نِظام AI" -- مساعد ذكي ومتخصص في الموارد البشرية للسوق المصري.
بتشتغل في نظام HR + CRM، وبتساعد صاحب الشركة على اتخاذ قرارات HR/إدارية صح.

## مهامك الأساسية

أنت بترد على نوعين من الأسئلة:

(1) **أسئلة قانون العمل والـ HR العامة** -- زي:
   - حقوق الموظف والإجازات
   - حسابات الضرائب والتأمينات
   - مكافأة نهاية الخدمة، إنهاء العقد، فترة الاختبار
   - العمل الإضافي، إجازة الوضع، الإجازات المرضية
   - عقود العمل المختلفة (دائم، مؤقت، مياومة)
   - السياسات الإدارية وأفضل الممارسات

(2) **أسئلة عن بيانات شركة "${companyName}"** -- زي:
   - أداء الموظفين، الحضور، الالتزام
   - تحليل العملاء والـ pipeline
   - الإنتاجية الفردية والتفاعلات
   - مقترحات إدارية مبنية على البيانات

## معلومات HR مصرية لازم تستعملها

### القوانين المرجعية
- **قانون العمل رقم 12 لسنة 2003** + التعديلات
- **قانون التأمينات الاجتماعية رقم 148 لسنة 2019**
- **قانون الضريبة على الدخل** (آخر تعديل 2024 - قانون 175/2023)

### حقوق الإجازات (المادة 47 من قانون العمل)
- **اعتيادية**: 21 يوم/سنة (15 لو خدمته أقل من سنة)
- **30 يوم بعد 10 سنين خدمة أو 50 سنة عمر**
- **عارضة**: 6 أيام/سنة (مدفوعة) - بحد أقصى يومين متتاليين
- **مرضية**: لحد 180 يوم/سنة - 75% أول 90، 85% آخر 90
- **وضع**: 4 شهور (90 يوم قبل + 30 يوم بعد) بأجر كامل - مرتين في فترة الخدمة الكاملة
- **حج**: شهر مرة واحدة في العمر بعد 5 سنين خدمة
- **وفاة**: 3 أيام (للأقارب من الدرجة الأولى)

### الأجور والاستقطاعات (2024-2025)
- **التأمينات الاجتماعية - حصة الموظف**: 14% من الأجر المؤمَّن عليه
- **الحد الأقصى للأجر المؤمَّن عليه**: حوالي 12,600 ج/شهر (يتحدث سنويًا)
- **الإعفاء الشخصي السنوي**: 20,000 ج
- **شرائح ضريبة الدخل السنوية (بعد الإعفاء)**:
  - 0 - 40,000: 10%
  - 40,000 - 55,000: 15%
  - 55,000 - 70,000: 20%
  - 70,000 - 200,000: 22.5%
  - 200,000 - 400,000: 25%
  - أكتر من 400,000: 27.5%
- **الحد الأدنى للأجر** (قطاع خاص 2024): 6,000 ج/شهر

### ساعات العمل والعمل الإضافي (المادة 80-85)
- **الحد الأقصى لساعات العمل**: 8 ساعات/يوم، 48 ساعة/أسبوع
- **العمل الإضافي**: لازم بموافقة الموظف، حد أقصى 4 ساعات/يوم
- **زيادة أجر الـ overtime**:
  - نهاري: 35% فوق الأجر العادي
  - ليلي: 70% فوق
  - الراحة الأسبوعية والأعياد: 100% فوق (مضاعف)
- **الراحة الأسبوعية**: 24 ساعة متواصلة/أسبوع
- **الإجازات الرسمية**: حوالي 14 يوم/سنة بأجر كامل

### العقد والاختبار وإنهاء الخدمة
- **فترة الاختبار**: 3 شهور كحد أقصى (المادة 33)
- **مدة الإخطار قبل الإنهاء**: شهرين لو الخدمة < 10 سنين، 3 شهور لو > 10 سنين
- **مكافأة نهاية الخدمة (عقد محدد المدة منتهي)**: نص شهر عن كل سنة من أول 5 سنين، شهر كامل عن كل سنة بعدها

### قواعد الرد

1. **استعمل العربي المصري الواضح** - مفيش فصحى ثقيلة.
2. **اقتبس القانون لما السؤال قانوني** - مثلاً "حسب المادة 47 من قانون العمل..."
3. **اربط بالأرقام والشركة لما السؤال عن بياناتها** - استعمل أسماء الموظفين والعملاء.
4. **افتح للمستخدم خيارات لما السؤال غير واضح** - "تقصد كذا ولا كذا؟"
5. **لو محتاج معلومة مش موجودة في السياق** - قول صراحة "البيان ده مش متوفر، ابعت لي لو عندك تفاصيل أكتر."
6. **لو السؤال خارج HR/الشركة تمامًا (مثلاً طبخ، رياضة)** - رد بأدب: "أنا متخصص في موارد بشرية بس."
7. **في الحسابات المالية اشرح خطوة بخطوة** - عشان المستخدم يقدر يراجع.

## بيانات الشركة الحالية

- **اسم الشركة**: ${companyName}
- **المستخدم**: ${userName}
- **الفترة**: من ${startMonth} لـ ${today}

### الموظفين (${employees.length} موظف نشط)
${employeeStats
  .map(
    (e) =>
      `- ${e.full_name} (${e.job_title ?? "—"}, ${e.department ?? "—"}, ${e.status}): حضور ${e.attendance.rate}% (${e.attendance.present}/${e.attendance.present + e.attendance.absent + e.attendance.halfDay + e.attendance.leaves}), تفاعلات ${e.crm.total} (إيجابي: ${e.crm.positive}, سلبي: ${e.crm.negative}), مع ${e.crm.customers} عميل`,
  )
  .join("\n")}

### العملاء (آخر 30 - ${customers.length} ظاهر)
${customers
  .map(
    (c) =>
      `- ${c.full_name} (${c.status}, القيمة: ${c.estimated_value ?? "—"} ج, المصدر: ${c.source ?? "—"})`,
  )
  .join("\n")}

### ملخص الفترة
- إجمالي قيمة Pipeline (Leads + Active): ${totalPipelineValue.toLocaleString("ar-EG")} ج
- إجمالي التفاعلات: ${interactions.length}
- تفاعلات إيجابية: ${interactions.filter((i) => i.outcome === "positive").length}
- تفاعلات سلبية: ${interactions.filter((i) => i.outcome === "negative").length}
`.trim();
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  // Only HR (admin/manager) can use the AI assistant -- it has access to
  // company-wide attendance + customer data via the system prompt.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    return new Response(
      JSON.stringify({ error: "المساعد الذكي مخصص لـ HR فقط" }),
      { status: 403 },
    );
  }

  // Rate limit: 30 chat turns / 10 minutes per user -- comfortable for
  // legitimate use and a hard ceiling on accidental billing burn.
  const rl = checkRateLimit(`ai-chat:${user.id}`, 30, 10 * 60_000);
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

  if (!process.env.GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "AI configuration missing — GEMINI_API_KEY not set",
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
    return new Response(
      JSON.stringify({ error: "No messages received" }),
      { status: 400 },
    );
  }

  const systemPrompt = await buildCompanyContext(supabase);

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages,
  });

  return result.toUIMessageStreamResponse();
}
