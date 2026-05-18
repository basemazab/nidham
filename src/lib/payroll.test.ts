// ============================================================================
// Unit tests — src/lib/payroll.ts
// ============================================================================
//
// Egyptian payroll math is the single most consequential piece of code in the
// product: a 0.5% mistake here means every employee at every customer is
// getting paid wrong, every month. Test paranoidly.
//
// Source of truth for the brackets + rates:
//   - Law 175/2023 (income tax brackets, applied 2024+)
//   - Law 148/2019 (social insurance, 14% employee share, capped at the
//     MAX_INSURABLE_WAGE)
//   - Annual personal exemption: 20,000 EGP

import { describe, it, expect } from "vitest";
import {
  calculateAnnualIncomeTax,
  calculateMonthlyIncomeTax,
  calculateSocialInsurance,
  calculatePayroll,
  SOCIAL_INSURANCE_RATE,
  MAX_INSURABLE_WAGE,
  PERSONAL_EXEMPTION,
  TAX_BRACKETS_2024,
} from "./payroll";

describe("calculateAnnualIncomeTax — 2024 brackets", () => {
  it("returns 0 when income falls entirely within the personal exemption", () => {
    expect(calculateAnnualIncomeTax(0)).toBe(0);
    expect(calculateAnnualIncomeTax(PERSONAL_EXEMPTION)).toBe(0);
    expect(calculateAnnualIncomeTax(PERSONAL_EXEMPTION - 1)).toBe(0);
  });

  it("applies 10% to the first 40k taxable slice (after exemption)", () => {
    // 60,000 gross - 20,000 PE = 40,000 taxable in the 10% bracket
    expect(calculateAnnualIncomeTax(60_000)).toBe(4_000);
  });

  it("walks across the 10% → 15% boundary correctly", () => {
    // 80,000 gross - 20,000 PE = 60,000 taxable
    //   40,000 @ 10% = 4,000
    //   20,000 @ 15% = 3,000   (the 40k→55k bracket = 15k slice, then 5k more @20%)
    // Wait — brackets are [40k, 55k, 70k, 200k, 400k, ∞]. So after 40k:
    //   15k @ 15% (40k→55k) = 2,250
    //    5k @ 20% (55k→70k) = 1,000
    // Total = 4,000 + 2,250 + 1,000 = 7,250
    expect(calculateAnnualIncomeTax(80_000)).toBe(7_250);
  });

  it("respects all brackets for a very high earner", () => {
    // 500,000 gross - 20,000 PE = 480,000 taxable
    //   40,000 @ 10%   =  4,000   (0→40k)
    //   15,000 @ 15%   =  2,250   (40k→55k)
    //   15,000 @ 20%   =  3,000   (55k→70k)
    //  130,000 @ 22.5% = 29,250   (70k→200k)
    //  200,000 @ 25%   = 50,000   (200k→400k)
    //   80,000 @ 27.5% = 22,000   (400k→480k)
    // Total = 110,500
    expect(calculateAnnualIncomeTax(500_000)).toBeCloseTo(110_500, 2);
  });

  it("never returns a negative number for any input", () => {
    expect(calculateAnnualIncomeTax(-50_000)).toBe(0);
    expect(calculateAnnualIncomeTax(-1)).toBe(0);
  });

  it("accepts custom brackets (for future-year overrides)", () => {
    // Hypothetical: flat 20% above personal exemption
    const flat: Array<[number, number]> = [
      [Number.POSITIVE_INFINITY, 0.2],
    ];
    expect(calculateAnnualIncomeTax(50_000, flat)).toBe(
      (50_000 - PERSONAL_EXEMPTION) * 0.2,
    );
  });
});

describe("calculateMonthlyIncomeTax", () => {
  it("divides annual tax by 12 cleanly", () => {
    // Monthly 5000 → annual 60,000 → tax 4,000 → monthly 333.33...
    expect(calculateMonthlyIncomeTax(5_000)).toBeCloseTo(4_000 / 12, 4);
  });

  it("returns 0 when the annualized salary is below the personal exemption", () => {
    // 1,000/mo × 12 = 12,000/yr < 20,000 PE
    expect(calculateMonthlyIncomeTax(1_000)).toBe(0);
  });
});

describe("calculateSocialInsurance", () => {
  it("charges 14% of the salary when below the cap", () => {
    // The function rounds to 2dp, so `5000 * 0.14` in raw IEEE-754 (= 700.0000000000001)
    // becomes 700 after the round trip. Compare to the rounded value, not the raw one.
    expect(calculateSocialInsurance(5_000)).toBe(
      Math.round(5_000 * SOCIAL_INSURANCE_RATE * 100) / 100,
    );
    expect(calculateSocialInsurance(10_000)).toBe(1_400);
  });

  it("caps at the MAX_INSURABLE_WAGE for higher salaries", () => {
    expect(calculateSocialInsurance(20_000)).toBe(
      Math.round(MAX_INSURABLE_WAGE * SOCIAL_INSURANCE_RATE * 100) / 100,
    );
    expect(calculateSocialInsurance(20_000)).toBe(1_764); // 12,600 × 14%
  });

  it("equals zero for a zero salary", () => {
    expect(calculateSocialInsurance(0)).toBe(0);
  });

  it("rounds to 2 decimal places (piastres)", () => {
    // 1234.50 × 0.14 = 172.83 (already 2dp); 1234.55 × 0.14 = 172.837 → 172.84
    expect(calculateSocialInsurance(1_234.55)).toBe(172.84);
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

  it("opt-in social insurance is applied when enabled", () => {
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
    // 5000 × 14% = 700
    expect(result.socialInsurance).toBe(700);
    expect(result.netSalary).toBe(4_300);
  });

  it("opt-in income tax stacks on top of social insurance", () => {
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
    // monthlyBase = 5700; gross (no absence/tardy) = 5700
    // SI = 5700 × 14% = 798
    // Taxable = 5700 - 798 = 4902
    // Annual taxable = 58,824; minus PE 20,000 = 38,824 → 10% bracket entirely
    // Annual tax = 3,882.40; monthly = 323.5333... → 323.53
    expect(result.socialInsurance).toBe(798);
    expect(result.incomeTax).toBe(323.53);
    expect(result.totalDeductions).toBe(798 + 323.53);
    expect(result.netSalary).toBeCloseTo(5_700 - 798 - 323.53, 2);
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

  it("TAX_BRACKETS_2024 is monotonically increasing in upper bound", () => {
    // Catches a typo where a bracket bound was lower than its predecessor —
    // which would zero out everything past it.
    let prev = 0;
    for (const [upper] of TAX_BRACKETS_2024) {
      expect(upper).toBeGreaterThan(prev);
      prev = upper;
    }
  });
});
