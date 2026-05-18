"use client";

// ============================================================================
// EmployeesExplorer — the interactive list with view toggle
// ============================================================================
//
// One component for two views:
//   1) "By Department" — collapsible sections per department with a
//      count + total comp header per section
//   2) "Flat Table" — the classic searchable table (the old view)
//
// Search + filters apply to BOTH views, so the user can search and
// then switch views without losing context. Filters live here (not
// in the child views) so they share state.
//
// Why client-side
// ---------------
// Search-as-you-type, tab switching, and collapsible sections are
// all stateful interactions that would be jarring as full server
// roundtrips. For <500 employees the full list fits comfortably in
// the bundle.

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatEGP } from "@/lib/format";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
export type EmployeeRow = {
  id: string;
  full_name: string;
  employee_code: string | null;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  status: "active" | "on_leave" | "terminated";
  hire_date: string | null;
  pay_frequency: "monthly" | "weekly" | null;
  basic_salary: number | null;
  housing_allowance: number | null;
  transport_allowance: number | null;
  other_allowances: number | null;
  incentive_allowance: number | null;
  avatar_url: string | null;
};

const STATUS_LABELS: Record<
  EmployeeRow["status"],
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

const NO_DEPT_LABEL = "بدون قسم";

type StatusFilter = "all" | EmployeeRow["status"];
type FreqFilter = "all" | "monthly" | "weekly";
type ViewMode = "cards" | "by-dept" | "table";

function totalComp(e: EmployeeRow): number {
  return (
    (e.basic_salary ?? 0) +
    (e.housing_allowance ?? 0) +
    (e.transport_allowance ?? 0) +
    (e.other_allowances ?? 0) +
    (e.incentive_allowance ?? 0)
  );
}

