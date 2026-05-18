// ============================================================================
// Unit tests — src/lib/attendance.ts
// ============================================================================
//
// These helpers underpin the /dashboard/attendance/logs view (computed worked
// hours + per-minute deductions). Get them wrong and HR over- or under-
// charges every employee, every cycle.

import { describe, it, expect } from "vitest";
import {
  workedHours,
  perMinuteWage,
  formatTime,
  formatHours,
} from "./attendance";

describe("workedHours", () => {
  it("returns the difference in hours for a normal shift", () => {
    expect(workedHours("08:00", "17:00")).toBe(9);
    expect(workedHours("09:00", "12:30")).toBe(3.5);
  });

  it("returns 0 when either side is missing", () => {
    expect(workedHours(null, "17:00")).toBe(0);
    expect(workedHours("08:00", null)).toBe(0);
    expect(workedHours(null, null)).toBe(0);
    expect(workedHours(undefined, "17:00")).toBe(0);
    expect(workedHours("", "17:00")).toBe(0);
  });

  it("handles overnight shifts (check-out next day)", () => {
    // 22:00 -> 06:00 = 8 hours, not -16
    expect(workedHours("22:00", "06:00")).toBe(8);
    expect(workedHours("23:30", "00:30")).toBe(1);
  });

  it("ignores the seconds suffix (HH:MM:SS)", () => {
    expect(workedHours("08:00:00", "17:00:00")).toBe(9);
    expect(workedHours("08:15:45", "17:15:00")).toBe(9);
  });

  it("returns 0 for malformed input rather than throwing", () => {
    expect(workedHours("garbage", "17:00")).toBe(0);
    expect(workedHours("08:00", "blah")).toBe(0);
    expect(workedHours("not:a:time", "neither")).toBe(0);
  });

  it("treats a same check-in/check-out as zero work, not 24 hours", () => {
    // Zero-length shift is far more likely than a literal 24h shift.
    expect(workedHours("08:00", "08:00")).toBe(0);
  });
});

describe("perMinuteWage", () => {
  it("computes monthly per-minute rate at 30d × 8h × 60m", () => {
    // 5000 / 30 / 8 / 60 ≈ 0.347222
    expect(perMinuteWage(5000, "monthly")).toBeCloseTo(0.34722, 4);
  });

  it("computes weekly per-minute rate at 6d × 8h × 60m", () => {
    // 1200 / 6 / 8 / 60 ≈ 0.4166...
    expect(perMinuteWage(1200, "weekly")).toBeCloseTo(0.41667, 4);
  });

  it("returns 0 for missing / non-positive / non-numeric inputs", () => {
    expect(perMinuteWage(null, "monthly")).toBe(0);
    expect(perMinuteWage(undefined, "monthly")).toBe(0);
    expect(perMinuteWage(0, "monthly")).toBe(0);
    expect(perMinuteWage(-100, "monthly")).toBe(0);
    expect(perMinuteWage(NaN, "monthly")).toBe(0);
  });

  it("defaults to monthly when frequency is null/undefined", () => {
    expect(perMinuteWage(5000, null)).toBe(perMinuteWage(5000, "monthly"));
    expect(perMinuteWage(5000, undefined)).toBe(perMinuteWage(5000, "monthly"));
  });
});

describe("formatTime", () => {
  it("trims seconds when present", () => {
    expect(formatTime("08:30:00")).toBe("08:30");
    expect(formatTime("17:45:30")).toBe("17:45");
  });

  it("returns HH:MM untouched", () => {
    expect(formatTime("08:30")).toBe("08:30");
  });

  it("returns em-dash for null/empty", () => {
    expect(formatTime(null)).toBe("—");
    expect(formatTime(undefined)).toBe("—");
    expect(formatTime("")).toBe("—");
  });
});

describe("formatHours", () => {
  it("renders two decimals", () => {
    expect(formatHours(9)).toBe("9.00");
    expect(formatHours(8.5)).toBe("8.50");
    expect(formatHours(7.333)).toBe("7.33");
  });

  it("returns em-dash for zero (no shift)", () => {
    expect(formatHours(0)).toBe("—");
  });
});
