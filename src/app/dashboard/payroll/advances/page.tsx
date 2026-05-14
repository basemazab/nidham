import Link from "next/link";
import { requireHRPage } from "@/lib/permissions";
import { issueHRAdvance } from "./actions";
import { IssueAdvanceRow } from "./issue-row";

// "Wednesday advance run" -- the HR sits down once a week and
// disburses advances to whoever needs cash before payroll.
// Each row shows the employee's accrued state THIS MONTH (attended
// days, accrued net, 50% / 70% ceilings, any open advances).
// One click on a percentage button pre-fills the modal; HR can
// override the amount before confirming.

type Params = Promise<{
  as_of?: string;
  issued?: string;
  error?: string;
}>;

type EligibilityRow = {
  employee_id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  attended_days: number;
  effective_days: number;
  monthly_base: number;
  accrued_net: number;
  existing_open_advances: number;
  available_headroom: number;
  eligible_50pct: number;
  eligible_70pct: number;
};

export const metadata = {
  title: "صرف السلف الأسبوعي | نِظام",
};

function fmt(n: number): string {
  return n.toLocaleString("ar-EG", { maximumFractionDigits: 0 });
}

export default async function AdvancesPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const { supabase } = await requireHRPage();
  const sp = await searchParams;
  const asOf = sp.as_of ?? new Date().toISOString().split("T")[0];

  const rosterRes = await supabase.rpc("list_employees_advance_eligibility", {
    p_as_of_date: asOf,
  });

  const list: EligibilityRow[] = Array.isArray(rosterRes.data)
    ? (rosterRes.data as unknown as EligibilityRow[])
    : [];

  // Aggregate summary -- top-of-page snapshot for the day
  const total50 = list.reduce((s, r) => s + Number(r.eligible_50pct), 0);
  const total70 = list.reduce((s, r) => s + Number(r.eligible_70pct), 0);
  const totalAccrued = list.reduce((s, r) => s + Number(r.accrued_net), 0);
  const totalOpen = list.reduce(
    (s, r) => s + Number(r.existing_open_advances),
    0,
  );

  const issued = sp.issued ? decodeURIComponent(sp.issued).split("|") : null;

  // Pretty Arabic date for the header
  const asOfLabel = new Date(asOf + "T00:00:00").toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/payroll"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للرواتب
          </Link>
        </div>

        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              💵 صرف السلف الأسبوعي
            </h1>
            <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
              مين مستحق سلفة دلوقتي بناءً على أيام حضوره الفعلية من أول الشهر.
              50% و 70% بيتحسبوا من الصافي المستحق (الراتب الشهري × أيام الحضور
              ÷ {26} يوم) بعد خصم السلف المفتوحة القديمة.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Link
              href="/dashboard/payroll/advances/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition font-cairo"
            >
              <span className="text-base leading-none">+</span>
              <span>سلفة لموظف محدد</span>
            </Link>
            <form className="flex items-end gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-cairo">
                  التاريخ
                </label>
                <input
                  type="date"
                  name="as_of"
                  defaultValue={asOf}
                  className="px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm"
                  dir="ltr"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold font-cairo"
              >
                تحديث
              </button>
            </form>
          </div>
        </header>

        {issued && (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 font-cairo text-emerald-800 flex items-start gap-3">
            <span className="text-2xl">✓</span>
            <div>
              <div className="font-bold">تم صرف السلفة</div>
              <p className="text-sm mt-0.5">
                <b>{issued[0]}</b> · المبلغ:{" "}
                <b>{fmt(Number(issued[1]))} ج</b>. السلفة هتتخصم تلقائيًا من
                أول راتب جاي.
              </p>
            </div>
          </div>
        )}
        {sp.error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 font-cairo text-sm">
            ⚠ {decodeURIComponent(sp.error)}
          </div>
        )}

        <p className="text-xs text-slate-500 font-cairo mb-6">
          آخر تحديث: {asOfLabel}
        </p>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <SummaryCard
            label="الموظفين النشطين"
            value={list.length.toLocaleString("ar-EG")}
            color="slate"
          />
          <SummaryCard
            label="إجمالي الصافي المستحق"
            value={`${fmt(totalAccrued)} ج`}
            color="emerald"
          />
          <SummaryCard
            label="سلف مفتوحة قديمة"
            value={`${fmt(totalOpen)} ج`}
            color="amber"
          />
          <SummaryCard
            label="إجمالي محتمل (70%)"
            value={`${fmt(total70)} ج`}
            color="cyan"
            note={`الحد الأدنى 50% = ${fmt(total50)} ج`}
          />
        </div>

        {/* Roster */}
        {list.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-3">👥</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">
              مفيش موظفين نشطين
            </h2>
            <p className="text-sm text-slate-500 font-cairo">
              ضيف موظفين من /dashboard/employees الأول.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-sm font-cairo">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs">
                <tr>
                  <th className="px-3 py-3 text-right font-bold text-slate-600">
                    الموظف
                  </th>
                  <th className="px-3 py-3 text-center font-bold text-slate-600">
                    أيام حضور
                  </th>
                  <th className="px-3 py-3 text-right font-bold text-slate-600">
                    المرتب الشهري
                  </th>
                  <th className="px-3 py-3 text-right font-bold text-slate-600">
                    الصافي المستحق
                  </th>
                  <th className="px-3 py-3 text-right font-bold text-amber-700">
                    سلف قديمة
                  </th>
                  <th className="px-3 py-3 text-right font-bold text-slate-600">
                    المتاح
                  </th>
                  <th className="px-3 py-3 text-right font-bold text-cyan-700">
                    50%
                  </th>
                  <th className="px-3 py-3 text-right font-bold text-emerald-700">
                    70%
                  </th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <IssueAdvanceRow
                    key={row.employee_id}
                    employeeId={row.employee_id}
                    fullName={row.full_name}
                    jobTitle={row.job_title}
                    department={row.department}
                    attendedDays={row.attended_days}
                    effectiveDays={Number(row.effective_days)}
                    monthlyBase={Number(row.monthly_base)}
                    accruedNet={Number(row.accrued_net)}
                    existingOpenAdvances={Number(row.existing_open_advances)}
                    availableHeadroom={Number(row.available_headroom)}
                    eligible50={Number(row.eligible_50pct)}
                    eligible70={Number(row.eligible_70pct)}
                    issueAction={issueHRAdvance}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 font-cairo leading-relaxed">
          <b>ملاحظة:</b> النسبة 50% / 70% بتُحسب على المتاح بعد خصم السلف
          القديمة المفتوحة. الموظفين اللي عندهم سلف كبيرة لسه ما اتسددتش
          هيظهر المتاح صفر. السلف بتُخصم تلقائيًا من أول راتب جاي على
          أساس عدد الأقساط اللي اخترتها.
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  color,
  note,
}: {
  label: string;
  value: string;
  color: "slate" | "emerald" | "amber" | "cyan";
  note?: string;
}) {
  const classes = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    cyan: "bg-cyan-50 border-cyan-200 text-cyan-800",
  }[color];
  return (
    <div className={`rounded-2xl border ${classes} p-4`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1 font-cairo">
        {label}
      </div>
      <div className="text-2xl font-black font-display">{value}</div>
      {note && (
        <div className="text-[10px] mt-1 opacity-70 font-cairo">{note}</div>
      )}
    </div>
  );
}
