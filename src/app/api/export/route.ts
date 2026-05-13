import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

// Exports all of the current user's company data (via RLS) as a single
// Excel workbook with one sheet per table. Acts as a self-service backup
// — addresses customer concerns about cloud data ownership.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RLS automatically scopes each query to the user's company.
  const [
    profileRes,
    employeesRes,
    customersRes,
    attendanceRes,
    interactionsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, role, companies(name, industry)")
      .eq("id", user.id)
      .single(),
    supabase
      .from("employees")
      .select(
        "id, full_name, job_title, department, phone, email, hire_date, basic_salary, status, notes, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("customers")
      .select(
        "id, full_name, contact_name, type, phone, email, status, estimated_value, source, notes, assigned_to, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("attendance")
      .select(
        "date, status, check_in, check_out, hours_worked, notes, employees(full_name)",
      )
      .order("date", { ascending: false }),
    supabase
      .from("interactions")
      .select(
        "date, type, outcome, notes, employees(full_name), customers(full_name)",
      )
      .order("date", { ascending: false }),
  ]);

  // Flatten nested relationships for clean Excel cells
  const attendanceFlat = (attendanceRes.data ?? []).map((row) => ({
    "التاريخ": row.date,
    "الموظف": (row.employees as unknown as { full_name?: string } | null)?.full_name ?? "",
    "الحالة": row.status,
    "وقت الحضور": row.check_in ?? "",
    "وقت الانصراف": row.check_out ?? "",
    "ساعات العمل": row.hours_worked ?? "",
    "ملاحظات": row.notes ?? "",
  }));

  const interactionsFlat = (interactionsRes.data ?? []).map((row) => ({
    "التاريخ": row.date,
    "الموظف": (row.employees as unknown as { full_name?: string } | null)?.full_name ?? "",
    "العميل": (row.customers as unknown as { full_name?: string } | null)?.full_name ?? "",
    "النوع": row.type,
    "النتيجة": row.outcome,
    "ملاحظات": row.notes ?? "",
  }));

  // Build workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(employeesRes.data ?? []),
    "الموظفين",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(customersRes.data ?? []),
    "العملاء",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(attendanceFlat),
    "الحضور والانصراف",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(interactionsFlat),
    "التفاعلات",
  );

  const buffer: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const companyName =
    (profileRes.data?.companies as unknown as { name?: string } | null)?.name ??
    "nidham";
  const safeName = companyName.replace(/[^؀-ۿa-zA-Z0-9_-]/g, "_");
  const date = new Date().toISOString().split("T")[0];
  const filename = `nidham-backup-${safeName}-${date}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
