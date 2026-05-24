// ============================================================================
// Unit tests — src/lib/payroll.ts
// ============================================================================
//
// Egyptian payroll math is the single most consequential piece of code in the
// product: a 0.5% mistake here means every employee at every customer is
// getting paid wrong, every month. Test paranoidly.
//
// Source of truth (effective 2026):
//   - Law 175/2023 income tax brackets — with the 0% slice on the first
//     40k after personal exemption (PwC Egypt + KPMG + Andersen confirm).
//   - Law 148/2019 social insurance — employee share 11%, employer share
//     18.75%. NOSI 2026 decree: min insurable wage 2,700, max 16,700.
//   - Annual personal exemption: 20,000 EGP (unchanged from 2024).

import { describe, it, expect } from "vitest";
import {
  calculateAnnualIncomeTax,
  calculateMonthlyIncomeTax,
  calculateSocialInsurance,
  calculateEmployerSocialInsurance,
  calculatePayroll,
  calculateDailyWage,
  calculateHourlyWage,
  calculateHourlyRate,
  calculateOvertimePay,
  calculateProRationFactor,
  OVERTIME_RATE_DAY,
  OVERTIME_RATE_NIGHT,
  OVERTIME_RATE_REST,
  SOCIAL_INSURANCE_RATE,
  EMPLOYER_SOCIAL_INSURANCE_RATE,
  MAX_INSURABLE_WAGE,
  MIN_INSURABLE_WAGE,
  PERSONAL_EXEMPTION,
  TAX_BRACKETS_2024,
  TAX_BRACKETS_2026,
} from "./payroll";

describe("calculateAnnualIncomeTax — 2026 brackets (default)", () => {
  it("returns 0 when income falls entirely within the personal exemption", () => {
    expect(calculateAnnualIncomeTax(0)).toBe(0);
    expect(calculateAnnualIncomeTax(PERSONAL_EXEMPTION)).toBe(0);
    expect(calculateAnnualIncomeTax(PERSONAL_EXEMPTION - 1)).toBe(0);
  });

  it("applies 0% to the first 40k taxable slice (the new 2026 zero bracket)", () => {
    // 60,000 gross − 20,000 PE = 40,000 taxable in the 0% bracket.
    // Was 4,000 under TAX_BRACKETS_2024; now 0 under the 2026 schedule.
    expect(calculateAnnualIncomeTax(60_000)).toBe(0);
  });

  it("crosses the 0% → 10% boundary at 60k income (40k taxable)", () => {
    // 70,000 gross − 20,000 PE = 50,000 taxable
    //   40,000 @ 0%  = 0
    //   10,000 @ 10% = 1,000
    // → 1,000
    expect(calculateAnnualIncomeTax(70_000)).toBe(1_000);
  });

  it("walks across the 10% → 15% boundary correctly", () => {
    // 80,000 gross − 20,000 PE = 60,000 taxable
    //   40,000 @ 0%  =     0   (0 → 40k)
    //   15,000 @ 10% = 1,500   (40k → 55k)
    //    5,000 @ 15% =   750   (55k → 70k)
    // → 2,250
    expect(calculateAnnualIncomeTax(80_000)).toBe(2_250);
  });

  it("respects all brackets for a very high earner", () => {
    // 500,000 gross − 20,000 PE = 480,000 taxable
    //   40,000 @ 0%    =     0   (0 → 40k)
    //   15,000 @ 10%   = 1,500   (40k → 55k)
    //   15,000 @ 15%   = 2,250   (55k → 70k)
    //  130,000 @ 20%   = 26,000  (70k → 200k)
    //  200,000 @ 22.5% = 45,000  (200k → 400k)
    //   80,000 @ 25%   = 20,000  (400k → 480k)
    // → 94,750
    expect(calculateAnnualIncomeTax(500_000)).toBeCloseTo(94_750, 2);
  });

  it("hits the top 27.5% bracket only above 1.22M income (1.2M taxable)", () => {
    // 1,500,000 gross − 20,000 PE = 1,480,000 taxable
    //   40,000 @ 0%    =       0
    //   15,000 @ 10%   =   1,500
    //   15,000 @ 15%   =   2,250
    //  130,000 @ 20%   =  26,000
    //  200,000 @ 22.5% =  45,000
    //  800,000 @ 25%   = 200,000  (400k → 1.2M)
    //  280,000 @ 27.5% =  77,000  (1.2M → 1.48M)
    // → 351,750
    expect(calculateAnnualIncomeTax(1_500_000)).toBeCloseTo(351_750, 2);
  });

  it("never returns a negative number for any input", () => {
    expect(calculateAnnualIncomeTax(-50_000)).toBe(0);
    expect(calculateAnnualIncomeTax(-1)).toBe(0);
  });

  it("accepts custom brackets (for future-year overrides or historicals)", () => {
    // Hypothetical: flat 20% above personal exemption
    const flat: Array<[number, number]> = [
      [Number.POSITIVE_INFINITY, 0.2],
    ];
    expect(calculateAnnualIncomeTax(50_000, flat)).toBe(
      (50_000 - PERSONAL_EXEMPTION) * 0.2,
    );
  });

  it("still computes 2024 numbers correctly when passed TAX_BRACKETS_2024", () => {
    // Same example as the 2026 60k test, but with the old schedule:
    // 60,000 − 20,000 PE = 40,000 taxable @ 10% = 4,000.
    expect(calculateAnnualIncomeTax(60_000, TAX_BRACKETS_2024)).toBe(4_000);
  });
});

