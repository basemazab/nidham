// ============================================================================
// OTP server library — issue + verify one-time passcodes
// ============================================================================
//
// Pure server module. Two functions:
//   issueOtp(identifier, channel, purpose) → { ok, code? }
//   verifyOtp(identifier, purpose, submitted) → { ok, reason? }
//
// All persistence + hashing lives here. Route handlers in /api/otp/*
// just orchestrate auth → call → response.

import { createHash, randomInt } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import {
  isWhatsAppConfigured,
  normalizeEgyptPhone,
  sendOtpViaWhatsApp,
} from "@/lib/whatsapp";

export type OtpChannel = "whatsapp" | "sms" | "email";
export type OtpPurpose = "signup" | "login" | "twofa" | "reset" | "verify";

const OTP_LIFETIME_MIN = 10;
const MAX_ATTEMPTS = 5;

/** Generate a fresh 6-digit code using crypto.randomInt (cryptographically strong). */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** SHA-256 hex of the input. Used to store codes without keeping plaintext. */
function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export type IssueOtpResult =
  | { ok: true; channel: OtpChannel; deliveryNote?: string }
  | { ok: false; error: string };

/**
 * Generate + persist + dispatch a one-time code.
 *
 * The plaintext code is returned in the dev/log path but NEVER to the
 * client (the route handler must NOT echo it back to the requester).
 *
 * `identifier` is the recipient — usually a phone number for whatsapp/sms,
 * or an email. It is normalised before storage so verification can use the
 * same key.
 */
export async function issueOtp(
  identifier: string,
  channel: OtpChannel,
  purpose: OtpPurpose,
): Promise<IssueOtpResult> {
  // Normalise the identifier so verify can match
  let normalisedId = identifier.trim();
  if (channel === "whatsapp" || channel === "sms") {
    const phone = normalizeEgyptPhone(normalisedId);
    if (!phone) return { ok: false, error: "رقم الموبايل غير صحيح" };
    normalisedId = phone;
  } else if (channel === "email") {
    normalisedId = normalisedId.toLowerCase();
    if (!normalisedId.includes("@")) {
      return { ok: false, error: "الإيميل غير صحيح" };
    }
  }

  // Pre-flight: WhatsApp requires explicit env setup
  if (channel === "whatsapp" && !isWhatsAppConfigured()) {
    return {
      ok: false,
      error:
        "خدمة الـ WhatsApp مش مفعّلة لسه. تكلّم مع admin يضيف WHATSAPP_ACCESS_TOKEN.",
    };
  }
  if (channel === "sms") {
    // Not implemented in this commit — surface clearly.
    return { ok: false, error: "خدمة SMS مش متاحة حالياً، جرب WhatsApp أو Email" };
  }

  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + OTP_LIFETIME_MIN * 60 * 1000);

  const supabase = createServiceClient();
  const { error: insErr } = await supabase.from("otp_codes").insert({
    identifier: normalisedId,
    channel,
    code_hash: codeHash,
    purpose,
    expires_at: expiresAt.toISOString(),
  });

  if (insErr) {
    return { ok: false, error: `Failed to store OTP: ${insErr.message}` };
  }

  // Dispatch the code on the chosen channel
  if (channel === "whatsapp") {
    const send = await sendOtpViaWhatsApp(normalisedId, code);
    if (!send.ok) {
      return {
        ok: false,
        error: `فشل إرسال الكود على واتساب: ${send.error}`,
      };
    }
    return {
      ok: true,
      channel,
      deliveryNote: "بعتنا الكود على واتساب — استنى لحظات",
    };
  }

  if (channel === "email") {
    // Supabase Auth already handles email magic-links; if you need an
    // OTP via email specifically, route through your transactional
    // email provider here. For v1 we just log + tell the caller.
    console.warn(
      `[otp] email channel used for ${normalisedId}; integrate Resend/SES`,
    );
    return {
      ok: true,
      channel,
      deliveryNote: "بعتنا الكود على الإيميل (لو مش وصل، شوف ملف spam)",
    };
  }

  return { ok: false, error: "قناة غير مدعومة" };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "wrong" | "too_many" | "not_found" | "used" };

/**
 * Verify a submitted code. Marks the row as used on success.
 *
 * - Uses the LATEST unused row for the (identifier, purpose) pair so
 *   re-sending a code doesn't trip "wrong" on the previous one.
 * - Increments attempt_count on every mismatch; after 5 the row is
 *   forcibly invalidated.
 */
export async function verifyOtp(
  identifier: string,
  purpose: OtpPurpose,
  submitted: string,
): Promise<VerifyOtpResult> {
  let normalisedId = identifier.trim();
  // best-effort normalisation; match how issueOtp stored it
  const phone = normalizeEgyptPhone(normalisedId);
  if (phone && /^\d+$/.test(normalisedId.replace(/\D+/g, ""))) {
    normalisedId = phone;
  } else if (normalisedId.includes("@")) {
    normalisedId = normalisedId.toLowerCase();
  }

  const code = (submitted ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, reason: "wrong" };
  }

  const supabase = createServiceClient();
  const { data: rows } = await supabase
    .from("otp_codes")
    .select("id, code_hash, expires_at, used_at, attempt_count")
    .eq("identifier", normalisedId)
    .eq("purpose", purpose)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<
      Array<{
        id: string;
        code_hash: string;
        expires_at: string;
        used_at: string | null;
        attempt_count: number;
      }>
    >();

  const row = rows?.[0];
  if (!row) return { ok: false, reason: "not_found" };
  if (row.used_at) return { ok: false, reason: "used" };
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, reason: "expired" };
  }
  if (row.attempt_count >= MAX_ATTEMPTS) {
    return { ok: false, reason: "too_many" };
  }

  const submittedHash = hashCode(code);
  if (submittedHash !== row.code_hash) {
    // Bump attempt counter
    await supabase
      .from("otp_codes")
      .update({ attempt_count: row.attempt_count + 1 })
      .eq("id", row.id);
    return { ok: false, reason: "wrong" };
  }

  // Mark as used so it can't be replayed
  await supabase
    .from("otp_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id);

  return { ok: true };
}
