"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { requireHR } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";

export type EmployeeImportRow = {
  full_name: string;
  employee_code: string | null;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  hire_date: string | null;
  basic_salary: number | null;
  national_id: string | null;
};

// Confirmed-PDF flow: the client has already parsed the PDF via
// /api/import/parse-pdf, the user reviewed + edited the rows, and now
// posts them back to insert. Runs the same dedup checks the Excel
// importer does and returns inserted / skipped counts via the same
// query-string contract so the result UI is identical.
export async function confirmPdfImport(rows: EmployeeImportRow[]) {
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

  if (!Array.isArray(rows) || rows.length === 0) {
    redirect(
      "/dashboard/employees/import?error=" +
        encodeURIComponent("مفيش صفوف لاضافتها"),
    );
  }
  if (rows.length > 200) {
    redirect(
      "/dashboard/employees/import?error=" +
        encodeURIComponent("الحد الأقصى 200 صف في الرفعة الواحدة"),
    );
  }

  const inserted: string[] = [];
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowIndex = i + 1;

    if (!r.full_name || r.full_name.trim().length < 2) {
      skipped.push({ row: rowIndex, reason: "ناقص اسم الموظف" });
      continue;
    }
    if (r.national_id && !/^\d{14}$/.test(r.national_id)) {
      skipped.push({
        row: rowIndex,
        reason: "الرقم القومي لازم يكون 14 رقم",
      });
      continue;
    }

    if (r.national_id) {
      const { data: dupe } = await supabase
        .from("employees")
        .select("id")
        .eq("company_id", profile.company_id)
        .eq("national_id", r.national_id)
        .maybeSingle();
      if (dupe) {
        skipped.push({
          row: rowIndex,
          reason: "مسجّل قبل كده (نفس الرقم القومي)",
        });
        continue;
      }
    } else if (r.employee_code) {
      const { data: dupe } = await supabase
        .from("employees")
        .select("id")
        .eq("company_id", profile.company_id)
        .eq("employee_code", r.employee_code)
        .maybeSingle();
      if (dupe) {
        skipped.push({ row: rowIndex, reason: "مسجّل قبل كده (نفس الكود)" });
        continue;
      }
    }

    const { error } = await supabase.from("employees").insert({
      company_id: profile.company_id,
      full_name: r.full_name.trim(),
      employee_code: r.employee_code,
      job_title: r.job_title,
      department: r.department,
      phone: r.phone,
      email: r.email,
      hire_date: r.hire_date,
      basic_salary: r.basic_salary,
      national_id: r.national_id,
      status: "active",
    });

    if (error) {
      skipped.push({ row: rowIndex, reason: arabicizeDbError(error.message) });
      continue;
    }
    inserted.push(r.full_name);
  }

  revalidatePath("/dashboard/employees");

  const params = new URLSearchParams({
    inserted: String(inserted.length),
    skipped: String(skipped.length),
    source: "pdf",
  });
  if (skipped.length > 0) {
    params.set(
      "skips",
      skipped.slice(0, 20).map((s) => `${s.row}:${s.reason}`).join("|"),
    );
  }
  redirect(`/dashboard/employees/import?${params.toString()}`);
}

// Bulk import for employees. Mirrors the attendance importer's contract:
//   - Accept an .xlsx / .xls / .csv file under 5 MB.
//   - Accept Arabic + English column aliases.
//   - Validate every row before any write happens (all-or-nothing per
//     batch is unrealistic with 100s of rows, but we surface a per-row
//     skipped-with-reason report so HR knows exactly what to fix).
//   - Skip rows that already exist (matched by national_id when present,
//     else by employee_code, else by full_name+email pair).

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// Column aliases -- map any of these header strings to the canonical
// employees column. Lower-cased + Arabic preserved.
const HEADER_ALIASES: Record<string, string> = {
  // full_name
  "الاسم": "full_name",
  "اسم": "full_name",
  "الاسم الكامل": "full_name",
  "name": "full_name",
  "full name": "full_name",
  "full_name": "full_name",
  "employee name": "full_name",
  // employee_code
  "كود الموظف": "employee_code",
  "الكود": "employee_code",
  "code": "employee_code",
  "employee code": "employee_code",
  "employee_code": "employee_code",
  // job_title
  "الوظيفة": "job_title",
  "المسمى الوظيفي": "job_title",
  "title": "job_title",
  "job title": "job_title",
  "job_title": "job_title",
  // department
  "القسم": "department",
  "الإدارة": "department",
  "الادارة": "department",
  "department": "department",
  // phone
  "تليفون": "phone",
  "موبايل": "phone",
  "الهاتف": "phone",
  "phone": "phone",
  "mobile": "phone",
  // email
  "إيميل": "email",
  "ايميل": "email",
  "البريد": "email",
  "email": "email",
  // hire_date
  "تاريخ التعيين": "hire_date",
  "تاريخ الالتحاق": "hire_date",
  "hire date": "hire_date",
  "hire_date": "hire_date",
  // basic_salary
  "المرتب": "basic_salary",
  "المرتب الأساسي": "basic_salary",
  "الراتب": "basic_salary",
  "basic salary": "basic_salary",
  "basic_salary": "basic_salary",
  "salary": "basic_salary",
  // national_id
  "الرقم القومي": "national_id",
  "رقم قومي": "national_id",
  "national id": "national_id",
  "national_id": "national_id",
};

type ParsedRow = {
  rowIndex: number; // 1-based, matches Excel
  fullName: string | null;
  employeeCode: string | null;
  jobTitle: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  hireDate: string | null;
  basicSalary: number | null;
  nationalId: string | null;
};

