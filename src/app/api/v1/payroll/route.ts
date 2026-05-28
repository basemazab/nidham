import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  authenticateApiRequest,
  jsonResponse,
  errorResponse,
} from "@/lib/api/middleware";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, "payroll:read");
  if (!auth.authenticated) {
    return errorResponse(auth.error!, auth.status!);
  }

  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const periodId = searchParams.get("period_id");
  const year = searchParams.get("year");

  let query = supabase
    .from("payroll_entries")
    .select(
      "*, employees!inner(id, employee_code, full_name, department, job_title)",
    )
    .eq("company_id", auth.companyId!)
    .order("created_at", { ascending: false })
    .limit(100);

  if (periodId) query = query.eq("period_id", periodId);

  const { data, error } = await query;

  if (error) {
    return errorResponse(error.message, 500);
  }

  return jsonResponse({ data });
}
