"use server";

// ============================================================================
// /dashboard/customers/import — Bulk customer import action
// ============================================================================
//
// Parses a CSV / XLSX upload into customer rows, then bulk-inserts.
// Mirrors the proven pattern from the attendance import (mig 028)
// — same file-size cap, same XLSX library, same column-mapping
// flexibility for Arabic/English headers.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { requireHR } from "@/lib/permissions";
import { bustDashboardCache } from "@/lib/cache";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// Map of incoming column headers (Arabic + English aliases) → canonical
// customer-table column name. Lowercased + trimmed at lookup time so
// "Full Name", "fullname", "Full_Name" all hit the same key.
const COLUMN_ALIASES: Record<string, string> = {
  // full_name
  "الاسم": "full_name",
  "name": "full_name",
  "full name": "full_name",
  "full_name": "full_name",
  "fullname": "full_name",
  "اسم العميل": "full_name",
  "اسم الشركة": "full_name",

  // type
  "النوع": "type",
  "type": "type",
  "نوع العميل": "type",

  // phone
  "الموبايل": "phone",
  "phone": "phone",
  "mobile": "phone",
  "تليفون": "phone",
  "موبايل": "phone",

  // email
  "الإيميل": "email",
  "email": "email",
  "e-mail": "email",
  "ايميل": "email",
  "البريد": "email",

  // contact_name
  "جهة الاتصال": "contact_name",
  "contact": "contact_name",
  "contact_name": "contact_name",
  "contact name": "contact_name",
  "المسؤول": "contact_name",

  // status
  "الحالة": "status",
  "status": "status",
  "stage": "status",

  // estimated_value
  "القيمة المتوقعة": "estimated_value",
  "value": "estimated_value",
  "estimated value": "estimated_value",
  "estimated_value": "estimated_value",
  "deal_value": "estimated_value",
  "deal value": "estimated_value",

  // notes
  "الملاحظات": "notes",
  "notes": "notes",
  "note": "notes",
  "ملاحظات": "notes",

  // source
  "المصدر": "source",
  "source": "source",
};

// Allowed enum values — anything else falls back to the defaults below.
const VALID_TYPES = new Set(["individual", "company"]);
const VALID_STATUSES = new Set(["lead", "active", "won", "lost"]);

type ParsedRow = {
  full_name: string;
  type: string;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
  status: string;
  estimated_value: number | null;
  notes: string | null;
  source: string | null;
};

