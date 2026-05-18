import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import {
  approvePayrollPeriod,
  markPayrollAsPaid,
  deletePayrollPeriod,
  cancelPayrollPeriod,
  reopenPayrollPeriod,
  regeneratePeriodEntries,
} from "../actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DownloadPdfButton } from "@/components/download-pdf-button";
import { PeriodSummary } from "./period-summary";
import {
  PeriodEntriesExplorer,
  type PeriodEntry,
} from "./period-entries-explorer";
import { PeriodActionsBar } from "./period-actions-bar";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    cancelled?: string;
    reopened?: string;
    bulk_bonus?: string;
    regenerated?: string;
  }>;
};

type Period = {
  id: string;
  year: number;
  month: number;
  frequency: "monthly" | "weekly" | null;
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "approved" | "paid" | "cancelled";
  working_days: number;
  approved_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  reopened_count: number | null;
};

type RawEntry = {
  id: string;
  employee_id: string;
  attended_days: number;
  half_day_days: number;
  absent_days: number;
  leave_days: number;
  gross_salary: number;
  social_insurance: number;
  income_tax: number;
  bonuses: number;
  total_deductions: number;
  net_salary: number;
  eos_gratuity: number | null;
  employees: {
    employee_code: string | null;
    full_name: string;
    job_title: string | null;
    department: string | null;
  } | null;
};

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default async function PayrollPeriodPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Scope every list-style query to the caller's company. The period
  // row itself is identified by an unguessable UUID so RLS is fine
  // for the single() fetch, but the entries/employees lookups would
  // otherwise let a super-admin browse cross-tenant rows.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [periodRes, entriesRes] = await Promise.all([
    supabase
      .from("payroll_periods")
      .select("*")
      .eq("id", id)
      .single<Period>(),
    supabase
      .from("payroll_entries")
      .select(
        "id, employee_id, attended_days, half_day_days, absent_days, leave_days, gross_salary, social_insurance, income_tax, bonuses, total_deductions, net_salary, eos_gratuity, employees(employee_code, full_name, job_title, department)",
      )
      .eq("company_id", callerCompanyId)
      .eq("period_id", id)
      .order("employee_id")
      .returns<RawEntry[]>(),
  ]);

  if (!periodRes.data) notFound();
  const period = periodRes.data;
  const rawEntries = entriesRes.data ?? [];

  // Diagnostic counts — only computed when the period is empty, so HR can
  // see WHY no entries were created (wrong frequency? no active employees?
  // no salaries entered?). Lazy: skip the round-trips when entries exist.
  let diagnostics: {
    activeMonthly: number;
    activeWeekly: number;
    activeNoFreq: number;
    activeNoSalary: number;
  } | null = null;
  if (rawEntries.length === 0) {
    const [monthlyRes, weeklyRes, noFreqRes, noSalaryRes] = await Promise.all([
      supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("company_id", callerCompanyId)
        .eq("status", "active")
        .eq("pay_frequency", "monthly"),
      supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("company_id", callerCompanyId)
        .eq("status", "active")
        .eq("pay_frequency", "weekly"),
      supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("company_id", callerCompanyId)
        .eq("status", "active")
        .is("pay_frequency", null),
      supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("company_id", callerCompanyId)
        .eq("status", "active")
        .or("basic_salary.is.null,basic_salary.eq.0"),
    ]);
    diagnostics = {
      activeMonthly: monthlyRes.count ?? 0,
      activeWeekly: weeklyRes.count ?? 0,
      activeNoFreq: noFreqRes.count ?? 0,
      activeNoSalary: noSalaryRes.count ?? 0,
    };
  }

  // Flatten for the client component
  const entries: PeriodEntry[] = rawEntries.map((e) => ({
    id: e.id,
    employee_id: e.employee_id,
    employee_code: e.employees?.employee_code ?? null,
    attended_days: Number(e.attended_days),
    half_day_days: Number(e.half_day_days),
    absent_days: Number(e.absent_days),
    leave_days: Number(e.leave_days),
    gross_salary: Number(e.gross_salary),
    social_insurance: Number(e.social_insurance),
    income_tax: Number(e.income_tax),
    bonuses: Number(e.bonuses),
    total_deductions: Number(e.total_deductions),
    net_salary: Number(e.net_salary),
    eos_gratuity: Number(e.eos_gratuity ?? 0),
    full_name: e.employees?.full_name ?? "—",
    job_title: e.employees?.job_title ?? null,
    department: e.employees?.department ?? null,
  }));

  // Period-over-period: find the previous period of the same frequency
  // (ordered by start_date desc, take the one strictly before this).
  let previousTotals: { net: number; employees: number } | null = null;
  if (period.start_date) {
    const { data: prev } = await supabase
      .from("payroll_periods")
      .select("id, start_date")
      .eq("company_id", callerCompanyId)
      .eq("frequency", period.frequency ?? "monthly")
      .lt("start_date", period.start_date)
      .in("status", ["approved", "paid"])
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; start_date: string }>();
    if (prev) {
      const { data: prevEntries } = await supabase
        .from("payroll_entries")
        .select("net_salary")
        .eq("company_id", callerCompanyId)
        .eq("period_id", prev.id);
      const net = (prevEntries ?? []).reduce(
        (s, r: { net_salary: number }) => s + Number(r.net_salary),
        0,
      );
      previousTotals = { net, employees: (prevEntries ?? []).length };
    }
  }

  const totals = entries.reduce(
    (acc, e) => ({
      gross: acc.gross + e.gross_salary,
      insurance: acc.insurance + e.social_insurance,
      tax: acc.tax + e.income_tax,
      bonuses: acc.bonuses + e.bonuses,
      eos: acc.eos + e.eos_gratuity,
      deductions: acc.deductions + e.total_deductions,
      net: acc.net + e.net_salary,
    }),
    { gross: 0, insurance: 0, tax: 0, bonuses: 0, eos: 0, deductions: 0, net: 0 },
  );

  const isLocked = period.status === "paid" || period.status === "cancelled";
  const isCancelled = period.status === "cancelled";
  const periodLabel =
    period.start_date && period.end_date
      ? `${formatIsoDate(period.start_date)} → ${formatIsoDate(period.end_date)}`
      : `${ARABIC_MONTHS[period.month - 1]} ${period.year}`;

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard/payroll"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لقائمة المرتبات
          </Link>
        </div>

        {/* Status flash messages */}
        {sp.cancelled && (
          <FlashMessage tone="slate">
            تم إلغاء الدورة. مينفعش تظهر في التقارير لحد ما تتفتح تاني.
          </FlashMessage>
        )}
        {sp.reopened && (
          <FlashMessage tone="amber">
            تم فتح الدورة. حالتها بقت{" "}
            <strong>{sp.reopened === "draft" ? "مسودة" : "معتمدة"}</strong>.
            عدد مرات الفتح: {(period.reopened_count ?? 0)}.
          </FlashMessage>
        )}
        {sp.bulk_bonus && (
          <FlashMessage tone="emerald">
            ✅ تم صرف المكافأة الجماعية على {sp.bulk_bonus} موظف.
          </FlashMessage>
        )}
        {sp.regenerated && (
          <FlashMessage tone="emerald">
            ✅ تم إعادة توليد القسائم لـ {sp.regenerated} موظف بنجاح.
          </FlashMessage>
        )}

        {/* "Mark as paid" success — show big CTA to bulk-print payslips.
            This is the single most important step right after closing
            payroll: HR needs to hand each employee their payslip. */}
        {period.status === "paid" && entries.length > 0 && (
          <div className="mb-4 p-5 rounded-2xl bg-gradient-to-l from-emerald-100 via-emerald-50 to-cyan-50 border-2 border-emerald-300 flex items-start gap-3 flex-wrap">
            <span className="text-3xl">🧾</span>
            <div className="flex-1 min-w-0">
              <div className="font-black font-cairo text-emerald-900 mb-1">
                الدورة مدفوعة — حان وقت طباعة قسائم الموظفين
              </div>
              <p className="text-sm text-emerald-800 font-cairo leading-relaxed">
                اضغط الزر اليمين عشان النظام يطبعلك كل الـ {entries.length} قسيمة
                دفعة واحدة (كل قسيمة على صفحة A4 منفصلة) — تقدر تطبع ورقي أو
                تحفظهم PDF.
              </p>
            </div>
            <Link
              href={`/print/payslips-bulk/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-black font-cairo shadow-md hover:shadow-lg transition whitespace-nowrap"
            >
              🖨 اطبع كل القسائم ({entries.length})
            </Link>
          </div>
        )}
        {sp.error && (
          <FlashMessage tone="rose">⚠ {decodeURIComponent(sp.error)}</FlashMessage>
        )}

        <header className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <div className="inline-block px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-[11px] font-bold mb-2 font-cairo">
              {period.frequency === "weekly" ? "📆 دورة أسبوعية" : "📅 دورة شهرية"}
            </div>
            <h1 className="text-2xl md:text-3xl font-black font-cairo text-slate-800 mb-1">
              {periodLabel}
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              {entries.length} موظف · {period.working_days} يوم عمل ·{" "}
              <StatusChip status={period.status} />
            </p>
            {isCancelled && period.cancellation_reason && (
              <p className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg font-cairo">
                سبب الإلغاء: {period.cancellation_reason}
              </p>
            )}
          </div>

          {/* Action buttons - approve, mark paid, delete (draft only) */}
          <div className="flex flex-wrap gap-2 pdf-hide">
            {period.status === "draft" && (
              <form action={async () => { "use server"; await approvePayrollPeriod(id); }}>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm font-cairo transition"
                >
                  اعتماد المرتبات ✓
                </button>
              </form>
            )}
            {period.status === "approved" && (
              <form action={async () => { "use server"; await markPayrollAsPaid(id); }}>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm font-cairo transition"
                >
                  تم الدفع 💰
                </button>
              </form>
            )}
            {period.status === "draft" && (
              <form action={async () => { "use server"; await deletePayrollPeriod(id); }}>
                <ConfirmSubmitButton
                  label="حذف"
                  message="هتمسح فترة الرواتب دي وكل entries الموظفين فيها. الحذف ممكن بس على الـ draft."
                  confirmLabel="نعم احذف"
                  className="px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-bold text-sm font-cairo transition cursor-pointer"
                />
              </form>
            )}
          </div>
        </header>

        {/* Actions bar (search, export, bulk bonus, regenerate, cancel/reopen, PDF) */}
        <div className="pdf-hide">
          <PeriodActionsBar
            periodId={id}
            status={period.status}
            cancelAction={cancelPayrollPeriod}
            reopenAction={reopenPayrollPeriod}
            regenerateAction={regeneratePeriodEntries}
          />
        </div>

        {/* PDF wrapper -- everything inside is captured for "Download PDF" */}
        <div id="payroll-period-pdf">
          {/* Band 1: KPIs + dept breakdown + comparison */}
          {entries.length > 0 && (
            <PeriodSummary
              entries={entries}
              totals={totals}
              previousTotals={previousTotals}
            />
          )}

          {/* Band 2: Searchable explorer */}
          {entries.length === 0 ? (
            <EmptyPeriodDiagnostic
              frequency={period.frequency ?? "monthly"}
              diagnostics={diagnostics}
              periodId={id}
              isDraft={period.status === "draft"}
            />
          ) : (
            <PeriodEntriesExplorer entries={entries} periodId={id} />
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6 font-cairo pdf-hide">
          {isCancelled && "🚫 الدورة دي ملغية — مينفعش تتعدل"}
          {!isCancelled && isLocked && "🔒 الدورة دي مقفولة — مينفعش تتعدل (تقدر تعيد فتحها لو أدمن)"}
          {!isLocked && period.status === "approved" && "ℹ️ المعتمد قابل للتعديل لحد ما يتم الدفع"}
        </p>

        {/* Download buttons live OUTSIDE the PDF wrapper */}
        <div className="mt-4 flex flex-wrap gap-2 justify-center pdf-hide">
          <DownloadPdfButton
            targetSelector="#payroll-period-pdf"
            filename={`payroll-${period.start_date ?? `${period.year}-${period.month}`}.pdf`}
            label="📥 PDF (للمحاسب)"
          />
          <Link
            href={`/print/payroll-summary/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold text-sm font-cairo transition"
          >
            🖨 طباعة من المتصفح
          </Link>
        </div>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------
function StatusChip({ status }: { status: Period["status"] }) {
  const map: Record<Period["status"], { text: string; cls: string }> = {
    draft: {
      text: "مسودة",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    approved: {
      text: "معتمدة",
      cls: "bg-cyan-50 text-cyan-700 border-cyan-200",
    },
    paid: {
      text: "مدفوعة",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    cancelled: {
      text: "ملغية",
      cls: "bg-rose-50 text-rose-700 border-rose-200",
    },
  };
  const m = map[status];
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${m.cls} font-cairo`}
    >
      {m.text}
    </span>
  );
}

function EmptyPeriodDiagnostic({
  frequency,
  diagnostics,
  periodId,
  isDraft,
}: {
  frequency: "monthly" | "weekly";
  diagnostics: {
    activeMonthly: number;
    activeWeekly: number;
    activeNoFreq: number;
    activeNoSalary: number;
  } | null;
  periodId: string;
  isDraft: boolean;
}) {
  // Are there actually employees matching this period's frequency?
  // If yes, "Regenerate" is the right CTA — the period was likely
  // created before our payroll fix and just needs fresh entries.
  const matchingCount =
    frequency === "monthly"
      ? (diagnostics?.activeMonthly ?? 0) + (diagnostics?.activeNoFreq ?? 0)
      : (diagnostics?.activeWeekly ?? 0);
  const canRegenerate = isDraft && matchingCount > 0;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-amber-200 p-8">
      <div className="flex items-start gap-4 mb-4">
        <div className="text-4xl">⚠</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-black font-cairo text-slate-800 mb-1">
            الدورة دي اتعملت لكن مفيش موظفين متطابقين
          </h3>
          <p className="text-sm text-slate-600 font-cairo leading-relaxed">
            النظام دور على موظفين بحالة <strong>«نشط»</strong> وتكرار راتب{" "}
            <strong>{frequency === "monthly" ? "«شهري»" : "«أسبوعي»"}</strong>{" "}
            وما لقاش حد.
          </p>
        </div>
      </div>

      {/* Big green CTA when we DO have matching employees — most common
          case for users hitting this state after our recent fix. */}
      {canRegenerate && (
        <div className="bg-gradient-to-l from-emerald-50 to-cyan-50 border-2 border-emerald-300 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl">✦</span>
            <div className="flex-1">
              <div className="font-black font-cairo text-emerald-800 mb-1">
                لقينا {matchingCount} موظف{" "}
                {frequency === "monthly" ? "شهري" : "أسبوعي"} ينفعوا للدورة دي!
              </div>
              <p className="text-sm text-emerald-700 font-cairo leading-relaxed">
                المشكلة إن الدورة اتعملت قبل ما يدخل النظام إصلاح، أو في
                موظفين جداد بعد إنشائها. اضغط زرار <strong>إعادة توليد
                القسائم</strong> وهيتم توليدهم كلهم تلقائياً.
              </p>
            </div>
          </div>
          <form action={regeneratePeriodEntries}>
            <input type="hidden" name="period_id" value={periodId} />
            <button
              type="submit"
              className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-black font-cairo text-base shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all"
            >
              🔄 إعادة توليد القسائم لكل الموظفين ({matchingCount})
            </button>
          </form>
          <p className="text-[10px] text-emerald-700 font-cairo mt-2 text-center">
            ⚠ ده هيمسح أي تعديلات يدوية موجودة على entries الدورة دي.
          </p>
        </div>
      )}

      {/* Diagnostic counts */}
      {diagnostics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <DiagCard
            label="موظفين شهري"
            count={diagnostics.activeMonthly}
            tone={frequency === "monthly" ? "emerald" : "slate"}
          />
          <DiagCard
            label="موظفين أسبوعي"
            count={diagnostics.activeWeekly}
            tone={frequency === "weekly" ? "emerald" : "slate"}
          />
          <DiagCard
            label="بدون تكرار محدد"
            count={diagnostics.activeNoFreq}
            tone={diagnostics.activeNoFreq > 0 ? "amber" : "slate"}
          />
          <DiagCard
            label="بدون راتب أساسي"
            count={diagnostics.activeNoSalary}
            tone={diagnostics.activeNoSalary > 0 ? "amber" : "slate"}
          />
        </div>
      )}

      {/* Helpful advice — only when there's nothing matching */}
      {!canRegenerate && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 space-y-2 text-sm font-cairo text-slate-700">
          <div className="font-bold text-amber-800">🔎 الحلول الممكنة:</div>
          {matchingCount === 0 && (
            <p>
              <strong>1.</strong> روح على صفحة{" "}
              <Link
                href="/dashboard/employees"
                className="text-amber-700 hover:text-amber-900 underline font-bold"
              >
                الموظفين
              </Link>{" "}
              وتأكد إن فيه موظفين بحالة «نشط» ودورة صرف «
              {frequency === "monthly" ? "شهري" : "أسبوعي"}».
            </p>
          )}
          {diagnostics &&
            diagnostics.activeNoFreq > 0 &&
            frequency === "weekly" && (
              <p>
                <strong>2.</strong> عندك {diagnostics.activeNoFreq} موظف بدون
                تكرار محدد — افتح ملفهم وحط <strong>«أسبوعي»</strong> لو من
                عمال الإنتاج.
              </p>
            )}
          {diagnostics && diagnostics.activeNoSalary > 0 && (
            <p>
              <strong>3.</strong> {diagnostics.activeNoSalary} موظف نشط
              <strong> بدون راتب أساسي</strong> — افتح ملفاتهم وحط الراتب علشان
              النظام يحسب لهم.
            </p>
          )}
        </div>
      )}

      {/* Recovery actions */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/employees"
          className="px-4 py-2 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 font-bold text-sm font-cairo transition"
        >
          👥 افتح صفحة الموظفين
        </Link>
        {isDraft && (
          <form action={async () => { "use server"; await deletePayrollPeriod(periodId); }}>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-sm font-cairo transition"
            >
              🗑 احذف الدورة الفاضية
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function DiagCard({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "emerald" | "amber" | "slate";
}) {
  const cls = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
  }[tone];
  return (
    <div className={`p-3 rounded-xl border ${cls}`}>
      <div className="text-[10px] font-bold font-cairo opacity-75">
        {label}
      </div>
      <div className="text-2xl font-black font-cairo">{count}</div>
    </div>
  );
}

function FlashMessage({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "emerald" | "amber" | "rose" | "slate";
}) {
  const map = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    rose: "bg-rose-50 border-rose-200 text-rose-800",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
  };
  return (
    <div
      className={`mb-4 p-4 rounded-xl border ${map[tone]} font-cairo text-sm`}
    >
      {children}
    </div>
  );
}
