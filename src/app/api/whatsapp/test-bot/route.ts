// ============================================================================
// POST /api/whatsapp/test-bot — preview a bot reply WITHOUT sending WhatsApp
// ============================================================================
//
// Lets HR test the bot's intent routing + data lookups end-to-end before
// going through the full Meta Business Account setup. The bot logic runs
// exactly as it would when a real WhatsApp message arrives — we just
// skip the final sendText() step.
//
// Body: { employee_id: string, text: string }
// Response: { ok: true, reply: string, employee: { full_name, phone } }
//
// Admin/HR only. Scoped to the caller's company.

import { NextResponse } from "next/server";
import { requireHR } from "@/lib/permissions";
import { routeBotMessage } from "@/lib/whatsapp-bot";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: Request) {
  try {
    const { supabase, profile } = await requireHR();

    const body = (await req.json()) as {
      employee_id?: string;
      text?: string;
    };
    const employeeId = String(body.employee_id ?? "").trim();
    const text = String(body.text ?? "").trim();

    if (!employeeId || !text) {
      return NextResponse.json(
        { ok: false, error: "employee_id + text مطلوبين" },
        { status: 400 },
      );
    }

    // Make sure the picked employee belongs to the caller's company
    const { data: emp } = await supabase
      .from("employees")
      .select("id, company_id, full_name, phone, status")
      .eq("id", employeeId)
      .eq("company_id", profile.company_id)
      .maybeSingle<{
        id: string;
        company_id: string;
        full_name: string;
        phone: string | null;
        status: string;
      }>();

    if (!emp) {
      return NextResponse.json(
        { ok: false, error: "الموظف ده مش موجود" },
        { status: 404 },
      );
    }

    // Use the service-role client so the bot can do its lookups across
    // tables that have RLS (mirrors what the real webhook does).
    const service = createServiceClient();
    const reply = await routeBotMessage(service, emp, text);

    return NextResponse.json({
      ok: true,
      reply,
      employee: { full_name: emp.full_name, phone: emp.phone },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
