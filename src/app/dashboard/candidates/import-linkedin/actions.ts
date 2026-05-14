"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { requireHR } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";
import { bustDashboardCache } from "@/lib/cache";

// LinkedIn Recruiter / Sales Navigator export -> Nidham `candidates`.
//
// LinkedIn's CSV column layout varies across products (Recruiter,
// Recruiter Lite, Sales Navigator, "Save to PDF" exports) and over
// time as LinkedIn revises its export. Rather than hard-code one
// schema we accept ANY of ~30 known column-name variants and map
// them to our candidate fields. Anything unrecognized is preserved
// in the `notes` field so the recruiter can still see the data.

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// Column aliases. Lower-cased; we lower-case the file's headers before
// looking them up so case differences don't matter.
const COLUMN_ALIASES: Record<string, string> = {
  // full_name
  "full name": "full_name",
  "name": "full_name",
  "candidate": "full_name",
  "candidate name": "full_name",
  "member": "full_name",
  // first/last -- combined later if separate
  "first name": "first_name",
  "firstname": "first_name",
  "last name": "last_name",
  "lastname": "last_name",
  "surname": "last_name",
  // current_title
  "current title": "current_title",
  "current position": "current_title",
  "title": "current_title",
  "headline": "current_title",
  "current role": "current_title",
  "position": "current_title",
  "job title": "current_title",
  // current_company
  "current company": "current_company",
  "company": "current_company",
  "current employer": "current_company",
  "employer": "current_company",
  "organization": "current_company",
  // location
  "location": "location",
  "city": "location",
  "country": "location",
  "geo location": "location",
  "geographic area": "location",
  // years_experience
  "years of experience": "years_experience",
  "experience": "years_experience",
  "years at current company": "years_experience",
  // linkedin_url
  "linkedin url": "linkedin_url",
  "profile url": "linkedin_url",
  "linkedin profile": "linkedin_url",
  "public profile url": "linkedin_url",
  "url": "linkedin_url",
  // email
  "email": "email",
  "email address": "email",
  "work email": "email",
  // phone
  "phone": "phone",
  "phone number": "phone",
  "mobile": "phone",
  "contact number": "phone",
  // skills (free text)
  "skills": "skills",
  "top skills": "skills",
  "endorsed skills": "skills",
  // summary / about
  "summary": "summary",
  "about": "summary",
  "professional summary": "summary",
};

type ParsedCandidate = {
  full_name: string;
  current_title: string | null;
  current_company: string | null;
  location: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  years_experience: number | null;
  skills: string | null;
  summary: string | null;
  rowIndex: number; // 1-based, matches the source file
};

function asText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function asNumber(v: unknown): number | null {
  const t = asText(v);
  if (t === null) return null;
  // LinkedIn sometimes ships "5 years" / "10+" / "~3" -- pull the leading int.
  const match = t.match(/-?\d+/);
  if (!match) return null;
  const n = parseInt(match[0], 10);
  return Number.isFinite(n) ? n : null;
}

function normalizePhoneNumber(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.length < 7) return null;
  return digits;
}

function normalizeLinkedInUrl(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // LinkedIn returns "/in/ahmed-mohamed-..." sometimes -- prefix the host.
  if (trimmed.startsWith("http")) return trimmed;
  if (trimmed.startsWith("/")) return `https://www.linkedin.com${trimmed}`;
  if (trimmed.startsWith("in/")) return `https://www.linkedin.com/${trimmed}`;
  return trimmed;
}

function buildKeyMap(firstRow: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const header of Object.keys(firstRow)) {
    const lower = header.trim().toLowerCase();
    const canonical = COLUMN_ALIASES[lower];
    if (canonical && !out[canonical]) {
      out[canonical] = header;
    }
  }
  return out;
}

