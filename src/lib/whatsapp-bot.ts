// ============================================================================
// WhatsApp employee bot — intent router + reply builder
// ============================================================================
//
// Pure server module. Given an incoming text from a verified employee,
// returns the reply string. No I/O outside the supplied Supabase client.
//
// Intents v1 (rule-based — keyword + regex):
//   1. رصيد الإجازة            — annual leave balance
//   2. مرتب                    — last month's net pay
//   3. شهادة عمل / خبرة       — request a generated letter
//   4. الحضور / مواعيد         — last 7 days of attendance
//   5. سلفة                   — open loans summary
//   6. مساعدة / list           — show menu
//
// Future v2 will route to Gemini agent for free-form Q&A, but rule-based
// gets us 80% coverage at 10% the cost.

import type { SupabaseClient } from "@supabase/supabase-js";

type Employee = {
  id: string;
  company_id: string;
  full_name: string;
  phone: string | null;
  status: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SBClient = SupabaseClient<any, "public">;

const HELP_MENU = `أهلاً بيك! 👋
أنا بوت Nidham — تقدر تسأل عن:

🏖 "رصيد إجازاتي"
💰 "مرتبي" أو "آخر مرتب"
📅 "حضوري" (آخر 7 أيام)
💵 "سلفي"
📜 "شهادة عمل" أو "شهادة خبرة"
ℹ "مساعدة" — تشوف القائمة دي تاني

اكتب كلمة من اللي فوق وهرد عليك فوراً.`;

/** Detect intent from raw message text. Heuristic, Arabic-first.
 *
 * Regex tightening (J5): previous patterns over-matched. "عمل" inside
 * the certificate intent matched every "إزاي العمل" / "أول يوم عمل"
 * message; "إجاز" matched verbs like "أجاز"; English "leave" matched
 * "I will leave the office". The patterns below use:
 *   • Explicit phrase anchors ("شهادة عمل" / "رصيد إجازاتي" / "آخر مرتب")
 *     instead of single tokens that could appear in normal speech
 *   • \b word boundaries for ASCII keywords ("\bleave\b" not "leave")
 *   • Specific intent-marker words first ("شهادة", "رصيد", "آخر") that
 *     are unambiguous on their own
 *
 * Order matters: more specific intents come BEFORE more generic ones.
 * E.g. "شهادة عمل" must match certificate, not be hijacked by attendance.
 */
function detectIntent(text: string): string {
  const t = text.trim().toLowerCase();

  // Help — always first so menu/start commands take priority
  if (/(مساعد|menu|\bقائمة\b|\blist\b|ايه الخدمات|^ابدأ$|\bstart\b|الأوامر)/i.test(t)) {
    return "help";
  }

  // Certificate FIRST — "شهادة عمل" must beat the "عمل" → attendance trap
  if (
    /(شهادة|certificate|\bخبرة\b|شهادة عمل|شهادة خبرة|شهادة راتب|certificate of employment)/i.test(
      t,
    )
  ) {
    return "certificate";
  }

  // Leave balance — anchor on "رصيد" or "إجازة" with the ة. The verb forms
  // (أجاز / يجيز) don't end in ة, so requiring the ة filters them out.
  if (
    /(رصيد|إجازة|إجازات|اجازة|اجازات|عطلة|\bleave balance\b|leave days|كم رصيد)/i.test(
      t,
    )
  ) {
    return "leave_balance";
  }

  // Payroll — explicit pay-related words
  if (
    /(مرتب|راتب|قسيمة|\bsalary\b|\bpayslip\b|\bpaystub\b|آخر مرتب|اخر مرتب|كم مرتب|payroll)/i.test(
      t,
    )
  ) {
    return "payroll";
  }

  // Loans / advances
  if (
    /(سلف|سلفة|سلفه|قرض|قروض|\badvance\b|\bloan\b|installment|قسط)/i.test(t)
  ) {
    return "loans";
  }

  // Attendance — LAST among data intents because "حضور" could be ambiguous
  // (e.g., "حضرت اجتماع" but that's already handled by leave_balance not
  // matching above)
  if (/(حضور|حضوري|انصراف|attendance|سجل|مواعيد|تأخير)/i.test(t)) {
    return "attendance";
  }

  return "unknown";
}

/** Main entrypoint — given the employee and text, returns the reply. */
export async function routeBotMessage(
  supabase: SBClient,
  emp: Employee,
  text: string,
): Promise<string> {
  const intent = detectIntent(text);

  switch (intent) {
    case "help":
      return HELP_MENU;

    case "leave_balance":
      return await replyLeaveBalance(supabase, emp);

    case "payroll":
      return await replyLastPayroll(supabase, emp);

    case "attendance":
      return await replyAttendance(supabase, emp);

    case "loans":
      return await replyLoans(supabase, emp);

    case "certificate":
      return replyCertificate(emp);

    default:
      return `معلش، مش فاهم طلبك. اكتب *مساعدة* علشان تشوف الخدمات المتاحة.`;
  }
}

// ── Intent handlers ──

async function replyLeaveBalance(
  supabase: SBClient,
  emp: Employee,
): Promise<string> {
  const yearStart = new Date(new Date().getFullYear(), 0, 1)
    .toISOString()
    .split("T")[0];

  // Sum of approved annual leaves taken this year
  const { data: takenRows } = await supabase
    .from("leave_requests")
    .select("days_count")
    .eq("employee_id", emp.id)
    .eq("status", "approved")
    .eq("leave_type", "annual")
    .gte("start_date", yearStart)
    .returns<Array<{ days_count: number }>>();

  const taken = (takenRows ?? []).reduce(
    (s, r) => s + Number(r.days_count ?? 0),
    0,
  );

  // Default annual entitlement: 21 days (Egyptian Labor Law 12/2003,
  // Art 47 — increases to 30 after 10 years of service). For v1 we
  // assume 21 unless the company's settings override.
  const entitlement = 21;
  const remaining = Math.max(0, entitlement - taken);

  return `📋 رصيد إجازتك الاعتيادية ${new Date().getFullYear()}:

✓ المستحق: ${entitlement} يوم
🛫 اللي اتاخد: ${taken} يوم
🟢 المتبقي: *${remaining}* يوم

لو محتاج تطلب إجازة جديدة، كلم HR.`;
}

async function replyLastPayroll(
  supabase: SBClient,
  emp: Employee,
): Promise<string> {
  // Pull the most recent payroll entry for this employee
  const { data: entries } = await supabase
    .from("payroll_entries")
    .select(
      "net_pay, gross_pay, basic_salary, period_id, payroll_periods!inner(start_date, end_date, status)",
    )
    .eq("employee_id", emp.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<
      Array<{
        net_pay: number | null;
        gross_pay: number | null;
        basic_salary: number | null;
        period_id: string;
        payroll_periods: {
          start_date: string;
          end_date: string;
          status: string;
        } | null;
      }>
    >();

  const e = entries?.[0];
  if (!e || !e.payroll_periods) {
    return `معنديش بيانات مرتب لك لسه. لو خلصت دورة المرتبات حديثاً، استنى لحد ما HR يقفلها.`;
  }

  const period = e.payroll_periods;
  return `💰 آخر مرتب:

📅 الفترة: ${period.start_date} → ${period.end_date}
💵 الأساسي: ${Number(e.basic_salary ?? 0).toLocaleString("ar-EG")} ج
💸 الإجمالي: ${Number(e.gross_pay ?? 0).toLocaleString("ar-EG")} ج
🟢 الصافي: *${Number(e.net_pay ?? 0).toLocaleString("ar-EG")} ج*
📊 الحالة: ${period.status === "paid" ? "تم الصرف" : period.status === "closed" ? "مقفول" : "مفتوح"}`;
}

async function replyAttendance(
  supabase: SBClient,
  emp: Employee,
): Promise<string> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoIso = weekAgo.toISOString().split("T")[0];

  const { data: rows } = await supabase
    .from("attendance")
    .select("date, status, check_in, check_out, tardiness_minutes")
    .eq("employee_id", emp.id)
    .gte("date", weekAgoIso)
    .order("date", { ascending: false })
    .limit(7)
    .returns<
      Array<{
        date: string;
        status: string;
        check_in: string | null;
        check_out: string | null;
        tardiness_minutes: number | null;
      }>
    >();

  if (!rows || rows.length === 0) {
    return `معنديش حضور مسجّل ليك خلال آخر 7 أيام.`;
  }

  const statusEmoji: Record<string, string> = {
    present: "✓",
    absent: "✗",
    half_day: "◐",
    leave: "🏖",
    holiday: "🎉",
    weekend: "🛌",
  };

  const lines = rows.map((r) => {
    const emoji = statusEmoji[r.status] ?? "?";
    const time =
      r.check_in && r.check_out
        ? ` (${r.check_in.slice(0, 5)} → ${r.check_out.slice(0, 5)})`
        : r.check_in
          ? ` (دخول ${r.check_in.slice(0, 5)})`
          : "";
    const late =
      (r.tardiness_minutes ?? 0) > 0 ? ` ⚠ متأخر ${r.tardiness_minutes}د` : "";
    return `${emoji} ${r.date}${time}${late}`;
  });

  return `📅 آخر 7 أيام حضور:

${lines.join("\n")}`;
}

async function replyLoans(supabase: SBClient, emp: Employee): Promise<string> {
  const { data: loans } = await supabase
    .from("employee_loans")
    .select("amount, remaining_amount, monthly_installment, status")
    .eq("employee_id", emp.id)
    .in("status", ["pending", "approved", "active", "paid"])
    .order("requested_at", { ascending: false })
    .returns<
      Array<{
        amount: number;
        remaining_amount: number;
        monthly_installment: number;
        status: string;
      }>
    >();

  if (!loans || loans.length === 0) {
    return `معندكش أي سلف مسجّلة دلوقتي.`;
  }

  const active = loans.filter(
    (l) => l.status === "approved" || l.status === "active",
  );
  const totalRemaining = active.reduce(
    (s, l) => s + Number(l.remaining_amount),
    0,
  );

  if (active.length === 0) {
    const allPaid = loans.every((l) => l.status === "paid");
    return allPaid
      ? `✓ كل سلفك اتسدّدت. مفيش حاجة مفتوحة.`
      : `عندك سلفة منتظرة موافقة من HR. هتعلمك لما تتعمد.`;
  }

  return `💵 السلف المفتوحة:

📊 عدد السلف النشطة: ${active.length}
💰 إجمالي المتبقي: *${totalRemaining.toLocaleString("ar-EG")} ج*
📅 إجمالي القسط الشهري: ${active
    .reduce((s, l) => s + Number(l.monthly_installment), 0)
    .toLocaleString("ar-EG")} ج

كل قسط بيتخصم من مرتبك تلقائياً.`;
}

function replyCertificate(emp: Employee): string {
  return `📜 لإصدار شهادة (عمل / خبرة / راتب):

كلم HR في الشركة وقوله محتاج شهادة. هو هيدخل النظام وهيطلعها لك في دقيقة. الشهادة بتكون رسمية بختم الشركة.

اسمك في النظام: *${emp.full_name}*`;
}
