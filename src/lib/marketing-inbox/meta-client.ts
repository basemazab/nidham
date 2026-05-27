// ============================================================================
// Meta Graph API client — send replies to Messenger / Instagram
// ============================================================================
//
// Minimal HTTP wrapper around Meta's "Send API". One method that matters:
// `sendMessage` posts a reply to a given user (PSID for Messenger,
// IG-scoped-user-id for Instagram).
//
// References:
//   https://developers.facebook.com/docs/messenger-platform/send-messages
//   https://developers.facebook.com/docs/instagram-api/guides/messaging
//
// We don't use the Meta SDK because:
//   1. Single-purpose call — adding a 100KB SDK is overkill
//   2. We need fine-grained error handling (rate limits, token expiry)
//   3. Edge runtime compatibility — pure fetch works everywhere

import crypto from "crypto";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ── Send a message back to a user ──
export async function sendMetaMessage(input: {
  channel: "messenger" | "instagram";
  pageToken: string;       // Page Access Token (from settings)
  recipientId: string;     // PSID (Messenger) or IGSID (Instagram)
  text: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  // Messenger uses /me/messages, IG also uses /me/messages but with the
  // same Page token (since IG accounts are linked to a Page). The
  // recipient_id format differs but the call shape is identical.
  const url = `${GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(input.pageToken)}`;

  const body = {
    recipient: { id: input.recipientId },
    message: { text: input.text },
    messaging_type: "RESPONSE", // "I'm responding to a user-initiated message" — within 24h window
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as {
      message_id?: string;
      error?: { message?: string; code?: number };
    };

    if (!res.ok || data.error) {
      return {
        ok: false,
        error: data.error?.message || `HTTP ${res.status}`,
      };
    }

    return { ok: true, messageId: data.message_id || "" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Verify webhook signature ──
//
// Meta signs every webhook with HMAC-SHA256 of the body using the
// configured App Secret. We MUST verify this — otherwise anyone can
// post fake messages to our webhook and we'd process them.
//
// The signature comes in the `x-hub-signature-256` header as `sha256=HEX`.
export function verifyMetaSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  appSecret: string;
}): boolean {
  if (!input.signatureHeader || !input.appSecret) return false;

  const [algo, hex] = input.signatureHeader.split("=");
  if (algo !== "sha256" || !hex) return false;

  const expected = crypto
    .createHmac("sha256", input.appSecret)
    .update(input.rawBody, "utf8")
    .digest("hex");

  // Constant-time compare to dodge timing attacks
  if (expected.length !== hex.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(hex, "hex"),
    );
  } catch {
    return false;
  }
}

// ── Fetch user profile (display name + picture) ──
//
// Called lazily the first time we see a new external_user_id, so the
// inbox can show "Ahmed Ali" instead of a numeric PSID. Optional — if
// it fails (token scope insufficient), we just leave the fields null.
export async function fetchUserProfile(input: {
  channel: "messenger" | "instagram";
  pageToken: string;
  externalUserId: string;
}): Promise<{ name?: string; picture?: string } | null> {
  // For Messenger: GET /{psid}?fields=first_name,last_name,profile_pic
  // For Instagram: GET /{igsid}?fields=name,profile_pic
  const fields =
    input.channel === "messenger"
      ? "first_name,last_name,profile_pic"
      : "name,profile_pic";

  const url = `${GRAPH_BASE}/${input.externalUserId}?fields=${fields}&access_token=${encodeURIComponent(input.pageToken)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      first_name?: string;
      last_name?: string;
      name?: string;
      profile_pic?: string;
    };
    const name =
      data.name ||
      [data.first_name, data.last_name].filter(Boolean).join(" ") ||
      undefined;
    return {
      name,
      picture: data.profile_pic,
    };
  } catch {
    return null;
  }
}
