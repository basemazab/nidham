// ============================================================================
// POST /api/sign/[token]/submit — public signature submission
// ============================================================================
//
// Body: { signer_name: string, signature_png: data URL }
// Response: { ok: true } | { ok: false, error }
//
// No auth — the token in the URL path is the only access control. We
// validate it server-side, check the request state, then upsert the
// capture row + mark the request as signed.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const MAX_PNG_LENGTH = 500_000; // ~500KB base64 data URL

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Token مفقود" },
      { status: 400 },
    );
  }

  let body: { signer_name?: string; signature_png?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const signerName = String(body.signer_name ?? "").trim();
  const signaturePng = String(body.signature_png ?? "");

  if (!signerName) {
    return NextResponse.json(
      { ok: false, error: "اسمك مطلوب" },
      { status: 400 },
    );
  }
  if (!signaturePng.startsWith("data:image/png;base64,")) {
    return NextResponse.json(
      { ok: false, error: "صيغة التوقيع غير صحيحة" },
      { status: 400 },
    );
  }
  if (signaturePng.length > MAX_PNG_LENGTH) {
    return NextResponse.json(
      { ok: false, error: "حجم التوقيع كبير. ارسم توقيع أبسط." },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // Look up the request by token + check state
  const { data: request } = await supabase
    .from("signature_requests")
    .select("id, status, expires_at")
    .eq("token", token)
    .maybeSingle<{ id: string; status: string; expires_at: string | null }>();

  if (!request) {
    return NextResponse.json(
      { ok: false, error: "اللينك ده مش صحيح أو اتلغى" },
      { status: 404 },
    );
  }
  if (request.status !== "pending") {
    return NextResponse.json(
      {
        ok: false,
        error:
          request.status === "signed"
            ? "المستند ده اتوقّع بالفعل"
            : "الطلب ده مش متاح للتوقيع",
      },
      { status: 400 },
    );
  }
  if (request.expires_at && new Date(request.expires_at) < new Date()) {
    return NextResponse.json(
      { ok: false, error: "اللينك انتهت صلاحيته" },
      { status: 400 },
    );
  }

  // Capture the signer's IP + UA for the audit trail
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const ua = req.headers.get("user-agent") ?? null;

  // Insert capture row (bypassing the "deny anon inserts" RLS policy
  // via service-role client — we've validated the token already)
  const { error: capErr } = await supabase
    .from("signature_captures")
    .insert({
      request_id: request.id,
      signer_name: signerName,
      signature_png_data_url: signaturePng,
      signer_ip: ip,
      signer_user_agent: ua,
    });

  if (capErr) {
    return NextResponse.json(
      { ok: false, error: capErr.message },
      { status: 500 },
    );
  }

  // Mark the parent request as signed
  await supabase
    .from("signature_requests")
    .update({ status: "signed", signed_at: new Date().toISOString() })
    .eq("id", request.id);

  return NextResponse.json({ ok: true });
}
