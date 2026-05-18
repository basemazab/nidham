// ============================================================================
// Attendance helpers — pure functions usable from server components, server
// actions, and unit tests.
// ============================================================================
//
// These were inlined inside /dashboard/attendance/logs/page.tsx but extracted
// here once it became clear they're worth their own unit tests (and that
// /dashboard/reports/attendance is likely to want the same math soon).

/**
 * Compute worked hours from check_in / check_out HH:MM strings.
 *
 * - Returns 0 if either is null/empty.
 * - Handles seconds suffix ("08:30:00") by ignoring everything after the
 *   second colon.
 * - Handles overnight shifts: when check_out < check_in we treat it as the
 *   next day and add 24h. (A check-out exactly equal to check-in returns 0,
 *   not 24 — a zero-length shift is far more likely than a 24-hour one.)
 *
 *   workedHours("08:00", "17:00")        -> 9
 *   workedHours("22:00", "06:00")        -> 8        (overnight)
 *   workedHours("08:00", null)           -> 0
 *   workedHours(null, "17:00")           -> 0
 *   workedHours("garbage", "17:00")      -> 0        (defensive)
 */
export function workedHours(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): number {
  if (!checkIn || !checkOut) return 0;

  const [inH, inM] = checkIn.split(":").map(Number);
  const [outH, outM] = checkOut.split(":").map(Number);

  if (
    !Number.isFinite(inH) ||
    !Number.isFinite(inM) ||
    !Number.isFinite(outH) ||
    !Number.isFinite(outM)
  ) {
    return 0;
  }

  const inMins = inH * 60 + inM;
  let outMins = outH * 60 + outM;
  if (outMins < inMins) outMins += 24 * 60;

  return Math.max(0, (outMins - inMins) / 60);
}

/**
 * Per-minute wage estimate. Used to convert tardiness / early-leave
 * minutes into an indicative EGP deduction for the attendance logs view.
 *
 * Model:
 *   monthly:  basic_salary / 30 days / 8 hours / 60 minutes
 *   weekly:   basic_salary /  6 days / 8 hours / 60 minutes
 *
 * The real payroll engine (lib/payroll.ts) does the rigorous math against
 * the company's working-days setting. This helper is for display-only
 * estimates where 22 vs 30 working days doesn't matter much.
 */
export function perMinuteWage(
  basic: number | null | undefined,
  freq: "monthly" | "weekly" | null | undefined,
): number {
  if (typeof basic !== "number" || !Number.isFinite(basic) || basic <= 0) {
    return 0;
  }
  const daysInCycle = freq === "weekly" ? 6 : 30;
  return basic / daysInCycle / 8 / 60;
}

/**
 * Trim seconds from a "HH:MM:SS" time, leaving "HH:MM". Returns "—" for
 * null/empty so it can be dropped straight into a table cell.
 */
export function formatTime(t: string | null | undefined): string {
  if (!t) return "—";
  return t.slice(0, 5);
}

/**
 * Format a worked-hours number to two decimals, or "—" for zero.
 * Two decimals is enough granularity to surface 15-minute increments
 * without showing "9.00" everywhere.
 */
export function formatHours(h: number): string {
  if (h === 0) return "—";
  return h.toFixed(2);
}
