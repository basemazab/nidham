"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { requireHR } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";
import { bustDashboardCache } from "@/lib/cache";

export type EmployeeImportRow = {
  full_name: string;
  employee_code: string | null;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  hire_date: string | null;
  basic_salary: number | null;
  incentive_allowance: number | null;
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
      incentive_allowance: r.incentive_allowance,
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
  bustDashboardCache();

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
// employees column. Lower-cased for English, untouched for Arabic.
// We're permissive on purpose -- HR files come from a dozen vendors
// with their own naming conventions.
const HEADER_ALIASES: Record<string, string> = {
  // full_name
  "الاسم": "full_name",
  "اسم": "full_name",
  "الاسم الكامل": "full_name",
  "اسم الموظف": "full_name",
  "الاسم بالكامل": "full_name",
  "الموظف": "full_name",
  "الاسم رباعي": "full_name",
  "الإسم": "full_name",
  "اسم الموظفه": "full_name",
  "اسم بالكامل": "full_name",
  "name": "full_name",
  "full name": "full_name",
  "full_name": "full_name",
  "employee name": "full_name",
  "employee_name": "full_name",
  "emp name": "full_name",
  "staff name": "full_name",
  // employee_code
  "كود الموظف": "employee_code",
  "كود": "employee_code",
  "الكود": "employee_code",
  "كود موظف": "employee_code",
  "رقم الموظف": "employee_code",
  "رقم موظف": "employee_code",
  "id": "employee_code",
  "code": "employee_code",
  "employee code": "employee_code",
  "employee_code": "employee_code",
  "employee id": "employee_code",
  "emp id": "employee_code",
  "emp code": "employee_code",
  "staff id": "employee_code",
  // job_title
  "الوظيفة": "job_title",
  "المسمى الوظيفي": "job_title",
  "المسمى": "job_title",
  "الوظيفه": "job_title",
  "وظيفة": "job_title",
  "وظيفه": "job_title",
  "المهنة": "job_title",
  "title": "job_title",
  "job title": "job_title",
  "job_title": "job_title",
  "position": "job_title",
  "role": "job_title",
  // department
  "القسم": "department",
  "قسم": "department",
  "الإدارة": "department",
  "الادارة": "department",
  "ادارة": "department",
  "إدارة": "department",
  "department": "department",
  "dept": "department",
  "division": "department",
  // phone
  "تليفون": "phone",
  "تلفون": "phone",
  "موبايل": "phone",
  "محمول": "phone",
  "الهاتف": "phone",
  "هاتف": "phone",
  "رقم الهاتف": "phone",
  "رقم التليفون": "phone",
  "رقم الموبايل": "phone",
  "phone": "phone",
  "phone number": "phone",
  "mobile": "phone",
  "mobile number": "phone",
  "tel": "phone",
  "telephone": "phone",
  "contact": "phone",
  // email
  "إيميل": "email",
  "ايميل": "email",
  "الإيميل": "email",
  "الايميل": "email",
  "البريد": "email",
  "البريد الإلكتروني": "email",
  "البريد الالكتروني": "email",
  "البريد الاليكتروني": "email",
  "email": "email",
  "e-mail": "email",
  "email address": "email",
  "mail": "email",
  // hire_date
  "تاريخ التعيين": "hire_date",
  "تاريخ الالتحاق": "hire_date",
  "تاريخ الإلتحاق": "hire_date",
  "تاريخ بدء العمل": "hire_date",
  "تاريخ بداية العمل": "hire_date",
  "تاريخ الانضمام": "hire_date",
  "بداية العمل": "hire_date",
  "تاريخ تعيين": "hire_date",
  "التاريخ": "hire_date",
  "hire date": "hire_date",
  "hire_date": "hire_date",
  "date of joining": "hire_date",
  "joining date": "hire_date",
  "start date": "hire_date",
  "date of hire": "hire_date",
  // incentive_allowance (حافز)
  "حافز": "incentive_allowance",
  "الحافز": "incentive_allowance",
  "حافز شهري": "incentive_allowance",
  "incentive": "incentive_allowance",
  "incentive allowance": "incentive_allowance",
  "monthly incentive": "incentive_allowance",
  // basic_salary
  "المرتب": "basic_salary",
  "المرتب الأساسي": "basic_salary",
  "الراتب": "basic_salary",
  "الراتب الأساسي": "basic_salary",
  "الأساسي": "basic_salary",
  "الاساسي": "basic_salary",
  "مرتب": "basic_salary",
  "راتب": "basic_salary",
  "basic salary": "basic_salary",
  "basic_salary": "basic_salary",
  "salary": "basic_salary",
  "base salary": "basic_salary",
  "monthly salary": "basic_salary",
  // national_id
  "الرقم القومي": "national_id",
  "رقم قومي": "national_id",
  "رقم البطاقة": "national_id",
  "البطاقة": "national_id",
  "بطاقة": "national_id",
  "national id": "national_id",
  "national_id": "national_id",
  "national-id": "national_id",
  "nid": "national_id",
  "id number": "national_id",
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
  incentiveAllowance: number | null;
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

  // Parse the workbook into a 2D array of cells first, then auto-detect
  // the header row. ERP-exported reports often have title rows, blank
  // lines, or merged-cell banners above the actual column headers, so
  // trusting row 1 as the header (xlsx default) breaks on those files.
  // findHeaderRow() scans the first ~15 rows and picks the one with
  // the most matches against HEADER_ALIASES.
  let rows: Record<string, unknown>[];
  let detectedHeaderRow = 0; // 0-indexed; -1 means "no good row found"
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];

    // Get the workbook as a 2D array so we can scan rows for headers.
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });

    detectedHeaderRow = findHeaderRow(matrix);
    if (detectedHeaderRow === -1) {
      redirect(
        "/dashboard/employees/import?error=" +
          encodeURIComponent(
            "مش لاقي صف فيه أسماء أعمدة معروفة (زي 'الاسم' أو 'Name'). " +
              "تأكد إن الملف فيه صف header واحد على الأقل.",
          ),
      );
    }

    // Slice from the detected header onwards and convert back to
    // object form using THAT row as the header. The rest of the
    // pipeline (buildKeyMap, HEADER_ALIASES lookup) stays identical.
    const headerCells = matrix[detectedHeaderRow] as unknown[];
    const dataRows = matrix.slice(detectedHeaderRow + 1);
    rows = dataRows
      .filter((r) => Array.isArray(r) && r.some((c) => c !== null && c !== ""))
      .map((r) => {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < headerCells.length; i++) {
          const key = headerCells[i];
          if (key === null || key === undefined) continue;
          const keyStr = String(key).trim();
          if (keyStr.length === 0) continue;
          obj[keyStr] = (r as unknown[])[i] ?? null;
        }
        return obj;
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

  // Fail fast with a diagnostic if the file doesn't have an Arabic /
  // English column for the employee name -- without it every row is
  // skipped as "ناقص اسم الموظف" and the user has no idea why.
  if (!keyMap.full_name) {
    const foundHeaders = Object.keys(rows[0]).filter((h) => h && h.trim());
    const headersPreview =
      foundHeaders.length > 0
        ? `الأعمدة الموجودة في الملف: ${foundHeaders.slice(0, 10).join(" · ")}`
        : "الملف مفيهوش أعمدة في السطر الأول.";
    redirect(
      "/dashboard/employees/import?error=" +
        encodeURIComponent(
          `مفيش عمود للاسم في الملف. ${headersPreview}. غيّر اسم العمود لـ "الاسم" أو "اسم الموظف" أو "Name".`,
        ),
    );
  }

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
      incentiveAllowance: asNumber(get("incentive_allowance")),
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
      incentive_allowance: r.incentiveAllowance,
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
  bustDashboardCache();

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

// ----------------------------------------------------------------------------
// findHeaderRow -- pick the row most likely to be the column header
//
// ERP/HR systems export reports with title rows, blank lines, and merged
// banners above the real headers, so trusting "row 1 = headers" breaks.
// We score each of the first ~15 rows by how many of its non-empty cells
// match a known alias in HEADER_ALIASES. The highest-scoring row (with
// at least 2 hits) is the header.
//
// Ties broken by "earlier row wins" so a report with two header-like
// rows (e.g. summary + detail) uses the first one.
//
// Returns the 0-indexed row number, or -1 if no row hits the threshold.
// ----------------------------------------------------------------------------
function findHeaderRow(matrix: unknown[][]): number {
  const SCAN_LIMIT = Math.min(matrix.length, 15);
  const MIN_HITS = 2;

  let bestRow = -1;
  let bestScore = 0;

  for (let i = 0; i < SCAN_LIMIT; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;

    let hits = 0;
    for (const cell of row) {
      if (cell === null || cell === undefined) continue;
      const s = String(cell).trim();
      if (s.length === 0) continue;
      const lower = s.toLowerCase();
      if (HEADER_ALIASES[lower] || HEADER_ALIASES[s]) {
        hits += 1;
      }
    }

    if (hits > bestScore && hits >= MIN_HITS) {
      bestScore = hits;
      bestRow = i;
    }
  }

  return bestRow;
}
