// ============================================================================
// Unit tests — src/lib/password.ts
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  validatePassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES_AR,
} from "./password";

describe("validatePassword", () => {
  it("rejects non-strings", () => {
    expect(validatePassword(null).ok).toBe(false);
    expect(validatePassword(undefined).ok).toBe(false);
    expect(validatePassword(12345).ok).toBe(false);
    expect(validatePassword({}).ok).toBe(false);
  });

  it("rejects empty / short passwords with a length-floor message", () => {
    const r = validatePassword("Aa1!");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/12/);
  });

  it("rejects a long all-lowercase password (no uppercase rule)", () => {
    // 14 chars, all lowercase
    const r = validatePassword("aaaaaaaaaaaaaa");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/كابيتال/);
  });

  it("rejects long no-lowercase", () => {
    const r = validatePassword("AAAAAAAAAAAA1!");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/صغير/);
  });

  it("rejects long no-digit", () => {
    const r = validatePassword("AbcdefghijklMm!");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/رقم/);
  });

  it("rejects long no-symbol", () => {
    const r = validatePassword("Abcdefghijkl1Mm2");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/رمز/);
  });

  it("accepts a strong password meeting all rules", () => {
    expect(validatePassword("Abcdef1234!Z").ok).toBe(true); // exactly 12
    expect(validatePassword("VeryLong&Strong#Password123").ok).toBe(true);
    expect(validatePassword("nidh@m-HR-2026").ok).toBe(true);
  });

  it("accepts every non-alphanumeric as a symbol", () => {
    // Egyptian Arabic password using "؟" as symbol — passes the regex
    // [^A-Za-z0-9] check because ؟ is non-alphanumeric.
    expect(validatePassword("MyPassword12؟").ok).toBe(true);
    // Various symbols
    for (const sym of ["@", "#", "!", "%", "&", "*", "_", "-", "."]) {
      const pw = `Strong1aBc${sym}xyz`;
      expect(validatePassword(pw).ok).toBe(true);
    }
  });

  it("first-failing-rule wins (doesn't dump all errors at once)", () => {
    // "abc" fails length AND uppercase AND digit AND symbol — but only
    // the length rule fires.
    const r = validatePassword("abc");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // Only length is reported — not "كابيتال" / "رقم" / "رمز"
      expect(r.reason).toMatch(/12/);
      expect(r.reason).not.toMatch(/كابيتال|رقم|رمز/);
    }
  });

  it("exposes the minimum length as a constant", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
  });

  it("exports a parallel Arabic rules list for UI checklists", () => {
    // Should have exactly 5 rules (length + 4 char-class rules)
    expect(PASSWORD_RULES_AR).toHaveLength(5);
    expect(PASSWORD_RULES_AR[0]).toMatch(/12/);
  });
});