describe("calculateMonthlyIncomeTax", () => {
  it("divides annual tax by 12 cleanly", () => {
    // Monthly 6,000 → annual 72,000 → after PE 52,000
    //   40,000 @ 0%  = 0
    //   12,000 @ 10% = 1,200
    // → 1,200 / 12 = 100/month
    expect(calculateMonthlyIncomeTax(6_000)).toBeCloseTo(1_200 / 12, 4);
  });

  it("returns 0 when the annualized salary is below the personal exemption", () => {
    // 1,000/mo × 12 = 12,000/yr < 20,000 PE
    expect(calculateMonthlyIncomeTax(1_000)).toBe(0);
  });

  it("returns 0 when annual taxable falls entirely in the 0% bracket", () => {
    // 5,000/mo × 12 = 60,000/yr − 20,000 PE = 40,000 taxable → all 0%
    expect(calculateMonthlyIncomeTax(5_000)).toBe(0);
  });
});

describe("calculateSocialInsurance — 2026 NOSI rates", () => {
  it("charges 11% of the salary when between min and max", () => {
    // 10,000 × 0.11 = 1,100
    expect(calculateSocialInsurance(10_000)).toBe(1_100);
    // 5,000 × 0.11 = 550
    expect(calculateSocialInsurance(5_000)).toBe(550);
  });

  it("caps at the MAX_INSURABLE_WAGE for higher salaries", () => {
    // 20,000 → clamps to 16,700 → × 0.11 = 1,837
    expect(calculateSocialInsurance(20_000)).toBe(
      Math.round(MAX_INSURABLE_WAGE * SOCIAL_INSURANCE_RATE * 100) / 100,
    );
    expect(calculateSocialInsurance(20_000)).toBe(1_837);
  });

  it("applies the MIN_INSURABLE_WAGE floor for very low salaries", () => {
    // Worker earning 1,500 EGP is below the 2,700 NOSI floor;
    // SI is still computed on the floor.
    // 2,700 × 0.11 = 297
    expect(calculateSocialInsurance(1_500)).toBe(297);
    expect(calculateSocialInsurance(MIN_INSURABLE_WAGE)).toBe(297);
  });

  it("equals zero for a zero or negative salary (no contribution if no wage)", () => {
    expect(calculateSocialInsurance(0)).toBe(0);
    expect(calculateSocialInsurance(-100)).toBe(0);
  });

  it("rounds to 2 decimal places (piastres)", () => {
    // 12,345.55 × 0.11 = 1,358.0105 → 1,358.01
    expect(calculateSocialInsurance(12_345.55)).toBe(1_358.01);
  });
});

