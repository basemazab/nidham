import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await request.json();
    const { subscription, deviceName } = body;

    if (!subscription) {
      return NextResponse.json({ error: "المعطيات ناقصة" }, { status: 400 });
    }

    const subJson = typeof subscription === "string"
      ? JSON.parse(subscription)
      : subscription;

    await supabase
      .from("user_sessions")
      .update({
        push_subscription: subJson,
        push_enabled: true,
        device_name: deviceName || null,
      })
      .eq("user_id", user.id)
      .eq("is_current", true);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    await supabase
      .from("user_sessions")
      .update({ push_subscription: null, push_enabled: false })
      .eq("user_id", user.id)
      .eq("is_current", true);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
