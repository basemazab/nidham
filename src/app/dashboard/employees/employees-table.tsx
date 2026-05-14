"use client";

// Searchable + filterable employees table.
//
// Filters applied on the client because the SaaS' target tenants
// have <200 employees -- one round trip to fetch the full list
// then instant filtering beats a server round-trip per keystroke.
// If a 1000+ employee tenant ever joins we can flip to a debounced
// server query without changing this component's external API.
//
// Filters:
//   - text search across full_name, employee_code, job_title,
//     department, phone (case-insensitive, accent-folded for Arabic)
//   - status chip: all / active / on_leave / terminated
//   - pay-frequency chip: all / monthly / weekly

import { useMemo, useState } from "react";
import Link from "next/link";

export type Employee = {
  id: string;
  full_name: string;
  employee_code: string | null;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  status: "active" | "on_leave" | "terminated";
  hire_date: string | null;
  pay_frequency: "monthly" | "weekly" | null;
};

const STATUS_LABELS: Record<
  Employee["status"],
  { text: string; classes: string }
> = {
  active: {
    text: "نشط",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  on_leave: {
    text: "إجازة",
    classes: "bg-amber-50 text-amber-700 border-amber-200",
  },
  terminated: {
    text: "منتهي",
    classes: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

type StatusFilter = "all" | Employee["status"];
type FreqFilter = "all" | "monthly" | "weekly";

export function EmployeesTable({ employees }: { employees: Employee[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [freqFilter, setFreqFilter] = useState<FreqFilter>("all");

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    return employees.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (freqFilter !== "all") {
        const f = e.pay_frequency ?? "monthly";
        if (f !== freqFilter) return false;
      }
      if (!needle) return true;
      const haystack = normalize(
        [
          e.full_name,
          e.employee_code ?? "",
          e.job_title ?? "",
          e.department ?? "",
          e.phone ?? "",
        ].join(" "),
      );
      return haystack.includes(needle);
    });
  }, [employees, query, statusFilter, freqFilter]);

  // Counts shown on the filter chips so HR knows how many will appear
  // before clicking.
  const counts = useMemo(() => {
    const byStatus = { all: employees.length, active: 0, on_leave: 0, terminated: 0 };
    const byFreq = { all: employees.length, monthly: 0, weekly: 0 };
    for (const e of employees) {
      byStatus[e.status] += 1;
      const f = e.pay_frequency ?? "monthly";
      byFreq[f] += 1;
    }
    return { byStatus, byFreq };
  }, [employees]);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
          🔍
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث بالاسم، كود الموظف، الوظيفة، القسم، أو الموبايل..."
          className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo bg-white shadow-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 hover:text-slate-600"
            aria-label="مسح البحث"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
          label="الكل"
          count={counts.byStatus.all}
        />
        <FilterChip
          active={statusFilter === "active"}
          onClick={() => setStatusFilter("active")}
          label="نشط"
          count={counts.byStatus.active}
          tone="emerald"
        />
        <FilterChip
          active={statusFilter === "on_leave"}
          onClick={() => setStatusFilter("on_leave")}
          label="في إجازة"
          count={counts.byStatus.on_leave}
          tone="amber"
        />
        <FilterChip
          active={statusFilter === "terminated"}
          onClick={() => setStatusFilter("terminated")}
          label="منتهي"
          count={counts.byStatus.terminated}
          tone="slate"
        />

        <span className="text-slate-300 self-center px-1">|</span>

        <FilterChip
          active={freqFilter === "monthly"}
          onClick={() =>
            setFreqFilter(freqFilter === "monthly" ? "all" : "monthly")
          }
          label="📅 شهري"
          count={counts.byFreq.monthly}
          tone="sky"
        />
        <FilterChip
          active={freqFilter === "weekly"}
          onClick={() =>
            setFreqFilter(freqFilter === "weekly" ? "all" : "weekly")
          }
          label="📆 أسبوعي"
          count={counts.byFreq.weekly}
          tone="violet"
        />
      </div>

      {/* Results counter */}
      <div className="text-xs text-slate-500 font-cairo">
        {filtered.length === employees.length
          ? `${employees.length} موظف`
          : `${filtered.length} من ${employees.length} موظف${
              query ? ` يطابقوا "${query}"` : ""
            }`}
      </div>

      {/* Table or empty-results state */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-12 text-center">
          <div className="text-5xl mb-3">🔍</div>
          <h3 className="text-lg font-bold font-cairo mb-1 text-slate-700">
            مفيش نتائج
          </h3>
          <p className="text-sm text-slate-500 font-cairo mb-4">
            جرّب كلمة بحث تانية أو شيل الفلاتر
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
              setFreqFilter("all");
            }}
            className="text-sm text-brand-cyan-dark font-bold hover:underline font-cairo"
          >
            مسح كل الفلاتر
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                  الاسم
                </th>
                <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                  المسمى الوظيفي
                </th>
                <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                  القسم
                </th>
                <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                  الموبايل
                </th>
                <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                  دورة الصرف
                </th>
                <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                  الحالة
                </th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((employee) => {
                const status = STATUS_LABELS[employee.status];
                const isWeekly = employee.pay_frequency === "weekly";
                return (
                  <tr
                    key={employee.id}
                    className="hover:bg-slate-50 transition"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/employees/${employee.id}`}
                        className="flex items-center gap-3 group"
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center text-white font-bold text-sm">
                          {employee.full_name[0]}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800 font-cairo group-hover:text-brand-cyan-dark transition">
                            {employee.full_name}
                          </div>
                          {employee.employee_code && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              #{employee.employee_code}
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {employee.job_title ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {employee.department ?? "—"}
                    </td>
                    <td
                      className="px-5 py-4 text-slate-600 font-mono text-sm"
                      dir="ltr"
                    >
                      {employee.phone ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border font-cairo ${
                          isWeekly
                            ? "bg-violet-50 text-violet-700 border-violet-200"
                            : "bg-sky-50 text-sky-700 border-sky-200"
                        }`}
                      >
                        {isWeekly ? "📆 أسبوعي" : "📅 شهري"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${status.classes} font-cairo`}
                      >
                        {status.text}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/employees/${employee.id}`}
                        className="text-xs text-brand-cyan-dark hover:text-brand-cyan font-cairo font-bold"
                      >
                        تعديل
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: "emerald" | "amber" | "slate" | "sky" | "violet";
}) {
  const activeTones: Record<string, string> = {
    emerald: "bg-emerald-600 text-white shadow-sm",
    amber: "bg-amber-500 text-white shadow-sm",
    slate: "bg-slate-600 text-white shadow-sm",
    sky: "bg-sky-600 text-white shadow-sm",
    violet: "bg-violet-600 text-white shadow-sm",
  };
  const activeClass = tone
    ? activeTones[tone]
    : "bg-brand-cyan-dark text-white shadow-sm";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold font-cairo transition ${
        active
          ? activeClass
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

// Normalize a string for search:
//   - Lowercase Latin
//   - Strip Arabic diacritics (ـً ـٌ ـٍ ـَ ـُ ـِ ـّ ـْ)
//   - Unify alif forms (أ إ آ ا) so searching "احمد" matches "أحمد"
//   - Unify hamza-on-ya / dotless ya / ya
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْ]/g, "") // tashkeel + sukun + shadda
    .replace(/[إأآا]/g, "ا")
    .replace(/[ىئ]/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}
