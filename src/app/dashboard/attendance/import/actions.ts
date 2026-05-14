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

// Header-aliases per logical column. Permissive on purpose -- ZK has
// at least 6 product lines (ZKTime 5/8, ZKBio, BioTime, IClock, Attendance
// Management, Standalone) and each emits Arabic OR English headers with
// slightly different spellings. The normalizer below also folds Arabic
// variants (ة/ه, ى/ي, alif forms, tashkeel) so we don't have to list
// every spelling.
const HEADER_ALIASES: Record<string, string> = {
  // ----- employee_code (the ZKTeco fingerprint id) -----
  "رقم البصمة": "code",
  "رقم البصمه": "code",
  "كود البصمة": "code",
  "كود البصمه": "code",
  "كود الموظف": "code",
  كود: "code",
  الكود: "code",
  بصمة: "code",
  بصمه: "code",
  "رقم بصمة": "code",
  "رقم بصمه": "code",
  "كود بصمة": "code",
  "كود بصمه": "code",
  "رقم تعريف": "code",
  "رقم تعريفي": "code",
  "id رقم": "code",
  employee_code: "code",
  code: "code",
  id: "code",
  "ac-no": "code",
  "ac no": "code",
  acno: "code",
  no: "code",
  num: "code",
  number: "code",
  enrollno: "code",
  "enroll no": "code",
  enroll_no: "code",
  "personnel id": "code",
  "person id": "code",
  personid: "code",
  fingerprint: "code",
  "fingerprint id": "code",
  "fingerprint number": "code",
  // ----- name (display only) -----
  الإسم: "name",
  الاسم: "name",
  اسم: "name",
  "اسم الموظف": "name",
  "اسم الموظفه": "name",
  "اسم العامل": "name",
  "اسم الفرد": "name",
  "اسم الشخص": "name",
  "الاسم الكامل": "name",
  "الاسم رباعي": "name",
  full_name: "name",
  name: "name",
  employee_name: "name",
  "employee name": "name",
  "person name": "name",
  "staff name": "name",
  "full name": "name",
  // ----- department (display only) -----
  الإدارة: "department",
  الادارة: "department",
  الاداره: "department",
  الإداره: "department",
  إدارة: "department",
  اداره: "department",
  ادارة: "department",
  القسم: "department",
  قسم: "department",
  الجهة: "department",
  جهة: "department",
  جهه: "department",
  المجموعة: "department",
  مجموعة: "department",
  department: "department",
  dept: "department",
  division: "department",
  group: "department",
  unit: "department",
  // ----- date -----
  التاريخ: "date",
  تاريخ: "date",
  "تاريخ الحضور": "date",
  "تاريخ الإنصراف": "date",
  "تاريخ البصمة": "date",
  "تاريخ السجل": "date",
  date: "date",
  day: "date",
  "att date": "date",
  attendancedate: "date",
  "attendance date": "date",
  punch_date: "date",
  punchdate: "date",
  // ----- bundled time(s) -- ZK puts both punches in one cell -----
  الوقت: "time",
  وقت: "time",
  "وقت الحضور والإنصراف": "time",
  "أوقات البصمة": "time",
  البصمات: "time",
  time: "time",
  times: "time",
  punch: "time",
  punches: "time",
  "punch time": "time",
  punchtime: "time",
  inout: "time",
  "in/out": "time",
  "in out": "time",
  // ----- separate check_in -----
  "وقت الحضور": "check_in",
  "ساعة الحضور": "check_in",
  "وقت الدخول": "check_in",
  دخول: "check_in",
  حضور: "check_in",
  check_in: "check_in",
  "check in": "check_in",
  checkin: "check_in",
  in: "check_in",
  "in time": "check_in",
  "time in": "check_in",
  "first in": "check_in",
  // ----- separate check_out -----
  "وقت الانصراف": "check_out",
  "وقت الإنصراف": "check_out",
  "ساعة الانصراف": "check_out",
  "وقت الخروج": "check_out",
  انصراف: "check_out",
  خروج: "check_out",
  check_out: "check_out",
  "check out": "check_out",
  checkout: "check_out",
  out: "check_out",
  "out time": "check_out",
  "time out": "check_out",
  "last out": "check_out",
  // ----- status (when present) -----
  الحالة: "status",
  حالة: "status",
  status: "status",
  state: "status",
  // ----- notes -----
  ملاحظات: "notes",
  ملاحظة: "notes",
  notes: "notes",
  note: "notes",
  remark: "notes",
  remarks: "notes",
};

