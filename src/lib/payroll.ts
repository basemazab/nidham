// Egyptian payroll calculation engine
// Compliant with Law 12/2003 + 148/2019 + 2026 income tax brackets + 2026
// social insurance limits.
//
// Sources for 2026 values:
//   - Tax brackets:    Law 175/2023 progressive table (PwC Egypt Tax
//                      Summaries 2026, KPMG Egypt rate table, Andersen
//                      Egypt commentary).
//   - SI rates & caps: NOSI (National Organization for Social Insurance)
//                      decree effective 1 Jan 2026 — min insurable wage
//                      EGP 2,700, max EGP 16,700.
//                      Employee share 11%, employer share 18.75%
//                      (https://mercans.com/.../insurable-wage-2026).
//
// Audit reference: PRODUCTION_READINESS_AUDIT.md §2.1 + §2.2 flagged
// the previous 2024 values as a 🔴 blocker — moving them here is a
// payroll-correctness fix, not a feature change.

// ============================================================================
// SOCIAL INSURANCE CONSTANTS
// ============================================================================

/**
 * Employee's share of social insurance (الجزء الذي يخصم من الموظف).
 *
 * 11% of the insurable wage. Confirmed against the 2026 NOSI decree.
 * Was 14% in the codebase until 2026-05-18; the bump to 11% is the
 * correct rate per Law 148/2019 as currently enforced.
 */
export const SOCIAL_INSURANCE_RATE = 0.11; // 11% — employee share

/**
 * Employer's share of social insurance. Not deducted from the employee —
 * it's a separate cost line for the company. Exposed here so future cost-
 * of-employment reports (Total Employee Cost) can pick it up without
 * hard-coding the number again.
 */
export const EMPLOYER_SOCIAL_INSURANCE_RATE = 0.1875; // 18.75% — employer share

/**
 * Maximum insurable wage per month (NOSI decree, effective 1 Jan 2026).
 * Any income above this is NOT subject to social insurance.
 * Was 12,600 EGP until the 2026 update.
 */
export const MAX_INSURABLE_WAGE = 16700;

/**
 * Minimum insurable wage per month (NOSI decree, effective 1 Jan 2026).
 * Even if a worker's salary is below this, SI is computed on the floor —
 * the insurance fund must receive at least the minimum contribution.
 *
 * In practice rare in Egypt: the statutory minimum wage for the private
 * sector is well above 2,700 EGP. We still honor it for correctness.
 */
export const MIN_INSURABLE_WAGE = 2700;

// ============================================================================
// INCOME TAX CONSTANTS
// ============================================================================

/**
 * Personal exemption — first slice of annual income fully exempt from
 * income tax. Egyptian Tax Authority confirms 20,000 EGP/yr for 2026
 * (unchanged from 2024).
 */
export const PERSONAL_EXEMPTION = 20000;

/**
 * Egyptian income tax brackets for 2026 (annual, after personal exemption).
 *
 * Major change from prior years: the FIRST 40k after the personal
 * exemption is now 0% (was 10% under the 2024 schedule). Subsequent
 * brackets shifted up so the top rate of 27.5% only applies above
 * EGP 1,200,000 (was 400,000).
 *
 * Each entry = [upper bound, rate]. The last entry has Infinity.
 *
 * Worked example for an employee on 100k/year:
 *   1. After PE: 100,000 − 20,000 = 80,000 taxable
 *   2. 40,000 in the 0% bracket  → 0 EGP
 *   3. 15,000 in the 10% bracket → 1,500
 *   4. 15,000 in the 15% bracket → 2,250
 *   5. 10,000 in the 20% bracket → 2,000
 *   → 5,750 EGP annual tax
 */
export const TAX_BRACKETS_2026: Array<[number, number]> = [
  [40_000,   0.0],   //       0 – 40k    → 0%
  [55_000,   0.10],  //   40k – 55k    → 10%
  [70_000,   0.15],  //   55k – 70k    → 15%
  [200_000,  0.20],  //   70k – 200k   → 20%
  [400_000,  0.225], //  200k – 400k   → 22.5%
  [1_200_000, 0.25], //  400k – 1.2M   → 25%
  [Number.POSITIVE_INFINITY, 0.275], // 1.2M+ → 27.5%
];

