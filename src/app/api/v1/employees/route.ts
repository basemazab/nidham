import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  authenticateApiRequest,
  jsonResponse,
  errorResponse,
} from "@/lib/api/middleware";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, "employees:read");
  if (!auth.authenticated) {
    return errorResponse(auth.error!, auth.status!);
  }

  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const status = searchParams.get("status");
  const department = searchParams.get("department");
  const offset = (page - 1) * limit;

  let query = supabase
    .from("employees")
    .select(
      "id, employee_code, full_name, job_title, department, phone, email, status, hire_date, basic_salary, created_at",
      { count: "exact" },
    )
    .eq("company_id", auth.companyId!)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (department) query = query.eq("department", department);

  const { data, error, count } = await query;

  if (error) {
    return errorResponse(error.message, 500);
  }

  return jsonResponse({
    data,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      total_pages: Math.ceil((count ?? 0) / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req, "employees:write");
  if (!auth.authenticated) {
    return errorResponse(auth.error!, auth.status!);
  }

  const supabase = await createClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from("employees")
    .insert({
      company_id: auth.companyId,
      ...body,
    })
    .select()
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse({ data }, 201);
}