export async function importLinkedInCandidates(formData: FormData) {
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
      "/dashboard/candidates/import-linkedin?error=" +
        encodeURIComponent("ارفع ملف CSV من LinkedIn Recruiter"),
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    redirect(
      "/dashboard/candidates/import-linkedin?error=" +
        encodeURIComponent("الملف أكبر من المسموح (5 ميجا)"),
    );
  }

  // Parse the file -- xlsx handles both .xlsx and .csv inputs uniformly.
  let rows: Record<string, unknown>[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      raw: true,
      defval: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "غير معروف";
    redirect(
      "/dashboard/candidates/import-linkedin?error=" +
        encodeURIComponent(`ما قدرناش نقرا الملف: ${msg}`),
    );
  }

  if (rows.length === 0) {
    redirect(
      "/dashboard/candidates/import-linkedin?error=" +
        encodeURIComponent("الملف فاضي"),
    );
  }
  if (rows.length > 1000) {
    redirect(
      "/dashboard/candidates/import-linkedin?error=" +
        encodeURIComponent("الحد الأقصى 1000 مرشح للرفعة الواحدة"),
    );
  }

  const keyMap = buildKeyMap(rows[0]);

  if (!keyMap.full_name && !keyMap.first_name) {
    const found = Object.keys(rows[0]).filter((h) => h && h.trim());
    redirect(
      "/dashboard/candidates/import-linkedin?error=" +
        encodeURIComponent(
          `ما قدرناش نلاقي عمود الاسم. الأعمدة الموجودة: ${found.slice(0, 8).join(" · ")}. تأكد إن الملف export من LinkedIn Recruiter.`,
        ),
    );
  }

  const parsed: ParsedCandidate[] = rows.map((row, i) => {
    const get = (canonical: string) => {
      const aliasKey = keyMap[canonical];
      return aliasKey ? row[aliasKey] : null;
    };

    // Compose full name from first+last if needed
    let fullName = asText(get("full_name"));
    if (!fullName) {
      const first = asText(get("first_name"));
      const last = asText(get("last_name"));
      if (first || last) {
        fullName = [first, last].filter(Boolean).join(" ");
      }
    }

    return {
      rowIndex: i + 2, // header is row 1
      full_name: fullName ?? "",
      current_title: asText(get("current_title")),
      current_company: asText(get("current_company")),
      location: asText(get("location")),
      linkedin_url: normalizeLinkedInUrl(asText(get("linkedin_url"))),
      email: asText(get("email")),
      phone: normalizePhoneNumber(asText(get("phone"))),
      years_experience: asNumber(get("years_experience")),
      skills: asText(get("skills")),
      summary: asText(get("summary")),
    };
  });

  const inserted: string[] = [];
  const skipped: { row: number; reason: string }[] = [];

  for (const c of parsed) {
    if (!c.full_name || c.full_name.length < 2) {
      skipped.push({ row: c.rowIndex, reason: "اسم المرشح فاضي" });
      continue;
    }

    // Dedup: by linkedin_url first (most reliable), then by email.
    let dupe = null;
    if (c.linkedin_url) {
      const r = await supabase
        .from("candidates")
        .select("id")
        .eq("company_id", profile.company_id)
        .eq("linkedin_url", c.linkedin_url)
        .maybeSingle();
      dupe = r.data;
    }
    if (!dupe && c.email) {
      const r = await supabase
        .from("candidates")
        .select("id")
        .eq("company_id", profile.company_id)
        .eq("email", c.email)
        .maybeSingle();
      dupe = r.data;
    }
    if (dupe) {
      skipped.push({
        row: c.rowIndex,
        reason: "موجود قبل كده (LinkedIn URL أو الإيميل)",
      });
      continue;
    }

    // Combine summary + skills into the candidates.notes field so the
    // AI matcher has more signal to work with later.
    const notesParts: string[] = [];
    if (c.summary) notesParts.push(`Summary: ${c.summary}`);
    if (c.skills) notesParts.push(`Skills: ${c.skills}`);
    const notes = notesParts.length > 0 ? notesParts.join("\n\n") : null;

    const { error } = await supabase.from("candidates").insert({
      company_id: profile.company_id,
      full_name: c.full_name,
      current_title: c.current_title,
      current_company: c.current_company,
      location: c.location,
      linkedin_url: c.linkedin_url,
      email: c.email,
      phone: c.phone,
      years_experience: c.years_experience,
      notes,
      source: "linkedin_csv",
    });

    if (error) {
      skipped.push({ row: c.rowIndex, reason: arabicizeDbError(error.message) });
      continue;
    }
    inserted.push(c.full_name);
  }

  revalidatePath("/dashboard/candidates");
  bustDashboardCache();

  const params = new URLSearchParams({
    inserted: String(inserted.length),
    skipped: String(skipped.length),
  });
  if (skipped.length > 0) {
    params.set(
      "skips",
      skipped.slice(0, 20).map((s) => `${s.row}:${s.reason}`).join("|"),
    );
  }
  redirect(`/dashboard/candidates/import-linkedin?${params.toString()}`);
}