describe("calculateEmployerSocialInsurance — 18.75% (NOT deducted from employee)", () => {
  it("computes 18.75% of the insurable wage", () => {
    // 10,000 × 0.1875 = 1,875
    expect(calculateEmployerSocialInsurance(10_000)).toBe(1_875);
  });

  it("respects the same MAX_INSURABLE_WAGE cap", () => {
    // 20,000 → 16,700 × 0.1875 = 3,131.25
    expect(calculateEmployerSocialInsurance(20_000)).toBe(
      Math.round(MAX_INSURABLE_WAGE * EMPLOYER_SOCIAL_INSURANCE_RATE * 100) /
        100,
    );
    expect(calculateEmployerSocialInsurance(20_000)).toBe(3_131.25);
  });

  it("respects the MIN_INSURABLE_WAGE floor", () => {
    // 2,700 × 0.1875 = 506.25
    expect(calculateEmployerSocialInsurance(1_000)).toBe(506.25);
  });

  it("equals zero for a zero or negative salary", () => {
    expect(calculateEmployerSocialInsurance(0)).toBe(0);
    expect(calculateEmployerSocialInsurance(-1)).toBe(0);
  });
});

// ============================================================================
// Egyptian divisor: ÷26 is the standard for monthly salaried employees.
// 30-day month minus ~4 Fridays = 26 working days. The codebase previously
// defaulted to ÷22 which under-counted the daily rate by ~18% — every
// absence deduction was over-stated by roughly that fraction.
// ============================================================================
describe("calculatePayroll — Egyptian ÷26 default", () => {
  it("uses 26 working days when the caller omits the parameter", () => {
    // Salary 5,200 with 2 absent days. dailyRate = 5200/26 = 200.
    // Deduction = 2 × 200 = 400. Net = 4,800.
    const result = calculatePayroll(
      {
        basicSalary: 5_200,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
      },
      { attended: 24, halfDay: 0, leave: 0, absent: 2 },
      // no workingDays passed -> defaults to 26
    );
    expect(result.absenceDeduction).toBe(400);
    expect(result.netSalary).toBe(4_800);
  });

  it("matches the worked example from the Egyptian HR reference docs", () => {
    // The reference: 5,200 EGP/mo, dailyRate = 200, 2 days absent → 4,800 net
    // This test pins that exact example so a future regression flags
    // immediately.
    const result = calculatePayroll(
      {
        basicSalary: 5_200,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
      },
      { attended: 24, halfDay: 0, leave: 0, absent: 2 },
    );
    expect(Math.round((5_200 / 26) * 100) / 100).toBe(200);
    expect(result.netSalary).toBe(4_800);
  });

  it("still accepts an explicit override (e.g. 25 for a 5-Friday month)", () => {
    // Some months have 5 Fridays → 25 working days.
    const result = calculatePayroll(
      {
        basicSalary: 5_000,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
      },
      { attended: 24, halfDay: 0, leave: 0, absent: 1 },
      25,
    );
    // dailyRate = 5000/25 = 200; deduction = 200.
    expect(result.absenceDeduction).toBe(200);
    expect(result.netSalary).toBe(4_800);
  });
});

describe("calculateDailyWage — daily-paid workers", () => {
  it("multiplies daily rate by attended days", () => {
    // 250 × 24 days = 6,000
    expect(calculateDailyWage(250, 24)).toBe(6_000);
  });

  it("counts half-days as 0.5", () => {
    // 250 × (22 + 2*0.5) = 250 × 23 = 5,750
    expect(calculateDailyWage(250, 22, 2)).toBe(5_750);
  });

  it("returns 0 when no attendance (no salary to fall back on)", () => {
    expect(calculateDailyWage(250, 0)).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    // 123.45 × 7 = 864.15
    expect(calculateDailyWage(123.45, 7)).toBe(864.15);
  });
});

