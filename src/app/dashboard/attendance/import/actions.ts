"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { requireHR } from "@/lib/permissions";
import { bustDashboardCache } from "@/lib/cache";

// Hard cap on uploaded file size. XLSX.read loads the whole buffer
// into memory, so accepting an arbitrarily-large workbook is an easy
// OOM vector. 5 MB covers any plausible monthly attendance sheet.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const VALID_STATUSES = new Set([
  "present",
  "absent",
  "half_day",
  "leave",
  "holiday",
  "weekend",
]);

// Status aliases — accept Arabic names from manual users too
const STATUS_ALIASES: Record<string, string> = {
  "حاضر": "present",
  "حضور": "present",
  "غايب": "absent",
  "غائب": "absent",
  "غياب": "absent",
  "نص يوم": "half_day",
  "نصف يوم": "half_day",
  "إجازة": "leave",
  "اجازة": "leave",
  "إجازة رسمية": "holiday",
  "اجازة رسمية": "holiday",
  "إجازة أسبوعية": "weekend",
  "اجازة اسبوعية": "weekend",
};

type ParsedRow = {
  rowIndex: number;
  employeeCode: string | null;
  fullName: string | null;
  date: string | null;
  status: string | null;
  checkIn: string | null;
  checkOut: string | null;
  notes: string | null;
};

function normalizeStatus(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.toString().trim().toLowerCase();
  if (VALID_STATUSES.has(v)) return v;
  // Try Arabic aliases (don't lowercase Arabic)
  const rawTrimmed = raw.toString().trim();
  if (STATUS_ALIASES[rawTrimmed]) return STATUS_ALIASES[rawTrimmed];
  return null;
}

function normalizeDate(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    // Already a string — check ISO format
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    // Try DD/MM/YYYY
    const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      const day = slashMatch[1].padStart(2, "0");
      const month = slashMatch[2].padStart(2, "0");
      return `${slashMatch[3]}-${month}-${day}`;
    }
    // Try Date parse
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    return null;
  }
  if (typeof raw === "number") {
    // Excel serial date number
    const excelEpoch = new Date(1899, 11, 30).getTime();
    const ms = excelEpoch + raw * 24 * 60 * 60 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  return null;
}

function normalizeTime(raw: unknown): string | null {
  if (!raw && raw !== 0) return null;
  if (typeof raw === "string" && raw.trim()) {
    // Already a string like "08:30" or "08:30:00"
    const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      return `${match[1].padStart(2, "0")}:${match[2]}:${match[3] ?? "00"}`;
    }
    return null;
  }
  if (typeof raw === "number") {
    // Excel time as fraction of day
    const totalSeconds = Math.round(raw * 24 * 60 * 60);
    const hh = Math.floor(totalSeconds / 3600);
    const mm = Math.floor((totalSeconds % 3600) / 60);
    const ss = totalSeconds % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  return null;
}

export async function importAttendance(formData: FormData) {
  await requireHR();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Profile not found");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(
      "/dashboard/attendance/import?error=" +
        encodeURIComponent("ارفع ملف Excel"),
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    redirect(
      "/dashboard/attendance/import?error=" +
        encodeURIComponent("الملف أكبر من المسموح به (5 ميجا)"),
    );
  }

  // Parse file
  let rows: Record<string, unknown>[];
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: null });
  } catch (e) {
    redirect(
      "/dashboard/attendance/import?error=" +
        encodeURIComponent(
          "ملف Excel غير صالح: " + (e instanceof Error ? e.message : "error"),
        ),
    );
  }

  // Map column names (accept Arabic + English)
  const colNames = {
    code: ["كود الموظف", "employee_code", "code", "id"],
    name: ["الاسم", "full_name", "name", "employee_name"],
    date: ["التاريخ", "date"],
    status: ["الحالة", "status"],
    checkIn: ["وقت الحضور", "check_in", "in", "checkin"],
    checkOut: ["وقت الانصراف", "check_out", "out", "checkout"],
    notes: ["ملاحظات", "notes", "note"],
  };

  const getField = (row: Record<string, unknown>, keys: string[]): string | null => {
    for (const k of keys) {
      const v = row[k];
      if (v !== null && v !== undefined && v !== "") return String(v);
    }
    return null;
  };

  // Fetch all active employees for matching
  const { data: employees } = await supabase
    .from("employees")
    .select("id, employee_code, full_name")
    .eq("company_id", profile.company_id);

  type EmpRow = { id: string; employee_code: string | null; full_name: string };
  const empList: EmpRow[] = employees ?? [];

  const findEmployee = (code: string | null, name: string | null): EmpRow | null => {
    if (code) {
      const byCode = empList.find(
        (e) => e.employee_code && e.employee_code.toLowerCase() === code.toLowerCase(),
      );
      if (byCode) return byCode;
    }
    if (name) {
      const byName = empList.find(
        (e) => e.full_name.trim().toLowerCase() === name.trim().toLowerCase(),
      );
      if (byName) return byName;
    }
    return null;
  };

  const records: Array<{
    company_id: string;
    employee_id: string;
    date: string;
    status: string;
    check_in: string | null;
    check_out: string | null;
    notes: string | null;
    created_by: string;
  }> = [];
  const errors: string[] = [];
  let skipped = 0;

  rows.forEach((row, i) => {
    const rowNum = i + 2; // +2 because row 1 is header, and rows are 1-indexed
    const code = getField(row, colNames.code);
    const name = getField(row, colNames.name);
    const dateRaw = getField(row, colNames.date);
    const statusRaw = getField(row, colNames.status);

    const date = normalizeDate(dateRaw);
    const status = normalizeStatus(statusRaw);

    if (!date) {
      errors.push(`السطر ${rowNum}: تاريخ مش صالح`);
      skipped++;
      return;
    }
    if (!status) {
      errors.push(`السطر ${rowNum}: حالة مش صالحة (${statusRaw ?? "فارغة"})`);
      skipped++;
      return;
    }

    const emp = findEmployee(code, name);
    if (!emp) {
      errors.push(`السطر ${rowNum}: مفيش موظف بكود "${code ?? "—"}" أو اسم "${name ?? "—"}"`);
      skipped++;
      return;
    }

    records.push({
      company_id: profile.company_id,
      employee_id: emp.id,
      date,
      status,
      check_in: normalizeTime(getField(row, colNames.checkIn)),
      check_out: normalizeTime(getField(row, colNames.checkOut)),
      notes: getField(row, colNames.notes),
      created_by: user.id,
    });
  });

  if (records.length === 0) {
    redirect(
      "/dashboard/attendance/import?error=" +
        encodeURIComponent(
          `لم يتم استيراد أي سجل. ${skipped} سطر فيهم أخطاء. ${errors.slice(0, 3).join(" · ")}`,
        ),
    );
  }

  const { error: upsertError } = await supabase
    .from("attendance")
    .upsert(records, { onConflict: "employee_id,date" });

  if (upsertError) {
    redirect(
      "/dashboard/attendance/import?error=" +
        encodeURIComponent("خطأ في الحفظ: " + upsertError.message),
    );
  }

  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/reports/attendance");
  bustDashboardCache();

  const errorSummary =
    errors.length > 0
      ? `&errors=${encodeURIComponent(errors.slice(0, 10).join("\n"))}`
      : "";
  redirect(
    `/dashboard/attendance/import?imported=${records.length}&skipped=${skipped}${errorSummary}`,
  );
}
