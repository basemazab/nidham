import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashApiKey, validateApiKeyFormat } from "./keys";

export interface ApiAuthResult {
  authenticated: boolean;
  companyId?: string;
  error?: string;
  status?: number;
}

export async function authenticateApiRequest(
  req: NextRequest,
  requiredScope?: string,
): Promise<ApiAuthResult> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      authenticated: false,
      error: "مطلوب Bearer token في header Authorization",
      status: 401,
    };
  }

  const rawKey = authHeader.slice(7);
  if (!validateApiKeyFormat(rawKey)) {
    return {
      authenticated: false,
      error: "تنسيق مفتاح API غير صالح",
      status: 401,
    };
  }

  const keyHash = hashApiKey(rawKey);
  const supabase = await createClient();

  const { data: key, error } = await supabase
    .from("api_keys")
    .select("*, companies!inner(id)")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();

  if (error || !key) {
    return {
      authenticated: false,
      error: "مفتاح API غير صالح أو ملغي",
      status: 401,
    };
  }

  // Check expiry
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return {
      authenticated: false,
      error: "مفتاح API منتهي الصلاحية",
      status: 401,
    };
  }

  // Check scope
  if (requiredScope && !key.scopes.includes(requiredScope)) {
    return {
      authenticated: false,
      error: `لا يوجد صلاحية: ${requiredScope}`,
      status: 403,
    };
  }

  // Update last_used_at
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  return {
    authenticated: true,
    companyId: key.company_id,
  };
}

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-API-Version": "1.0.0",
    },
  });
}

export function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message, status },
    { status, headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
}