describe("Mid-cycle pro-ration (hire + termination)", () => {
  const periodStart = "2026-01-01";
  const periodEnd = "2026-01-31"; // 31 days

  it("returns 1.0 when no hire/termination dates are inside the period", () => {
    expect(
      calculateProRationFactor({ periodStart, periodEnd }),
    ).toBe(1);
    expect(
      calculateProRationFactor({
        periodStart,
        periodEnd,
        hireDate: "2024-06-01",       // long before period
        terminationDate: "2030-01-01", // long after period
      }),
    ).toBe(1);
  });

  it("hired on first day of cycle → factor 1.0", () => {
    expect(
      calculateProRationFactor({
        periodStart,
        periodEnd,
        hireDate: periodStart,
      }),
    ).toBe(1);
  });

  it("hired mid-cycle → fractional factor (days from hire to end)", () => {
    // Hired on Jan 16 of a 31-day month → 16 days remaining (incl. day 16)
    // factor = 16/31
    const f = calculateProRationFactor({
      periodStart,
      periodEnd,
      hireDate: "2026-01-16",
    });
    expect(f).toBeCloseTo(16 / 31, 5);
  });

  it("hired AFTER period end → factor 0", () => {
    expect(
      calculateProRationFactor({
        periodStart,
        periodEnd,
        hireDate: "2026-02-01",
      }),
    ).toBe(0);
  });

  it("terminated on last day of cycle → factor 1.0", () => {
    expect(
      calculateProRationFactor({
        periodStart,
        periodEnd,
        terminationDate: periodEnd,
      }),
    ).toBe(1);
  });

  it("terminated mid-cycle → fractional factor", () => {
    // Terminated Jan 10 → 10 days worked → 10/31
    const f = calculateProRationFactor({
      periodStart,
      periodEnd,
      terminationDate: "2026-01-10",
    });
    expect(f).toBeCloseTo(10 / 31, 5);
  });

  it("terminated BEFORE period start → factor 0", () => {
    expect(
      calculateProRationFactor({
        periodStart,
        periodEnd,
        terminationDate: "2025-12-30",
      }),
    ).toBe(0);
  });

  it("hired AND terminated inside the same cycle → days-between factor", () => {
    // Jan 5 through Jan 20 inclusive = 16 days → 16/31
    const f = calculateProRationFactor({
      periodStart,
      periodEnd,
      hireDate: "2026-01-05",
      terminationDate: "2026-01-20",
    });
    expect(f).toBeCloseTo(16 / 31, 5);
  });

  it("clamps invalid factors to [0, 1] inside calculatePayroll", () => {
    // factor below 0 → 0 (no salary)
    const r1 = calculatePayroll(
      { basicSalary: 5_200, housingAllowance: 0, transportAllowance: 0, otherAllowances: 0 },
      { attended: 26, halfDay: 0, leave: 0, absent: 0 },
      26,
      { proRationFactor: -0.5 },
    );
    expect(r1.netSalary).toBe(0);

    // factor above 1 → 1 (full salary, not amplified)
    const r2 = calculatePayroll(
      { basicSalary: 5_200, housingAllowance: 0, transportAllowance: 0, otherAllowances: 0 },
      { attended: 26, halfDay: 0, leave: 0, absent: 0 },
      26,
      { proRationFactor: 2.0 },
    );
    expect(r2.netSalary).toBe(5_200);
  });

  it("calculatePayroll applies pro-ration to the monthly base", () => {
    // Employee earns 5,200/mo, hired mid-month → factor ~ 16/31
    const factor = 16 / 31;
    const r = calculatePayroll(
      { basicSalary: 5_200, housingAllowance: 0, transportAllowance: 0, otherAllowances: 0 },
      { attended: 16, halfDay: 0, leave: 0, absent: 0 },
      16, // working days = 16 (the partial cycle)
      { proRationFactor: factor },
    );
    // Expected: 5200 * (16/31) ≈ 2,683.87
    expect(r.netSalary).toBeCloseTo(5_200 * factor, 1);
  });
});

