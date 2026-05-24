// ============================================================================
// Unit tests — src/lib/totp.ts
// ============================================================================

import { describe, it, expect } from "vitest";
import { Secret, TOTP } from "otpauth";
import {
  generateTotpSecret,
  buildOtpauthUrl,
  verifyTotpCode,
} from "./totp";

describe("generateTotpSecret", () => {
  it("returns a base32 string of reasonable length", () => {
    const secret = generateTotpSecret();
    expect(typeof secret).toBe("string");
    // 20-byte secret in base32 = 32 chars
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(secret).toMatch(/^[A-Z2-7]+$/); // base32 alphabet
  });

  it("returns a different secret on each call", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
  });
});

describe("buildOtpauthUrl", () => {
  it("returns a valid otpauth:// URL with issuer + label", () => {
    const secret = generateTotpSecret();
    const url = buildOtpauthUrl({
      secret,
      accountEmail: "basem@example.com",
    });
    expect(url).toMatch(/^otpauth:\/\/totp\//);
    expect(url).toContain("issuer=Nidham");
    expect(url).toContain("basem%40example.com");
    expect(url).toContain(`secret=${secret}`);
  });
});

describe("verifyTotpCode", () => {
  // Generate a real TOTP code from the same secret to test against
  function currentCodeFor(secret: string): string {
    const totp = new TOTP({
      issuer: "Nidham",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });
    return totp.generate();
  }

  it("returns true for a fresh code", () => {
    const secret = generateTotpSecret();
    const code = currentCodeFor(secret);
    expect(verifyTotpCode({ secret, code })).toBe(true);
  });

  it("returns false for a clearly wrong code", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode({ secret, code: "000000" })).toBe(false);
    expect(verifyTotpCode({ secret, code: "123456" })).toBe(false);
  });

  it("rejects non-6-digit input shapes", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode({ secret, code: "" })).toBe(false);
    expect(verifyTotpCode({ secret, code: "12345" })).toBe(false); // 5 digits
    expect(verifyTotpCode({ secret, code: "1234567" })).toBe(false); // 7 digits
    expect(verifyTotpCode({ secret, code: "12345a" })).toBe(false); // letter
    expect(verifyTotpCode({ secret, code: "  " })).toBe(false);
  });

  it("trims whitespace before verifying", () => {
    const secret = generateTotpSecret();
    const code = currentCodeFor(secret);
    expect(verifyTotpCode({ secret, code: `  ${code}  ` })).toBe(true);
  });
});
