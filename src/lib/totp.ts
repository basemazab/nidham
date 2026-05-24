// ============================================================================
// TOTP (Time-based One-Time Password) helpers — RFC 6238
// ============================================================================
//
// Thin wrapper around the `otpauth` library that pins our 2FA conven-
// tions:
//
//   • 6-digit codes (Google Authenticator / 1Password / Authy default)
//   • SHA-1 hash (legacy compatibility — every authenticator app supports)
//   • 30-second period (RFC 6238 default)
//   • ±1 step tolerance on verify (allows ±30s clock drift)
//   • Issuer "Nidham"
//   • Label = user email
//
// The secret is generated server-side, passed to the DB via the
// set_my_totp_secret RPC (where it's encrypted via Vault), and the
// browser only ever sees the base32 OR the otpauth:// URL for the QR.
// We deliberately don't display the secret in plain — users who lose
// their authenticator must go through the disable+re-enable flow.

import { Secret, TOTP } from "otpauth";

const ISSUER = "Nidham";
const DIGITS = 6;
const PERIOD = 30;
const ALGORITHM = "SHA1";

/**
 * Generate a new TOTP secret. Returns the base32-encoded string suitable
 * for storing via set_my_totp_secret and for building the otpauth:// URL.
 */
export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

/**
 * Build the otpauth:// URL that goes into a QR code. The authenticator
 * app reads this and provisions itself.
 *
 * Example: otpauth://totp/Nidham:basem@example.com?secret=XXX&issuer=Nidham
 */
export function buildOtpauthUrl(opts: {
  secret: string;
  accountEmail: string;
}): string {
  const totp = new TOTP({
    issuer: ISSUER,
    label: opts.accountEmail,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: Secret.fromBase32(opts.secret),
  });
  return totp.toString();
}

/**
 * Verify a 6-digit code against the stored secret. Returns true if the
 * code matches the current 30-second window OR one of the immediately
 * adjacent windows (±30s). The ±1-step tolerance is what every major
 * authenticator app expects — without it, a slow phone clock breaks
 * auth.
 */
export function verifyTotpCode(opts: {
  secret: string;
  code: string;
}): boolean {
  if (!opts.code || !/^\d{6}$/.test(opts.code.trim())) return false;
  const totp = new TOTP({
    issuer: ISSUER,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: Secret.fromBase32(opts.secret),
  });
  const delta = totp.validate({
    token: opts.code.trim(),
    window: 1, // ±1 × 30s
  });
  return delta !== null;
}