// Detect+repair Arabic strings that xlsx mis-decoded as latin1. ZK's
// .xls files declare cp1252 in their BIFF8 header even when the content
// is cp1256-encoded Arabic, so xlsx faithfully gives us latin1
// gibberish like "ÑÞã ÇáÈÕãå" when the real text is "رقم البصمه".
//
// Fix: encode the garbled string back to its original bytes (each
// latin1 codepoint = one byte), then decode those bytes as
// windows-1256. TextDecoder('windows-1256') is supported in Node 12+.
function fixArabicEncoding(matrix: unknown[][]): unknown[][] {
  const decoder = new TextDecoder("windows-1256");
  // Cell-level repair: only touch strings; numbers/dates pass through.
  const fixCell = (cell: unknown): unknown => {
    if (typeof cell !== "string") return cell;
    // Skip strings that contain NO high-bit char (pure ASCII -- no
    // encoding issue possible).
    let hasHigh = false;
    for (let i = 0; i < cell.length; i++) {
      if (cell.charCodeAt(i) > 127) {
        hasHigh = true;
        break;
      }
    }
    if (!hasHigh) return cell;
    // Each char of `cell` is a latin1 byte. Reassemble the byte array
    // and re-decode as cp1256.
    const bytes = new Uint8Array(cell.length);
    for (let i = 0; i < cell.length; i++) {
      bytes[i] = cell.charCodeAt(i) & 0xff;
    }
    return decoder.decode(bytes);
  };
  return matrix.map((row) =>
    Array.isArray(row) ? row.map(fixCell) : row,
  );
}

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

