// Email notifications via Resend.
//
// Wired in as fire-and-forget from the relevant server actions: HR
// decides a leave request -> employee gets an Arabic email. Mark advance
// as paid -> employee gets an Arabic email. Generate invitation token
// -> employee gets an Arabic email with the code.
//
// All sends go through `sendEmail(...)` which:
//   - skips silently when RESEND_API_KEY is unset (dev / not wired
//     yet -- we don't want to crash the action just because email is
//     misconfigured).
//   - never throws; logs to console.warn on failure.
// The audit log captures the underlying business event regardless,
// so a missing email won't lose data.

type EmailInput = {
  to: string;
  subject: string;
  html: string;
  // Optional plain-text alternative (better inbox placement).
  text?: string;
  // From address. Defaults to RESEND_FROM_EMAIL or
  // "Nidham <notifications@nidham.app>" -- callers usually don't pass it.
  from?: string;
  // Reply-to. Defaults to RESEND_REPLY_TO or undefined.
  replyTo?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string };

/**
 * Send an email via Resend. Returns a tagged result so callers can log
 * but do not need to try/catch -- this function never throws.
 */
export async function sendEmail(input: EmailInput): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Don't log on every send; that would spam the dev console. Just
    // skip silently with a tagged result.
    return { ok: false, skipped: true, reason: "RESEND_API_KEY not set" };
  }

  // FROM: ⚠ requires a Resend-verified domain. The default below assumes
  // nidham.app is verified; until then, set RESEND_FROM_EMAIL to a
  // verified address (or Resend's onboarding sandbox).
  const from =
    input.from ||
    process.env.RESEND_FROM_EMAIL ||
    "Nidham <notifications@nidham.app>";

  // REPLY-TO: when an employee hits "reply" on a system email, the
  // reply should land in a real mailbox -- not bounce back to a
  // noreply notifications@ address. Defaults to our Proton support
  // mailbox so feedback always reaches a human.
  const replyTo =
    input.replyTo ?? process.env.RESEND_REPLY_TO ?? "nidhamhr@proton.me";

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: wrapHtml(input.html),
        text: input.text,
        reply_to: replyTo,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
       
      console.warn(
        `[email] Resend returned ${res.status} for ${input.to}: ${detail.slice(0, 200)}`,
      );
      return {
        ok: false,
        skipped: false,
        error: `Resend HTTP ${res.status}`,
      };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id ?? "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
     
    console.warn(`[email] Send failed for ${input.to}: ${msg}`);
    return { ok: false, skipped: false, error: msg };
  }
}

// ----------------------------------------------------------------------------
// Templates -- keep them inline so changes are obvious from one file.
// All templates render an RTL Arabic body.
// ----------------------------------------------------------------------------

const BRAND_NAVY = "#0a1428";
const BRAND_CYAN = "#0891b2";
const BRAND_GOLD = "#c9a84c";

function wrapHtml(inner: string): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Tajawal,Cairo,'Segoe UI',Tahoma,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <tr><td style="background:${BRAND_NAVY};padding:24px;text-align:center;color:#fff;">
          <div style="font-size:28px;font-weight:900;letter-spacing:1px;">نِظام</div>
          <div style="font-size:11px;letter-spacing:3px;color:${BRAND_GOLD};margin-top:4px;">NIDHAM</div>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#0f172a;font-size:15px;line-height:1.7;">
          ${inner}
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;color:#64748b;font-size:11px;text-align:center;">
          الرسالة دي بعتت لك من نظام نِظام لإدارة الموارد البشرية. لو مش متوقعها كلّم HR في شركتك.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// -- Templates -------------------------------------------------------------

export function emailLeaveDecision(opts: {
  to: string;
  employeeName: string;
  leaveTypeAr: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  decision: "approved" | "rejected";
  hrNotes: string | null;
}): EmailInput {
  const verdictTitle =
    opts.decision === "approved" ? "تمت الموافقة ✓" : "اعتذرنا — الطلب مرفوض";
  const verdictColor =
    opts.decision === "approved" ? "#10b981" : "#ef4444";

  return {
    to: opts.to,
    subject: `${verdictTitle} على طلب ${opts.leaveTypeAr} (${opts.startDate})`,
    html: `
      <h2 style="margin:0 0 12px 0;color:${verdictColor};font-size:20px;">${verdictTitle}</h2>
      <p>أهلاً ${escapeHtml(opts.employeeName)}،</p>
      <p>طلب ${escapeHtml(opts.leaveTypeAr)} من <b>${opts.startDate}</b> إلى <b>${opts.endDate}</b> (${opts.daysCount} يوم) ${opts.decision === "approved" ? "اتمت الموافقة عليه" : "للأسف مرفوض"}.</p>
      ${opts.hrNotes ? `<p style="background:#f8fafc;border-right:4px solid ${BRAND_CYAN};padding:12px 16px;border-radius:8px;"><b>ملاحظة HR:</b> ${escapeHtml(opts.hrNotes)}</p>` : ""}
      <p style="color:#64748b;font-size:13px;">للاطلاع على تفاصيل طلباتك، افتح تطبيق Nidham على الموبايل.</p>
    `,
    text: `${verdictTitle}: طلب ${opts.leaveTypeAr} (${opts.startDate} -> ${opts.endDate}, ${opts.daysCount} يوم).${opts.hrNotes ? "\nملاحظة HR: " + opts.hrNotes : ""}`,
  };
}