export async function bulkImportCustomers(formData: FormData) {
  const { profile, supabase } = await requireHR();
  if (!profile?.company_id) {
    redirect("/dashboard/customers/import?error=" + encodeURIComponent("مفيش شركة"));
  }

  const file = formData.get("file") as File | null;
  const skipDuplicates = formData.get("skip_duplicates") === "1";

  if (!file || file.size === 0) {
    redirect(
      "/dashboard/customers/import?error=" +
        encodeURIComponent("اختار ملف الأول"),
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    redirect(
      "/dashboard/customers/import?error=" +
        encodeURIComponent("الملف كبير قوي (الحد الأقصى 5 MB)"),
    );
  }

  // Parse XLSX/CSV
  const buffer = new Uint8Array(await file.arrayBuffer());
  let rows: Record<string, unknown>[];
  try {
    const wb = XLSX.read(buffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    redirect(
      "/dashboard/customers/import?error=" +
        encodeURIComponent("الملف مش مقروء: " + msg),
    );
  }

  if (rows.length === 0) {
    redirect(
      "/dashboard/customers/import?error=" +
        encodeURIComponent("الملف فاضي — مفيش بيانات للاستيراد"),
    );
  }

  // Map rows into our canonical schema using COLUMN_ALIASES
  const parsed: ParsedRow[] = [];
  for (const raw of rows) {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      const canonicalKey = COLUMN_ALIASES[key.trim().toLowerCase()];
      if (canonicalKey) normalized[canonicalKey] = value;
    }

    const fullName = String(normalized.full_name ?? "").trim();
    if (!fullName) continue; // skip empty rows

    const typeRaw = String(normalized.type ?? "").trim().toLowerCase();
    const statusRaw = String(normalized.status ?? "").trim().toLowerCase();

    parsed.push({
      full_name: fullName,
      type: VALID_TYPES.has(typeRaw) ? typeRaw : "company",
      phone: cleanText(normalized.phone),
      email: cleanText(normalized.email),
      contact_name: cleanText(normalized.contact_name),
      status: VALID_STATUSES.has(statusRaw) ? statusRaw : "lead",
      estimated_value: cleanNumber(normalized.estimated_value),
      notes: cleanText(normalized.notes),
      source: cleanText(normalized.source),
    });
  }

  if (parsed.length === 0) {
    redirect(
      "/dashboard/customers/import?error=" +
        encodeURIComponent(
          "ما لقيتش صفوف فيها اسم — تأكد إن في عمود اسمه 'الاسم' أو 'Name'",
        ),
    );
  }

  // De-duplicate within the file (by phone or email) so the user's
  // sloppy Excel doesn't insert the same customer twice.
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  const deduped = parsed.filter((row) => {
    if (row.phone && seenPhones.has(row.phone)) return false;
    if (row.email && seenEmails.has(row.email.toLowerCase())) return false;
    if (row.phone) seenPhones.add(row.phone);
    if (row.email) seenEmails.add(row.email.toLowerCase());
    return true;
  });

  // Skip rows whose phone/email already exists in the database when
  // the user requested that. One-shot query is faster than per-row.
  let toInsert = deduped;
  if (skipDuplicates) {
    const phones = deduped.map((r) => r.phone).filter(Boolean) as string[];
    const emails = deduped.map((r) => r.email).filter(Boolean) as string[];

    const { data: existing } = await supabase
      .from("customers")
      .select("phone, email")
      .eq("company_id", profile.company_id)
      .or(
        [
          phones.length > 0 ? `phone.in.(${phones.join(",")})` : "",
          emails.length > 0
            ? `email.in.(${emails.map((e) => `"${e}"`).join(",")})`
            : "",
        ]
          .filter(Boolean)
          .join(",") || "id.is.null",
      )
      .returns<Array<{ phone: string | null; email: string | null }>>();

    const existingPhones = new Set(
      (existing ?? []).map((r) => r.phone).filter(Boolean) as string[],
    );
    const existingEmails = new Set(
      (existing ?? [])
        .map((r) => r.email?.toLowerCase())
        .filter(Boolean) as string[],
    );

    toInsert = deduped.filter(
      (r) =>
        !(r.phone && existingPhones.has(r.phone)) &&
        !(r.email && existingEmails.has(r.email.toLowerCase())),
    );
  }

  if (toInsert.length === 0) {
    redirect(
      "/dashboard/customers/import?error=" +
        encodeURIComponent(
          "كل العملاء في الملف موجودين بالفعل في النظام — مفيش حاجة للاستيراد",
        ),
    );
  }

  // Bulk insert. We add company_id + source default + a marker note
  // so HR can later filter "show me everyone imported on date X".
  const today = new Date().toISOString().split("T")[0];
  const records = toInsert.map((row) => ({
    company_id: profile.company_id,
    full_name: row.full_name,
    type: row.type,
    phone: row.phone,
    email: row.email,
    contact_name: row.contact_name,
    status: row.status,
    estimated_value: row.estimated_value,
    notes: row.notes
      ? `${row.notes}\n\n— مستورد بتاريخ ${today}`
      : `مستورد بتاريخ ${today}`,
    source: row.source ?? "import",
  }));

  const { error, count } = await supabase
    .from("customers")
    .insert(records, { count: "exact" });

  if (error) {
    redirect(
      "/dashboard/customers/import?error=" +
        encodeURIComponent("فشل الاستيراد: " + error.message),
    );
  }

  revalidatePath("/dashboard/customers");
  bustDashboardCache();
  redirect(
    "/dashboard/customers/import?result=" +
      encodeURIComponent(String(count ?? toInsert.length)),
  );
}

// ────────────────────────────────────────────────────────────────────
// Cell-value sanitizers — defensive against XLSX returning numbers
// where strings are expected, empty strings, whitespace, etc.
// ────────────────────────────────────────────────────────────────────

function cleanText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function cleanNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  // Allow "50,000" / "50 000" / "50000"
  const stripped = String(v).replace(/[\s,]/g, "");
  const n = Number(stripped);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