/**
 * Egyptian income tax brackets PRIOR to 2026 (Law 175/2023 first table).
 * Kept exported so tax certificates for tax years 2024-2025 can still be
 * recomputed against the historically-correct schedule. Pass explicitly
 * to `calculateAnnualIncomeTax(income, TAX_BRACKETS_2024)` when doing
 * back-fills; the default is now TAX_BRACKETS_2026.
 */
export const TAX_BRACKETS_2024: Array<[number, number]> = [
  [40000, 0.1], // 0 - 40k → 10%
  [55000, 0.15], // 40k - 55k → 15%
  [70000, 0.2], // 55k - 70k → 20%
  [200000, 0.225], // 70k - 200k → 22.5%
  [400000, 0.25], // 200k - 400k → 25%
  [Number.POSITIVE_INFINITY, 0.275], // 400k+ → 27.5%
];

// ============================================================================
// TAX CALCULATION
// ============================================================================

/**
 * Calculate annual income tax based on Egyptian brackets, after personal
 * exemption. Returns the annual tax owed.
 *
 * Defaults to the 2026 brackets (Law 175/2023 schedule active from
 * 2026-01-01). Pass TAX_BRACKETS_2024 explicitly when re-computing
 * historical tax certificates.
 */
export function calculateAnnualIncomeTax(
  annualGrossTaxable: number,
  brackets: Array<[number, number]> = TAX_BRACKETS_2026,
  personalExemption: number = PERSONAL_EXEMPTION,
): number {
  // Subtract personal exemption first
  let taxable = Math.max(0, annualGrossTaxable - personalExemption);
  let tax = 0;
  let prevBoundary = 0;

  for (const [upper, rate] of brackets) {
    if (taxable <= 0) break;
    const widthOfBracket = upper - prevBoundary;
    const amountInBracket = Math.min(taxable, widthOfBracket);
    tax += amountInBracket * rate;
    taxable -= amountInBracket;
    prevBoundary = upper;
  }

  return Math.max(0, tax);
}

export function calculateMonthlyIncomeTax(monthlyGrossTaxable: number): number {
  return calculateAnnualIncomeTax(monthlyGrossTaxable * 12) / 12;
}

// ============================================================================
// SOCIAL INSURANCE
// ============================================================================

/**
 * Employee's share of social insurance on a given monthly wage.
 *
 * Applies BOTH the floor (MIN_INSURABLE_WAGE) and the ceiling
 * (MAX_INSURABLE_WAGE) per the 2026 NOSI decree:
 *   - Below floor → contribution is still on the floor amount
 *   - Above ceiling → ignored
 *   - Zero or negative → no contribution (treats "no salary" as "no SI")
 *
 * The min/max are reset every January by NOSI; bump the constants when
 * the new decree drops.
 */
export function calculateSocialInsurance(monthlyGross: number): number {
  if (monthlyGross <= 0) return 0;
  const insurableWage = Math.max(
    MIN_INSURABLE_WAGE,
    Math.min(monthlyGross, MAX_INSURABLE_WAGE),
  );
  return Math.round(insurableWage * SOCIAL_INSURANCE_RATE * 100) / 100;
}

/**
 * Employer's social insurance contribution for the same wage. Symmetric
 * to the employee's: same min/max bounds, different rate.
 *
 * Not currently subtracted from anything — this is a separate company
 * cost. Use it when building "Total Employee Cost" reports or when
 * exporting NOSI submission files (نموذج 2 المنشأة).
 */
export function calculateEmployerSocialInsurance(monthlyGross: number): number {
  if (monthlyGross <= 0) return 0;
  const insurableWage = Math.max(
    MIN_INSURABLE_WAGE,
    Math.min(monthlyGross, MAX_INSURABLE_WAGE),
  );
  return Math.round(insurableWage * EMPLOYER_SOCIAL_INSURANCE_RATE * 100) / 100;
}

// ============================================================================
// MID-CYCLE PRO-RATION — hires + terminations
// ============================================================================
//
// If an employee was hired (or terminated) inside a payroll cycle, they
// shouldn't get the full monthly salary — only the fraction of the cycle
// they were actually employed.
//
// The factor is computed in CALENDAR days, not working days, because
// the salary covers calendar days (Fridays included in the monthly
// figure). Working-day math comes later when applying absence deductions.
//
// Edge cases handled:
//   - Hired AFTER period end           → factor 0 (no salary)
//   - Terminated BEFORE period start    → factor 0
//   - Hire on period.start              → factor 1 (full cycle)
//   - Termination on period.end         → factor 1 (also full cycle —
//                                          last day is worked)
//   - Hired AND terminated inside       → days between (inclusive)