export function emailAdvanceDecision(opts: {
  to: string;
  employeeName: string;
  amount: number;
  installments: number;
  decision: "approved" | "rejected";
  hrNotes: string | null;
}): EmailInput {
  const verdictTitle =
    opts.decision === "approved" ? "تمت الموافقة ✓" : "اعتذرنا — السلفة مرفوضة";
  const verdictColor =
    opts.decision === "approved" ? "#10b981" : "#ef4444";

  return {
    to: opts.to,
    subject: `${verdictTitle} على طلب سلفة بقيمة ${opts.amount} ج`,
    html: `
      <h2 style="margin:0 0 12px 0;color:${verdictColor};font-size:20px;">${verdictTitle}</h2>
      <p>أهلاً ${escapeHtml(opts.employeeName)}،</p>
      <p>طلب سلفة بقيمة <b>${opts.amount.toLocaleString("ar-EG")} ج</b> على <b>${opts.installments}</b> قسط ${opts.decision === "approved" ? "اتمت الموافقة عليه" : "للأسف مرفوض"}.</p>
      ${opts.hrNotes ? `<p style="background:#f8fafc;border-right:4px solid ${BRAND_CYAN};padding:12px 16px;border-radius:8px;"><b>ملاحظة HR:</b> ${escapeHtml(opts.hrNotes)}</p>` : ""}
      ${opts.decision === "approved" ? `<p style="color:#64748b;font-size:13px;">هتلاقي مبلغ الصرف موضّح في قسائم مرتباتك الجاية على التطبيق.</p>` : ""}
    `,
    text: `${verdictTitle}: سلفة ${opts.amount} ج / ${opts.installments} قسط.${opts.hrNotes ? "\nملاحظة HR: " + opts.hrNotes : ""}`,
  };
}

export function emailAdvancePaid(opts: {
  to: string;
  employeeName: string;
  amount: number;
}): EmailInput {
  return {
    to: opts.to,
    subject: `تم صرف السلفة (${opts.amount.toLocaleString("ar-EG")} ج)`,
    html: `
      <h2 style="margin:0 0 12px 0;color:#10b981;font-size:20px;">تم الصرف ✓</h2>
      <p>أهلاً ${escapeHtml(opts.employeeName)}،</p>
      <p>تم صرف السلفة بقيمة <b>${opts.amount.toLocaleString("ar-EG")} ج</b>. هتلاقي تفاصيل الأقساط الشهرية في قسائم مرتباتك الجاية على التطبيق.</p>
    `,
    text: `تم صرف السلفة (${opts.amount} ج).`,
  };
}

export function emailMobileInvitation(opts: {
  to: string;
  employeeName: string;
  inviteToken: string;
}): EmailInput {
  return {
    to: opts.to,
    subject: `كود دعوة Nidham — للموظفين`,
    html: `
      <h2 style="margin:0 0 12px 0;color:${BRAND_CYAN};font-size:20px;">أهلاً ${escapeHtml(opts.employeeName)} 👋</h2>
      <p>HR في شركتك دعاك تستخدم تطبيق <b>Nidham للموظفين</b> على الموبايل عشان:</p>
      <ul style="padding-right:20px;">
        <li>تثبيت حضور وانصراف من موقعك (GPS)</li>
        <li>تقديم طلبات إجازة وسلفة واستئذان</li>
        <li>متابعة قسائم مرتبك الشهرية</li>
      </ul>
      <p>كود الدعوة الخاص بك:</p>
      <div style="background:#0a1428;color:#22d3ee;font-family:monospace;font-size:14px;padding:14px 18px;border-radius:10px;word-break:break-all;letter-spacing:1px;text-align:center;direction:ltr;">${escapeHtml(opts.inviteToken)}</div>
      <p style="color:#64748b;font-size:13px;margin-top:14px;">حمّل التطبيق من Google Play أو App Store (قريبًا)، وادخل الكود ده في خطوة التسجيل.</p>
    `,
    text: `كود دعوة Nidham للموظفين:\n${opts.inviteToken}\n\nادخل الكود في التطبيق عند التسجيل.`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
