// In-process token-bucket rate limiter, scoped per user.
//
// Used to keep AI endpoints (Gemini-backed) from being drained by a
// single account. This is a stopgap -- a single Next.js instance can
// only enforce limits across the requests it sees, so a horizontally-
// scaled deployment would need a shared store (Upstash, Redis). For
// Vercel's single-function model and our current scale it's enough to
// stop accidental loops + intentional abuse from a single session.

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
