// ============================================================================
// POST /api/otp/send — issue an OTP code to the given identifier
// ============================================================================
//
// Body: { identifier: string, channel: "whatsapp"|"email", purpose: string }
// Response: { ok: true, channel, note? } | { ok: false, error }
//
// Rate-limited per identifier (3 requests / 10 minutes) to prevent
// brute-spam on someone else's phone number.

import { NextResponse } from "next/server";
import { issueOtp, type OtpChannel, type OtpPurpose } from "@/lib/otp";
import { checkRateLimit } from "@/lib/rate-limit";

const VALID_CHANNELS: OtpChannel[] = ["whatsapp", "email"];
const VALID_PURPOSES: OtpPurpose[] = [
  "signup",
  "login",
  "twofa",
  "reset",
  "verify",
];

export async function POST(req: Request) {
  let body: { identifier?: string; channel?: string; purpose?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const identifier = String(body.identifier ?? "").trim();
  const channel = String(body.channel ?? "whatsapp") as OtpChannel;
  const purpose = String(body.purpose ?? "verify") as OtpPurpose;

  if (!identifier) {
    return NextResponse.json(
      { ok: false, error: "identifier مطلوب" },
      { status: 400 },
    );
  }
  if (!VALID_CHANNELS.includes(channel)) {
    return NextResponse.json(
      { ok: false, error: "قناة غير صحيحة" },
      { status: 400 },
    );
  }
  if (!VALID_PURPOSES.includes(purpose)) {
    return NextResponse.json(
      { ok: false, error: "purpose غير صحيح" },
      { status: 400 },
    );
  }

  // J3 fix — two-bucket rate limit:
  //   1. Per identifier (3 / 10 min) — prevents spamming a specific
  //      recipient with codes they didn't ask for
  //   2. Per IP (10 / 10 min)        — prevents an attacker from
  //      iterating random phone numbers to burn Meta API spend
  //      ($0.04/msg) and trigger Meta abuse-flagging on our sender
  //
  // Both buckets must pass. Attacker has to control 10x more IPs to
  // achieve the same abuse rate.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const ipLimit = checkRateLimit(`otp-send:ip:${ip}`, 10, 10 * 60_000);
  if (!ipLimit.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `كتير إرسال من شبكتك — جرب بعد ${Math.ceil(ipLimit.retryAfterSeconds / 60)} دقيقة`,
      },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } },
    );
  }

  const idLimit = checkRateLimit(`otp-send:id:${identifier}`, 3, 10 * 60_000);
  if (!idLimit.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `كتر إرسال الكود — جرب تاني بعد ${Math.ceil(idLimit.retryAfterSeconds / 60)} دقيقة`,
      },
      { status: 429, headers: { "Retry-After": String(idLimit.retryAfterSeconds) } },
    );
  }

  const result = await issueOtp(identifier, channel, purpose);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
