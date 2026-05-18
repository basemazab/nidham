// ============================================================================
// Unit tests — src/lib/rate-limit.ts
// ============================================================================
//
// The login limiter is the one piece of code standing between a brute-
// force script and Supabase auth. We want it to behave deterministically.
//
// Note: the BUCKETS Map is module-scoped, so tests must use distinct
// keys (different IP / email per test) to avoid bleeding state between
// cases.

import { describe, it, expect } from "vitest";
import { checkRateLimit, checkLoginRateLimit } from "./rate-limit";

describe("checkRateLimit (generic)", () => {
  it("allows up to `limit` requests, then blocks", () => {
    const key = "test:basic-flow";
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit(key, 3, 60_000);
      expect(r.ok).toBe(true);
    }
    const blocked = checkRateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("decrements remaining tokens on each successful call", () => {
    const key = "test:decrement";
    const a = checkRateLimit(key, 5, 60_000);
    const b = checkRateLimit(key, 5, 60_000);
    if (a.ok && b.ok) {
      expect(a.remaining).toBe(4);
      expect(b.remaining).toBe(3);
    } else {
      throw new Error("Expected both calls to succeed");
    }
  });
});

describe("checkLoginRateLimit", () => {
  it("allows 10 attempts from one IP per hour", () => {
    const ip = "203.0.113.42"; // RFC 5737 documentation IP
    for (let i = 0; i < 10; i++) {
      const r = checkLoginRateLimit(ip, `user${i}@test.com`);
      expect(r.ok).toBe(true);
    }
  });

  it("blocks the 11th attempt from one IP within the hour", () => {
    const ip = "203.0.113.43";
    // Burn 10 attempts using emails that don't share their bucket
    for (let i = 0; i < 10; i++) {
      checkLoginRateLimit(ip, `unique-${i}-${Date.now()}@test.com`);
    }
    const r = checkLoginRateLimit(ip, "blocked@test.com");
    expect(r.ok).toBe(false);
  });

  it("blocks the same email after 5 attempts even from different IPs", () => {
    const email = "victim@test.com";
    // 5 attempts from 5 different IPs — burns the email bucket
    for (let i = 0; i < 5; i++) {
      const r = checkLoginRateLimit(`198.51.100.${i + 1}`, email);
      expect(r.ok).toBe(true);
    }
    // 6th attempt from yet another IP — email bucket is empty
    const r = checkLoginRateLimit("198.51.100.99", email);
    expect(r.ok).toBe(false);
  });

  it("skips the email bucket when email is null/empty", () => {
    // Malformed payload (no email) — IP bucket alone protects us.
    const ip = "192.0.2.10";
    const a = checkLoginRateLimit(ip, null);
    const b = checkLoginRateLimit(ip, "");
    const c = checkLoginRateLimit(ip, undefined);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(c.ok).toBe(true);
  });

  it("normalises email case so 'A@x' and 'a@x' share a bucket", () => {
    const ip1 = "192.0.2.20";
    const ip2 = "192.0.2.21";
    // 5 attempts on the upper-case form, from one IP
    for (let i = 0; i < 5; i++) {
      checkLoginRateLimit(ip1, "VICTIM@CORP.COM");
    }
    // 1 attempt on the lower-case form, from a different IP — should
    // hit the SAME email bucket and be blocked.
    const r = checkLoginRateLimit(ip2, "victim@corp.com");
    expect(r.ok).toBe(false);
  });
});