/**
 * Compute the pro-ration factor (0..1) for an employee against a payroll
 * cycle. The caller multiplies the monthly base by this factor when the
 * factor is less than 1 (typical case: mid-month hire or termination).
 *
 * All dates are ISO `YYYY-MM-DD` strings. The function is timezone-safe
 * because it parses dates at midnight UTC.
 */
export function calculateProRationFactor(input: {
  periodStart: string;            // ISO date, e.g. "2026-01-01"
  periodEnd: string;               // ISO date, e.g. "2026-01-31"
  hireDate?: string | null;        // ISO date or null/undefined
  terminationDate?: string | null; // ISO date or null/undefined
}): number {
  const startMs = parseIsoDay(input.periodStart);
  const endMs = parseIsoDay(input.periodEnd);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return 0;
  }

  const hireMs = input.hireDate ? parseIsoDay(input.hireDate) : null;
  const termMs = input.terminationDate
    ? parseIsoDay(input.terminationDate)
    : null;

  // Outside the period entirely → no salary
  if (hireMs !== null && hireMs > endMs) return 0;
  if (termMs !== null && termMs < startMs) return 0;

  // Effective employment window inside the period
  const effectiveStart = hireMs !== null && hireMs > startMs ? hireMs : startMs;
  const effectiveEnd = termMs !== null && termMs < endMs ? termMs : endMs;

  if (effectiveEnd < effectiveStart) return 0;

  // +1 because both endpoints are inclusive (a hire on the period start
  // gets the full period; a hire on day 15 of a 30-day month gets 16
  // days = 16/30 of salary).
  const DAY_MS = 86_400_000;
  const periodDays = Math.round((endMs - startMs) / DAY_MS) + 1;
  const effectiveDays = Math.round((effectiveEnd - effectiveStart) / DAY_MS) + 1;

  if (periodDays <= 0) return 0;
  // Clamp to [0, 1] defensively.
  return Math.max(0, Math.min(1, effectiveDays / periodDays));
}

function clampProRationFactor(factor: number | undefined): number {
  if (factor === undefined || factor === null || !Number.isFinite(factor)) {
    return 1;
  }
  if (factor < 0) return 0;
  if (factor > 1) return 1;
  return factor;
}

function parseIsoDay(iso: string): number {
  // "2026-01-15" → ms at UTC midnight. We avoid `new Date(iso)` because
  // it interprets bare YYYY-MM-DD as UTC in modern engines but locally
  // in older ones — explicit parse keeps it deterministic.
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}


// ============================================================================
// OVERTIME — Egyptian Labor Law Article 85
// ============================================================================
//
// Three legally-mandated overtime multipliers:
//
//   Daytime           ×1.35  (+35% premium)
//   Nighttime         ×1.70  (+70% premium)   defined as 7pm–7am
//   Rest day / holiday ×2.00 (+100% premium)
//
// These apply to the NORMAL hourly wage, which for a monthly-salaried
// employee = basic_salary / 26 / 8 hours = basic_salary / 208.

export const OVERTIME_RATE_DAY = 1.35;
export const OVERTIME_RATE_NIGHT = 1.7;
export const OVERTIME_RATE_REST = 2.0;

/**
 * Compute the normal hourly wage for a monthly-salaried employee.
 *
 * basic_salary / (workingDays × workdayHours)
 *
 * Defaults to 26 working days × 8 hours = 208 hours/month (Egyptian
 * Labour Code office-work assumption).
 */
export function calculateHourlyRate(
  basicSalary: number,
  workingDays: number = 26,
  workdayHours: number = 8,
): number {
  if (basicSalary <= 0 || workingDays <= 0 || workdayHours <= 0) return 0;
  return (
    Math.round((basicSalary / workingDays / workdayHours) * 10000) / 10000
  );
}

/**
 * Total overtime pay for one payroll cycle, given the hours worked in
 * each category. The caller passes the employee's normal hourly wage —
 * we don't recompute it here because the source depends on the worker's
 * pay frequency (monthly → basic/208, hourly → hourly_rate, daily →
 * daily_rate/8).
 *
 * Returns the additional pay (already multiplied), rounded to piastres.
 */
