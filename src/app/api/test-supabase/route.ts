import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const res = await fetch("https://whedifdmllooyejzuwrw.supabase.co/auth/v1/settings", {
      headers: {
        apikey: key ?? "",
      },
    });

    const data = await res.json();

    return NextResponse.json({
      urlExists: !!url,
      keyExists: !!key,
      keyPrefix: key?.substring(0, 20),
      authStatus: res.status,
      authData: data,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack?.substring(0, 500) }, { status: 500 });
  }
}
