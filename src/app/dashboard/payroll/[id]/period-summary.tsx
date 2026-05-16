// ============================================================================
// PeriodSummary — server component: KPI cards + dept breakdown + comparison
// ============================================================================
//
// Renders the analytics band on /dashboard/payroll/[id]:
//
//   1) KPI cards: gross, deductions, net, headcount, bonuses, EOS
//   2) Period-over-period comparison: net Δ% vs the previous cycle
//      of the same frequency. Helps HR spot "why is this month so much
//      higher than last?"
//   3) Department breakdown: count + total net per dept with bars
//
// All computed server-side from the same entries array the table uses
// so the numbers in the cards exactly match the numbers in the rows.

import { formatEGP } from "@/lib/payroll";
import type { PeriodEntry } from "./period-entries-explorer";

type Props = {
  entries: PeriodEntry[];
  totals: {
    gross: number;
    insurance: number;
    tax: number;
    bonuses: number;
    eos: number;
    deductions: number;
    net: number;
  };
  previousTotals?: {
    net: number;
    employees: number;
  } | null;
};

export function PeriodSummary({ entries, totals, previousTotals }: Props) {
  const avgNet = entries.length === 0 ? 0 : totals.net / entries.length;

  // Period-over-period delta (vs previous period of same frequency)
  let netDelta: number | null = null;
  let netDeltaPct: number | null = null;
  if (previousTotals && previousTotals.net > 0) {
    netDelta = totals.net - previousTotals.net;
    netDeltaPct = (netDelta / previousTotals.net) * 100;
  }

  // Department breakdown
  type Dept = { name: string; count: number; net: number; gross: number };
  const deptMap = new Map<string, Dept>();
  for (const e of entries) {
    const k = (e.department && e.department.trim()) || "بدون قسم";
    const cur = deptMap.get(k) ?? { name: k, count: 0, net: 0, gross: 0 };
    cur.count += 1;
    cur.net += Number(e.net_salary);
    cur.gross += Number(e.gross_salary);
    deptMap.set(k, cur);
  }
  const depts = Array.from(deptMap.values()).sort((a, b) => b.net - a.net);
  const maxNet = depts[0]?.net ?? 1;

  return (
    <section className="space-y-4 mb-6">
      {/* ===== KPI cards ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="عدد الموظفين"
          value={String(entries.length)}
          icon="👥"
          color="slate"
        />
        <KpiCard
          label="إجمالي الراتب"
          value={formatEGP(totals.gross)}
          icon="💼"
          color="slate"
        />
        <KpiCard
          label="إجمالي الخصومات"
          value={formatEGP(totals.deductions)}
          icon="💸"
          color="red"
        />
        <KpiCard
          label="الصافي المستحق"
          value={formatEGP(totals.net)}
          icon="💰"
          color="emerald"
          delta={
            netDeltaPct !== null
              ? {
                  pct: netDeltaPct,
                  amount: netDelta ?? 0,
                  vsLabel: "مقارنة بالدورة السابقة",
                }
              : undefined
          }
        />
      </div>

      {/* ===== Secondary KPIs (only when there's data) ===== */}
      {(totals.bonuses > 0 || totals.eos > 0 || avgNet > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SecondaryKpi
            label="متوسط الصافي"
            value={formatEGP(Math.round(avgNet))}
            icon="📊"
          />
          {totals.bonuses > 0 && (
            <SecondaryKpi
              label="إجمالي المكافآت"
              value={formatEGP(totals.bonuses)}
              icon="🎁"
              tone="amber"
            />
          )}
          {totals.eos > 0 && (
            <SecondaryKpi
              label="مكافأة نهاية خدمة"
              value={formatEGP(totals.eos)}
              icon="🚪"
              tone="violet"
            />
          )}
          <SecondaryKpi
            label="تأمينات + ضرايب"
            value={formatEGP(totals.insurance + totals.tax)}
            icon="🏛"
            tone="rose"
          />
        </div>
      )}

      {/* ===== Department breakdown ===== */}
      {depts.length > 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏢</span>
              <h2 className="text-sm font-black font-cairo text-slate-800">
                توزيع التكلفة حسب القسم
              </h2>
            </div>
            <span className="text-[11px] text-slate-500 font-cairo">
              مرتبة حسب أعلى تكلفة
            </span>
          </div>
          <div className="space-y-2">
            {depts.map((d, i) => {
              const pct = (d.net / maxNet) * 100;
              return (
                <div
                  key={d.name}
                  className="flex items-center gap-3 py-1.5 border-b last:border-0 border-slate-100"
                >
                  <span
                    className={`w-2 h-7 rounded-full flex-shrink-0 ${deptHueClass(i)}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                      <div className="text-sm font-bold font-cairo text-slate-800 truncate">
                        {d.name}
                      </div>
                      <div className="text-xs text-slate-500 font-cairo whitespace-nowrap">
                        <span className="font-bold text-slate-700">
                          {d.count}
                        </span>
                        {" موظف · "}
                        <span className="font-bold text-emerald-700">
                          {formatEGP(d.net)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${deptBarClass(i)} rounded-full transition-all`}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// KpiCard — primary metric (large)
// ----------------------------------------------------------------------------
function KpiCard({
  label,
  value,
  icon,
  color,
  delta,
}: {
  label: string;
  value: string;
  icon: string;
  color: "slate" | "emerald" | "red" | "cyan";
  delta?: {
    pct: number;
    amount: number;
    vsLabel: string;
  };
}) {
  const bg = {
    slate: "from-slate-50 to-white border-slate-200",
    emerald: "from-emerald-50 to-white border-emerald-200",
    red: "from-red-50 to-white border-red-200",
    cyan: "from-cyan-50 to-white border-cyan-200",
  }[color];

  return (
    <div
      className={`p-4 rounded-2xl bg-gradient-to-br ${bg} border shadow-sm`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-[10px] font-bold uppercase font-cairo text-slate-500 tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-xl md:text-2xl font-black text-slate-800 font-cairo">
        {value}
      </div>
      {delta && (
        <div className="text-[11px] font-cairo mt-1">
          <span
            className={`font-bold ${
              delta.pct >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {delta.pct >= 0 ? "▲" : "▼"}{" "}
            {Math.abs(delta.pct).toFixed(1)}%
          </span>{" "}
          <span className="text-slate-500">{delta.vsLabel}</span>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// SecondaryKpi — smaller chip-style metric
// ----------------------------------------------------------------------------
function SecondaryKpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: string;
  tone?: "amber" | "violet" | "rose";
}) {
  const bg = {
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    violet: "bg-violet-50 border-violet-200 text-violet-800",
    rose: "bg-rose-50 border-rose-200 text-rose-800",
  };
  const cls = tone
    ? bg[tone]
    : "bg-white border-slate-200 text-slate-700";
  return (
    <div className={`p-3 rounded-xl border ${cls}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase font-cairo opacity-75">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-lg font-black font-cairo mt-0.5">{value}</div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Hue helpers (same palette as employees-analytics for visual consistency)
// ----------------------------------------------------------------------------
const HUE_DOT = [
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-lime-500",
  "bg-fuchsia-500",
];
const HUE_BAR = [
  "bg-gradient-to-r from-cyan-400 to-cyan-600",
  "bg-gradient-to-r from-emerald-400 to-emerald-600",
  "bg-gradient-to-r from-amber-400 to-amber-600",
  "bg-gradient-to-r from-violet-400 to-violet-600",
  "bg-gradient-to-r from-rose-400 to-rose-600",
  "bg-gradient-to-r from-sky-400 to-sky-600",
  "bg-gradient-to-r from-lime-400 to-lime-600",
  "bg-gradient-to-r from-fuchsia-400 to-fuchsia-600",
];
function deptHueClass(i: number): string {
  return HUE_DOT[i % HUE_DOT.length];
}
function deptBarClass(i: number): string {
  return HUE_BAR[i % HUE_BAR.length];
}