export function calculateOvertimePay(
  hourlyRate: number,
  hours: {
    day?: number;
    night?: number;
    rest?: number;
  },
): number {
  if (hourlyRate <= 0) return 0;
  const dayPay = (hours.day ?? 0) * hourlyRate * OVERTIME_RATE_DAY;
  const nightPay = (hours.night ?? 0) * hourlyRate * OVERTIME_RATE_NIGHT;
  const restPay = (hours.rest ?? 0) * hourlyRate * OVERTIME_RATE_REST;
  const total = dayPay + nightPay + restPay;
  return Math.round(total * 100) / 100;
}


// ============================================================================
// EMPLOYEE-CATEGORY-SPECIFIC HELPERS
// ============================================================================
//
// Egyptian SMBs run four payment models side-by-side. The flat
// calculatePayroll() at the bottom of this file handles monthly + weekly
// + daily (with `workingDays` as the divisor / multiplier knob). Hourly
// is structurally different — it pays per actual hour and gates a
// conditional transport allowance on a min-hours-per-day threshold — so
// it gets its own dedicated entry point.

/**
 * Daily wage for a daily-paid worker. The "salary" concept doesn't apply
 * here — they get `daily_rate × attended_days`, period. No deductions for
 * absent days (because there's no base salary to deduct from).
 *
 * Returns just the wage; the caller adds allowances, taxes, etc.
 */
export function calculateDailyWage(
  dailyRate: number,
  attendedDays: number,
  halfDays: number = 0,
): number {
  const effectiveDays = attendedDays + halfDays * 0.5;
  return Math.round(dailyRate * effectiveDays * 100) / 100;
}

/**
 * Hourly wage with conditional transport allowance.
 *
 * `transportAllowance` is paid PER DAY if the worker hit
 * `transportThresholdHours` on that day (typical at Al-Ittihad: 4-6 hours).
 * If `transportThresholdHours` is undefined, the allowance is paid
 * unconditionally for every day the worker showed up.
 *
 * Inputs:
 *   hourlyRate          — wage per hour
 *   hoursWorked         — total hours across the period
 *   daysWorked          — count of distinct days the worker showed up
 *   transportAllowance  — daily transport allowance amount
 *   transportThresholdHours? — min hours/day to earn the allowance
 *   eligibleDays?       — count of days the worker hit the threshold
 *                         (caller computes this from the attendance log)
 */
export function calculateHourlyWage(input: {
  hourlyRate: number;
  hoursWorked: number;
  daysWorked: number;
  transportAllowance?: number;
  transportThresholdHours?: number;
  eligibleDays?: number;
}): { baseWage: number; transportTotal: number; total: number } {
  const baseWage =
    Math.round(input.hourlyRate * input.hoursWorked * 100) / 100;

  const transport = input.transportAllowance ?? 0;
  // If a threshold is set, use the eligibleDays count the caller supplied;
  // otherwise pay transport for every day worked.
  const transportDays =
    input.transportThresholdHours === undefined
      ? input.daysWorked
      : (input.eligibleDays ?? 0);
  const transportTotal =
    Math.round(transport * transportDays * 100) / 100;

  return {
    baseWage,
    transportTotal,
    total: Math.round((baseWage + transportTotal) * 100) / 100,
  };
}


// ============================================================================
// FULL PAYROLL CALCULATION
// ============================================================================

export type AttendanceBreakdown = {
  attended: number;   // أيام حضور كاملة
  halfDay: number;    // أيام نصف يوم
  leave: number;      // أيام إجازة مدفوعة (annual / casual / public holiday)
  absent: number;     // أيام غياب بدون عذر
  /**
   * إجازة بدون مرتب — counted as days NOT paid, just like `absent`.
   * Kept in its own bucket so reports + audits can distinguish a
   * deliberate unpaid leave (approved by HR) from a no-show absence.
   */
  unpaidLeave?: number;
  /** Sum of tardiness_minutes across the period. Default 0. */
  tardinessMinutes?: number;
  /** Sum of early_leave_minutes across the period. Default 0. */
  earlyLeaveMinutes?: number;
};

/**
 * Minutes in a single workday. Used to convert tardiness + early-leave
 * minutes into a fractional-day deduction. 480 = 8h, the Egyptian
 * Labour Code standard for office work.
 */
