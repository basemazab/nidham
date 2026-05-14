// Egyptian payroll calculation engine
// Compliant with Law 12/2003 + 148/2019 + 2024-2025 income tax brackets
// Sources: ETA (Egyptian Tax Authority) + NOSI (National Organization for Social Insurance)

// ============================================================================
// CONSTANTS
// ============================================================================

/** Social insurance employee contribution rate (الجزء الذي يخصم من الموظف) */
export const SOCIAL_INSURANCE_RATE = 0.14; // 14%

/**
 * Maximum insurable wage per month (2024-2025).
 * Updated annually by NOSI. Confirm with the latest decree before each
 * fiscal year — but as of 2024 it's around 12,600 EGP.
 */
export const MAX_INSURABLE_WAGE = 12600;

/**
 * Personal exemption — first slice of annual income that is fully exempt
 * from income tax. As of 2024 = 20,000 EGP/year (about 1,666 EGP/month).
 */
export const PERSONAL_EXEMPTION = 20000;

/**
 * Egyptian income tax brackets (annual, after personal exemption).
 * Updated 2024 per Law 175 of 2023.
 * Each bracket = [upper bound, rate]. The last bracket has Infinity.
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
 */
export function calculateAnnualIncomeTax(
  annualGrossTaxable: number,
  brackets: Array<[number, number]> = TAX_BRACKETS_2024,
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
 * Capped at the max insurable wage.
 */
export function calculateSocialInsurance(monthlyGross: number): number {
  const insurableWage = Math.min(monthlyGross, MAX_INSURABLE_WAGE);
  return Math.round(insurableWage * SOCIAL_INSURANCE_RATE * 100) / 100;
}

// ============================================================================
// FULL PAYROLL CALCULATION
// ============================================================================

export type AttendanceBreakdown = {
  attended: number;   // أيام حضور كاملة
  halfDay: number;    // أيام نصف يوم
  leave: number;      // أيام إجازة (مدفوعة الأجر)
  absent: number;     // أيام غياب بدون أجر
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
  overtime?: number;           // قيمة الـ overtime
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

export function calculatePayroll(
  salary: SalaryStructure,
  attendance: AttendanceBreakdown,
  workingDays = 22,
  settings: PayrollSettings = {},
): PayrollResult {
  // 1. Effective attended days (paid days)
  const effectiveAttended =
    attendance.attended +
    attendance.halfDay * 0.5 +
    attendance.leave; // paid leave counts as worked

  // 2. Base monthly compensation (before attendance adjustment)
  const incentiveAllowance = salary.incentiveAllowance ?? 0;
  const monthlyBase =
    salary.basicSalary +
    salary.housingAllowance +
    salary.transportAllowance +
    salary.otherAllowances +
    incentiveAllowance;

  // 3. Daily rate
  const dailyRate = monthlyBase / workingDays;

  // 4a. Absence deduction (only for unpaid absences)
  const absenceDeduction =
    Math.round(attendance.absent * dailyRate * 100) / 100;

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
  const bonuses = salary.bonuses ?? 0;
  const overtime = salary.overtime ?? 0;
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
