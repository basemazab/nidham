"use server";

// ============================================================================
// Leads (Marketing CRM) — server actions
// ============================================================================
//
// Dashboard-side actions for managing leads that came in via landing pages
// or were imported manually. All read access is gated by the existing
// customers RLS (tenant scoping), so these actions only do writes.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHR } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { arabicizeDbError } from "@/lib/i18n";

async function gate() {
  const { profile, supabase } = await requireHR();
  if (!(await canUseFeature("marketing_studio"))) {
    redirect(
      "/dashboard?error=" +
        encodeURIComponent("الـ Leads CRM متاح للنسخة Enterprise فقط"),
    );
  }
  return { profile, supabase };
}

// ----------------------------------------------------------------------------
// markLeadContacted — sets last_contacted_at + last_contacted_by + bumps
// status (lead → contacted) AND logs a 'custom' lead_event for the timeline.
// ----------------------------------------------------------------------------
export async function markLeadContacted(formData: FormData) {
  const { supabase } = await gate();

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const channel = String(formData.get("channel") ?? "call").trim();
  const notes = String(formData.get("notes") ?? "").trim() || "";

  if (!/^[0-9a-f-]{36}$/i.test(customerId)) {
    redirect("/dashboard/marketing/leads?error=" + encodeURIComponent("ID مش صحيح"));
  }

  const { error } = await supabase.rpc("mark_lead_contacted", {
    p_customer_id: customerId,
    p_channel: channel,
    p_notes: notes,
  });

  if (error) {
    redirect(
      `/dashboard/marketing/leads/${customerId}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath(`/dashboard/marketing/leads/${customerId}`);
  revalidatePath("/dashboard/marketing/leads");
  redirect(`/dashboard/marketing/leads/${customerId}?marked=1`);
}

// ----------------------------------------------------------------------------
// updateLeadStatus — direct status change (qualify / win / lose / dormant)
// + auto-stamp converted_at/lost_at where appropriate.
// ----------------------------------------------------------------------------
const ALLOWED_STATUSES = new Set([
  "lead",
  "contacted",
  "qualified",
  "active",
  "won",
  "lost",
  "dormant",
]);

export async function updateLeadStatus(formData: FormData) {
  const { profile, supabase } = await gate();

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const newStatus = String(formData.get("status") ?? "").trim();
  const dealValueRaw = String(formData.get("estimated_value") ?? "").trim();
  const lostReason = String(formData.get("lost_reason") ?? "").trim() || null;

  if (!/^[0-9a-f-]{36}$/i.test(customerId) || !ALLOWED_STATUSES.has(newStatus)) {
    redirect("/dashboard/marketing/leads?error=" + encodeURIComponent("بيانات غير صحيحة"));
  }

  const update: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (newStatus === "won") {
    update.converted_at = new Date().toISOString();
    update.lost_at = null;
    update.lost_reason = null;
    const v = Number.parseFloat(dealValueRaw);
    if (Number.isFinite(v) && v > 0) update.estimated_value = v;
  } else if (newStatus === "lost") {
    update.lost_at = new Date().toISOString();
    update.lost_reason = lostReason;
    update.converted_at = null;
  }

  const { error } = await supabase
    .from("customers")
    .update(update)
    .eq("id", customerId)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/marketing/leads/${customerId}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath(`/dashboard/marketing/leads/${customerId}`);
  revalidatePath("/dashboard/marketing/leads");
  redirect(`/dashboard/marketing/leads/${customerId}?status_updated=1`);
}

// ----------------------------------------------------------------------------
// moveLeadOnPipeline — lightweight status change for the Kanban board.
// Unlike updateLeadStatus this returns JSON instead of redirecting (the
// caller is a client component handling drag-drop, not a form post).
// ----------------------------------------------------------------------------
export async function moveLeadOnPipeline(
  customerId: string,
  newStatus: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { profile, supabase } = await gate();

  if (!/^[0-9a-f-]{36}$/i.test(customerId)) {
    return { ok: false, error: "ID مش صحيح" };
  }
  if (!ALLOWED_STATUSES.has(newStatus)) {
    return { ok: false, error: "حالة مش معروفة" };
  }

  const update: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  // Stamp converted_at / lost_at when transitioning into terminal states
  // so dashboards downstream don't have to special-case status changes.
  if (newStatus === "won") {
    update.converted_at = new Date().toISOString();
    update.lost_at = null;
  } else if (newStatus === "lost") {
    update.lost_at = new Date().toISOString();
    update.converted_at = null;
  }

  const { error } = await supabase
    .from("customers")
    .update(update)
    .eq("id", customerId)
    .eq("company_id", profile.company_id);

  if (error) return { ok: false, error: arabicizeDbError(error.message) };

  revalidatePath("/dashboard/marketing/leads/pipeline");
  revalidatePath("/dashboard/marketing/leads");
  return { ok: true };
}

// ----------------------------------------------------------------------------
// assignLead — set customers.assigned_to (an employee). Setting to empty
// string clears the assignment.
// ----------------------------------------------------------------------------
export async function assignLead(formData: FormData) {
  const { profile, supabase } = await gate();

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const employeeIdRaw = String(formData.get("employee_id") ?? "").trim();
  const employeeId = /^[0-9a-f-]{36}$/i.test(employeeIdRaw) ? employeeIdRaw : null;

  if (!/^[0-9a-f-]{36}$/i.test(customerId)) {
    redirect("/dashboard/marketing/leads?error=" + encodeURIComponent("ID مش صحيح"));
  }

  const { error } = await supabase
    .from("customers")
    .update({
      assigned_to: employeeId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/marketing/leads/${customerId}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath(`/dashboard/marketing/leads/${customerId}`);
  redirect(`/dashboard/marketing/leads/${customerId}?assigned=1`);
}

// ----------------------------------------------------------------------------
// updateLeadNotes — append a free-form note to the customer's notes field.
// Appends rather than replaces so the history isn't lost.
// ----------------------------------------------------------------------------
export async function appendLeadNote(formData: FormData) {
  const { profile, supabase } = await gate();
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!/^[0-9a-f-]{36}$/i.test(customerId) || !note) {
    redirect(`/dashboard/marketing/leads/${customerId}`);
  }

  // Load current notes, append, save back. Could be done in a single SQL
  // update with concat but doing it client-side keeps the formatting
  // (timestamp prefix) consistent.
  const { data: cur } = await supabase
    .from("customers")
    .select("notes")
    .eq("id", customerId)
    .eq("company_id", profile.company_id)
    .single<{ notes: string | null }>();

  const stamp = new Date().toLocaleString("ar-EG", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const author = profile.full_name ?? "HR";
  const newNote = `[${stamp} · ${author}]\n${note}`;
  const combined = cur?.notes ? `${cur.notes}\n\n${newNote}` : newNote;

  const { error } = await supabase
    .from("customers")
    .update({ notes: combined, updated_at: new Date().toISOString() })
    .eq("id", customerId)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/marketing/leads/${customerId}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath(`/dashboard/marketing/leads/${customerId}`);
  redirect(`/dashboard/marketing/leads/${customerId}?noted=1`);
}
