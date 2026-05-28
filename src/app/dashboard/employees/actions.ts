"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireHR } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";
import { bustDashboardCache } from "@/lib/cache";
import { sendEmail, emailMobileInvitation } from "@/lib/email";

function asText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function asNumber(value: FormDataEntryValue | null): number | null {
  const text = asText(value);
  if (text === null) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export async function createEmployee(formData: FormData) {
  await requireHR();
  const supabase = await createClient();

  const fullName = asText(formData.get("full_name"));
  if (!fullName) {
    redirect("/dashboard/employees/new?error=" + encodeURIComponent("اسم الموظف مطلوب"));
  }

  const payFrequencyRaw = asText(formData.get("pay_frequency"));
  const payFrequency =
    payFrequencyRaw === "weekly" ? "weekly" : "monthly";

  const { error } = await supabase.from("employees").insert({
    full_name: fullName,
    employee_code: asText(formData.get("employee_code")),
    job_title: asText(formData.get("job_title")),
    department: asText(formData.get("department")),
    phone: asText(formData.get("phone")),
    email: asText(formData.get("email")),
    hire_date: asText(formData.get("hire_date")),
    date_of_birth: asText(formData.get("date_of_birth")),
    basic_salary: asNumber(formData.get("basic_salary")),
    housing_allowance: asNumber(formData.get("housing_allowance")),
    transport_allowance: asNumber(formData.get("transport_allowance")),
    other_allowances: asNumber(formData.get("other_allowances")),
    incentive_allowance: asNumber(formData.get("incentive_allowance")),
    pay_frequency: payFrequency,
    national_id: asText(formData.get("national_id")),
    social_insurance_number: asText(formData.get("social_insurance_number")),
    bank_name: asText(formData.get("bank_name")),
    bank_account_number: asText(formData.get("bank_account_number")),
    status: asText(formData.get("status")) ?? "active",
    notes: asText(formData.get("notes")),
    // company_id is auto-filled by the RLS WITH CHECK policy via the trigger
    // ... actually, RLS only filters; we must set company_id explicitly:
    company_id: await getCurrentCompanyId(supabase),
  });

  if (error) {
    redirect(
      "/dashboard/employees/new?error=" +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/employees");
  bustDashboardCache();
  redirect("/dashboard/employees");
}

export async function updateEmployee(id: string, formData: FormData) {
  await requireHR();
  const supabase = await createClient();

  const fullName = asText(formData.get("full_name"));
  if (!fullName) {
    redirect(
      `/dashboard/employees/${id}?error=` +
        encodeURIComponent("اسم الموظف مطلوب"),
    );
  }

  const payFrequencyRaw = asText(formData.get("pay_frequency"));
  const payFrequency =
    payFrequencyRaw === "weekly" ? "weekly" : "monthly";

  const { error } = await supabase
    .from("employees")
    .update({
      full_name: fullName,
      employee_code: asText(formData.get("employee_code")),
      job_title: asText(formData.get("job_title")),
      department: asText(formData.get("department")),
      phone: asText(formData.get("phone")),
      email: asText(formData.get("email")),
      hire_date: asText(formData.get("hire_date")),
      basic_salary: asNumber(formData.get("basic_salary")),
      housing_allowance: asNumber(formData.get("housing_allowance")),
      transport_allowance: asNumber(formData.get("transport_allowance")),
      other_allowances: asNumber(formData.get("other_allowances")),
      incentive_allowance: asNumber(formData.get("incentive_allowance")),
      pay_frequency: payFrequency,
      national_id: asText(formData.get("national_id")),
      social_insurance_number: asText(formData.get("social_insurance_number")),
      bank_name: asText(formData.get("bank_name")),
      bank_account_number: asText(formData.get("bank_account_number")),
      status: asText(formData.get("status")) ?? "active",
      notes: asText(formData.get("notes")),
    })
    .eq("id", id);

  if (error) {
    redirect(
      `/dashboard/employees/${id}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/employees");
  bustDashboardCache();
  revalidatePath(`/dashboard/employees/${id}`);
  redirect("/dashboard/employees?updated=1");
}

// End-of-service settlement breakdown returned by the RPC. The
// terminateEmployee action calls it twice -- once to preview before
// HR confirms, and once again after confirmation to snapshot the
// final number onto employees.eos_gratuity.
export type EOSBreakdown = {
  hire_date: string;
  termination_date: string;
  years_of_service: number;
  wage_base: number;
  months_owed: number;
  gratuity_amount: number;
};

/**
 * Compute the End-of-Service gratuity owed to an employee at a given
 * termination date. Pure preview -- doesn't modify the employee row.
 * Used by the "Terminate" modal to show HR "كده فاضل عليك تدفع
 * X جنيه" before they confirm.
 */
export async function previewEOSGratuity(
  employeeId: string,
  terminationDate: string,
): Promise<EOSBreakdown | null> {
  await requireHR();
  const supabase = await createClient();
  const { data } = await supabase.rpc("compute_eos_gratuity", {
    p_employee_id: employeeId,
    p_termination_date: terminationDate,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  return row as EOSBreakdown;
}

/**
 * Finalize an employee's termination:
 *   1. Compute EOS gratuity at the chosen date
 *   2. Set status='terminated' + termination_date + termination_reason +
 *      eos_gratuity (snapshot, NOT recomputed later if wages change)
 *   3. Audit log captures the row update via the migration-018 trigger
 *
 * Admin-only because the consequences (gratuity write, employee
 * locked out, payroll exclusion) are financial.
 */
export async function terminateEmployee(formData: FormData) {
  const { supabase, profile } = await requireAdmin();

  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const terminationDate = String(formData.get("termination_date") ?? "").trim();
  const reason = String(formData.get("termination_reason") ?? "").trim();

  const validReasons = [
    "resignation",
    "termination_by_employer",
    "mutual_agreement",
    "end_of_contract",
    "retirement",
    "death",
  ];

  if (!employeeId) {
    redirect("/dashboard/employees?error=" + encodeURIComponent("الموظف غير محدد"));
  }
  if (!terminationDate) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent("تاريخ انتهاء الخدمة مطلوب"),
    );
  }
  if (!validReasons.includes(reason)) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent("سبب انتهاء الخدمة غير صحيح"),
    );
  }

  // 1. Final preview right before the write so the snapshot uses the
  //    latest wage data.
  const { data: eosData } = await supabase.rpc("compute_eos_gratuity", {
    p_employee_id: employeeId,
    p_termination_date: terminationDate,
  });
  const eos = (Array.isArray(eosData) ? eosData[0] : eosData) as
    | EOSBreakdown
    | null;
  if (!eos) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent("مش قادر يحسب المكافأة — تأكد إن للموظف تاريخ تعيين"),
    );
  }

  // 2. Write the termination record. RLS scopes by company_id.
  const { error } = await supabase
    .from("employees")
    .update({
      status: "terminated",
      termination_date: terminationDate,
      termination_reason: reason,
      eos_gratuity: eos.gratuity_amount,
    })
    .eq("id", employeeId)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/employees");
  revalidatePath(`/dashboard/employees/${employeeId}`);
  bustDashboardCache();
  redirect(
    `/dashboard/employees/${employeeId}?terminated=` +
      encodeURIComponent(
        `${eos.gratuity_amount}|${eos.years_of_service}|${eos.months_owed}`,
      ),
  );
}

export async function deleteEmployee(id: string) {
  // Deletion cascades to attendance, payroll_entries, leave_requests,
  // advance_requests, permission_requests -- restrict to admin only.
  //
  // J4 hardening: previously did just .eq("id", id) with no company
  // clamp and no error check. RLS scopes the DELETE for normal admin
  // sessions, but super-admin sessions (mig 038) bypass RLS, so a
  // forged employee id from a different tenant would silently no-op
  // OR delete the wrong tenant's row. Now we explicitly clamp by
  // company_id AND check the error.
  const { profile, supabase } = await requireAdmin();
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);
  if (error) {
    redirect(
      `/dashboard/employees?error=${encodeURIComponent(
        "ما قدرناش نمسح الموظف: " + error.message,
      )}`,
    );
  }
  revalidatePath("/dashboard/employees");
  bustDashboardCache();
}

// ============================================================================
// Nuclear option: delete ALL employees in the current company.
//
// Admin-only, gated behind a typed-phrase confirmation ("حذف الكل") so a
// rogue click or a stolen session can't quietly wipe a 200-employee
// roster. Counts before delete + reports back via the URL so HR sees
// "تم حذف 47 موظف" instead of an ambiguous "done".
//
// Cascades: every employee-keyed table (attendance, payroll_entries,
// leave_requests, advance_requests, permission_requests, leave_balances,
// audit_log via trigger) has ON DELETE CASCADE on employee_id, so the
// dependent data goes with them. auth.users rows are NOT touched; if HR
// wants to retire an employee's mobile account, they need to remove the
// auth user separately.
// ============================================================================
export async function deleteAllEmployees(formData: FormData) {
  const { supabase, profile } = await requireAdmin();

  const phrase = String(formData.get("confirm_phrase") ?? "").trim();
  if (phrase !== "حذف الكل") {
    redirect(
      "/dashboard/employees?error=" +
        encodeURIComponent("لازم تكتب 'حذف الكل' بالظبط عشان تأكد."),
    );
  }

  // Count first so the success message can be specific.
  const { count } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("company_id", profile.company_id);

  if (!count || count === 0) {
    redirect(
      "/dashboard/employees?error=" +
        encodeURIComponent("مفيش موظفين عندك أصلاً."),
    );
  }

  // Wipe. RLS is doing the company-scoping anyway, but we're explicit
  // about the company_id eq for defence in depth -- if RLS got loosened
  // in a future migration this still scopes to the caller's tenant.
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      "/dashboard/employees?error=" +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/employees");
  bustDashboardCache();
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/payroll");
  redirect(
    "/dashboard/employees?deleted_all=" + encodeURIComponent(String(count)),
  );
}

/**
 * Generates an invitation token for an employee. The HR person hands
 * the resulting UUID to the employee (paper / WhatsApp / SMS), and the
 * mobile app's "Claim invitation" flow uses it to bind the new auth
 * user to this employees row.
 *
 * RLS on the RPC checks that the caller is admin/manager in the same
 * company, so there's no extra permission gate here.
 */
export async function generateEmployeeInvitation(id: string) {
  await requireHR();
  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_employee_invitation", {
    p_employee_id: id,
  });
  if (error) {
    redirect(
      `/dashboard/employees/${id}?invite_error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  // Read the freshly-issued token + the employee's email so we can
  // ship the invite over email automatically. Skip silently if the
  // employee has no email on file -- the HR can still copy the token
  // from the dashboard and hand it over manually.
  void (async () => {
    try {
      const { data: emp } = await supabase
        .from("employees")
        .select("full_name, email, invitation_token")
        .eq("id", id)
        .single<{
          full_name: string;
          email: string | null;
          invitation_token: string | null;
        }>();
      if (!emp?.email || !emp?.invitation_token) return;
      await sendEmail(
        emailMobileInvitation({
          to: emp.email,
          employeeName: emp.full_name,
          inviteToken: emp.invitation_token,
        }),
      );
    } catch (err) {
       
      console.warn("generateEmployeeInvitation email failed:", err);
    }
  })();

  revalidatePath(`/dashboard/employees/${id}`);
  redirect(`/dashboard/employees/${id}?invite_generated=1`);
}

async function getCurrentCompanyId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (error || !data) throw new Error("Profile not found");
  return data.company_id as string;
}


// ============================================================================
// FILE-RELATED ACTIONS — avatar + document vault (mig 047)
// ============================================================================

const FILES_BUCKET = "employee-files";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // matches the bucket's file_size_limit
const ALLOWED_AVATAR_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const ALLOWED_DOC_MIMES = [
  ...ALLOWED_AVATAR_MIMES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const ALLOWED_DOC_TYPES = [
  "contract",
  "national_id",
  "cv",
  "certificate",
  "photo",
  "license",
  "insurance",
  "bank",
  "medical",
  "other",
] as const;
type DocType = (typeof ALLOWED_DOC_TYPES)[number];

function fileExtension(mime: string, filename: string): string {
  // Prefer mime-based extension so we don't trust user-supplied
  // filenames blindly. Fall back to whatever's after the last dot.
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/msword") return "doc";
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (mime === "application/vnd.ms-excel") return "xls";
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "xlsx";
  }
  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx >= 0 && dotIdx < filename.length - 1) {
    return filename.slice(dotIdx + 1).toLowerCase();
  }
  return "bin";
}

/**
 * Upload (or replace) the employee's avatar. Stored at
 * {company_id}/{employee_id}/avatar/{ts}-photo.{ext} in employee-files.
 *
 * The OLD avatar (if any) is left in storage — cheap, easier to rollback
 * a wrong upload by editing employees.avatar_url back to the prior URL.
 * A future "storage GC" cron can sweep orphaned objects.
 */
export async function uploadEmployeeAvatar(formData: FormData) {
  const { supabase, profile } = await requireHR();

  const employeeId = String(formData.get("employee_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(employeeId)) {
    redirect("/dashboard/employees");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent("اختار صورة الأول"),
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent(
          `الصورة كبيرة (${(file.size / 1024 / 1024).toFixed(1)} MB). الحد 10 MB.`,
        ),
    );
  }
  if (!ALLOWED_AVATAR_MIMES.includes(file.type)) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent(
          `نوع الصورة مش مدعوم (${file.type}). PNG / JPEG / WebP / GIF فقط.`,
        ),
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = fileExtension(file.type, file.name);
    const ts = Date.now();
    const path = `${profile.company_id}/${employeeId}/avatar/${ts}-photo.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(FILES_BUCKET)
      .upload(path, bytes, {
        contentType: file.type,
        upsert: false,
        cacheControl: "31536000",
      });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    const { data: pub } = supabase.storage
      .from(FILES_BUCKET)
      .getPublicUrl(path);

    const { error: updErr } = await supabase
      .from("employees")
      .update({
        avatar_url: pub.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", employeeId)
      .eq("company_id", profile.company_id);
    if (updErr) throw new Error(updErr.message);
  } catch (err) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent(
          err instanceof Error
            ? `رفع الصورة فشل: ${err.message.slice(0, 200)}`
            : "رفع الصورة فشل",
        ),
    );
  }

  revalidatePath(`/dashboard/employees/${employeeId}`);
  revalidatePath("/dashboard/employees");
  redirect(`/dashboard/employees/${employeeId}?avatar_updated=1`);
}

/**
 * Remove the avatar from an employee. Drops the avatar_url column to NULL
 * so the Kanban card falls back to the initial-letter avatar. Doesn't
 * delete the storage object (cheap, supports "oops, restore it").
 */
export async function removeEmployeeAvatar(formData: FormData) {
  const { supabase, profile } = await requireHR();
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(employeeId)) {
    redirect("/dashboard/employees");
  }
  await supabase
    .from("employees")
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq("id", employeeId)
    .eq("company_id", profile.company_id);

  revalidatePath(`/dashboard/employees/${employeeId}`);
  revalidatePath("/dashboard/employees");
  redirect(`/dashboard/employees/${employeeId}?avatar_removed=1`);
}

/**
 * Upload a document to an employee's vault. Files live at
 * {company_id}/{employee_id}/docs/{ts}-{safe-filename}.{ext}; a row
 * lands in employee_documents with the metadata.
 */
export async function uploadEmployeeDocument(formData: FormData) {
  const { supabase, profile } = await requireHR();

  const employeeId = String(formData.get("employee_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(employeeId)) {
    redirect("/dashboard/employees");
  }
  const docTypeRaw = String(formData.get("doc_type") ?? "other").trim();
  const docType: DocType = (ALLOWED_DOC_TYPES as readonly string[]).includes(
    docTypeRaw,
  )
    ? (docTypeRaw as DocType)
    : "other";

  const displayName = String(formData.get("name") ?? "").trim();
  const expiresAtRaw = String(formData.get("expires_at") ?? "").trim();
  const expiresAt = expiresAtRaw || null;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent("اختار ملف الأول"),
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent(
          `الملف كبير (${(file.size / 1024 / 1024).toFixed(1)} MB). الحد 10 MB.`,
        ),
    );
  }
  if (!ALLOWED_DOC_MIMES.includes(file.type)) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent(`نوع الملف مش مدعوم (${file.type}).`),
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = fileExtension(file.type, file.name);
    const ts = Date.now();
    // Sanitize the original filename for the storage path. Keep Arabic /
    // Latin letters + digits + dash + underscore; everything else
    // becomes a dash. Cap at 60 chars.
    const safeName = (displayName || file.name.replace(/\.[^/.]+$/, ""))
      .replace(/[^\p{L}\p{N}_-]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "doc";
    const path = `${profile.company_id}/${employeeId}/docs/${ts}-${safeName}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(FILES_BUCKET)
      .upload(path, bytes, {
        contentType: file.type,
        upsert: false,
        cacheControl: "31536000",
      });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    const { data: pub } = supabase.storage
      .from(FILES_BUCKET)
      .getPublicUrl(path);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: insErr } = await supabase
      .from("employee_documents")
      .insert({
        company_id: profile.company_id,
        employee_id: employeeId,
        doc_type: docType,
        name: displayName || file.name,
        file_url: pub.publicUrl,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        expires_at: expiresAt,
        uploaded_by: user?.id ?? null,
      });
    if (insErr) {
      // Cleanup: remove the uploaded blob if the DB insert failed so we
      // don't leak orphaned storage objects.
      await supabase.storage.from(FILES_BUCKET).remove([path]);
      throw new Error(insErr.message);
    }
  } catch (err) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent(
          err instanceof Error
            ? `رفع المستند فشل: ${err.message.slice(0, 200)}`
            : "رفع المستند فشل",
        ),
    );
  }

  revalidatePath(`/dashboard/employees/${employeeId}`);
  redirect(`/dashboard/employees/${employeeId}?doc_uploaded=1`);
}

/**
 * Delete a document — DB row + the storage object.
 */
export async function deleteEmployeeDocument(formData: FormData) {
  const { supabase, profile } = await requireHR();
  const documentId = String(formData.get("document_id") ?? "").trim();
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  if (
    !/^[0-9a-f-]{36}$/i.test(documentId) ||
    !/^[0-9a-f-]{36}$/i.test(employeeId)
  ) {
    redirect("/dashboard/employees");
  }

  // Fetch the storage path so we can also delete the underlying object.
  const { data: doc } = await supabase
    .from("employee_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("company_id", profile.company_id)
    .maybeSingle<{ storage_path: string }>();

  await supabase
    .from("employee_documents")
    .delete()
    .eq("id", documentId)
    .eq("company_id", profile.company_id);

  if (doc?.storage_path) {
    await supabase.storage.from(FILES_BUCKET).remove([doc.storage_path]);
  }

  revalidatePath(`/dashboard/employees/${employeeId}`);
  redirect(`/dashboard/employees/${employeeId}?doc_deleted=1`);
}
