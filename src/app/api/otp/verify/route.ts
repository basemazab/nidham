// ============================================================================
// POST /api/otp/verify — check an OTP code submitted by the user
// ============================================================================
//
// Body: { identifier: string, purpose: string, code: string }
// Response: { ok: true } | { ok: false, error }
//
// Rate-limited per identifier (10 attempts / 10 minutes) — second
// throttle on top of the DB-level attempt_count cap.

import { NextResponse } from "next/server";
import { verifyOtp, type OtpPurpose } from "@/lib/otp";
import { checkRateLimit } from "@/lib/rate-limit";

const FRIENDLY_REASONS: Record<string, string> = {
  expired: "الكود ده انتهت صلاحيته. اطلب كود جديد.",
  wrong: "الكود غلط. تأكد منه أو اطلب كود جديد.",
  too_many: "محاولات كتيرة جداً — اطلب كود جديد.",
  not_found: "مفيش كود مرسل للرقم/الإيميل ده. اطلب كود الأول.",
  used: "الكود ده اتستخدم بالفعل. اطلب كود جديد.",
};

export async function POST(req: Request) {
  let body: { identifier?: string; purpose?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const identifier = String(body.identifier ?? "").trim();
  const purpose = String(body.purpose ?? "verify") as OtpPurpose;
  const code = String(body.code ?? "").trim();

  if (!identifier || !code) {
    return NextResponse.json(
      { ok: false, error: "identifier + code مطلوبين" },
      { status: 400 },
    );
  }

  const rl = checkRateLimit(`otp-verify:${identifier}`, 10, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `محاولات كتيرة — جرب تاني بعد ${Math.ceil(rl.retryAfterSeconds / 60)} دقيقة`,
      },
      { status: 429 },
    );
  }

  const result = await verifyOtp(identifier, purpose, code);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: FRIENDLY_REASONS[result.reason] ?? "الكود غلط" },
      { status: 400 },
    );
  }
  return NextResponse.json(result);
}
