// ============================================================================
// /api/whatsapp/webhook — WhatsApp Cloud API incoming-message receiver
// ============================================================================
//
// Meta calls this in two ways:
//
//   GET  hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
//        — subscription handshake; we echo back the challenge if the
//          verify token matches our env.
//
//   POST { entry: [{ changes: [{ value: { messages: [...] } }] }] }
//        — incoming user messages. We route them through the bot's
//          intent parser and reply.
//
// We use the service-role Supabase client because incoming messages
// have no auth context — we need to look up the sender's phone across
// all employees to find which tenant they belong to, then enforce
// tenant scoping in the response.

import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendText, normalizeEgyptPhone } from "@/lib/whatsapp";
import { routeBotMessage } from "@/lib/whatsapp-bot";

type IncomingMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
};

type WebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: IncomingMessage[];
        metadata?: { phone_number_id?: string; display_phone_number?: string };
      };
    }>;
  }>;
};

// ── GET: Meta subscription handshake ──
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expected) {
    return new Response("Server missing WHATSAPP_VERIFY_TOKEN", { status: 500 });
  }

  if (mode === "subscribe" && token === expected && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Verification failed", { status: 403 });
}

// ── POST: incoming messages ──
export async function POST(req: Request) {
  // Always return 200 quickly — Meta retries aggressively on non-2xx,
  // and we don't want to backfill duplicates if our handler is slow.
  // Background-process the message after returning.
  let body: WebhookPayload;
  try {
    body = (await req.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Collect every message in the payload (Meta batches them)
  const messages: IncomingMessage[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        messages.push(msg);
      }
    }
  }

  // Process replies via `after()` so the response returns immediately but
  // the async work survives past response close. On Vercel serverless,
  // a plain `void Promise.all(...)` gets killed when the function returns
  // and replies may never send. `after()` is the supported way to extend
  // the function lifetime for post-response work.
  after(async () => {
    try {
      await Promise.all(messages.map(processMessage));
    } catch (err) {
      console.error("[whatsapp-webhook]", err);
    }
  });

  return NextResponse.json({ ok: true });
}

async function processMessage(msg: IncomingMessage) {
  if (msg.type !== "text" || !msg.text?.body) return;
  const fromPhone = normalizeEgyptPhone(msg.from);
  if (!fromPhone) return;

  const supabase = createServiceClient();

  // Find the employee by phone. We try several normalisation forms
  // because employee phones might be stored as "01055356622",
  // "+201055356622", "201055356622", etc.
  //
  // ⚠ NO company_id scoping here — we have no way to know which tenant
  // the message is for, since incoming WhatsApp messages don't carry
  // tenant identity. So if two tenants happen to have an employee with
  // the same phone number (a real person who works at two companies),
  // the bot would respond with whichever row Supabase returned first —
  // potentially leaking the wrong company's data.
  //
  // Mitigation: fetch ALL matches across tenants. If there's exactly ONE
  // active match, reply with that tenant's data (intended use case). If
  // multiple tenants share the phone, we refuse to reply and tell the
  // user to specify the company — the alternative (silently picking one)
  // is a tenant data leak.
  const candidates = [
    fromPhone,
    "0" + fromPhone.slice(2), // 201xxxxxxxxx → 01xxxxxxxxx
    "+" + fromPhone,           // → +20...
    fromPhone.slice(2),        // → 1xxxxxxxxx (legacy)
  ];

  const { data: matches } = await supabase
    .from("employees")
    .select("id, company_id, full_name, phone, status, companies(name)")
    .in("phone", candidates)
    .eq("status", "active")
    .returns<Array<{
      id: string;
      company_id: string;
      full_name: string;
      phone: string | null;
      status: string;
      companies: { name: string } | null;
    }>>();

  const matchList = matches ?? [];
  const incomingText = msg.text.body.trim();

  // Multiple tenants share this phone — refuse to reply to avoid data leak
  if (matchList.length > 1) {
    const companyNames = matchList
      .map((m) => m.companies?.name)
      .filter(Boolean)
      .join(" / ");
    await sendText(
      fromPhone,
      `الرقم ده مسجّل في أكتر من شركة (${companyNames}). لأمان بياناتك، كلم HR في الشركة المطلوبة مباشرة.`,
    );
    return;
  }

  const employee = matchList[0];

  if (!employee) {
    // Unknown sender — friendly hint + opt-out info. Don't reveal we're
    // an HR system to random spammers; keep the reply generic.
    await sendText(
      fromPhone,
      "أهلاً 👋 الرقم ده مش مسجّل عندنا كموظف. لو محتاج مساعدة، تواصل مع HR الشركة بتاعتك مباشرة. شكراً!",
    );
    return;
  }

  // Route the message through the bot
  try {
    const reply = await routeBotMessage(supabase, employee, incomingText);
    if (reply) {
      await sendText(fromPhone, reply);
    }
  } catch (err) {
    console.error("[whatsapp-bot]", err);
    await sendText(
      fromPhone,
      "حصل عطل بسيط من جانبنا. جرب تاني بعد دقايق، أو كلم HR مباشرة.",
    );
  }
}