describe("Egyptian overtime (Labor Law Art. 85) — 1.35 / 1.7 / 2.0", () => {
  it("exposes the three statutory multipliers as constants", () => {
    expect(OVERTIME_RATE_DAY).toBe(1.35);
    expect(OVERTIME_RATE_NIGHT).toBe(1.7);
    expect(OVERTIME_RATE_REST).toBe(2.0);
  });

  it("calculateHourlyRate divides basic salary by 26 × 8 = 208 by default", () => {
    // 5,200 / 208 = 25
    expect(calculateHourlyRate(5_200)).toBe(25);
    // 10,400 / 208 = 50
    expect(calculateHourlyRate(10_400)).toBe(50);
  });

  it("calculateHourlyRate accepts custom working-day + workday-hour overrides", () => {
    // For a 25-day month with 6-hr workdays: 4,500 / (25 × 6) = 30
    expect(calculateHourlyRate(4_500, 25, 6)).toBe(30);
  });

  it("returns 0 for zero/negative inputs", () => {
    expect(calculateHourlyRate(0)).toBe(0);
    expect(calculateHourlyRate(-100)).toBe(0);
    expect(calculateHourlyRate(5_000, 0)).toBe(0);
  });

  it("calculateOvertimePay applies 1.35× for day hours", () => {
    // 10 day hours × 25 EGP/hr × 1.35 = 337.50
    expect(calculateOvertimePay(25, { day: 10 })).toBe(337.5);
  });

  it("applies 1.7× for night hours", () => {
    // 8 night hrs × 25 × 1.7 = 340
    expect(calculateOvertimePay(25, { night: 8 })).toBe(340);
  });

  it("applies 2.0× for rest-day / holiday hours", () => {
    // 4 rest hrs × 25 × 2.0 = 200
    expect(calculateOvertimePay(25, { rest: 4 })).toBe(200);
  });

  it("sums all three categories in one cycle", () => {
    // 10×1.35 + 6×1.7 + 2×2.0 = 13.5 + 10.2 + 4 = 27.7 hours-equivalent
    // × 25 EGP/hr = 692.50
    const r = calculateOvertimePay(25, { day: 10, night: 6, rest: 2 });
    expect(r).toBe(692.5);
  });

  it("returns 0 when no hours are provided", () => {
    expect(calculateOvertimePay(25, {})).toBe(0);
  });

  it("returns 0 for an invalid hourly rate", () => {
    expect(calculateOvertimePay(0, { day: 10, night: 5 })).toBe(0);
    expect(calculateOvertimePay(-5, { day: 10 })).toBe(0);
  });

  it("calculatePayroll uses the hour breakdown when ANY category is set", () => {
    // Basic 5,200 → hourly = 25. 10 day OT hours → 337.50 added to gross.
    const result = calculatePayroll(
      {
        basicSalary: 5_200,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
        overtime: 9999, // should be IGNORED because hour breakdown wins
        overtimeHoursDay: 10,
      },
      { attended: 26, halfDay: 0, leave: 0, absent: 0 },
    );
    // 5,200 + 337.50 OT = 5,537.50
    expect(result.overtime).toBe(337.5);
    expect(result.netSalary).toBe(5_537.5);
  });

  it("calculatePayroll falls back to raw `overtime` when no hour breakdown", () => {
    const result = calculatePayroll(
      {
        basicSalary: 5_200,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
        overtime: 500,
        // No overtimeHoursDay/Night/Rest → legacy path
      },
      { attended: 26, halfDay: 0, leave: 0, absent: 0 },
    );
    expect(result.overtime).toBe(500);
    expect(result.netSalary).toBe(5_700);
  });
});

