// ============================================================================
// Password complexity rules — Nidham SaaS
// ============================================================================
//
// Single source of truth for the password policy. Every password-setting
// path (signup, claim-invite, change-password, reset-password) calls
// `validatePassword` so the rules stay consistent — there used to be three
// different floors (6 / 6 / 8) across the codebase.
//
// Why these rules?
//   • length >= 12      — NIST 800-63B recommends length over rules; 12
//                          balances security with what humans tolerate.
//   • upper + lower     — defeats trivial dictionary brute force.
//   • digit             — separates "password" from "Password1".
//   • symbol            — pushes the entropy across the threshold.
//
// We deliberately DO NOT enforce:
//   - "no consecutive identical chars" (false positive on legit
//     strong passwords like "111aBc!22Z9!" )
//   - "must differ from previous N passwords" (would need to store
//     a hash history on profiles; punt to v2)
//   - dictionary check (would need an offline wordlist; punt)
//
// All Arabic error strings stay in this file so the auth pages don't
// translate twice.

export type PasswordValidation =
  | { ok: true }
  | { ok: false; reason: string };

export const PASSWORD_MIN_LENGTH = 12;

/**
 * Validate a password against the Nidham policy. Returns OK or a
 * user-readable Arabic reason for rejection.
 *
 * The first failing rule wins — we don't bombard the user with every
 * issue at once. The order also doubles as the user-facing checklist
 * shown on signup / change-password screens.
 */
export function validatePassword(password: unknown): PasswordValidation {
  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, reason: "كلمة السر مطلوبة" };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      reason: `كلمة السر لازم تكون ${PASSWORD_MIN_LENGTH} حرف على الأقل`,
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      ok: false,
      reason: "كلمة السر لازم تحتوي على حرف كابيتال (A-Z)",
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      ok: false,
      reason: "كلمة السر لازم تحتوي على حرف صغير (a-z)",
    };
  }
  if (!/\d/.test(password)) {
    return { ok: false, reason: "كلمة السر لازم تحتوي على رقم (0-9)" };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      ok: false,
      reason: "كلمة السر لازم تحتوي على رمز (مثل @ # ! % &)",
    };
  }
  return { ok: true };
}

/**
 * Human-readable rules list for showing on the signup / change-password
 * UI as a checklist. Kept in sync with validatePassword's actual rules
 * by living next to it.
 */
export const PASSWORD_RULES_AR: readonly string[] = [
  `${PASSWORD_MIN_LENGTH} حرف على الأقل`,
  "حرف كابيتال واحد على الأقل (A-Z)",
  "حرف صغير واحد على الأقل (a-z)",
  "رقم واحد على الأقل (0-9)",
  "رمز واحد على الأقل (@ # ! % & ...)",
];
