// ============================================================================
// /api/ai/parse-file — Server-side file parsing for the AI chat.
// ============================================================================
//
// The AI chat lets users upload Excel/CSV files and ask the agent to act
// on them (e.g. "ضيف الموظفين دول"). This endpoint does the heavy lifting:
//
//   1) Accept the file via FormData
//   2) Detect type (Excel / CSV)
//   3) Parse → produce structured headers + rows
//   4) Return JSON the client can embed in the next chat message
//
// The AI then uses tools (bulk_import_employees / bulk_import_attendance)
// to act on the structured data. Field mapping is handled by the LLM since
// Egyptian SMB Excel files come in dozens of column-name variants.
//
// PDF parsing is intentionally NOT here — the existing /api/import/parse-pdf
// endpoint handles PDFs via Gemini multimodal, and PDF imports go through
// the dedicated /dashboard/employees/import flow with a manual review step.
// V2 may unify these.

import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 500; // hard cap so we don't blow up Gemini context

type ParsedRow = Record<string, string | number | null>;

export async function POST(req: Request) {
  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // HR-only (admin/manager) — same gate as /api/ai/agent
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    return Response.json(
      { error: "رفع الملفات للمساعد الذكي مخصص لـ HR فقط" },
      { status: 403 },
    );
  }

  // Rate limit
  const rl = checkRateLimit(`ai-file:${user.id}`, 15, 10 * 60_000);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({
        error: `كتر شويه على رفع الملفات — جرب تاني بعد ${Math.ceil(rl.retryAfterSeconds / 60)} دقيقة`,
      }),
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  // Read + validate
  let file: File;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File) || f.size === 0) {
      return Response.json({ error: "ارفع ملف" }, { status: 400 });
    }
    if (f.size > MAX_BYTES) {
      return Response.json(
        {
          error: `الملف كبير جدًا (${(f.size / 1024 / 1024).toFixed(1)} MB). الحد الأقصى 5 MB.`,
        },
        { status: 400 },
      );
    }
    file = f;
  } catch {
    return Response.json({ error: "فشل قراءة الملف" }, { status: 400 });
  }

  const lowerName = file.name.toLowerCase();
  const isExcel =
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".csv");

  if (!isExcel) {
    return Response.json(
      {
        error:
          "النوع ده مش مدعوم. ارفع Excel (.xlsx, .xls) أو CSV. لـ PDF استخدم صفحة رفع الموظفين.",
      },
      { status: 400 },
    );
  }

  // Parse Excel
  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    return Response.json({ error: "فشل قراءة محتوى الملف" }, { status: 400 });
  }

  // Try multiple codepages (cp1256 first for Arabic, then UTF-8 / cp1252)
  // This is the same defense the /dashboard/employees/import uses against
  // ZK fingerprint Excels that mis-declare their encoding.
  const codepages = [1256, 65001, 1252, 0];
  let workbook: XLSX.WorkBook | null = null;
  for (const cp of codepages) {
    try {
      workbook = XLSX.read(bytes, {
        type: "array",
        cellDates: false,
        codepage: cp || undefined,
      });
      break;
    } catch {
      // try next codepage
    }
  }
  if (!workbook || workbook.SheetNames.length === 0) {
    return Response.json(
      { error: "فشل فك ضغط الملف. تأكد إنه Excel سليم." },
      { status: 400 },
    );
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  // header: 1 returns raw rows as arrays (no auto-key inference)
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: null,
  }) as unknown[][];

  if (matrix.length === 0) {
    return Response.json(
      { error: "الملف فاضي" },
      { status: 400 },
    );
  }

  // Smart header detection: scan first 15 rows for the one with the most
  // non-empty string cells (best heuristic for HR-tool exports that
  // include a logo/title row before the actual table)
  const headerRowIndex = pickHeaderRow(matrix);
  const headersRaw = (matrix[headerRowIndex] ?? []) as unknown[];
  const headers = headersRaw
    .map((h) => (typeof h === "string" ? h.trim() : String(h ?? "").trim()))
    .filter(Boolean);

  if (headers.length === 0) {
    return Response.json(
      { error: "ما عرفش يلاقي عناوين الأعمدة. تأكد إن الصف الأول هو العناوين." },
      { status: 400 },
    );
  }

  // Data rows = everything after the header row
  const dataRows = matrix.slice(headerRowIndex + 1);
  const parsed: ParsedRow[] = [];
  for (const raw of dataRows) {
    if (!Array.isArray(raw)) continue;
    const obj: ParsedRow = {};
    let hasAnyValue = false;
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      const cell = raw[i];
      if (cell === null || cell === undefined || cell === "") {
        obj[key] = null;
        continue;
      }
      if (typeof cell === "number") {
        obj[key] = cell;
        hasAnyValue = true;
      } else {
        const s = String(cell).trim();
        obj[key] = s.length ? s : null;
        if (s.length) hasAnyValue = true;
      }
    }
    if (hasAnyValue) parsed.push(obj);
    if (parsed.length >= MAX_ROWS) break;
  }

  // Heuristic detection of file type so the AI can pick the right tool
  const hint = detectHint(headers);

  return Response.json({
    ok: true,
    filename: file.name,
    size: file.size,
    sheet_name: sheetName,
    headers,
    row_count: parsed.length,
    truncated: dataRows.length > MAX_ROWS,
    rows: parsed,
    hint, // 'employees' | 'attendance' | 'unknown'
    notes: buildNotes(parsed.length, dataRows.length, hint),
  });
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function pickHeaderRow(matrix: unknown[][]): number {
  let bestIdx = 0;
  let bestScore = -1;
  const max = Math.min(matrix.length, 15);
  for (let i = 0; i < max; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    let nonEmpty = 0;
    for (const c of row) {
      if (typeof c === "string" && c.trim().length > 0) nonEmpty++;
      else if (typeof c === "number") nonEmpty++;
    }
    // Prefer rows with 3+ non-empty cells (likely actual headers, not
    // a logo line or document title)
    if (nonEmpty >= 3 && nonEmpty > bestScore) {
      bestScore = nonEmpty;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// Lightweight pattern matching to hint at file type. Not authoritative —
// the AI agent confirms via the user before importing.
function detectHint(headers: string[]): "employees" | "attendance" | "unknown" {
  const blob = headers.join(" ").toLowerCase();
  const hasName =
    blob.includes("اسم") ||
    blob.includes("الاسم") ||
    blob.includes("name") ||
    blob.includes("الإسم");
  const hasCode =
    blob.includes("كود") ||
    blob.includes("code") ||
    blob.includes("رقم الموظف") ||
    blob.includes("id");
  const hasSalary =
    blob.includes("راتب") ||
    blob.includes("مرتب") ||
    blob.includes("salary") ||
    blob.includes("الأساسي");
  const hasJobTitle =
    blob.includes("وظيف") || blob.includes("title") || blob.includes("مسمى");
  const hasDate =
    blob.includes("تاريخ") || blob.includes("date") || blob.includes("اليوم");
  const hasTime =
    blob.includes("وقت") ||
    blob.includes("time") ||
    blob.includes("الحضور") ||
    blob.includes("الانصراف") ||
    blob.includes("بصمة") ||
    blob.includes("البصمه");

  if (hasName && (hasSalary || hasJobTitle)) return "employees";
  if (hasDate && hasTime) return "attendance";
  if (hasName && hasCode && !hasSalary) return "employees"; // fallback
  return "unknown";
}

function buildNotes(parsedCount: number, totalCount: number, hint: string): string {
  const parts: string[] = [];
  parts.push(`اتقرى ${parsedCount} صف من الملف`);
  if (totalCount > MAX_ROWS) {
    parts.push(`(الحد الأقصى ${MAX_ROWS} صف، الباقي اتجاهل)`);
  }
  if (hint === "employees") parts.push("الملف يبدو إنه كشف موظفين");
  else if (hint === "attendance") parts.push("الملف يبدو إنه كشف حضور");
  return parts.join(" · ");
}
