// ============================================================================
// End-of-service gratuity calculator (مكافأة نهاية الخدمة)
// ============================================================================
//
// Pure function library — no I/O, fully unit-testable.
//
// Egyptian Labor Law 12/2003, Article 122:
//   - 0.5 month of LAST basic monthly salary per year for the first 5 years
//   - 1 full month of last basic monthly salary per year AFTER the first 5
//   - Fractional years are pro-rated by completed full months
//
// Examples:
//   3 years service, basic 5000  → 3 × 0.5 × 5000 = 7,500
//   7 years service, basic 8000  → (5×0.5 + 2×1) × 8000 = 4.5 × 8000 = 36,000
//   10y 6m service, basic 10000  → (5×0.5 + 5.5×1) × 10000 = 8 × 10000 = 80,000
//
// Caveats (not enforced in this calculator):
//   - Gratuity ONLY applies if employer terminates WITHOUT just cause, or
//     employee resigns with proper notice. Termination for gross misconduct
//     (Art 69) forfeits the gratuity. HR judgment call.
//   - Some companies pay 1 month per year throughout, regardless of tenure.
//     That's their internal policy, not the law's floor — display it
//     separately as "policy override" if needed.

export type EosBreakdownRow = {
  yearNumber: number;            // 1-indexed
  fractionOfMonth: 0.5 | 1;      // 0.5 for first 5 years, 1 thereafter
  monthsEarned: number;          // fractionOfMonth × yearsInThisBucket
  basicSalary: number;
  amountEgp: number;             // monthsEarned × basicSalary
  note?: string;
};

export type EosCalculation = {
  totalYears: number;            // floor(months/12)
  totalMonths: number;           // calendar months from hire → termination
  yearsCompleted: number;        // integer years
  monthsBeyondLastFullYear: number;
  totalMonthsEarned: number;     // sum of fractional months of salary
  totalAmountEgp: number;        // final gratuity figure
  breakdown: EosBreakdownRow[];
  basicSalary: number;
};

/** Sentinel error for J6: termination-before-hire silently returned 0,
 *  which let the UI display an "EOS = 0 EGP" certificate without HR
 *  noticing the input was nonsense. Now the caller can branch on this. */
export class EosInvalidDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EosInvalidDateError";
  }
}

/**
 * Compute completed months between two ISO dates.
 * Treats partial months by calendar — e.g. 2020-01-15 → 2025-01-14 = 59 months.
 *
 * Throws EosInvalidDateError when the inputs are nonsensical (termination
 * before hire, unparseable strings). The previous "return 0 silently"
 * masked the real bug.
 */
function completedMonths(from: string, to: string): number {
  const a = new Date(from + (from.length === 10 ? "T00:00:00" : ""));
  const b = new Date(to + (to.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    throw new EosInvalidDateError(
      "تواريخ غير صحيحة — تأكد من صيغة التعيين والإنهاء",
    );
  }
  if (b < a) {
    throw new EosInvalidDateError(
      "تاريخ الإنهاء أقدم من تاريخ التعيين — راجع البيانات",
    );
  }
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Calculate end-of-service gratuity per Article 122 of Egyptian Labor
 * Law 12/2003.
 *
 * @param hireDate            ISO date of hire (YYYY-MM-DD)
 * @param terminationDate     ISO date of termination (YYYY-MM-DD)
 * @param basicSalary         Last basic monthly salary in EGP
 */
export function calculateEosGratuity(
  hireDate: string,
  terminationDate: string,
  basicSalary: number,
): EosCalculation {
  const months = completedMonths(hireDate, terminationDate);
  const yearsCompleted = Math.floor(months / 12);
  const monthsBeyond = months - yearsCompleted * 12;

  const breakdown: EosBreakdownRow[] = [];
  let totalMonthsEarned = 0;

  // First 5 years (or fewer if employee served < 5 years), at 0.5 months
  const yearsInFirstBucket = Math.min(yearsCompleted, 5);
  for (let y = 1; y <= yearsInFirstBucket; y++) {
    breakdown.push({
      yearNumber: y,
      fractionOfMonth: 0.5,
      monthsEarned: 0.5,
      basicSalary,
      amountEgp: basicSalary * 0.5,
      note: y === 1 ? "نصف شهر للسنوات الخمس الأولى (مادة 122)" : undefined,
    });
    totalMonthsEarned += 0.5;
  }

  // Years 6 onward, at 1 month each
  if (yearsCompleted > 5) {
    for (let y = 6; y <= yearsCompleted; y++) {
      breakdown.push({
        yearNumber: y,
        fractionOfMonth: 1,
        monthsEarned: 1,
        basicSalary,
        amountEgp: basicSalary,
        note: y === 6 ? "شهر كامل عن كل سنة بعد الخمس الأولى" : undefined,
      });
      totalMonthsEarned += 1;
    }
  }

  // Pro-rate the partial final year by completed months
  if (monthsBeyond > 0) {
    const nextYearNumber = yearsCompleted + 1;
    const fraction = nextYearNumber <= 5 ? 0.5 : 1;
    const partial = (monthsBeyond / 12) * fraction;
    breakdown.push({
      yearNumber: nextYearNumber,
      fractionOfMonth: fraction,
      monthsEarned: partial,
      basicSalary,
      amountEgp: basicSalary * partial,
      note: `${monthsBeyond} شهر من السنة رقم ${nextYearNumber} (متناسبة)`,
    });
    totalMonthsEarned += partial;
  }

  const totalAmountEgp = totalMonthsEarned * basicSalary;

  return {
    totalYears: yearsCompleted,
    totalMonths: months,
    yearsCompleted,
    monthsBeyondLastFullYear: monthsBeyond,
    totalMonthsEarned,
    totalAmountEgp: Math.round(totalAmountEgp * 100) / 100,
    breakdown,
    basicSalary,
  };
}
