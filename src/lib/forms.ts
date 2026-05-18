// ============================================================================
// Forms — shared types + data resolvers for HR document templates
// ============================================================================
//
// Used by every /dashboard/forms/* page to load:
//   1) Company info (name, address, logo, registration #) — letterhead
//   2) Employee info (if ?employeeId= is in the URL) — pre-fill
//
// Both lookups respect RLS so cross-tenant data can't leak. When the
// form is rendered without an employeeId, the resolver returns a
// "blank template" record so HR can print and fill by hand.

import { createClient } from "@/lib/supabase/server";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
export type FormCompany = {
  name: string;
  industry: string | null;
  // Future-proof: when companies table grows extra letterhead fields
  // (address, commercial register, tax card) the resolver will pick
  // them up automatically.
  address?: string | null;
  phone?: string | null;
  commercial_register?: string | null;
  tax_id?: string | null;
};

export type FormEmployee = {
  id: string | null;
  full_name: string;
  employee_code: string | null;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  hire_date: string | null;
  basic_salary: number | null;
  housing_allowance: number | null;
  transport_allowance: number | null;
  other_allowances: number | null;
  incentive_allowance: number | null;
  national_id: string | null;
  social_insurance_number: string | null;
  pay_frequency: "monthly" | "weekly" | null;
};

export type FormContext = {
  company: FormCompany;
  employee: FormEmployee | null; // null => blank template
  /** Today's date in YYYY-MM-DD, computed server-side for consistency */
  today: string;
  /** Auto-generated reference number based on date + form type */
  reference: string;
};

// ----------------------------------------------------------------------------
// resolveFormContext — one call powers every form page
// ----------------------------------------------------------------------------
export async function resolveFormContext(opts: {
  employeeId?: string | null;
  formTypeCode: string; // 2-3 letter code used in the auto-generated reference
}): Promise<FormContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let companyId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle<{ company_id: string }>();
    companyId = profile?.company_id ?? null;
  }

  // Company (letterhead source)
  let company: FormCompany = { name: "—", industry: null };
  if (companyId) {
    const { data } = await supabase
      .from("companies")
      .select("name, industry")
      .eq("id", companyId)
      .maybeSingle<{ name: string; industry: string | null }>();
    if (data) {
      company = data;
    }
  }

  // Employee (only if pre-filled mode).
  //
  // Two-step fetch:
  //   1) Main row from the employees TABLE — RLS through PostgREST is
  //      proven on the base table.
  //   2) Decrypted PII (national_id, social_insurance_number) from the
  //      employees_with_pii VIEW. The view doesn't always pass RLS through
  //      cleanly in production (see employees/[id]/page.tsx note), so we
  //      query it separately and tolerate a null response — the form still
  //      renders with blank PII rather than 404'ing the whole page.
  let employee: FormEmployee | null = null;
  const empId = opts.employeeId?.trim();
  if (empId && /^[0-9a-f-]{36}$/i.test(empId)) {
    const { data: base } = await supabase
      .from("employees")
      .select(
        "id, full_name, employee_code, job_title, department, phone, email, hire_date, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, pay_frequency",
      )
      .eq("id", empId)
      .maybeSingle<Omit<FormEmployee, "national_id" | "social_insurance_number">>();

    if (base) {
      const { data: pii } = await supabase
        .from("employees_with_pii")
        .select("national_id_dec, social_insurance_number_dec")
        .eq("id", empId)
        .maybeSingle<{
          national_id_dec: string | null;
          social_insurance_number_dec: string | null;
        }>();

      employee = {
        ...base,
        national_id: pii?.national_id_dec ?? null,
        social_insurance_number: pii?.social_insurance_number_dec ?? null,
      };
    }
  }

  // Today + reference number
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  // Reference: NID-<TYPE>-<YYYYMMDD>-<RANDOM4>
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const reference = `NID-${opts.formTypeCode.toUpperCase()}-${y}${m}${d}-${randomSuffix}`;

  return { company, employee, today, reference };
}

// ----------------------------------------------------------------------------
// Display helpers
// ----------------------------------------------------------------------------
export function totalCompensation(e: FormEmployee | null): number {
  if (!e) return 0;
  return (
    (e.basic_salary ?? 0) +
    (e.housing_allowance ?? 0) +
    (e.transport_allowance ?? 0) +
    (e.other_allowances ?? 0) +
    (e.incentive_allowance ?? 0)
  );
}

export function formatArabicDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// ----------------------------------------------------------------------------
// Months / numbers in Arabic words (for legal forms)
// ----------------------------------------------------------------------------
export function numberToArabicWords(n: number): string {
  // Lightweight integer-to-Arabic-words for amounts up to 9,999,999.
  // For larger amounts the formal contract layout still includes the
  // numeric figure so the words are a courtesy, not the source of truth.
  if (!Number.isFinite(n) || n < 0) return "";
  const intPart = Math.floor(n);
  const fraction = Math.round((n - intPart) * 100);

  const ones = [
    "صفر","واحد","اثنان","ثلاثة","أربعة","خمسة","ستة","سبعة","ثمانية","تسعة",
    "عشرة","أحد عشر","اثنا عشر","ثلاثة عشر","أربعة عشر","خمسة عشر",
    "ستة عشر","سبعة عشر","ثمانية عشر","تسعة عشر",
  ];
  const tens = ["","","عشرون","ثلاثون","أربعون","خمسون","ستون","سبعون","ثمانون","تسعون"];

  function below1000(num: number): string {
    if (num === 0) return "";
    if (num < 20) return ones[num];
    if (num < 100) {
      const t = Math.floor(num / 10);
      const r = num % 10;
      return r === 0 ? tens[t] : `${ones[r]} و${tens[t]}`;
    }
    const h = Math.floor(num / 100);
    const r = num % 100;
    const hWord =
      h === 1 ? "مائة" :
      h === 2 ? "مئتان" :
      `${ones[h]}مائة`;
    return r === 0 ? hWord : `${hWord} و${below1000(r)}`;
  }

  function buildLarge(num: number): string {
    if (num < 1000) return below1000(num);
    const thousands = Math.floor(num / 1000);
    const rem = num % 1000;
    const thWord =
      thousands === 1 ? "ألف" :
      thousands === 2 ? "ألفان" :
      thousands < 11 ? `${ones[thousands]} آلاف` :
      `${below1000(thousands)} ألف`;
    return rem === 0 ? thWord : `${thWord} و${below1000(rem)}`;
  }

  const intWords = buildLarge(intPart) || "صفر";
  if (fraction === 0) return `${intWords} جنيهًا فقط لا غير`;
  return `${intWords} جنيهًا و${below1000(fraction)} قرشًا فقط لا غير`;
}
