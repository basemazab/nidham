import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { createClient } from "@/lib/supabase/server";

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

  // Format as concise text (saves tokens)
  return `
أنت مساعد ذكي اسمه "نِظام AI" في نظام HR + CRM مصري.
دورك: تجاوب أسئلة صاحب الشركة عن بياناته بالعربي المصري الواضح والمختصر.

قواعد:
1. ردك دايمًا بالعربي المصري — لا تكتب إنجليزي إلا للأرقام والأسماء الإنجليزية.
2. كن مختصرًا ومفيدًا — مفيش حشو.
3. لما تذكر موظف أو عميل، اذكر اسمه واضح.
4. لو السؤال مش متعلق ببيانات الشركة، رد بأدب: "أنا متخصص في بيانات شركتك بس."
5. لو محتاج معلومة مش موجودة في السياق، قول صراحة: "البيانات دي مش متوفرة في الشهر الحالي."
6. عند المقارنة، استخدم نسب وأرقام واضحة.

السياق الحالي:
- اسم الشركة: ${companyName}
- المستخدم: ${userName}
- الفترة: من ${startMonth} إلى ${today}

الموظفين (${employees.length} موظف):
${employeeStats
  .map(
    (e) =>
      `- ${e.full_name} (${e.job_title ?? "—"}, ${e.department ?? "—"}, ${e.status}): حضور ${e.attendance.rate}% (${e.attendance.present}/${e.attendance.present + e.attendance.absent + e.attendance.halfDay + e.attendance.leaves}), تفاعلات ${e.crm.total} (إيجابي: ${e.crm.positive}, سلبي: ${e.crm.negative}), مع ${e.crm.customers} عميل`,
  )
  .join("\n")}

العملاء (آخر 30 — ${customers.length} ظاهر):
${customers
  .map(
    (c) =>
      `- ${c.full_name} (${c.status}, القيمة: ${c.estimated_value ?? "—"} ج, المصدر: ${c.source ?? "—"})`,
  )
  .join("\n")}

ملخص:
- إجمالي قيمة Pipeline (Leads + Active): ${totalPipelineValue.toLocaleString("ar-EG")} ج
- إجمالي التفاعلات الشهر ده: ${interactions.length}
- إيجابية: ${interactions.filter((i) => i.outcome === "positive").length}
- سلبية: ${interactions.filter((i) => i.outcome === "negative").length}
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
