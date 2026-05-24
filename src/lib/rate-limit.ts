// In-process token-bucket rate limiter, scoped per key.
//
// Originally introduced for AI endpoints (Gemini-backed) to keep a
// single account from draining the model quota. As of 2026-05-18, also
// used by the /login server action to slow down brute-force attempts
// (P0 #3 in PRODUCTION_READINESS_AUDIT.md §4).
//
// Caveat: this is in-memory. A horizontally-scaled deployment (Vercel
// runs N concurrent function instances) gets N separate buckets — so
// the *effective* limit is roughly limit × N. That's still strictly
// better than no limit, but proper protection requires a shared store
// (Upstash Redis, Vercel KV). When the team migrates, swap the BUCKETS
// Map for `@upstash/ratelimit` — the API is intentionally similar:
//
//   import { Ratelimit } from "@upstash/ratelimit";
//   import { Redis } from "@upstash/redis";
//   const rl = new Ratelimit({
//     redis: Redis.fromEnv(),
//     limiter: Ratelimit.slidingWindow(10, "1 h"),
//   });
//   const { success, reset } = await rl.limit(key);

type Bucket = {
  // Tokens remaining in the current window.
  tokens: number;
  // Epoch ms when the window resets.
  resetAt: number;
};

const BUCKETS = new Map<string, Bucket>();

// Trim once in a while so the map doesn't grow unbounded. The key
// space is bounded by active user IDs anyway, but on Vercel each cold
// start gives us a fresh map -- so this only matters for long-lived
// instances.
let lastTrim = 0;
function trimIfDue(now: number) {
  if (now - lastTrim < 60_000) return;
  lastTrim = now;
  for (const [key, b] of BUCKETS) {
    if (b.resetAt < now) BUCKETS.delete(key);
  }
}

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; retryAfterSeconds: number };

/**
 * Allow `limit` requests per `windowMs` for the given key. Returns
 * `ok: true` and decrements the bucket on success; `ok: false` with
 * `retryAfterSeconds` when the bucket is empty.
 *
 * Default: 20 calls per 5 minutes -- generous for legitimate HR work
 * (a screening sprint is maybe 10 CVs / 30 min) but stops a runaway
 * client loop from burning Gemini quota.
 */
export function checkRateLimit(
  key: string,
  limit = 20,
  windowMs = 5 * 60_000,
): RateLimitResult {
  const now = Date.now();
  trimIfDue(now);

  let b = BUCKETS.get(key);
  if (!b || b.resetAt < now) {
    b = { tokens: limit, resetAt: now + windowMs };
    BUCKETS.set(key, b);
  }

  if (b.tokens <= 0) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }

  b.tokens -= 1;
  return { ok: true, remaining: b.tokens, resetAt: b.resetAt };
}

// ----------------------------------------------------------------------------
// Sensitive-action limiter — for endpoints other than /login that are
// still attractive to abuse but have different access patterns.
//
// Currently used by:
//   - acceptInvitation   → 8 tries / hour / IP    (invitation token brute force)
//   - requestPasswordReset → 5 sends / hour / email + 20 / hour / IP
//                            (email enumeration + spam relay)
//   - updatePassword     → 10 attempts / 15min / IP (after-reset abuse)
//
// All buckets are in-memory like login — same Upstash migration path
// applies when scale demands it.
// ----------------------------------------------------------------------------
export function checkInvitationClaimRateLimit(ip: string): RateLimitResult {
  // 8 attempts per hour per IP. Tighter than login because the token
  // space is huge — there's no legitimate reason an honest user retries
  // claim that many times.
  return checkRateLimit(`invite:ip:${ip}`, 8, 60 * 60_000);
}

export function checkPasswordResetRateLimit(
  ip: string,
  email: string | null | undefined,
): RateLimitResult {
  // IP-side: 20 reset-emails per hour per IP. Stops a script from
  // bombing every email it scraped.
  const ipResult = checkRateLimit(`reset:ip:${ip}`, 20, 60 * 60_000);
  if (!ipResult.ok) return ipResult;

  // Email-side: 5 reset-emails per hour per address. Stops a user from
  // accidentally clicking "forgot" 50 times AND stops a targeted attack
  // bombing one victim's inbox.
  if (email && email.trim()) {
    const emailResult = checkRateLimit(
      `reset:email:${email.trim().toLowerCase()}`,
      5,
      60 * 60_000,
    );
    if (!emailResult.ok) return emailResult;
  }
  return ipResult;
}

export function checkPasswordUpdateRateLimit(ip: string): RateLimitResult {
  // Post-reset password setting: 10 attempts per 15min per IP. Catches
  // a session-token attacker mashing the update endpoint after
  // intercepting the email link.
  return checkRateLimit(`pwupdate:ip:${ip}`, 10, 15 * 60_000);
}


// ----------------------------------------------------------------------------
// Login-attempt limiter — narrower, more aggressive defaults.
//
// We check the same attempt against TWO buckets:
//   1) the IP        — stops a brute-forcer from one IP cycling passwords
//   2) the email     — stops the same attacker rotating IPs to hit one
//                      victim account
// Whichever runs out first wins. The email-keyed bucket gets a stricter
// limit because we accept some false positives there (e.g. shared family
// device where two people try wrong passwords once each — 5 attempts /
// 15 min is plenty of headroom).
//
// Returns the SAME shape as checkRateLimit so the caller can pattern-
// match on `ok`. On block, the suggested response is a 429 / redirect
// with `retryAfterSeconds` so the UI can render "حاول تاني بعد 4 دقايق".
//
// The reason this lives in a separate function — not a parametrised
// checkRateLimit call — is so the buckets stay distinct from AI's. A
// busy HR user calling 10 AI screenings doesn't drain their login
// budget.
// ----------------------------------------------------------------------------
export function checkLoginRateLimit(
  ip: string,
  email: string | null | undefined,
): RateLimitResult {
  // IP bucket: 10 attempts per hour. Captures the "spray-and-pray" style
  // bot that tries common passwords across many emails from one IP.
  const ipResult = checkRateLimit(`login:ip:${ip}`, 10, 60 * 60_000);
  if (!ipResult.ok) return ipResult;

  // Email bucket: 5 attempts per 15 min. Captures the "targeted attack"
  // style where the attacker has a victim's email and rotates IPs.
  // Skipped if no email — the form requires it but malformed payloads
  // could have null.
  if (email && email.trim()) {
    const emailResult = checkRateLimit(
      `login:email:${email.trim().toLowerCase()}`,
      5,
      15 * 60_000,
    );
    if (!emailResult.ok) return emailResult;
  }

  return ipResult;
}
