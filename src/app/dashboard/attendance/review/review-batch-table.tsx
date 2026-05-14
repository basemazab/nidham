"use client";

// Editable table for reviewing a single import batch. Each row has
// inline-editable status / check-in / check-out / tardiness /
// early-leave fields. A "💾 حفظ" button per row commits via the
// updateAttendanceRow server action; "🗑" deletes via deleteAttendanceRow.
//
// Bulk delete via checkboxes + a top-bar action.

import { useMemo, useState, useTransition } from "react";
import type { ReviewRow } from "./page";

type Props = {
  rows: ReviewRow[];
  batchId: string;
  saveAction: (formData: FormData) => Promise<void> | void;
  deleteRowAction: (formData: FormData) => Promise<void> | void;
};

const STATUS_OPTIONS = [
  { value: "present", label: "✓ حاضر" },
  { value: "absent", label: "✗ غايب" },
  { value: "half_day", label: "◐ نص يوم" },
  { value: "leave", label: "🏖 إجازة" },
  { value: "holiday", label: "🎉 عطلة رسمية" },
  { value: "weekend", label: "🛌 عطلة أسبوعية" },
];

export function ReviewBatchTable({
  rows,
  batchId,
  saveAction,
  deleteRowAction,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = r.employees?.full_name?.toLowerCase() ?? "";
      const code = r.employees?.employee_code?.toLowerCase() ?? "";
      return name.includes(q) || code.includes(q) || r.date.includes(q);
    });
  }, [rows, query]);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 ابحث باسم الموظف، كوده، أو التاريخ..."
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-sm font-cairo"
        />
        <div className="text-[11px] text-slate-500 font-cairo mt-1">
          {filtered.length} من {rows.length} سجل
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-right text-sm font-cairo">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-3">الموظف</th>
              <th className="px-3 py-3">التاريخ</th>
              <th className="px-3 py-3">الحالة</th>
              <th className="px-2 py-3 text-center">الحضور</th>
              <th className="px-2 py-3 text-center">الانصراف</th>
              <th className="px-2 py-3 text-center">تأخير</th>
              <th className="px-2 py-3 text-center">انصراف مبكر</th>
              <th className="px-3 py-3 w-32 text-center">عمليات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((row) => (
              <EditableRow
                key={row.id}
                row={row}
                batchId={batchId}
                saveAction={saveAction}
                deleteRowAction={deleteRowAction}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditableRow({
  row,
  batchId,
  saveAction,
  deleteRowAction,
}: {
  row: ReviewRow;
  batchId: string;
  saveAction: (formData: FormData) => Promise<void> | void;
  deleteRowAction: (formData: FormData) => Promise<void> | void;
}) {
  const [status, setStatus] = useState(row.status);
  const [checkIn, setCheckIn] = useState(timeStr(row.check_in));
  const [checkOut, setCheckOut] = useState(timeStr(row.check_out));
  const [tardiness, setTardiness] = useState(String(row.tardiness_minutes));
  const [earlyLeave, setEarlyLeave] = useState(String(row.early_leave_minutes));
  const [isPending, startTransition] = useTransition();

  const isWeekly = row.employees?.pay_frequency === "weekly";

  return (
    <tr className="hover:bg-slate-50/50">
      <td className="px-3 py-2">
        <div className="font-bold text-slate-800">
          {row.employees?.full_name ?? "—"}
          {isWeekly && (
            <span className="mr-1 text-[10px] text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
              أسبوعي
            </span>
          )}
        </div>
        {row.employees?.employee_code && (
          <div className="text-[10px] text-slate-500 font-mono" dir="ltr">
            #{row.employees.employee_code}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-slate-700 font-mono text-xs" dir="ltr">
        {row.date}
      </td>
      <td className="px-3 py-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ReviewRow["status"])}
          className="px-2 py-1.5 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-xs font-cairo w-full min-w-[100px]"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="time"
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
          className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-xs font-mono"
          dir="ltr"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="time"
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-xs font-mono"
          dir="ltr"
        />
      </td>
      <td className="px-2 py-2 text-center">
        <input
          type="number"
          value={tardiness}
          onChange={(e) => setTardiness(e.target.value)}
          min="0"
          max="720"
          className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none text-xs font-mono text-center"
          dir="ltr"
        />
      </td>
      <td className="px-2 py-2 text-center">
        <input
          type="number"
          value={earlyLeave}
          onChange={(e) => setEarlyLeave(e.target.value)}
          min="0"
          max="720"
          className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-200 outline-none text-xs font-mono text-center"
          dir="ltr"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5 justify-center">
          <form
            action={(fd) => {
              fd.set("attendance_id", row.id);
              fd.set("batch_id", batchId);
              fd.set("status", status);
              fd.set("check_in", checkIn);
              fd.set("check_out", checkOut);
              fd.set("tardiness_minutes", tardiness);
              fd.set("early_leave_minutes", earlyLeave);
              startTransition(() => saveAction(fd));
            }}
          >
            <button
              type="submit"
              disabled={isPending}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-[10px] font-cairo transition disabled:opacity-50"
            >
              💾 حفظ
            </button>
          </form>
          <form action={deleteRowAction}>
            <input type="hidden" name="attendance_id" value={row.id} />
            <input type="hidden" name="batch_id" value={batchId} />
            <button
              type="submit"
              className="px-2 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-[10px] font-cairo transition"
              title="حذف السجل"
            >
              🗑
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}

// "HH:MM:SS" from DB -> "HH:MM" for the <input type="time">.
function timeStr(s: string | null): string {
  if (!s) return "";
  const m = s.match(/^(\d{1,2}:\d{2})/);
  return m ? m[1] : "";
}