describe("calculateHourlyWage — hourly + conditional transport", () => {
  it("pays per actual hours worked, no allowance when none configured", () => {
    const r = calculateHourlyWage({
      hourlyRate: 30,
      hoursWorked: 160,
      daysWorked: 20,
    });
    expect(r.baseWage).toBe(4_800);
    expect(r.transportTotal).toBe(0);
    expect(r.total).toBe(4_800);
  });

  it("pays transport every worked day when no threshold is set", () => {
    const r = calculateHourlyWage({
      hourlyRate: 30,
      hoursWorked: 160,
      daysWorked: 20,
      transportAllowance: 25,
      // transportThresholdHours: undefined → always pay
    });
    expect(r.transportTotal).toBe(500); // 25 × 20
    expect(r.total).toBe(5_300); // 4,800 + 500
  });

  it("pays transport ONLY on eligible days when a threshold is set", () => {
    // Worker had 20 attended days but only 15 had >= 4 hours.
    const r = calculateHourlyWage({
      hourlyRate: 30,
      hoursWorked: 110, // mixed short + full shifts
      daysWorked: 20,
      transportAllowance: 25,
      transportThresholdHours: 4,
      eligibleDays: 15,
    });
    expect(r.baseWage).toBe(3_300); // 30 × 110
    expect(r.transportTotal).toBe(375); // 25 × 15
    expect(r.total).toBe(3_675);
  });

  it("falls back to 0 eligible days if the caller forgot to compute them", () => {
    const r = calculateHourlyWage({
      hourlyRate: 30,
      hoursWorked: 100,
      daysWorked: 20,
      transportAllowance: 25,
      transportThresholdHours: 4,
      // eligibleDays missing -> treated as 0 (safe default)
    });
    expect(r.transportTotal).toBe(0);
  });
});

