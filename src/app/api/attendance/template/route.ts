import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

type EmployeeRow = {
  employee_code: string | null;
  full_name: string;
  department: string | null;
};

// Generates an Excel template for bulk attendance import, pre-filled with the
// company's current active employees and today's date.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: employees } = await supabase
    .from("employees")
    .select("employee_code, full_name, department")
    .eq("status", "active")
    .order("full_name")
    .returns<EmployeeRow[]>();

  const today = new Date().toISOString().split("T")[0];

  const rows = (employees ?? []).map((e) => ({
    "كود الموظف": e.employee_code ?? "",
    "الاسم": e.full_name,
    "القسم": e.department ?? "",
    "التاريخ": today,
    "الحالة": "present", // present | absent | half_day | leave
    "وقت الحضور": "",
    "وقت الانصراف": "",
    "ملاحظات": "",
  }));

  // If no employees, include a single sample row so user sees the format
  if (rows.length === 0) {
    rows.push({
      "كود الموظف": "100",
      "الاسم": "اسم الموظف",
      "القسم": "—",
      "التاريخ": today,
      "الحالة": "present",
      "وقت الحضور": "08:30",
      "وقت الانصراف": "17:00",
      "ملاحظات": "",
    });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      "كود الموظف",
      "الاسم",
      "القسم",
      "التاريخ",
      "الحالة",
      "وقت الحضور",
      "وقت الانصراف",
      "ملاحظات",
    ],
  });
  if (!ws["!views"]) ws["!views"] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, ws, "الحضور");

  // Reference sheet listing valid status codes
  const referenceRows = [
    { "الكود": "present", "المعنى": "حاضر" },
    { "الكود": "absent", "المعنى": "غايب" },
    { "الكود": "half_day", "المعنى": "نص يوم" },
    { "الكود": "leave", "المعنى": "إجازة" },
    { "الكود": "holiday", "المعنى": "إجازة رسمية" },
    { "الكود": "weekend", "المعنى": "إجازة أسبوعية" },
  ];
  const refWs = XLSX.utils.json_to_sheet(referenceRows);
  if (!refWs["!views"]) refWs["!views"] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, refWs, "أكواد الحالة");

  const buffer: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const filename = `nidham-attendance-template-${today}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
