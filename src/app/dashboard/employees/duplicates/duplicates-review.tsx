"use client";

// Renders each duplicate group as a card. HR picks ONE row to keep
// (radio button); on submit, the others are sent to the server action
// for deletion. The "oldest record" is pre-selected as the default
// keep because that's the row with the most history (attendance,
// payroll, etc.).

import { useMemo, useState, useTransition } from "react";
import type { DuplicateGroup } from "./page";

type Props = {
  groups: DuplicateGroup[];
  action: (formData: FormData) => Promise<void> | void;
};

const MATCH_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  national_id: { label: "رقم قومي مكرر", emoji: "🪪" },
  employee_code: { label: "كود موظف مكرر", emoji: "🏷" },
  email: { label: "إيميل مكرر", emoji: "✉" },
  phone: { label: "تليفون مكرر", emoji: "📞" },
};

const STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  on_leave: "إجازة",
  terminated: "منتهي",
};

export function DuplicatesReview({ groups, action }: Props) {
  // Map<group_id, employee_id_to_keep>. Default: the oldest employee
  // in each group (typically the "original" one).
  const initialKeepers = useMemo(() => {
    const m: Record<string, string> = {};
    for (const g of groups) {
      const oldest = [...g.employees].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )[0];
      m[g.group_id] = oldest?.employee_id ?? g.employees[0].employee_id;
    }
    return m;
  }, [groups]);

  const [keepers, setKeepers] = useState<Record<string, string>>(initialKeepers);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [isPending, startTransition] = useTransition();

  // Collect every employee_id NOT marked as "keep" -- those are the
  // deletion candidates. Dedupe in case an employee appears in
  // multiple groups (same person flagged by both email + phone).
  const idsToDelete = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) {
      const keeperId = keepers[g.group_id];
      for (const e of g.employees) {
        if (e.employee_id !== keeperId) set.add(e.employee_id);
      }
    }
    return Array.from(set);
  }, [groups, keepers]);

  // BUT we also need to be careful: if employee X is the "keeper" in
  // group A but also a candidate-for-delete in group B, deleting X
  // would break group A. Remove X from deletion list if they're
  // anyone's keeper.
  const safeIdsToDelete = useMemo(() => {
    const keeperSet = new Set(Object.values(keepers));
    return idsToDelete.filter((id) => !keeperSet.has(id));
  }, [idsToDelete, keepers]);

  const canSubmit =
    safeIdsToDelete.length > 0 &&
    confirmPhrase.trim() === "حذف" &&
    !isPending;

  return (
    <form
      action={(fd) => {
        fd.set("employee_ids", safeIdsToDelete.join(","));
        fd.set("confirm", confirmPhrase);
        startTransition(() => action(fd));
      }}
      className="space-y-4"
    >
      {groups.map((g) => {
        const meta = MATCH_TYPE_LABELS[g.match_type] ?? {
          label: g.match_type,
          emoji: "🔍",
        };
        const isHigh = g.confidence === "high";
        return (
          <div
            key={g.group_id}
            className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden ${
              isHigh ? "border-red-200" : "border-amber-200"
            }`}
          >
            <div
              className={`px-5 py-3 flex items-center justify-between gap-3 ${
                isHigh ? "bg-red-50" : "bg-amber-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{meta.emoji}</span>
                <div>
                  <div
                    className={`text-sm font-black font-cairo ${
                      isHigh ? "text-red-800" : "text-amber-800"
                    }`}
                  >
                    {meta.label}: <span className="font-mono">{g.match_value}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-cairo">
                    {g.employees.length} موظفين بنفس القيمة دي
                  </div>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-1 rounded-full border font-cairo ${
                  isHigh
                    ? "bg-red-100 text-red-800 border-red-300"
                    : "bg-amber-100 text-amber-800 border-amber-300"
                }`}
              >
                {isHigh ? "ثقة عالية" : "ثقة متوسطة"}
              </span>
            </div>

            <table className="w-full text-right text-sm font-cairo">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 w-12 text-center">احتفظ</th>
                  <th className="px-3 py-2">الموظف</th>
                  <th className="px-3 py-2">الكود</th>
                  <th className="px-3 py-2">الرقم القومي</th>
                  <th className="px-3 py-2">إيميل / تليفون</th>
                  <th className="px-3 py-2 text-center">تاريخ الإضافة</th>
                  <th className="px-3 py-2 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {g.employees.map((e) => {
                  const isKeeper = keepers[g.group_id] === e.employee_id;
                  return (
                    <tr
                      key={e.employee_id}
                      className={
                        isKeeper
                          ? "bg-emerald-50/50"
                          : "hover:bg-slate-50/50"
                      }
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="radio"
                          name={`keep_${g.group_id}`}
                          checked={isKeeper}
                          onChange={() =>
                            setKeepers((prev) => ({
                              ...prev,
                              [g.group_id]: e.employee_id,
                            }))
                          }
                          className="w-5 h-5 accent-emerald-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-800">
                          {e.full_name}
                          {e.has_user && (
                            <span className="mr-1 text-[10px] text-cyan-700">
                              📱
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600 font-mono text-xs" dir="ltr">
                        {e.employee_code ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-slate-600 font-mono text-xs" dir="ltr">
                        {e.national_id ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-slate-600 text-xs">
                        <div dir="ltr">{e.email ?? "—"}</div>
                        <div dir="ltr">{e.phone ?? "—"}</div>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-500 text-xs">
                        {new Date(e.created_at).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            e.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : e.status === "on_leave"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {STATUS_LABELS[e.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Bottom action bar */}
      <div className="bg-white rounded-2xl border-2 border-red-200 p-5 shadow-md sticky bottom-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <div className="font-black text-slate-800 font-cairo mb-0.5">
              ⚠ سيتم حذف {safeIdsToDelete.length} موظف
            </div>
            <p className="text-xs text-slate-500 font-cairo leading-relaxed">
              الحذف بياخد معاه كل بياناتهم (حضور، مرتبات، طلبات، سلف).
              <b className="text-red-700"> الإجراء نهائي</b>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="dup_confirm"
              className="block text-xs font-bold text-slate-700 mb-1 font-cairo"
            >
              اكتب كلمة <b className="text-red-600">حذف</b> هنا للتأكيد:
            </label>
            <input
              id="dup_confirm"
              type="text"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder="حذف"
              className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 focus:border-red-400 focus:ring-2 focus:ring-red-200 outline-none text-slate-900 font-cairo text-center font-bold"
            />
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending
              ? "...جاري الحذف"
              : `🗑 احذف ${safeIdsToDelete.length} موظف`}
          </button>
        </div>
      </div>
    </form>
  );
}