export const WORKDAY_MINUTES = 480;

export type SalaryStructure = {
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  incentiveAllowance?: number; // حافز -- recurring monthly incentive
  bonuses?: number;            // مكافآت لمرة واحدة (هذا الشهر)
  /**
   * Raw overtime amount in EGP. Used as a FALLBACK when the per-hour
   * breakdown below isn't populated (e.g. legacy entries from before
   * migration 052, or HR manually overriding the calculation).
   */
  overtime?: number;
  /**
   * Egyptian Labor Law Art. 85 overtime hours, broken down by category.
   * When ANY of these is non-zero, calculatePayroll computes the overtime
   * pay using the legally-mandated multipliers (1.35 / 1.7 / 2.0) and
   * IGNORES the raw `overtime` field.
   */
  overtimeHoursDay?: number;
  overtimeHoursNight?: number;
  overtimeHoursRest?: number;
  loanDeduction?: number;      // قسط قرض
  otherDeductions?: number;    // خصومات إضافية
};

// Per-company toggles for the two auto-applied statutory deductions.
// Default: both off, matching the reality that most Egyptian SMBs
// don't formally file social-insurance / income-tax monthly. The
// company can switch them on from /dashboard/payroll/settings once
// they're ready to comply.
export type PayrollSettings = {
  socialInsuranceEnabled?: boolean;
  incomeTaxEnabled?: boolean;
  /**
   * Pro-ration factor in (0, 1]. Set to < 1 when the employee was hired
   * or terminated inside the payroll cycle so only that fraction of the
   * monthly base is paid. Default 1.0 (full salary).
   *
   * Use `calculateProRationFactor(...)` to derive this from hire_date,
   * termination_date, and the period dates.
   */
  proRationFactor?: number;
};

export type PayrollResult = {
  // Earnings
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  incentiveAllowance: number;
  bonuses: number;
  overtime: number;
  grossSalary: number;

  // Attendance
  workingDays: number;
  attendedDays: number;     // effective: attended + halfDay*0.5 + leave
  absentDays: number;

  // Deductions
  absenceDeduction: number;
  socialInsurance: number;
  incomeTax: number;
  loanDeduction: number;
  otherDeductions: number;
  /** Deduction for tardiness + early-leave (minutes -> fractional day). */
  tardinessDeduction: number;
  totalDeductions: number;

  // Result
  netSalary: number;
};

/**
 * Calculate monthly payroll for an Egyptian employee.
 *
 * `workingDays` defaults to **26** — the Egyptian standard for monthly
 * salaried employees. The reasoning: a 30-day month has ~4 Fridays
 * (weekly rest day), so 30 − 4 = 26 working days. The daily rate is
 * therefore `monthly_salary / 26`, NOT `monthly_salary / 30` and NOT
 * `monthly_salary / 22` (which was an earlier mistake that under-paid
 * the daily rate by ~18% — every absence deduction was over-stated by
 * roughly that fraction).
 *
 * Override `workingDays` per period when:
 *   - The month genuinely has 5 Fridays (some Septembers) → pass 25
 *   - Weekly-paid employees → pass 6
 *   - Daily-rate workers → pass the actual attendance days
 */
