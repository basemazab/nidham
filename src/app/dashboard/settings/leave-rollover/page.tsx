import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { runLeaveRollover } from "./actions";

// Annual leave carryover admin page. Run once at the start of each
// new year so unused annual leave from year N-1 doesn't silently
// disappear when employees take leave under their year-N rows.
//
// What it does (see migration 032):
//   - For each active employee in the company
//   - Computes prior-year remaining = entitled + carried_over - used
//   - Caps at 2x the new-year entitlement
//   - Writes it as the new year's carried_over (upsert, idempotent)
//
// Admin sees a preview table BEFORE clicking the apply button so they
// can sanity-check the numbers per employee.

export const metadata = {
  title: "ترحيل الإجازات السنوية | نِظام",
};

type PreviewRow = {
  employee_id: string;
  full_name: string;
  prior_remaining: number;
  would_carry_over: number;
};

type Params = Promise<{
  year?: string;
  applied?: string;
  error?: string;
}>;

export default async function LeaveRolloverPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;

  // Default target year = current calendar year. HR usually runs the
  // rollover in late December for the next year, or early January
  // catching up.
  const currentYear = new Date().getFullYear();
  const targetYear = sp.year ? parseInt(sp.year, 10) : currentYear;

  const { data: rows } = await supabase.rpc("preview_leave_rollover", {
    p_target_year: targetYear,
  });
  const preview = (Array.isArray(rows) ? rows : []) as PreviewRow[];

  const totalCarryover = preview.reduce(
    (s, r) => s + Number(r.would_carry_over ?? 0),
    0,
  );
  const employeesWithCarryover = preview.filter(
    (r) => Number(r.would_carry_over) > 0,
  ).length;

  const applied = sp.applied
    ? parseInt(decodeURIComponent(sp.applied), 10)
    : null;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            🗓 ترحيل الإجازات السنوية
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
            في 1 يناير، الإجازات السنوية اللي لسه ما اتاخدتش بتضيع لو ما اترحلتش
            للسنة الجاية. شغّل التحقيق ده مرة في السنة (آخر ديسمبر أو أول يناير)
            عشان الـ carried_over لكل موظف يتسجل صح.
          </p>
        </header>

        {applied !== null && (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 font-cairo text-emerald-900">
            <div className="font-bold mb-1">✓ تم الترحيل</div>
            <p className="text-sm">
              اترحّل رصيد الإجازات لـ <b>{applied.toLocaleString("ar-EG")}</b>{" "}
              موظف بنجاح. الـ carryover ظاهر دلوقتي في كل رصيد للسنة{" "}
              <b>{targetYear}</b>.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 font-cairo text-sm">
            ⚠ {errorMsg}
          </div>
        )}

        {/* Year picker */}
        <form className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-6 flex items-end gap-3">
          <div>
            <label
              htmlFor="year"
              className="block text-xs font-bold text-slate-700 mb-1 font-cairo"
            >
              السنة المستهدفة (اللي هتنزل عليها الـ carryover)
            </label>
            <select
              id="year"
              name="year"
              defaultValue={String(targetYear)}
              className="px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-sm font-cairo min-w-[140px]"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold font-cairo"
          >
            معاينة
          </button>
        </form>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <SummaryCard label="موظفين نشطين" value={preview.length} />
          <SummaryCard
            label="عندهم رصيد للترحيل"
            value={employeesWithCarryover}
            tone="emerald"
          />
          <SummaryCard
            label="إجمالي الأيام للترحيل"
            value={totalCarryover}
            tone="amber"
            suffix="يوم"
          />
        </div>

        {/* Preview table */}
        {preview.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
            <div className="text-5xl mb-3">🗓</div>
            <h2 className="text-lg font-bold font-cairo mb-2 text-slate-700">
              مفيش موظفين نشطين للترحيل
            </h2>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                    الموظف
                  </th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo text-center">
                    رصيد متبقي من {targetYear - 1}
                  </th>
                  <th className="px-5 py-3 text-xs font-bold text-emerald-700 uppercase tracking-wider font-cairo text-center">
                    هيترحّل لـ {targetYear}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((r) => (
                  <tr key={r.employee_id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800 font-cairo">
                      {r.full_name}
                    </td>
                    <td className="px-5 py-3 text-center font-mono text-slate-600">
                      {Number(r.prior_remaining).toFixed(1)} يوم
                    </td>
                    <td
                      className={`px-5 py-3 text-center font-mono font-bold ${
                        Number(r.would_carry_over) > 0
                          ? "text-emerald-700"
                          : "text-slate-400"
                      }`}
                    >
                      {Number(r.would_carry_over).toFixed(1)} يوم
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Apply button */}
        {preview.length > 0 && (
          <form
            action={async () => {
              "use server";
              await runLeaveRollover(targetYear);
            }}
            className="mt-6 bg-white p-5 rounded-xl border-2 border-amber-200 shadow-md"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-black text-slate-800 font-cairo mb-1">
                  ✅ تأكيد الترحيل لسنة {targetYear}
                </div>
                <p className="text-xs text-slate-500 font-cairo leading-relaxed">
                  الإجراء آمن وقابل للتكرار — لو شغّلته مرتين، الـ carryover
                  يتسجل بنفس القيمة مش بيتراكم.
                </p>
              </div>
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold font-cairo shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition"
              >
                🗓 شغّل الترحيل دلوقتي
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 bg-cyan-50 border border-cyan-200 rounded-xl p-4 text-xs text-cyan-900 font-cairo leading-relaxed">
          💡 <b>الكاب</b>: الـ carryover محدود بـ 2× الاستحقاق السنوي (يعني
          أقصى 42 يوم للموظف اللي عنده 21 يوم استحقاق). ده عشان نمنع تراكم
          إجازات لأشهر طويلة بدون حد.
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone = "slate",
  suffix,
}: {
  label: string;
  value: number;
  tone?: "slate" | "emerald" | "amber";
  suffix?: string;
}) {
  const classes = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1 font-cairo">
        {label}
      </div>
      <div className="text-2xl font-black font-display">
        {value.toLocaleString("ar-EG")}
        {suffix && (
          <span className="text-sm font-normal opacity-70 mr-1">{suffix}</span>
        )}
      </div>
    </div>
  );
}