describe("calculatePayroll — full scenarios", () => {
  it("happy path: full attendance, no extras, no statutory deductions", () => {
    const result = calculatePayroll(
      {
        basicSalary: 5_000,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
      },
      { attended: 22, halfDay: 0, leave: 0, absent: 0 },
      22, // working days
    );

    expect(result.grossSalary).toBe(5_000);
    expect(result.absenceDeduction).toBe(0);
    expect(result.tardinessDeduction).toBe(0);
    expect(result.socialInsurance).toBe(0);
    expect(result.incomeTax).toBe(0);
    expect(result.totalDeductions).toBe(0);
    expect(result.netSalary).toBe(5_000);
  });

  it("absence: 2 unpaid days at a 22-day month", () => {
    const result = calculatePayroll(
      {
        basicSalary: 5_000,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
      },
      { attended: 20, halfDay: 0, leave: 0, absent: 2 },
      22,
    );

    // dailyRate = 5000/22 = 227.272...
    // absenceDeduction = round(2 × 227.272 × 100) / 100 = 454.55
    expect(result.absenceDeduction).toBe(454.55);
    expect(result.grossSalary).toBe(5_000 - 454.55);
    expect(result.netSalary).toBe(5_000 - 454.55);
  });

  it("tardiness: 60 minutes late converts to a fractional-day deduction", () => {
    const result = calculatePayroll(
      {
        basicSalary: 5_000,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
      },
      {
        attended: 22,
        halfDay: 0,
        leave: 0,
        absent: 0,
        tardinessMinutes: 60,
      },
      22,
    );

    // dailyRate = 5000/22, perMinute = dailyRate/480
    // 60 minutes × (5000/22/480) = 28.40909... → round to 28.41
    expect(result.tardinessDeduction).toBe(28.41);
    expect(result.netSalary).toBe(5_000 - 28.41);
  });

  it("half-day attendance counts as 0.5 paid day", () => {
    const result = calculatePayroll(
      {
        basicSalary: 5_000,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
      },
      { attended: 20, halfDay: 4, leave: 0, absent: 0 },
      22,
    );
    // attendedDays = 20 + 4*0.5 + 0 = 22.0 — the math reports the
    // effective days, even though absent=0 means no deduction here.
    expect(result.attendedDays).toBe(22);
    expect(result.absenceDeduction).toBe(0);
    expect(result.netSalary).toBe(5_000);
  });

  it("unpaid leave is deducted just like an unexcused absence", () => {
    // 5,200/mo, 26 working days → daily 200
    // 24 attended + 2 unpaid leave → 2 × 200 = 400 deducted → net 4,800
    const result = calculatePayroll(
      {
        basicSalary: 5_200,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
      },
      { attended: 24, halfDay: 0, leave: 0, absent: 0, unpaidLeave: 2 },
    );
    expect(result.absenceDeduction).toBe(400);
    expect(result.netSalary).toBe(4_800);
  });

  it("paid leave + unpaid leave can coexist on the same period", () => {
    // 5,200/mo, 26 working days → daily 200
    // 22 attended + 2 paid leave (no deduction) + 2 unpaid (deducted)
    const result = calculatePayroll(
      {
        basicSalary: 5_200,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
      },
      { attended: 22, halfDay: 0, leave: 2, absent: 0, unpaidLeave: 2 },
    );
    expect(result.absenceDeduction).toBe(400);
    expect(result.netSalary).toBe(4_800);
  });

  it("paid leave counts as worked (no deduction)", () => {
    const result = calculatePayroll(
      {
        basicSalary: 5_000,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
      },
      { attended: 17, halfDay: 0, leave: 5, absent: 0 },
      22,
    );
    expect(result.absenceDeduction).toBe(0);
    expect(result.netSalary).toBe(5_000);
  });

  it("opt-in social insurance is applied when enabled (2026: 11%)", () => {
    const result = calculatePayroll(
      {
        basicSalary: 5_000,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
      },
      { attended: 22, halfDay: 0, leave: 0, absent: 0 },
      22,
      { socialInsuranceEnabled: true },
    );
    // 5,000 (between min 2,700 and max 16,700) × 11% = 550
    expect(result.socialInsurance).toBe(550);
    expect(result.netSalary).toBe(4_450);
  });

  it("opt-in income tax stacks on top of social insurance (2026 schedule)", () => {
    const result = calculatePayroll(
      {
        basicSalary: 5_000,
        housingAllowance: 500,
        transportAllowance: 200,
        otherAllowances: 0,
      },
      { attended: 22, halfDay: 0, leave: 0, absent: 0 },
      22,
      { socialInsuranceEnabled: true, incomeTaxEnabled: true },
    );
    // monthlyBase = 5,700; gross (no absence/tardy) = 5,700
    // SI = 5,700 × 11% = 627  (between min & max)
    // Taxable = 5,700 − 627 = 5,073
    // Annual taxable = 60,876; minus PE 20,000 = 40,876
    //   40,000 @ 0%  =     0
    //      876 @ 10% =   87.60
    // Annual tax = 87.60; monthly = 7.30
    expect(result.socialInsurance).toBe(627);
    expect(result.incomeTax).toBe(7.30);
    expect(result.totalDeductions).toBe(627 + 7.30);
    expect(result.netSalary).toBeCloseTo(5_700 - 627 - 7.30, 2);
  });

  it("loan + other deductions show up in totalDeductions and net", () => {
    const result = calculatePayroll(
      {
        basicSalary: 5_000,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
        loanDeduction: 500,
        otherDeductions: 150,
      },
      { attended: 22, halfDay: 0, leave: 0, absent: 0 },
      22,
    );
    expect(result.loanDeduction).toBe(500);
    expect(result.otherDeductions).toBe(150);
    expect(result.totalDeductions).toBe(650);
    expect(result.netSalary).toBe(5_000 - 650);
  });

  it("bonuses + overtime are added on top of gross, not eaten by deductions", () => {
    const result = calculatePayroll(
      {
        basicSalary: 5_000,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
        bonuses: 1_000,
        overtime: 500,
      },
      { attended: 22, halfDay: 0, leave: 0, absent: 0 },
      22,
    );
    expect(result.bonuses).toBe(1_000);
    expect(result.overtime).toBe(500);
    expect(result.grossSalary).toBe(6_500);
    expect(result.netSalary).toBe(6_500);
  });

  it("TAX_BRACKETS_2026 is monotonically increasing in upper bound", () => {
    // Catches a typo where a bracket bound was lower than its predecessor —
    // which would zero out everything past it. Same check on 2024 schedule
    // for the historical-recompute path.
    for (const brackets of [TAX_BRACKETS_2026, TAX_BRACKETS_2024]) {
      let prev = 0;
      for (const [upper] of brackets) {
        expect(upper).toBeGreaterThan(prev);
        prev = upper;
      }
    }
  });
});