export function calculatePayroll(
  salary: SalaryStructure,
  attendance: AttendanceBreakdown,
  workingDays = 26,
  settings: PayrollSettings = {},
): PayrollResult {
  // 1. Effective attended days (paid days)
  const effectiveAttended =
    attendance.attended +
    attendance.halfDay * 0.5 +
    attendance.leave; // paid leave counts as worked

  // 2. Base monthly compensation (before attendance adjustment).
  //    Apply pro-ration first so subsequent absence / tardy deductions
  //    work on the pro-rated base — an employee who started mid-month
  //    AND missed a day shouldn't get double-clipped.
  const incentiveAllowance = salary.incentiveAllowance ?? 0;
  const proRationFactor = clampProRationFactor(settings.proRationFactor);
  const fullMonthlyBase =
    salary.basicSalary +
    salary.housingAllowance +
    salary.transportAllowance +
    salary.otherAllowances +
    incentiveAllowance;
  const monthlyBase =
    Math.round(fullMonthlyBase * proRationFactor * 100) / 100;

  // 3. Daily rate
  const dailyRate = monthlyBase / workingDays;

  // 4a. Absence deduction. Two buckets contribute:
  //       absent       — unexcused no-show
  //       unpaidLeave  — pre-approved إجازة بدون مرتب
  //     Both get deducted at the daily rate. (Paid leave + sick leave
  //     don't show up here — they're counted as worked in `leave`.)
  const unpaidLeave = attendance.unpaidLeave ?? 0;
  const unpaidDays = attendance.absent + unpaidLeave;
  const absenceDeduction =
    Math.round(unpaidDays * dailyRate * 100) / 100;

  // 4b. Tardiness + early-leave deduction. The minutes captured in
  //     attendance.tardiness_minutes / early_leave_minutes get converted
  //     to a fractional-day deduction at the per-minute rate.
  //     per_minute = dailyRate / 480 (8h workday).
  const tardyMins =
    (attendance.tardinessMinutes ?? 0) +
    (attendance.earlyLeaveMinutes ?? 0);
  const tardinessDeduction =
    Math.round((tardyMins * (dailyRate / WORKDAY_MINUTES)) * 100) / 100;

  // 5. Gross = base + bonuses + overtime - absence - tardiness
  //
  // Overtime resolution order:
  //   a) If any of overtimeHours{Day,Night,Rest} is set → compute from
  //      hours using Egyptian Labor Law Art. 85 multipliers (×1.35, ×1.7,
  //      ×2.0) on the hourly wage derived from basicSalary.
  //   b) Otherwise fall back to the raw `overtime` money amount (legacy
  //      path — kept so entries created before migration 052 still work).
  const bonuses = salary.bonuses ?? 0;
  const otHours = {
    day: salary.overtimeHoursDay ?? 0,
    night: salary.overtimeHoursNight ?? 0,
    rest: salary.overtimeHoursRest ?? 0,
  };
  const hasHourBreakdown = otHours.day > 0 || otHours.night > 0 || otHours.rest > 0;
  const overtime = hasHourBreakdown
    ? calculateOvertimePay(
        calculateHourlyRate(salary.basicSalary, workingDays),
        otHours,
      )
    : (salary.overtime ?? 0);
  const grossSalary =
    monthlyBase + bonuses + overtime - absenceDeduction - tardinessDeduction;

  // 6. Social insurance (on insurable wage, capped) -- opt-in per company.
  //    Most SMBs don't file with NOSI; default off keeps net = gross.
  const socialInsurance = settings.socialInsuranceEnabled
    ? calculateSocialInsurance(grossSalary)
    : 0;

  // 7. Income tax on taxable income (gross - social insurance) -- opt-in.
  //    Default off matches the cash-paid pattern of most Egyptian SMBs.
  const incomeTax = settings.incomeTaxEnabled
    ? Math.round(
        calculateMonthlyIncomeTax(Math.max(0, grossSalary - socialInsurance)) *
          100,
      ) / 100
    : 0;

  // 8. Other deductions
  const loanDeduction = salary.loanDeduction ?? 0;
  const otherDeductions = salary.otherDeductions ?? 0;

  // 9. Total deductions + net
  const totalDeductions =
    Math.round(
      (absenceDeduction +
        tardinessDeduction +
        socialInsurance +
        incomeTax +
        loanDeduction +
        otherDeductions) *
        100,
    ) / 100;

  const netSalary =
    Math.round(
      (monthlyBase + bonuses + overtime - totalDeductions) * 100,
    ) / 100;

  return {
    basicSalary: salary.basicSalary,
    housingAllowance: salary.housingAllowance,
    transportAllowance: salary.transportAllowance,
    otherAllowances: salary.otherAllowances,
    incentiveAllowance,
    bonuses,
    overtime,
    grossSalary,

    workingDays,
    attendedDays: Math.round(effectiveAttended * 10) / 10,
    absentDays: attendance.absent,

    absenceDeduction,
    socialInsurance,
    incomeTax,
    loanDeduction,
    otherDeductions,
    tardinessDeduction,
    totalDeductions,

    netSalary,
  };
}

// ============================================================================
// HELPER: Format currency in Arabic
// ============================================================================
// Payroll context always wants 2 decimals (payslips read down to the
// piastre). General-purpose currency formatting lives in lib/format.ts.

import { formatEGP as baseFormatEGP } from "./format";

export function formatEGP(value: number): string {
  return baseFormatEGP(value, true);
}
