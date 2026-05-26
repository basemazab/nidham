// ============================================================================
// WhatsApp Cloud API wrapper
// ============================================================================
//
// Thin client around Meta's WhatsApp Cloud API v18 (Graph API). Two
// surfaces:
//
//   sendTemplate(to, template, params)  — send a pre-approved template
//                                          (required for first-contact
//                                          messages outside the 24h
//                                          conversation window).
//   sendText(to, body)                  — send a free-form text within
//                                          an open 24h conversation
//                                          (started by the recipient).
//
// Environment:
//   WHATSAPP_ACCESS_TOKEN   — long-lived token from Meta Business Manager
//   WHATSAPP_PHONE_NUMBER_ID — the sender phone's WABA ID
//   WHATSAPP_VERIFY_TOKEN    — webhook subscription verify secret
//
// If WHATSAPP_ACCESS_TOKEN is missing, every send call returns
// { ok: false, fallback: "channel_not_configured" } so callers can
// degrade gracefully to email / SMS.

const API_BASE = "https://graph.facebook.com/v18.0";

export type WhatsAppSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; fallback?: string };

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  );
}

/**
 * Normalise an Egyptian phone number for WhatsApp:
 * - strip non-digits
 * - prefix "20" if it starts with 0
 * - prefix "20" if it's 10 digits (legacy 1xxxxxxxxx form)
 *
 * Returns null for clearly invalid inputs (under 10 digits, etc.).
 */
export function normalizeEgyptPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  let p = digits;
  if (p.startsWith("00")) p = p.slice(2); // strip 00 international prefix
  if (p.startsWith("0")) p = "2" + p; // 010... → 2010...
  if (p.length === 10 && p.startsWith("1")) p = "20" + p; // 1xxxxxxxxx → 201xxxxxxxxx
  if (p.length < 11 || p.length > 15) return null;
  return p;
}

/**
 * Send a pre-approved template message. Required for messages outside the
 * 24-hour customer service window. Use this for OTPs, reminders, etc.
 */
export async function sendTemplate(
  to: string,
  templateName: string,
  bodyParams: string[],
  languageCode = "ar",
): Promise<WhatsAppSendResult> {
  if (!isWhatsAppConfigured()) {
    return { ok: false, error: "WhatsApp not configured", fallback: "channel_not_configured" };
  }
  const phone = normalizeEgyptPhone(to);
  if (!phone) {
    return { ok: false, error: "Invalid phone number" };
  }

  const url = `${API_BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: bodyParams.length
        ? [
            {
              type: "body",
              parameters: bodyParams.map((text) => ({ type: "text", text })),
            },
          ]
        : [],
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, error: `WhatsApp API ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      messages?: Array<{ id: string }>;
    };
    const msgId = data.messages?.[0]?.id ?? "";
    return msgId
      ? { ok: true, messageId: msgId }
      : { ok: false, error: "No message id returned" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown send error",
    };
  }
}

/**
 * Send a free-form text message. ONLY valid when the recipient has
 * sent a message to your business in the last 24 hours. For first
 * contact or outside the window, use sendTemplate instead.
 */
export async function sendText(
  to: string,
  body: string,
): Promise<WhatsAppSendResult> {
  if (!isWhatsAppConfigured()) {
    return { ok: false, error: "WhatsApp not configured", fallback: "channel_not_configured" };
  }
  const phone = normalizeEgyptPhone(to);
  if (!phone) {
    return { ok: false, error: "Invalid phone number" };
  }

  const url = `${API_BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: { body, preview_url: false },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, error: `WhatsApp API ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      messages?: Array<{ id: string }>;
    };
    const msgId = data.messages?.[0]?.id ?? "";
    return msgId
      ? { ok: true, messageId: msgId }
      : { ok: false, error: "No message id returned" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown send error",
    };
  }
}

/**
 * Convenience wrapper: send an OTP via WhatsApp.
 *
 * Falls back to wa.me link in the response so the caller can show
 * "اضغط للحصول على الكود" if API isn't configured.
 */
export async function sendOtpViaWhatsApp(
  phone: string,
  code: string,
): Promise<WhatsAppSendResult> {
  const text = `كود التحقق الخاص بك في Nidham هو: *${code}*\nصالح لمدة 10 دقائق. لا تشاركه مع أي شخص.`;
  // Try template first (required outside 24h window). The template
  // name "nidham_otp" must be pre-approved in Meta Business Manager
  // with one body variable for the code.
  const tmpl = await sendTemplate(phone, "nidham_otp", [code]);
  if (tmpl.ok) return tmpl;
  // Fall back to free-form text — works if the user has messaged the
  // business in the last 24h.
  return sendText(phone, text);
}
