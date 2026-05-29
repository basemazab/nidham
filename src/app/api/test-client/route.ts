import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const tests: Record<string, any> = {};

  tests.envCheck = { urlExists: !!url, keyExists: !!key, keyPrefix: key?.substring(0, 15) };

  try {
    const res = await fetch(`${url}/rest/v1/notifications?select=id&limit=1`, {
      headers: {
        apikey: key ?? "",
        Authorization: `Bearer ${key ?? ""}`,
      },
    });
    tests.restApi = { status: res.status, statusText: res.statusText };
    tests.restBody = await res.text().then((t) => t.substring(0, 200));
  } catch (e: any) {
    tests.restApi = { error: e.message };
  }

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: key ?? "",
        Authorization: `Bearer ${key ?? ""}`,
      },
    });
    tests.authApi = { status: res.status, statusText: res.statusText };
    tests.authBody = await res.text().then((t) => t.substring(0, 200));
  } catch (e: any) {
    tests.authApi = { error: e.message };
  }

  return NextResponse.json(tests);
}
