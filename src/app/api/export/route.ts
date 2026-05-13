import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

const STATUS_AR: Record<string, string> = {
  active: "نشط",
  on_leave: "في إجازة",
  terminated: "منتهي العمل",
  lead: "Lead",
  won: "تم البيع",
  lost: "ضاع",
  present: "حاضر",
  absent: "غايب",
  half_day: "نص يوم",
  leave: "إجازة",
  holiday: "إجازة رسمية",
  weekend: "إجازة أسبوعية",
};

const TYPE_AR: Record<string, string> = {
  call: "📞 مكالمة",
  whatsapp: "💬 واتساب",
  meeting: "🤝 اجتماع",
  email: "✉️ إيميل",
  visit: "🚶 زيارة",
  other: "📋 أخرى",
};

const OUTCOME_AR: Record<string, string> = {
  positive: "✓ إيجابية",
  neutral: "◐ متابعة",
  negative: "✗ سلبية",
};

const TYPE_PERSON_AR: Record<string, string> = {
  individual: "فرد",
  company: "شركة",
};

function ar(value: string | null | undefined, dict: Record<string, string>): string {
  if (!value) return "";
  return dict[value] ?? value;
}

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  // Strip time component if it has one
  return value.split("T")[0];
}

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
        "full_name, job_title, department, phone, email, hire_date, basic_salary, status, notes, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("customers")
      .select(
        "full_name, contact_name, type, phone, email, status, estimated_value, source, notes, created_at, employees:assigned_to(full_name)",
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

  // Flatten + translate to Arabic headers
  const employees = (employeesRes.data ?? []).map((row) => ({
    "الاسم": row.full_name,
    "المسمى الوظيفي": row.job_title ?? "",
    "القسم": row.department ?? "",
    "الموبايل": row.phone ?? "",
    "الإيميل": row.email ?? "",
    "تاريخ التعيين": formatDateOnly(row.hire_date),
    "الراتب الأساسي": row.basic_salary ?? "",
    "الحالة": ar(row.status, STATUS_AR),
    "ملاحظات": row.notes ?? "",
    "تاريخ الإضافة": formatDateOnly(row.created_at),
  }));

  const customers = (customersRes.data ?? []).map((row) => ({
    "الاسم": row.full_name,
    "جهة الاتصال": row.contact_name ?? "",
    "النوع": ar(row.type, TYPE_PERSON_AR),
    "الموبايل": row.phone ?? "",
    "الإيميل": row.email ?? "",
    "الحالة": ar(row.status, STATUS_AR),
    "المسؤول": (row.employees as unknown as { full_name?: string } | null)?.full_name ?? "",
    "القيمة المتوقعة": row.estimated_value ?? "",
    "المصدر": row.source ?? "",
    "ملاحظات": row.notes ?? "",
    "تاريخ الإضافة": formatDateOnly(row.created_at),
  }));

  const attendance = (attendanceRes.data ?? []).map((row) => ({
    "التاريخ": row.date,
    "الموظف": (row.employees as unknown as { full_name?: string } | null)?.full_name ?? "",
    "الحالة": ar(row.status, STATUS_AR),
    "وقت الحضور": row.check_in ?? "",
    "وقت الانصراف": row.check_out ?? "",
    "ساعات العمل": row.hours_worked ?? "",
    "ملاحظات": row.notes ?? "",
  }));

  const interactions = (interactionsRes.data ?? []).map((row) => ({
    "التاريخ": row.date,
    "الموظف": (row.employees as unknown as { full_name?: string } | null)?.full_name ?? "",
    "العميل": (row.customers as unknown as { full_name?: string } | null)?.full_name ?? "",
    "النوع": ar(row.type, TYPE_AR),
    "النتيجة": ar(row.outcome, OUTCOME_AR),
    "ملاحظات": row.notes ?? "",
  }));

  // Build workbook
  const wb = XLSX.utils.book_new();

  const buildSheet = (
    name: string,
    rows: Record<string, unknown>[],
    headers: string[],
  ) => {
    const data = rows.length === 0 ? [Object.fromEntries(headers.map((h) => [h, ""]))] : rows;
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    // RTL view for Arabic content
    if (!ws["!views"]) ws["!views"] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  buildSheet(
    "الموظفين",
    employees,
    ["الاسم", "المسمى الوظيفي", "القسم", "الموبايل", "الإيميل", "تاريخ التعيين", "الراتب الأساسي", "الحالة", "ملاحظات", "تاريخ الإضافة"],
  );
  buildSheet(
    "العملاء",
    customers,
    ["الاسم", "جهة الاتصال", "النوع", "الموبايل", "الإيميل", "الحالة", "المسؤول", "القيمة المتوقعة", "المصدر", "ملاحظات", "تاريخ الإضافة"],
  );
  buildSheet(
    "الحضور والانصراف",
    attendance,
    ["التاريخ", "الموظف", "الحالة", "وقت الحضور", "وقت الانصراف", "ساعات العمل", "ملاحظات"],
  );
  buildSheet(
    "التفاعلات (Bridge)",
    interactions,
    ["التاريخ", "الموظف", "العميل", "النوع", "النتيجة", "ملاحظات"],
  );

  const buffer: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const companyName =
    (profileRes.data?.companies as unknown as { name?: string } | null)?.name ??
    "nidham";
  const date = new Date().toISOString().split("T")[0];

  // HTTP headers only accept ASCII. Use RFC 5987 to encode the Arabic company
  // name into the filename — modern browsers use `filename*` to show the Arabic
  // name; older clients fall back to the ASCII `filename`.
  const asciiFallback = `nidham-backup-${date}.xlsx`;
  const utf8Encoded = encodeURIComponent(
    `nidham-backup-${companyName}-${date}.xlsx`,
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`,
    },
  });
}
