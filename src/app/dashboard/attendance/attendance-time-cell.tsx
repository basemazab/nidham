"use client";

// ============================================================================
// AttendanceTimeCell — per-employee check-in / check-out time inputs
// ============================================================================
//
// Two compact <input type="time"> fields wrapped with "الآن" helper
// buttons that drop the user's current local clock time into the
// matching field. Uncontrolled inputs — values are read by the parent
// form when the user submits, no React state needed.
//
// Why client-side? `new Date()` on the server uses Vercel's UTC clock,
// not the HR's Cairo wall clock. Picking the time in the browser
// guarantees the recorded time matches what the HR sees on their wrist.

import { useRef } from "react";

type Props = {
  employeeId: string;
  defaultCheckIn?: string | null;
  defaultCheckOut?: string | null;
  /** When set, used as a status auto-fill helper id for downstream JS. */
  statusFieldId?: string;
};

/** Format current local time as "HH:MM" for an <input type="time">. */
function nowHHMM(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Trim seconds from a DB time value ("08:30:00" → "08:30"). */
function trimSeconds(t: string | null | undefined): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export function AttendanceTimeCell({
  employeeId,
  defaultCheckIn,
  defaultCheckOut,
}: Props) {
  const inRef = useRef<HTMLInputElement>(null);
  const outRef = useRef<HTMLInputElement>(null);

  const fillIn = () => {
    if (!inRef.current) return;
    inRef.current.value = nowHHMM();
    // Bonus: if status select for this row is empty, auto-set to "present".
    // The select shares the `status_<employeeId>` name pattern.
    const statusSel = document.querySelector<HTMLSelectElement>(
      `select[name="status_${employeeId}"]`,
    );
    if (statusSel && !statusSel.value) statusSel.value = "present";
  };

  const fillOut = () => {
    if (!outRef.current) return;
    outRef.current.value = nowHHMM();
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Check-in */}
      <div className="flex items-center gap-1">
        <input
          ref={inRef}
          type="time"
          name={`check_in_${employeeId}`}
          defaultValue={trimSeconds(defaultCheckIn)}
          className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 outline-none text-slate-900 text-xs font-mono"
          dir="ltr"
          aria-label="ساعة الدخول"
        />
        <button
          type="button"
          onClick={fillIn}
          title="املأ بساعة دلوقتي"
          className="px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold font-cairo border border-emerald-200 transition"
        >
          الآن
        </button>
      </div>

      {/* Check-out */}
      <div className="flex items-center gap-1">
        <input
          ref={outRef}
          type="time"
          name={`check_out_${employeeId}`}
          defaultValue={trimSeconds(defaultCheckOut)}
          className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-200 outline-none text-slate-900 text-xs font-mono"
          dir="ltr"
          aria-label="ساعة الخروج"
        />
        <button
          type="button"
          onClick={fillOut}
          title="املأ بساعة دلوقتي"
          className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold font-cairo border border-rose-200 transition"
        >
          الآن
        </button>
      </div>
    </div>
  );
}
