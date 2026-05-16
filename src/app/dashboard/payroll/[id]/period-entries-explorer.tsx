"use client";

// ============================================================================
// PeriodEntriesExplorer — search + filter + collapsible department groups
// ============================================================================
//
// Replaces the flat table inside /dashboard/payroll/[id] with an
// interactive explorer that scales to 100+ employees per period.
//
// Features:
//   - Instant search (Arabic-normalised) across name + code + dept
//   - Department filter chips
//   - Same-row links to edit + payslip
//   - All numbers rendered with consistent EGP formatting

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatEGP } from "@/lib/payroll";

export type PeriodEntry = {
  id: string;
  employee_id: string;
  employee_code: string | null;
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
  eos_gratuity: number;
  full_name: string;
  job_title: string | null;
  department: string | null;
};

export function PeriodEntriesExplorer({
  entries,
  periodId,
}: {
  entries: PeriodEntry[];
  periodId: string;
}) {
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  // Build dept list once
  const departments = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      const k = (e.department && e.department.trim()) || "بدون قسم";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    return entries.filter((e) => {
      if (deptFilter !== "all") {
        const dept = (e.department && e.department.trim()) || "بدون قسم";
        if (dept !== deptFilter) return false;
      }
      if (!needle) return true;
      const hay = normalize(
        [e.full_name, e.employee_code ?? "", e.job_title ?? "", e.department ?? ""]
          .join(" "),
      );
      return hay.includes(needle);
    });
  }, [entries, query, deptFilter]);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
          🔍
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث بالاسم، الكود، الوظيفة، أو القسم..."
          className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo bg-white shadow-sm text-sm"
        />
      </div>

      {/* Department chips */}
      {departments.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={deptFilter === "all"}
            onClick={() => setDeptFilter("all")}
            label="كل الأقسام"
            count={entries.length}
          />
          {departments.map(([name, count]) => (
            <FilterChip
              key={name}
              active={deptFilter === name}
              onClick={() => setDeptFilter(name)}
              label={name}
              count={count}
            />
          ))}
        </div>
      )}

      {/* Result counter */}
      <div className="text-[11px] text-slate-500 font-cairo">
        {filtered.length === entries.length
          ? `${entries.length} موظف`
          : `${filtered.length} من ${entries.length} موظف`}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-10 text-center">
          <div className="text-4xl mb-2">🔍</div>
          <p className="text-sm text-slate-500 font-cairo">مفيش نتايج</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-x-auto">
          <table className="w-full text-right min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <Th>الموظف</Th>
                <Th>حضور</Th>
                <Th>غياب</Th>
                <Th>الإجمالي</Th>
                <Th>مكافأة</Th>
                <Th>تأمينات</Th>
                <Th>ضريبة</Th>
                <Th className="text-emerald-700">الصافي</Th>
                <th className="px-4 py-3 pdf-hide"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800 font-cairo">
                      {e.full_name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-cairo flex items-center gap-2 flex-wrap">
                      {e.job_title && <span>{e.job_title}</span>}
                      {e.department && (
                        <span className="text-slate-400">· {e.department}</span>
                      )}
                      {e.employee_code && (
                        <span
                          className="font-mono bg-slate-50 border border-slate-200 px-1 rounded text-[10px]"
                          dir="ltr"
                        >
                          #{e.employee_code}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-emerald-700 font-bold">
                    {Number(e.attended_days) + Number(e.half_day_days) * 0.5}
                  </td>
                  <td className="px-4 py-3 text-red-600 font-bold">
                    {Number(e.absent_days)}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-700 font-cairo">
                    {formatEGP(e.gross_salary)}
                  </td>
                  <td className="px-4 py-3 text-amber-700 font-cairo">
                    {e.bonuses > 0 ? formatEGP(e.bonuses) : "—"}
                  </td>
                  <td className="px-4 py-3 text-amber-700 font-cairo">
                    {formatEGP(e.social_insurance)}
                  </td>
                  <td className="px-4 py-3 text-red-600 font-cairo">
                    {formatEGP(e.income_tax)}
                  </td>
                  <td className="px-4 py-3 font-black text-emerald-700 font-cairo">
                    {formatEGP(e.net_salary)}
                    {e.eos_gratuity > 0 && (
                      <div className="text-[10px] text-violet-700 font-cairo">
                        + EOS {formatEGP(e.eos_gratuity)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap pdf-hide">
                    <Link
                      href={`/dashboard/payroll/${periodId}/${e.id}`}
                      className="text-xs text-brand-cyan-dark hover:text-brand-cyan font-cairo font-bold ml-2"
                    >
                      تعديل
                    </Link>
                    <Link
                      href={`/dashboard/payroll/${periodId}/${e.id}/payslip`}
                      className="text-xs text-slate-600 hover:text-slate-800 font-cairo font-bold"
                    >
                      قسيمة
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-bold uppercase tracking-wider font-cairo ${
        className ?? "text-slate-600"
      }`}
    >
      {children}
    </th>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold font-cairo transition ${
        active
          ? "bg-brand-cyan-dark text-white shadow-sm"
          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-[10px] tabular-nums opacity-75 ${
          active ? "" : "text-slate-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/[ىئ]/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}
