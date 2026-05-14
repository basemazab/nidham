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

// Default shift if the employee has no shift assigned. Most Egyptian
// office shops run 09:00 - 17:00 -- a fingerprint export with no
// per-employee shift context falls back to this for tardiness math.
const DEFAULT_SHIFT_START_MIN = 9 * 60; // 09:00
const DEFAULT_SHIFT_END_MIN = 17 * 60; // 17:00

// Status aliases — accept Arabic names when HR has a status column.
const VALID_STATUSES = new Set([
  "present",
  "absent",
  "half_day",
  "leave",
  "holiday",
  "weekend",
]);
const STATUS_ALIASES: Record<string, string> = {
  حاضر: "present",
  حضور: "present",
  غايب: "absent",
  غائب: "absent",
  غياب: "absent",
  "نص يوم": "half_day",
  "نصف يوم": "half_day",
  إجازة: "leave",
  اجازة: "leave",
  "إجازة رسمية": "holiday",
  "اجازة رسمية": "holiday",
  "إجازة أسبوعية": "weekend",
  "اجازة اسبوعية": "weekend",
};

// Header-aliases per logical column. Each row's headers are matched
// case-insensitively for English, trimmed for Arabic. ZKTeco exports
// use shorter Arabic labels (رقم البصمة / الإسم / الإدارة / التاريخ /
// الوقت), so those are in here too.
const HEADER_ALIASES: Record<string, string> = {
  // employee_code (ZKTeco fingerprint id)
  "رقم البصمة": "code",
  "كود الموظف": "code",
  كود: "code",
  الكود: "code",
  "كود البصمة": "code",
  "رقم البصمه": "code",
  employee_code: "code",
  code: "code",
  id: "code",
  fingerprint: "code",
  "fingerprint id": "code",
  // name (display only)
  الإسم: "name",
  الاسم: "name",
  "اسم الموظف": "name",
  "اسم الموظفه": "name",
  full_name: "name",
  name: "name",
  employee_name: "name",
  // department (display only)
  الإدارة: "department",
  الادارة: "department",
  القسم: "department",
  department: "department",
  // date
  التاريخ: "date",
  date: "date",
  day: "date",
  "تاريخ الحضور": "date",
  // time(s) -- ZKTeco bundles in/out in one cell separated by space
  الوقت: "time",
  time: "time",
  "وقت الحضور": "check_in",
  check_in: "check_in",
  checkin: "check_in",
  in: "check_in",
  "وقت الانصراف": "check_out",
  check_out: "check_out",
  checkout: "check_out",
  out: "check_out",
  // status (when present)
  الحالة: "status",
  status: "status",
  // notes
  ملاحظات: "notes",
  notes: "notes",
  note: "note",
};

// Arabic normalizer: ZKTeco exports use "الإداره" (with هـ ending)
// while a different vendor might use "الإدارة" (with ة), and HR types
// can be inconsistent too. Normalize tashkeel + unify ة/ه, ى/ي, and
// alif forms so the alias table matches all spellings.
function normalizeArabic(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[ً-ْ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/[ىئ]/g, "ي")
    .replace(/ة/g, "ه");
}

// Build a normalized version of HEADER_ALIASES once at module load --
// we look up by normalizeArabic(headerCell) so variants match.
const NORMALIZED_ALIASES: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(HEADER_ALIASES)) {
    out[normalizeArabic(key)] = val;
  }
  return out;
})();

function lookupAlias(headerCell: unknown): string | null {
  if (headerCell === null || headerCell === undefined) return null;
  const s = String(headerCell).trim();
  if (!s) return null;
  return NORMALIZED_ALIASES[normalizeArabic(s)] ?? null;
}

// ----------------------------------------------------------------------------
// findHeaderRow -- locate the row most likely to be the column header.
// Reused pattern from the employees import: ERP reports often have title
// rows or blank lines above the actual headers. Scan first 15 rows,
// pick the one with the most known-alias hits.
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
      if (lookupAlias(cell)) hits++;
    }
    if (hits > bestScore && hits >= MIN_HITS) {
      bestScore = hits;
      bestRow = i;
    }
  }
  return bestRow;
}

function normalizeStatus(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase();
  if (VALID_STATUSES.has(v)) return v;
  const rawTrimmed = String(raw).trim();
  return STATUS_ALIASES[rawTrimmed] ?? null;
}

function normalizeDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    // ISO YYYY-MM-DD
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    // DD/MM/YYYY (Egyptian default — what ZKTeco emits)
    const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slash) {
      const day = slash[1].padStart(2, "0");
      const month = slash[2].padStart(2, "0");
      return `${slash[3]}-${month}-${day}`;
    }
    // DD-MM-YYYY
    const dash = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (dash) {
      const day = dash[1].padStart(2, "0");
      const month = dash[2].padStart(2, "0");
      return `${dash[3]}-${month}-${day}`;
    }
    return null;
  }
  if (typeof raw === "number") {
    // Excel serial date
    const excelEpoch = new Date(1899, 11, 30).getTime();
    const d = new Date(excelEpoch + raw * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  return null;
}

// Convert a single time token "08:54" or "8:54" to minutes since midnight.
// Returns null if unparseable.
function timeToMinutes(token: string): number | null {
  const m = token.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

function minutesToTimeStr(minutes: number | null): string | null {
  if (minutes === null || minutes < 0) return null;
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

// Parse a ZKTeco-style combined time string like "08:54 17:34" into
// check_in + check_out minutes. Falls back to single-time mode if only
// one time is present. Returns null/null if neither can be parsed.
function parseCombinedTimes(raw: unknown): {
  checkInMin: number | null;
  checkOutMin: number | null;
} {
  if (raw === null || raw === undefined) return { checkInMin: null, checkOutMin: null };
  const s = String(raw).trim();
  if (!s) return { checkInMin: null, checkOutMin: null };

  // Split on any whitespace OR comma OR pipe (ZKTeco exports vary).
  const tokens = s.split(/[\s,|]+/).filter(Boolean);
  if (tokens.length === 0) return { checkInMin: null, checkOutMin: null };
  if (tokens.length === 1) {
    return { checkInMin: timeToMinutes(tokens[0]), checkOutMin: null };
  }
  // 2+ tokens: first = check_in, LAST = check_out. Intermediate punches
  // (break in/out) are ignored for the daily aggregate.
  return {
    checkInMin: timeToMinutes(tokens[0]),
    checkOutMin: timeToMinutes(tokens[tokens.length - 1]),
  };
}

// ----------------------------------------------------------------------------
// importAttendance -- main entrypoint
// ----------------------------------------------------------------------------
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
      "/dashboard/attendance/import?error=" + encodeURIComponent("ارفع ملف Excel"),
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    redirect(
      "/dashboard/attendance/import?error=" +
        encodeURIComponent("الملف أكبر من المسموح به (5 ميجا)"),
    );
  }

  // Parse the workbook. The `codepage: 1256` option tells xlsx to
  // decode legacy BIFF8 Arabic .xls files correctly -- without it,
  // ZKTeco exports come back as garbled latin1 (ÑÞã ÇáÈÕãå ...).
  let matrix: unknown[][];
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, {
      type: "array",
      cellDates: false,
      codepage: 1256,
    });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });
  } catch (e) {
    redirect(
      "/dashboard/attendance/import?error=" +
        encodeURIComponent(
          "ملف Excel غير صالح: " + (e instanceof Error ? e.message : "error"),
        ),
    );
  }

  if (matrix.length === 0) {
    redirect(
      "/dashboard/attendance/import?error=" + encodeURIComponent("الملف فاضي"),
    );
  }

  const headerRowIdx = findHeaderRow(matrix);
  if (headerRowIdx === -1) {
    redirect(
      "/dashboard/attendance/import?error=" +
        encodeURIComponent(
          "مش لاقي صف هيدر فيه أعمدة معروفة (زي 'رقم البصمة' أو 'التاريخ' أو 'الوقت'). تأكد إن الـ encoding عربي.",
        ),
    );
  }

  // Resolve which column maps to which logical field, using the headers
  // found at headerRowIdx. Stored as logicalName -> columnIndex.
  const headerRow = matrix[headerRowIdx] as unknown[];
  const colByLogical = new Map<string, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const logical = lookupAlias(headerRow[i]);
    if (logical && !colByLogical.has(logical)) {
      colByLogical.set(logical, i);
    }
  }

  if (!colByLogical.has("code")) {
    redirect(
      "/dashboard/attendance/import?error=" +
        encodeURIComponent("مفيش عمود لكود الموظف (رقم البصمة / employee_code)"),
    );
  }
  if (!colByLogical.has("date")) {
    redirect(
      "/dashboard/attendance/import?error=" +
        encodeURIComponent("مفيش عمود للتاريخ"),
    );
  }

  // Fetch all employees + their assigned shift's expected start/end so we
  // can compute tardiness + early_leave per row.
  const { data: empData } = await supabase
    .from("employees")
    .select(
      "id, employee_code, full_name, shift_id, shifts(start_time, end_time)",
    )
    .eq("company_id", profile.company_id);

  // Supabase resolves the embedded `shifts(...)` join as an array
  // (the FK relationship type), so we normalize to a single object.
  type EmpRow = {
    id: string;
    employee_code: string | null;
    full_name: string;
    shift_id: string | null;
    shifts: { start_time: string; end_time: string } | null;
  };
  const empList: EmpRow[] = (empData ?? []).map((e) => {
    const r = e as {
      id: string;
      employee_code: string | null;
      full_name: string;
      shift_id: string | null;
      shifts:
        | { start_time: string; end_time: string }
        | { start_time: string; end_time: string }[]
        | null;
    };
    const shifts = Array.isArray(r.shifts) ? (r.shifts[0] ?? null) : r.shifts;
    return {
      id: r.id,
      employee_code: r.employee_code,
      full_name: r.full_name,
      shift_id: r.shift_id,
      shifts,
    };
  });
  const empByCode = new Map<string, EmpRow>();
  const empByName = new Map<string, EmpRow>();
  for (const e of empList) {
    if (e.employee_code) {
      empByCode.set(e.employee_code.trim().toLowerCase(), e);
    }
    if (e.full_name) {
      empByName.set(e.full_name.trim().toLowerCase(), e);
    }
  }

  // Walk the data rows (everything below the header).
  const records: Array<{
    company_id: string;
    employee_id: string;
    date: string;
    status: string;
    check_in: string | null;
    check_out: string | null;
    tardiness_minutes: number;
    early_leave_minutes: number;
    notes: string | null;
    created_by: string;
  }> = [];
  const errors: string[] = [];
  let skipped = 0;
  const dataRows = matrix.slice(headerRowIdx + 1);

  const fieldAt = (row: unknown[], logical: string): unknown => {
    const idx = colByLogical.get(logical);
    if (idx === undefined) return null;
    return row[idx];
  };

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!Array.isArray(row)) continue;
    const rowNum = headerRowIdx + 2 + i; // 1-indexed source line for the message

    const codeRaw = fieldAt(row, "code");
    const nameRaw = fieldAt(row, "name");
    const dateRaw = fieldAt(row, "date");
    const code = codeRaw !== null ? String(codeRaw).trim() : null;
    const name = nameRaw !== null ? String(nameRaw).trim() : null;
    const date = normalizeDate(dateRaw);

    if (!date) {
      // Silently skip rows with missing date (some ZKTeco exports
      // include subtotal lines).
      skipped++;
      continue;
    }

    // Match employee
    let emp: EmpRow | undefined = undefined;
    if (code) emp = empByCode.get(code.toLowerCase());
    if (!emp && name) emp = empByName.get(name.toLowerCase());
    if (!emp) {
      errors.push(
        `السطر ${rowNum}: مفيش موظف بكود "${code ?? "—"}" أو اسم "${name ?? "—"}"`,
      );
      skipped++;
      continue;
    }

    // Parse times. Prefer separate check_in/check_out columns if they
    // exist; otherwise fall back to the combined "الوقت" column that
    // ZKTeco emits.
    let checkInMin: number | null = null;
    let checkOutMin: number | null = null;
    if (colByLogical.has("check_in") || colByLogical.has("check_out")) {
      const ciRaw = fieldAt(row, "check_in");
      const coRaw = fieldAt(row, "check_out");
      checkInMin = ciRaw !== null ? timeToMinutes(String(ciRaw)) : null;
      checkOutMin = coRaw !== null ? timeToMinutes(String(coRaw)) : null;
    } else if (colByLogical.has("time")) {
      const combined = parseCombinedTimes(fieldAt(row, "time"));
      checkInMin = combined.checkInMin;
      checkOutMin = combined.checkOutMin;
    }

    // Status: explicit column wins; otherwise infer from times.
    let status = normalizeStatus(
      colByLogical.has("status") ? String(fieldAt(row, "status") ?? "") : null,
    );
    if (!status) {
      status = checkInMin !== null || checkOutMin !== null ? "present" : "absent";
    }

    // Expected shift times -- per-employee shift if assigned, else default.
    const expectedStart = emp.shifts?.start_time
      ? timeToMinutes(emp.shifts.start_time)
      : null;
    const expectedEnd = emp.shifts?.end_time
      ? timeToMinutes(emp.shifts.end_time)
      : null;
    const startMin = expectedStart ?? DEFAULT_SHIFT_START_MIN;
    const endMin = expectedEnd ?? DEFAULT_SHIFT_END_MIN;

    // Tardiness / early-leave (only for "present" + "half_day").
    let tardinessMinutes = 0;
    let earlyLeaveMinutes = 0;
    if (status === "present" || status === "half_day") {
      if (checkInMin !== null && checkInMin > startMin) {
        tardinessMinutes = Math.min(720, checkInMin - startMin);
      }
      if (checkOutMin !== null && checkOutMin < endMin) {
        earlyLeaveMinutes = Math.min(720, endMin - checkOutMin);
      }
    }

    records.push({
      company_id: profile.company_id,
      employee_id: emp.id,
      date,
      status,
      check_in: minutesToTimeStr(checkInMin),
      check_out: minutesToTimeStr(checkOutMin),
      tardiness_minutes: tardinessMinutes,
      early_leave_minutes: earlyLeaveMinutes,
      notes:
        colByLogical.has("notes") || colByLogical.has("note")
          ? (() => {
              const v = fieldAt(row, "notes") ?? fieldAt(row, "note");
              return v !== null && v !== undefined ? String(v).trim() : null;
            })()
          : null,
      created_by: user.id,
    });
  }

  if (records.length === 0) {
    redirect(
      "/dashboard/attendance/import?error=" +
        encodeURIComponent(
          `لم يتم استيراد أي سجل. ${skipped} سطر فيهم أخطاء. ${errors.slice(0, 3).join(" · ")}`,
        ),
    );
  }

  // Upsert (employee_id, date) so re-importing the same file is idempotent.
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