// ----------------------------------------------------------------------------
// Main component
// ----------------------------------------------------------------------------
export function EmployeesExplorer({
  employees,
}: {
  employees: EmployeeRow[];
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [freqFilter, setFreqFilter] = useState<FreqFilter>("all");
  // Department filter — driven by the right-side sidebar. "" means
  // "all departments". Setting it to NO_DEPT_LABEL filters down to
  // employees without a department.
  const [deptFilter, setDeptFilter] = useState<string>("");
  // Cards is the default — matches the Odoo-style kanban grid the
  // operator asked for. by-dept + table stay available via tabs.
  const [view, setView] = useState<ViewMode>("cards");

  // Department list with counts — drives the sidebar. Computed off
  // the FULL employee list (not the filtered one) so counts reflect
  // the underlying truth, not the active search.
  const departments = useMemo(() => {
    const m = new Map<string, number>();
    let unassigned = 0;
    for (const e of employees) {
      const d = (e.department && e.department.trim()) || "";
      if (!d) {
        unassigned += 1;
      } else {
        m.set(d, (m.get(d) ?? 0) + 1);
      }
    }
    const entries = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    if (unassigned > 0) {
      entries.push([NO_DEPT_LABEL, unassigned]);
    }
    return entries;
  }, [employees]);

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    return employees.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (freqFilter !== "all") {
        const f = e.pay_frequency ?? "monthly";
        if (f !== freqFilter) return false;
      }
      // Department filter — empty means "all". NO_DEPT_LABEL matches
      // employees with no department or an empty-string department.
      if (deptFilter) {
        const d = (e.department && e.department.trim()) || "";
        if (deptFilter === NO_DEPT_LABEL) {
          if (d) return false;
        } else {
          if (d !== deptFilter) return false;
        }
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
  }, [employees, query, statusFilter, freqFilter, deptFilter]);

  const counts = useMemo(() => {
    const byStatus = {
      all: employees.length,
      active: 0,
      on_leave: 0,
      terminated: 0,
    };
    const byFreq = { all: employees.length, monthly: 0, weekly: 0 };
    for (const e of employees) {
      byStatus[e.status] += 1;
      const f = e.pay_frequency ?? "monthly";
      byFreq[f] += 1;
    }
    return { byStatus, byFreq };
  }, [employees]);

  // Auto-detect empty filter state for the "no results" panel
  const isFiltered =
    query !== "" ||
    statusFilter !== "all" ||
    freqFilter !== "all" ||
    deptFilter !== "";

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setFreqFilter("all");
    setDeptFilter("");
  };

  return (
    <div className="space-y-4">
      {/* ===== Search ===== */}
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
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* ===== Filters + View toggle row ===== */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
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

        {/* View tabs */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 shadow-inner">
          <ViewTab
            active={view === "cards"}
            onClick={() => setView("cards")}
            icon="🃏"
            label="كروت"
          />
          <ViewTab
            active={view === "by-dept"}
            onClick={() => setView("by-dept")}
            icon="🏢"
            label="حسب القسم"
          />
          <ViewTab
            active={view === "table"}
            onClick={() => setView("table")}
            icon="📋"
            label="جدول"
          />
        </div>
      </div>

      {/* ===== Result counter ===== */}
      <div className="text-xs text-slate-500 font-cairo">
        {filtered.length === employees.length
          ? `${employees.length} موظف`
          : `${filtered.length} من ${employees.length} موظف${
              query ? ` يطابقوا "${query}"` : ""
            }`}
        {deptFilter && (
          <span className="ms-2">
            · القسم: <strong className="text-slate-700">{deptFilter}</strong>{" "}
            <button
              type="button"
              onClick={() => setDeptFilter("")}
              className="text-rose-600 hover:text-rose-800 font-bold"
              title="مسح فلتر القسم"
            >
              ✕
            </button>
          </span>
        )}
      </div>

      {/* ===== Body: sidebar + main ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
        <div className="min-w-0">
          {filtered.length === 0 ? (
            <NoResults onClear={clearFilters} hadFilters={isFiltered} />
          ) : view === "cards" ? (
            <CardGridView employees={filtered} />
          ) : view === "by-dept" ? (
            <ByDepartmentView employees={filtered} />
          ) : (
            <FlatTableView employees={filtered} />
          )}
        </div>
        {/* Department sidebar — Odoo-style. Always rendered (even when
            employees is empty) so the operator can see the structure.
            Sticks on desktop so the active department stays in view
            while scrolling the kanban grid. */}
        <DepartmentSidebar
          departments={departments}
          activeDept={deptFilter}
          totalCount={employees.length}
          onSelect={setDeptFilter}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// CardGridView — Odoo-style kanban grid (3 cards per row on desktop,
// 2 on tablet, 1 on phone). Each card is a Link to the detail page.
// ----------------------------------------------------------------------------
function CardGridView({ employees }: { employees: EmployeeRow[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {employees.map((e) => (
        <EmployeeCard key={e.id} employee={e} />
      ))}
    </div>
  );
}

function EmployeeCard({ employee }: { employee: EmployeeRow }) {
  const status = STATUS_LABELS[employee.status];
  const comp = totalComp(employee);
  // Status dot color — green for active, amber for on-leave, gray for terminated.
  const dotColor =
    employee.status === "active"
      ? "bg-emerald-500"
      : employee.status === "on_leave"
        ? "bg-amber-500"
        : "bg-slate-400";

  return (
    <Link
      href={`/dashboard/employees/${employee.id}`}
      className="group block bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-brand-cyan/40 hover:-translate-y-0.5 transition-all overflow-hidden"
    >
      <div className="p-4 flex gap-3">
        {/* Avatar block — uses the uploaded photo when present, falls
            back to the initial-letter tile so brand-new cards still
            look intentional. Status dot lives in the corner regardless. */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center text-white text-xl font-black shrink-0 relative overflow-hidden">
          {employee.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={employee.avatar_url}
              alt={employee.full_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{employee.full_name[0]}</span>
          )}
          {/* Status dot in the corner */}
          <span
            className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ${dotColor} ring-2 ring-white`}
            title={status.text}
          />
        </div>

        {/* Right column — name + role + extras */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <h3 className="font-black text-slate-800 font-cairo group-hover:text-brand-cyan-dark transition truncate text-sm">
              {employee.full_name}
            </h3>
            {employee.employee_code && (
              <span
                className="shrink-0 text-[9px] text-slate-500 font-mono bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded"
                dir="ltr"
              >
                #{employee.employee_code}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-600 font-cairo truncate mb-1">
            {employee.job_title ?? "—"}
          </div>
          {employee.phone && (
            <div
              className="text-[11px] text-slate-500 font-mono truncate"
              dir="ltr"
            >
              📞 {employee.phone}
            </div>
          )}
        </div>
      </div>

      {/* Footer — comp + freq + status chip. Hidden if there's nothing useful. */}
      {(comp > 0 || employee.department) && (
        <div className="px-4 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          {employee.department && (
            <span className="text-[11px] text-slate-600 font-cairo truncate min-w-0">
              🏢 {employee.department}
            </span>
          )}
          {comp > 0 && (
            <span
              className="text-[11px] font-bold text-emerald-700 whitespace-nowrap"
              dir="ltr"
            >
              {formatEGP(comp)}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

// ----------------------------------------------------------------------------
// DepartmentSidebar — Odoo's right-side "filter by department" list.
// Stays visible while the operator scrolls the kanban grid.
// ----------------------------------------------------------------------------
function DepartmentSidebar({
  departments,
  activeDept,
  totalCount,
  onSelect,
}: {
  departments: [string, number][];
  activeDept: string;
  totalCount: number;
  onSelect: (dept: string) => void;
}) {
  return (
    <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 lg:sticky lg:top-4 lg:self-start">
      <div className="flex items-center gap-2 mb-2 px-2">
        <span className="text-base">🏢</span>
        <h3 className="text-xs font-black text-slate-700 font-cairo">
          الأقسام
        </h3>
      </div>
      <div className="space-y-0.5">
        <DeptItem
          label="الكل"
          count={totalCount}
          active={activeDept === ""}
          onClick={() => onSelect("")}
          isPrimary
        />
        {departments.map(([name, count]) => (
          <DeptItem
            key={name}
            label={name}
            count={count}
            active={activeDept === name}
            onClick={() => onSelect(name)}
          />
        ))}
      </div>
    </aside>
  );
}

function DeptItem({
  label,
  count,
  active,
  onClick,
  isPrimary = false,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  isPrimary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-cairo transition group ${
        active
          ? "bg-brand-cyan/10 text-brand-cyan-dark font-black"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <span className="truncate text-right flex-1">
        {isPrimary && !active && <span className="text-slate-400">▸ </span>}
        {label}
      </span>
      <span
        className={`shrink-0 tabular-nums px-1.5 py-0.5 rounded text-[10px] font-bold ${
          active
            ? "bg-brand-cyan-dark text-white"
            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// ----------------------------------------------------------------------------
// ByDepartmentView — grouped sections
// ----------------------------------------------------------------------------
function ByDepartmentView({ employees }: { employees: EmployeeRow[] }) {
  // Group by department + sort: largest department first, "بدون قسم" last
  const groups = useMemo(() => {
    const m = new Map<string, EmployeeRow[]>();
    for (const e of employees) {
      const dept = (e.department && e.department.trim()) || NO_DEPT_LABEL;
      if (!m.has(dept)) m.set(dept, []);
      m.get(dept)!.push(e);
    }
    const entries = Array.from(m.entries()).sort((a, b) => {
      // pin "no dept" to the bottom
      if (a[0] === NO_DEPT_LABEL) return 1;
      if (b[0] === NO_DEPT_LABEL) return -1;
      return b[1].length - a[1].length;
    });
    return entries;
  }, [employees]);

  return (
    <div className="space-y-3">
      {groups.map(([deptName, deptEmployees], idx) => (
        <DepartmentSection
          key={deptName}
          name={deptName}
          employees={deptEmployees}
          hueIndex={idx}
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// DepartmentSection — collapsible card for one department
// ----------------------------------------------------------------------------
function DepartmentSection({
  name,
  employees,
  hueIndex,
}: {
  name: string;
  employees: EmployeeRow[];
  hueIndex: number;
}) {
  const [open, setOpen] = useState(true);

  const totalPayroll = employees.reduce((s, e) => s + totalComp(e), 0);
  const activeCount = employees.filter((e) => e.status === "active").length;
  const isNoDept = name === NO_DEPT_LABEL;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-4 md:px-5 py-3 flex items-center justify-between gap-3 transition ${
          isNoDept
            ? "bg-slate-50 hover:bg-slate-100"
            : `bg-gradient-to-l ${deptHeaderGradient(hueIndex)} hover:brightness-95`
        }`}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span
            className={`w-9 h-9 rounded-xl ${deptIconBg(hueIndex)} text-white flex items-center justify-center text-base font-bold shrink-0`}
          >
            {isNoDept ? "?" : name[0]}
          </span>
          <div className="text-right min-w-0 flex-1">
            <div className="font-black font-cairo text-slate-800 truncate">
              {name}
            </div>
            <div className="text-[11px] text-slate-500 font-cairo">
              {employees.length} موظف · {activeCount} نشط
              {totalPayroll > 0 ? (
                <span>
                  {" "}
                  ·{" "}
                  <span className="font-bold text-emerald-700">
                    {formatEGP(Math.round(totalPayroll))}/شهر
                  </span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <span className="text-slate-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {employees.map((e) => (
            <EmployeeRowItem key={e.id} employee={e} />
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// EmployeeRowItem — compact one-line row used inside dept sections
// ----------------------------------------------------------------------------
function EmployeeRowItem({ employee }: { employee: EmployeeRow }) {
  const status = STATUS_LABELS[employee.status];
  const isWeekly = employee.pay_frequency === "weekly";
  const comp = totalComp(employee);

  return (
    <Link
      href={`/dashboard/employees/${employee.id}`}
      className="flex items-center gap-3 px-4 md:px-5 py-3 hover:bg-slate-50 transition group"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center text-white font-bold text-sm shrink-0">
        {employee.full_name[0]}
      </div>

      {/* Name + code + title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-800 font-cairo group-hover:text-brand-cyan-dark transition truncate">
            {employee.full_name}
          </span>
          {employee.employee_code && (
            <span
              className="text-[10px] text-slate-500 font-mono bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded"
              dir="ltr"
            >
              #{employee.employee_code}
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-500 font-cairo truncate">
          {employee.job_title ?? "—"}
          {employee.phone && (
            <>
              {" "}
              · <span dir="ltr" className="font-mono">{employee.phone}</span>
            </>
          )}
        </div>
      </div>

      {/* Comp */}
      {comp > 0 && (
        <div
          className="hidden md:block text-xs font-bold text-emerald-700 whitespace-nowrap"
          dir="ltr"
        >
          {formatEGP(comp)}
        </div>
      )}

      {/* Freq chip */}
      <span
        className={`hidden md:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border font-cairo whitespace-nowrap ${
          isWeekly
            ? "bg-violet-50 text-violet-700 border-violet-200"
            : "bg-sky-50 text-sky-700 border-sky-200"
        }`}
      >
        {isWeekly ? "📆 أسبوعي" : "📅 شهري"}
      </span>

      {/* Status chip */}
      <span
        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${status.classes} font-cairo whitespace-nowrap`}
      >
        {status.text}
      </span>

      <span className="text-slate-400 text-sm hidden md:inline">←</span>
    </Link>
  );
}

// ----------------------------------------------------------------------------
// FlatTableView — classic table
// ----------------------------------------------------------------------------
function FlatTableView({ employees }: { employees: EmployeeRow[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden overflow-x-auto">
      <table className="w-full text-right min-w-[800px]">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <Th>الاسم</Th>
            <Th>المسمى الوظيفي</Th>
            <Th>القسم</Th>
            <Th>الموبايل</Th>
            <Th>الراتب الإجمالي</Th>
            <Th>دورة الصرف</Th>
            <Th>الحالة</Th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {employees.map((employee) => {
            const status = STATUS_LABELS[employee.status];
            const isWeekly = employee.pay_frequency === "weekly";
            const comp = totalComp(employee);
            return (
              <tr key={employee.id} className="hover:bg-slate-50 transition">
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
                        <div
                          className="text-[10px] text-slate-400 font-mono"
                          dir="ltr"
                        >
                          #{employee.employee_code}
                        </div>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="px-5 py-4 text-slate-600 text-sm font-cairo">
                  {employee.job_title ?? "—"}
                </td>
                <td className="px-5 py-4 text-slate-600 text-sm font-cairo">
                  {employee.department ?? "—"}
                </td>
                <td
                  className="px-5 py-4 text-slate-600 font-mono text-sm"
                  dir="ltr"
                >
                  {employee.phone ?? "—"}
                </td>
                <td
                  className="px-5 py-4 text-emerald-700 font-bold text-sm"
                  dir="ltr"
                >
                  {comp > 0 ? formatEGP(comp) : "—"}
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
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
      {children}
    </th>
  );
}

function NoResults({
  hadFilters,
  onClear,
}: {
  hadFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-12 text-center">
      <div className="text-5xl mb-3">🔍</div>
      <h3 className="text-lg font-bold font-cairo mb-1 text-slate-700">
        مفيش نتائج
      </h3>
      <p className="text-sm text-slate-500 font-cairo mb-4">
        {hadFilters
          ? "جرّب كلمة بحث تانية أو شيل الفلاتر"
          : "مفيش موظفين في النظام دلوقتي"}
      </p>
      {hadFilters && (
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-brand-cyan-dark font-bold hover:underline font-cairo"
        >
          مسح كل الفلاتر
        </button>
      )}
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-cairo transition ${
        active
          ? "bg-white text-slate-800 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
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

// ----------------------------------------------------------------------------
// Hue helpers — same palette as employees-analytics so a department's
// colour stays consistent across the two visualizations.
// ----------------------------------------------------------------------------
const HEADER_GRADIENTS = [
  "from-cyan-50 to-white",
  "from-emerald-50 to-white",
  "from-amber-50 to-white",
  "from-violet-50 to-white",
  "from-rose-50 to-white",
  "from-sky-50 to-white",
  "from-lime-50 to-white",
  "from-fuchsia-50 to-white",
];
const ICON_BGS = [
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-lime-500",
  "bg-fuchsia-500",
];

function deptHeaderGradient(i: number): string {
  return HEADER_GRADIENTS[i % HEADER_GRADIENTS.length];
}
function deptIconBg(i: number): string {
  return ICON_BGS[i % ICON_BGS.length];
}

// Normalize a string for search:
//   - Lowercase Latin
//   - Strip Arabic diacritics
//   - Unify alif/ya/ta-marbuta forms
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/[ىئ]/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}
