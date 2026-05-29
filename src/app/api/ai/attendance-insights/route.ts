import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeAttendanceAnomalies } from "@/lib/attendance-intelligence";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, company_id, role")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.company_id) {
      return Response.json({ error: "No company" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const days = Math.min(parseInt(searchParams.get("days") || "7"), 90);

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split("T")[0];

    const { data: attendanceData, error: attErr } = await supabase
      .from("attendance")
      .select("employee_id, date, check_in, check_out, status, tardiness_minutes, early_leave_minutes")
      .eq("company_id", profile.company_id)
      .gte("date", sinceStr)
      .order("date", { ascending: false });

    if (attErr) throw attErr;

    const { data: employees } = await supabase
      .from("employees")
      .select("id, full_name, department")
      .eq("company_id", profile.company_id);

    if (!employees || !attendanceData) {
      return Response.json({ insights: null, summary: { totalAnomalies: 0 } });
    }

    const mapped = attendanceData.map((r: any) => ({
      ...r,
      employee_name: employees.find((e: any) => e.id === r.employee_id)?.full_name || "",
    }));

    const insights = analyzeAttendanceAnomalies(mapped, employees);

    return Response.json(insights);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
