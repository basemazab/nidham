// Centralised display formatters used across the web app. The audit
// found three near-identical `formatEGP` functions plus inline date
// strings -- the visible result was Arabic-Indic and Latin digits
// mixed on the same page, plus raw "2026-05-14" strings showing up
// in customer-facing views. Single source of truth fixes both.

// ----------------------------------------------------------------------------
// Currency
// ----------------------------------------------------------------------------

const ar = "ar-EG";

/**
 * EGP currency formatter. Defaults to *no* fractional digits because
 * Egyptian payroll tables read better as "5,000 ج" than "5,000.00 ج"
 * and most of our amounts are integer pounds anyway. Pass
 * `withDecimals: true` for ledger / payslip totals where every
 * piastre matters.
 *
 *   formatEGP(5000)                  -> "٥٬٠٠٠ ج"
 *   formatEGP(5000, true)            -> "٥٬٠٠٠٫٠٠ ج"
 *   formatEGP(null)                  -> "—"
 *   formatEGP(undefined)             -> "—"
 */
export function formatEGP(
  value: number | null | undefined,
  withDecimals = false,
): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  const opts: Intl.NumberFormatOptions = withDecimals
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { minimumFractionDigits: 0, maximumFractionDigits: 0 };
  return value.toLocaleString(ar, opts) + " ج";
}

/**
 * EGP salary range, used in job postings:
 *   formatEGPRange(5000, 10000)  -> "٥٬٠٠٠ – ١٠٬٠٠٠ ج"
 *   formatEGPRange(5000, null)   -> "من ٥٬٠٠٠ ج"
 *   formatEGPRange(null, 10000)  -> "حتى ١٠٬٠٠٠ ج"
 *   formatEGPRange(null, null)   -> null  (caller can render "—" / hide)
 */
export function formatEGPRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  const hasMin = typeof min === "number" && Number.isFinite(min);
  const hasMax = typeof max === "number" && Number.isFinite(max);
  if (!hasMin && !hasMax) return null;
  if (hasMin && hasMax)
    return `${min!.toLocaleString(ar)} – ${max!.toLocaleString(ar)} ج`;
  if (hasMin) return `من ${min!.toLocaleString(ar)} ج`;
  return `حتى ${max!.toLocaleString(ar)} ج`;
}

// ----------------------------------------------------------------------------
// Dates
// ----------------------------------------------------------------------------

/**
 * Long Arabic date. Used when a single date is shown in isolation and
 * we want maximum readability:
 *   formatDate("2026-05-14")  -> "الخميس ١٤ مايو ٢٠٢٦"
 *   formatDate(null)          -> "—"
 *
 * Pass `{ withWeekday: false }` to drop the weekday (smaller chip).
 */
export function formatDate(
  value: string | Date | null | undefined,
  opts: { withWeekday?: boolean } = {},
): string {
  if (value === null || value === undefined) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(ar, {
    weekday: opts.withWeekday === false ? undefined : "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Compact Arabic date, suitable for dense tables:
 *   formatDateShort("2026-05-14")  -> "١٤ مايو ٢٠٢٦"
 */
export function formatDateShort(
  value: string | Date | null | undefined,
): string {
  return formatDate(value, { withWeekday: false });
}

/**
 * Date range, used in leave requests + contracts.
 *   formatDateRange("2026-05-14", "2026-05-20")
 *     -> "من ١٤ مايو إلى ٢٠ مايو ٢٠٢٦"
 */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start || !end) return formatDate(start ?? end);
  return `من ${formatDateShort(start)} إلى ${formatDateShort(end)}`;
}

// ----------------------------------------------------------------------------
// Numbers
// ----------------------------------------------------------------------------

/**
 * Display an integer count in Arabic-Indic digits, e.g. for "5 موظفين"
 * → "٥ موظفين". Avoids the Latin-vs-Indic mismatch where one number
 * on the page comes from `toLocaleString("ar-EG")` and another from
 * `${array.length}`.
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  return value.toLocaleString(ar);
}
