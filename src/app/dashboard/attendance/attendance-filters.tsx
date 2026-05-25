"use client";

// ============================================================================
// AttendanceFilters — client-side filter bar for the attendance grid
// ============================================================================
//
// Renders a search input + department dropdown that filters the table
// rows in-browser by toggling a `data-hidden="true"` attribute. Pure
// client-side DOM mutation — no server roundtrip, no React re-render
// of the (potentially 200-row) table. Critical for HR doing fast roll
// call on a company with 100+ employees.
//
// Why DOM mutation instead of React state? The attendance table is
// rendered in the parent Server Component because every row contains a
// <form> input bound to a server action. Lifting the table state into
// a client component would mean re-architecting all 200 rows as client
// state, which kills the simplicity of the existing form-post flow.
// Toggling `display: none` via data-attribute is a tiny lightweight
// escape hatch.

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Distinct department strings to populate the filter dropdown. */
  departments: string[];
  /** Total active employees — used in the "showing X of Y" hint. */
  totalCount: number;
};

export function AttendanceFilters({ departments, totalCount }: Props) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [visibleCount, setVisibleCount] = useState(totalCount);
  const lastApplied = useRef("");

  // Re-apply the filter whenever search or department changes. We work
  // off `data-employee-row` rows in the parent table — that attribute
  // is set on each <tr> in the Server Component.
  useEffect(() => {
    const key = `${search}|${department}`;
    if (key === lastApplied.current) return;
    lastApplied.current = key;

    const rows = document.querySelectorAll<HTMLElement>(
      "[data-employee-row]",
    );
    const needleName = search.trim().toLowerCase();
    const needleDept = department.trim();

    let shown = 0;
    rows.forEach((row) => {
      const rowName = (row.dataset.name ?? "").toLowerCase();
      const rowDept = row.dataset.department ?? "";

      const nameMatches = !needleName || rowName.includes(needleName);
      const deptMatches = !needleDept || rowDept === needleDept;

      const visible = nameMatches && deptMatches;
      row.style.display = visible ? "" : "none";
      if (visible) shown += 1;
    });
    setVisibleCount(shown);
  }, [search, department]);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-4 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <label
          htmlFor="att-search"
          className="block text-xs font-medium text-slate-600 mb-1 font-cairo"
        >
          ابحث بالاسم
        </label>
        <input
          id="att-search"
          type="search"
          placeholder="اكتب جزء من اسم الموظف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
        />
      </div>

      {departments.length > 0 && (
        <div>
          <label
            htmlFor="att-dept"
            className="block text-xs font-medium text-slate-600 mb-1 font-cairo"
          >
            القسم
          </label>
          <select
            id="att-dept"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo min-w-[160px]"
          >
            <option value="">كل الأقسام</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="text-xs text-slate-500 font-cairo py-2">
        {visibleCount === totalCount
          ? `كل الـ ${totalCount.toLocaleString("ar-EG")} موظف`
          : `بيظهر ${visibleCount.toLocaleString("ar-EG")} من ${totalCount.toLocaleString("ar-EG")}`}
      </div>

      {(search || department) && (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setDepartment("");
          }}
          className="text-xs text-slate-500 hover:text-slate-700 underline font-cairo"
        >
          مسح الفلاتر
        </button>
      )}
    </div>
  );
}
