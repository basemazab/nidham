// ============================================================================
// Unit tests — src/lib/format.ts
// ============================================================================
//
// The formatters were extracted from three near-identical inline copies
// scattered around the codebase. The tests pin the contract so the next
// refactor (e.g. migrating off the deprecated Intl options) doesn't
// silently change the user-facing strings.
//
// We test against the locale-formatted value rather than a hard-coded
// string of glyphs — Node ships with different ICU builds and Arabic-
// Indic vs Latin digits flip depending on the build. Pinning to "5,000 ج"
// breaks on any CI box that doesn't share our exact ICU.

import { describe, it, expect } from "vitest";
import {
  formatEGP,
  formatEGPRange,
  formatDate,
  formatDateShort,
  formatDateRange,
  formatNumber,
} from "./format";

const localized = (n: number, opts?: Intl.NumberFormatOptions) =>
  n.toLocaleString("ar-EG", opts);

describe("formatEGP", () => {
  it("appends the EGP suffix and uses Arabic locale digits", () => {
    const out = formatEGP(5_000);
    expect(out).toContain(localized(5_000));
    expect(out.endsWith("ج")).toBe(true);
  });

  it("renders integers without decimals by default", () => {
    expect(formatEGP(5_000)).toBe(
      localized(5_000, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }) + " ج",
    );
  });

  it("renders two decimals when withDecimals=true (payslip mode)", () => {
    expect(formatEGP(5_000, true)).toBe(
      localized(5_000, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " ج",
    );
  });

  it("returns em-dash for null/undefined/NaN/Infinity", () => {
    expect(formatEGP(null)).toBe("—");
    expect(formatEGP(undefined)).toBe("—");
    expect(formatEGP(Number.NaN)).toBe("—");
    expect(formatEGP(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("formatEGPRange", () => {
  it("renders 'min – max ج' when both are present", () => {
    const out = formatEGPRange(5_000, 10_000);
    expect(out).toContain(localized(5_000));
    expect(out).toContain(localized(10_000));
    expect(out!.endsWith("ج")).toBe(true);
    expect(out).toContain("–");
  });

  it("renders 'من X ج' when only min is present", () => {
    expect(formatEGPRange(5_000, null)).toBe(`من ${localized(5_000)} ج`);
  });

  it("renders 'حتى X ج' when only max is present", () => {
    expect(formatEGPRange(null, 10_000)).toBe(`حتى ${localized(10_000)} ج`);
  });

  it("returns null when both are missing (so callers can hide the chip)", () => {
    expect(formatEGPRange(null, null)).toBeNull();
    expect(formatEGPRange(undefined, undefined)).toBeNull();
  });
});

describe("formatDate", () => {
  it("returns the long Arabic date with weekday by default", () => {
    const out = formatDate("2026-05-14");
    expect(out).not.toBe("—");
    // Arabic weekday + month name + 4-digit year, separated by spaces
    expect(out.length).toBeGreaterThan(8);
  });

  it("can drop the weekday for a tighter chip", () => {
    const withWeekday = formatDate("2026-05-14");
    const withoutWeekday = formatDate("2026-05-14", { withWeekday: false });
    expect(withoutWeekday.length).toBeLessThan(withWeekday.length);
  });

  it("accepts a Date object as well as an ISO string", () => {
    const d = new Date("2026-05-14T00:00:00Z");
    expect(formatDate(d)).toBe(formatDate("2026-05-14"));
  });

  it("returns em-dash for invalid / null input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not a date")).toBe("—");
  });
});

describe("formatDateShort", () => {
  it("matches formatDate({ withWeekday: false })", () => {
    expect(formatDateShort("2026-05-14")).toBe(
      formatDate("2026-05-14", { withWeekday: false }),
    );
  });
});

describe("formatDateRange", () => {
  it("renders 'من X إلى Y' when both are present", () => {
    const out = formatDateRange("2026-05-14", "2026-05-20");
    expect(out.startsWith("من ")).toBe(true);
    expect(out).toContain(" إلى ");
  });

  it("falls back to a single formatted date when one side is missing", () => {
    expect(formatDateRange("2026-05-14", null)).toBe(formatDate("2026-05-14"));
    expect(formatDateRange(null, "2026-05-20")).toBe(formatDate("2026-05-20"));
  });
});

describe("formatNumber", () => {
  it("renders an Arabic-locale number", () => {
    expect(formatNumber(5_000)).toBe(localized(5_000));
  });

  it("returns em-dash for null/undefined/non-finite", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber(Number.NaN)).toBe("—");
  });
});