type ImportMode = "monthly" | "weekly" | "all";

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

  // Import mode controls which employees get their attendance written.
  // ZKTeco exports come as ONE monthly sheet covering both monthly +
  // weekly employees, but weekly employees' attendance is recorded in
  // their own weekly batches. If HR uploads the monthly sheet in
  // "monthly" mode, rows for weekly employees are silently filtered
  // out (NOT errored) so HR can clearly upload the same file without
  // accidentally adding weekly attendance to the wrong workflow.
  const modeRaw = String(formData.get("import_mode") ?? "monthly").trim();
  const mode: ImportMode =
    modeRaw === "weekly" ? "weekly" : modeRaw === "all" ? "all" : "monthly";

  // Parse the workbook. ZK products span multiple language packs +
  // codepages: Arabic builds emit BIFF8 with cp1256, English/Western
  // with cp1252, newer UTF-8 exports with cp65001. We try each
  // codepage in turn and keep the FIRST one where findHeaderRow can
  // locate a real header row.
  //
  // CAVEAT: xlsx prefers the file's own internal codepage marker
  // over our `codepage` option, so an Arabic-content file that's
  // mis-declared as cp1252 in its BIFF metadata comes back as
  // latin1 gibberish (ÑÞã ÇáÈÕãå). The fixArabicEncoding() pass
  // below handles that: it re-decodes each string cell via
  // TextDecoder('windows-1256') against the latin1 byte view.
  let matrix: unknown[][] = [];
  let parseError: string | null = null;
  const CODEPAGE_FALLBACKS = [1256, 65001, 1252, 0]; // 0 = autodetect
  try {
    const buffer = await file.arrayBuffer();
    for (const cp of CODEPAGE_FALLBACKS) {
      const wb = XLSX.read(buffer, {
        type: "array",
        cellDates: false,
        codepage: cp || undefined,
      });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const candidate = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: true,
        defval: null,
        blankrows: false,
      });
      // If THIS codepage gives us a recognisable header row, keep it.
      const candidateHeader = findHeaderRow(candidate);
      if (candidateHeader !== -1) {
        matrix = candidate;
        break;
      }
      // Otherwise hold onto the first parsed matrix so the diagnostic
      // below can still show something useful.
      if (matrix.length === 0) matrix = candidate;
    }

    // Last-resort rescue: if NO codepage gave a usable header, the
    // file's internal codepage marker is wrong. Re-decode strings
    // from latin1 bytes via TextDecoder('windows-1256') and try
    // header detection again.
    if (findHeaderRow(matrix) === -1) {
      const fixed = fixArabicEncoding(matrix);
      if (findHeaderRow(fixed) !== -1) {
        matrix = fixed;
      }
    }
  } catch (e) {
    parseError = e instanceof Error ? e.message : "error";
  }
  if (parseError) {
    redirect(
      "/dashboard/attendance/import?error=" +
        encodeURIComponent("ملف Excel غير صالح: " + parseError),
    );
  }

  if (matrix.length === 0) {
    redirect(
      "/dashboard/attendance/import?error=" + encodeURIComponent("الملف فاضي"),
    );
  }

  const headerRowIdx = findHeaderRow(matrix);
  if (headerRowIdx === -1) {
    // Show the user the first 3 rows so they can tell us what headers
    // their ZK export actually uses. Encoding/decoding bugs surface
    // here as garbled cells (ÑÞã ÇáÈÕãå...).
    const preview = matrix
      .slice(0, 3)
      .map((row, i) => {
        if (!Array.isArray(row)) return `صف ${i + 1}: (فاضي)`;
        const cells = row
          .map((c) => (c === null || c === undefined ? "(فاضي)" : String(c).trim()))
          .filter((c) => c && c !== "(فاضي)")
          .slice(0, 6);
        return `صف ${i + 1}: ${cells.join(" · ") || "(فاضي)"}`;
      })
      .join("\n");
    redirect(
      "/dashboard/attendance/import?error=" +
        encodeURIComponent(
          `مش لاقي صف هيدر فيه أعمدة معروفة. شفت السطور دي في الملف:\n${preview}\n\nلو الحروف العربية ظاهرة غريبة (ÑÞã)، الـ encoding مش 1256. لو ظاهرة صح، ابعت screenshot عشان نضيف الأسماء دي للنظام.`,
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

  // Fetch all employees + their pay_frequency (drives the mode filter
  // below) and assigned shift's expected start/end for tardiness math.
  const { data: empData } = await supabase
    .from("employees")
    .select(
      "id, employee_code, full_name, pay_frequency, shift_id, shifts(start_time, end_time)",
    )
    .eq("company_id", profile.company_id);

  // Supabase resolves the embedded `shifts(...)` join as an array
  // (the FK relationship type), so we normalize to a single object.
  type EmpRow = {
    id: string;
    employee_code: string | null;
    full_name: string;
    pay_frequency: "monthly" | "weekly" | null;
    shift_id: string | null;
    shifts: { start_time: string; end_time: string } | null;
  };
  const empList: EmpRow[] = (empData ?? []).map((e) => {
    const r = e as {
      id: string;
      employee_code: string | null;
      full_name: string;
      pay_frequency: "monthly" | "weekly" | null;
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
      pay_frequency: r.pay_frequency,
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
  // Generate one batch UUID for this entire upload so HR can later
  // review "everything from this import" on /dashboard/attendance/review.
  const batchId = crypto.randomUUID();
  const importedAt = new Date().toISOString();

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
    import_batch_id: string;
    imported_at: string;
  }> = [];
  const errors: string[] = [];
  let skipped = 0;
  // Rows skipped because the employee's pay_frequency doesn't match
  // the import mode (e.g., monthly upload, employee is weekly). NOT
  // errored -- just filtered so HR can upload the same fingerprint
  // file under each mode.
  let modeFiltered = 0;
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

    // Mode filter: if HR uploaded a monthly fingerprint sheet, drop
    // rows for weekly employees (they have their own import). And
    // vice-versa. "all" mode imports everyone.
    const empFreq = emp.pay_frequency ?? "monthly";
    if (mode === "monthly" && empFreq === "weekly") {
      modeFiltered++;
      continue;
    }
    if (mode === "weekly" && empFreq === "monthly") {
      modeFiltered++;
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
      import_batch_id: batchId,
      imported_at: importedAt,
    });
  }

  if (records.length === 0) {
    // Differentiate "nothing imported because of errors" from "nothing
    // imported because the mode filter matched no one" so HR knows
    // whether to fix the file or switch the mode.
    if (modeFiltered > 0 && skipped === 0) {
      redirect(
        "/dashboard/attendance/import?error=" +
          encodeURIComponent(
            `كل الموظفين في الملف ${mode === "monthly" ? "أسبوعيين" : "شهريين"}. غيّر النوع لـ "${mode === "monthly" ? "أسبوعي" : "شهري"}" وارفع تاني.`,
          ),
      );
    }
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

  // Redirect to the review page so HR can audit the batch they just
  // uploaded before it shows up in reports / payroll. Carry the
  // import summary (mode, filtered, errors) so the review banner can
  // explain what got through and what didn't.
  const errSummary =
    errors.length > 0
      ? `&errors=${encodeURIComponent(errors.slice(0, 10).join("\n"))}`
      : "";
  redirect(
    `/dashboard/attendance/review?batch=${batchId}&just_imported=1&imported=${records.length}&skipped=${skipped}&filtered=${modeFiltered}&mode=${mode}${errSummary}`,
  );
}
