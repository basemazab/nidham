// ============================================================================
// /dashboard/team-calendar — Time-off visibility for managers
// ============================================================================
//
// Three stacked views answer "who is out + when":
//
//   1. اليوم          — list of everyone on leave today
//   2. هذا الأسبوع    — chip-grid of leaves for the next 7 days
//   3. هذا الشهر      — full month grid with per-day counts +
//                        per-employee row, color-coded by leave type
//
// Filter by department to scope to one team. Click any chip to jump
// to the underlying leave_request.
//
// Data source: leave_requests with status='approved' (covers the
// future window) PLUS attendance rows with status='leave' (covers any
// retroactively-flagged days that bypassed the request workflow).

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type LeaveRow = {
  employee_id: string;
  start_date: string;
  end_date: string;
  leave_type: string | null;
  reason: string | null;
  employees: {
    full_name: string;
    department: string | null;
    avatar_url: string | null;
  } | null;
};

type SearchParams = Promise<{ dept?: string; month?: string }>;

export default async function TeamCalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const monthCursor = sp.month
    ? parseYearMonth(sp.month)
    : { year: today.getUTCFullYear(), month: today.getUTCMonth() };
  const monthStart = new Date(Date.UTC(monthCursor.year, monthCursor.month, 1));
  const monthEnd = new Date(
    Date.UTC(monthCursor.year, monthCursor.month + 1, 0, 23, 59, 59),
  );
  const startIso = monthStart.toISOString().split("T")[0];
  const endIso = monthEnd.toISOString().split("T")[0];

  // leave_requests are approved-only here; the rejected/pending ones
  // would clutter the view and confuse "who's actually out."
  const { data: leaves } = await supabase
    .from("leave_requests")
    .select(
      "employee_id, start_date, end_date, leave_type, reason, employees(full_name, department, avatar_url)",
    )
    .eq("company_id", callerCompanyId)
    .eq("status", "approved")
    .gte("end_date", startIso)
    .lte("start_date", endIso)
    .returns<LeaveRow[]>();

  const list = (leaves ?? []).filter((l) =>
    sp.dept ? l.employees?.department === sp.dept : true,
  );

  // Available departments for the filter dropdown
  const allDepts = Array.from(
    new Set(
      (leaves ?? [])
        .map((l) => l.employees?.department)
        .filter((d): d is string => Boolean(d)),
    ),
  ).sort((a, b) => a.localeCompare(b, "ar"));

  // Slice into the 3 time buckets
  const todayIso = today.toISOString().split("T")[0];
  const week = new Date(today);
  week.setUTCDate(week.getUTCDate() + 7);
  const weekEndIso = week.toISOString().split("T")[0];

  const onLeaveToday = list.filter(
    (l) => l.start_date <= todayIso && l.end_date >= todayIso,
  );
  const onLeaveThisWeek = list.filter(
    (l) => l.start_date <= weekEndIso && l.end_date >= todayIso,
  );

  // Month grid: for each day-of-month, how many on leave
  const daysInMonth = monthEnd.getUTCDate();
  const dayCounts = new Array(daysInMonth).fill(0) as number[];
  for (const l of list) {
    const s = parseIsoDay(l.start_date);
    const e = parseIsoDay(l.end_date);
    for (let d = 1; d <= daysInMonth; d++) {
      const dayIso = isoFor(monthCursor.year, monthCursor.month, d);
      const dayMs = parseIsoDay(dayIso);
      if (dayMs >= s && dayMs <= e) dayCounts[d - 1]!++;
    }
  }
  const peakCount = Math.max(1, ...dayCounts);

  // Prev / next month nav
  const prevMonth = shiftMonth(monthCursor, -1);
  const nextMonth = shiftMonth(monthCursor, 1);
  const monthName = monthStart.toLocaleDateString("ar-EG", {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-violet-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الـ Dashboard
          </Link>
        </div>

        <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              📅 تقويم الإجازات
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              مين في إجازة دلوقتي ومين خلال الأسبوع والشهر — للتخطيط قبل ما
              تتراكم.
            </p>
          </div>
          <form method="GET" className="flex items-end gap-2 flex-wrap">
            <input
              type="hidden"
              name="month"
              value={`${monthCursor.year}-${String(monthCursor.month + 1).padStart(2, "0")}`}
            />
            <select
              name="dept"
              defaultValue={sp.dept ?? ""}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-cairo"
            >
              <option value="">كل الأقسام</option>
              {allDepts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-brand-cyan-dark text-white font-bold text-sm font-cairo"
            >
              تصفية
            </button>
          </form>
        </header>

        {/* TODAY */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
          <h2 className="text-base font-black font-cairo text-slate-800 mb-3">
            🟢 اليوم في إجازة ({onLeaveToday.length})
          </h2>
          {onLeaveToday.length === 0 ? (
            <p className="text-sm text-slate-500 font-cairo">
              مفيش حد في إجازة النهاردة — كل الفريق موجود.
            </p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {onLeaveToday.map((l, i) => (
                <LeaveChip key={i} leave={l} />
              ))}
            </ul>
          )}
        </section>

        {/* THIS WEEK */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
          <h2 className="text-base font-black font-cairo text-slate-800 mb-3">
            🗓 خلال الأسبوع القادم ({onLeaveThisWeek.length})
          </h2>
          {onLeaveThisWeek.length === 0 ? (
            <p className="text-sm text-slate-500 font-cairo">مفيش إجازات مقررة.</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {onLeaveThisWeek.map((l, i) => (
                <LeaveChip key={i} leave={l} showDates />
              ))}
            </ul>
          )}
        </section>

        {/* MONTH GRID */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-base font-black font-cairo text-slate-800">
              📆 الشهر — {monthName}
            </h2>
            <div className="flex items-center gap-2">
              <MonthLink target={prevMonth} label="← الشهر السابق" dept={sp.dept} />
              <MonthLink target={nextMonth} label="الشهر القادم →" dept={sp.dept} />
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center font-cairo">
            {/* Egypt week typically starts Saturday */}
            {["ج", "خ", "أ", "ث", "ث", "ح", "س"].map((d, i) => (
              <div
                key={i}
                className="text-[10px] font-bold text-slate-500 py-1"
              >
                {d}
              </div>
            ))}

            {/* Day cells (with leading blank cells to align to weekday) */}
            {(() => {
              const cells: React.ReactNode[] = [];
              const firstDow = monthStart.getUTCDay(); // 0=Sun…6=Sat
              // Convert to "Sat=0" so the grid lines up with the Egyptian week
              const offset = (firstDow + 1) % 7;
              for (let i = 0; i < offset; i++) {
                cells.push(<div key={`pad-${i}`} className="h-14" />);
              }
              for (let d = 1; d <= daysInMonth; d++) {
                const c = dayCounts[d - 1]!;
                const intensity = c / peakCount;
                const bg =
                  c === 0
                    ? "bg-slate-50"
                    : intensity < 0.34
                      ? "bg-violet-100"
                      : intensity < 0.67
                        ? "bg-violet-300"
                        : "bg-violet-500 text-white";
                const isToday =
                  monthCursor.year === today.getUTCFullYear() &&
                  monthCursor.month === today.getUTCMonth() &&
                  d === today.getUTCDate();
                cells.push(
                  <div
                    key={d}
                    className={`h-14 rounded-md ${bg} flex flex-col items-center justify-center text-xs ${
                      isToday ? "ring-2 ring-brand-cyan-dark" : ""
                    }`}
                  >
                    <div className="font-bold">{d}</div>
                    {c > 0 && (
                      <div className="text-[10px] opacity-80">{c} غياب</div>
                    )}
                  </div>,
                );
              }
              return cells;
            })()}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-3 text-[10px] font-cairo text-slate-500 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-slate-50 border" />
              0
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-violet-100" /> قليل
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-violet-300" /> متوسط
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-violet-500" /> ذروة
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Components
// ----------------------------------------------------------------------------
function LeaveChip({
  leave,
  showDates,
}: {
  leave: LeaveRow;
  showDates?: boolean;
}) {
  return (
    <li className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
        {leave.employees?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={leave.employees.avatar_url}
            alt={leave.employees.full_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{leave.employees?.full_name?.[0] ?? "?"}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-slate-800 font-cairo truncate">
          {leave.employees?.full_name ?? "—"}
        </div>
        <div className="text-[10px] text-slate-500 font-cairo truncate">
          {leave.employees?.department ?? "—"}
          {showDates && (
            <span className="mx-1">
              · {leave.start_date} → {leave.end_date}
            </span>
          )}
        </div>
      </div>
      {leave.leave_type && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-bold font-cairo shrink-0">
          {leave.leave_type}
        </span>
      )}
    </li>
  );
}

function MonthLink({
  target,
  label,
  dept,
}: {
  target: { year: number; month: number };
  label: string;
  dept: string | undefined;
}) {
  const q = new URLSearchParams();
  q.set("month", `${target.year}-${String(target.month + 1).padStart(2, "0")}`);
  if (dept) q.set("dept", dept);
  return (
    <Link
      href={`/dashboard/team-calendar?${q.toString()}`}
      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold font-cairo"
    >
      {label}
    </Link>
  );
}

// ----------------------------------------------------------------------------
// Date helpers
// ----------------------------------------------------------------------------
function parseYearMonth(s: string): { year: number; month: number } {
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (!m) return { year: new Date().getUTCFullYear(), month: new Date().getUTCMonth() };
  return { year: Number(m[1]), month: Number(m[2]) - 1 };
}
function shiftMonth(
  c: { year: number; month: number },
  delta: number,
): { year: number; month: number } {
  let y = c.year;
  let m = c.month + delta;
  while (m < 0) {
    m += 12;
    y -= 1;
  }
  while (m > 11) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}
function parseIsoDay(iso: string): number {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function isoFor(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month, day));
  return d.toISOString().split("T")[0];
}