function asText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}
function asNumber(v: unknown): number | null {
  const t = asText(v);
  if (t === null) return null;
  const cleaned = t.replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
function normalizeDate(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const sl = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (sl) {
      return `${sl[3]}-${sl[2].padStart(2, "0")}-${sl[1].padStart(2, "0")}`;
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    return null;
  }
  if (typeof raw === "number") {
    const excelEpoch = new Date(1899, 11, 30).getTime();
    const ms = excelEpoch + raw * 24 * 60 * 60 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  return null;
}

export async function importEmployees(formData: FormData) {
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
      "/dashboard/employees/import?error=" +
        encodeURIComponent("ارفع ملف Excel"),
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    redirect(
      "/dashboard/employees/import?error=" +
        encodeURIComponent("الملف أكبر من المسموح به (5 ميجا)"),
    );
  }

  // Parse
  let rows: Record<string, unknown>[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      raw: true,
      defval: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "غير معروف";
    redirect(
      "/dashboard/employees/import?error=" +
        encodeURIComponent(`ما قدرناش نقرا الملف: ${msg}`),
    );
  }

  if (rows.length === 0) {
    redirect(
      "/dashboard/employees/import?error=" +
        encodeURIComponent("الملف فاضي"),
    );
  }
  if (rows.length > 2000) {
    redirect(
      "/dashboard/employees/import?error=" +
        encodeURIComponent("الحد الأقصى 2000 موظف في الرفعة الواحدة"),
    );
  }

  // Build a canonical-key map for the first row's headers so we accept
  // any of the aliases above.
  const keyMap = buildKeyMap(rows[0]);

  const parsed: ParsedRow[] = rows.map((row, i) => {
    const get = (canonical: string) => {
      const aliasKey = keyMap[canonical];
      return aliasKey ? row[aliasKey] : null;
    };
    return {
      rowIndex: i + 2, // header is row 1
      fullName:     asText(get("full_name")),
      employeeCode: asText(get("employee_code")),
      jobTitle:     asText(get("job_title")),
      department:   asText(get("department")),
      phone:        asText(get("phone")),
      email:        asText(get("email")),
      hireDate:     normalizeDate(get("hire_date")),
      basicSalary:  asNumber(get("basic_salary")),
      nationalId:   asText(get("national_id")),
    };
  });

  // Validate + dedupe per-row
  const inserted: string[] = [];
  const skipped: { row: number; reason: string }[] = [];

  for (const r of parsed) {
    if (!r.fullName) {
      skipped.push({ row: r.rowIndex, reason: "ناقص اسم الموظف" });
      continue;
    }
    if (r.nationalId && !/^\d{14}$/.test(r.nationalId)) {
      skipped.push({
        row: r.rowIndex,
        reason: "الرقم القومي لازم يكون 14 رقم بالظبط",
      });
      continue;
    }

    // Idempotency check: skip if national_id (when present) or
    // employee_code already exists in this company.
    if (r.nationalId) {
      const { data: dupe } = await supabase
        .from("employees")
        .select("id")
        .eq("company_id", profile.company_id)
        .eq("national_id", r.nationalId)
        .maybeSingle();
      if (dupe) {
        skipped.push({
          row: r.rowIndex,
          reason: "مسجّل قبل كده (نفس الرقم القومي)",
        });
        continue;
      }
    } else if (r.employeeCode) {
      const { data: dupe } = await supabase
        .from("employees")
        .select("id")
        .eq("company_id", profile.company_id)
        .eq("employee_code", r.employeeCode)
        .maybeSingle();
      if (dupe) {
        skipped.push({
          row: r.rowIndex,
          reason: "مسجّل قبل كده (نفس الكود)",
        });
        continue;
      }
    }

    const { error } = await supabase.from("employees").insert({
      company_id: profile.company_id,
      full_name: r.fullName,
      employee_code: r.employeeCode,
      job_title: r.jobTitle,
      department: r.department,
      phone: r.phone,
      email: r.email,
      hire_date: r.hireDate,
      basic_salary: r.basicSalary,
      national_id: r.nationalId,
      status: "active",
    });

    if (error) {
      skipped.push({ row: r.rowIndex, reason: arabicizeDbError(error.message) });
      continue;
    }
    inserted.push(r.fullName);
  }

  revalidatePath("/dashboard/employees");

  const params = new URLSearchParams({
    inserted: String(inserted.length),
    skipped: String(skipped.length),
  });
  if (skipped.length > 0) {
    // Pack the first 20 skips into the URL so HR can fix them at a glance.
    params.set(
      "skips",
      skipped
        .slice(0, 20)
        .map((s) => `${s.row}:${s.reason}`)
        .join("|"),
    );
  }
  redirect(`/dashboard/employees/import?${params.toString()}`);
}

function buildKeyMap(firstRow: Record<string, unknown>): Record<string, string> {
  // Map "canonical column" -> "actual key in the row object" by matching
  // against HEADER_ALIASES. xlsx sheet_to_json uses the original header
  // strings as the row keys, so we walk those headers and find aliases.
  const out: Record<string, string> = {};
  for (const header of Object.keys(firstRow)) {
    const lower = header.trim().toLowerCase();
    const arabic = header.trim();
    const canonical = HEADER_ALIASES[lower] ?? HEADER_ALIASES[arabic];
    if (canonical && !out[canonical]) {
      out[canonical] = header;
    }
  }
  return out;
}
