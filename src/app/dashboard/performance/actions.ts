"use server";

// ============================================================================
// Performance review CRUD actions
// ============================================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireHR } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";

function asText(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const t = String(v).trim();
  return t.length === 0 ? null : t;
}
function asInt(v: FormDataEntryValue | null): number | null {
  const t = asText(v);
  if (t === null) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}
function asRating(v: FormDataEntryValue | null): number | null {
  const n = asInt(v);
  if (n === null) return null;
  if (n < 1 || n > 5) return null;
  return n;
}

export async function createReview(formData: FormData) {
  const { profile } = await requireHR();
  const supabase = await createClient();

  const employeeId = asText(formData.get("employee_id"));
  const periodLabel = asText(formData.get("period_label"));
  if (!employeeId || !periodLabel) {
    redirect(
      "/dashboard/performance/new?error=" +
        encodeURIComponent("الموظف والفترة مطلوبين"),
    );
  }

  // KPIs come from the form as JSON string in the "kpis_json" hidden
  // input populated by the client-side KPI editor.
  let kpis: unknown = [];
  const kpisRaw = asText(formData.get("kpis_json"));
  if (kpisRaw) {
    try {
      const parsed = JSON.parse(kpisRaw);
      if (Array.isArray(parsed)) kpis = parsed;
    } catch {
      // Ignore — empty array is the safe default.
    }
  }

  const { data, error } = await supabase
    .from("performance_reviews")
    .insert({
      company_id: profile.company_id,
      employee_id: employeeId,
      period_label: periodLabel,
      period_start: asText(formData.get("period_start")),
      period_end: asText(formData.get("period_end")),
      manager_rating: asRating(formData.get("manager_rating")),
      self_rating: asRating(formData.get("self_rating")),
      strengths: asText(formData.get("strengths")),
      areas_to_improve: asText(formData.get("areas_to_improve")),
      manager_notes: asText(formData.get("manager_notes")),
      outcome: asText(formData.get("outcome")),
      kpis,
      reviewer_id: profile.id,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(
      "/dashboard/performance/new?error=" +
        encodeURIComponent(
          arabicizeDbError(error?.message ?? "فشل حفظ التقييم"),
        ),
    );
  }

  revalidatePath("/dashboard/performance");
  redirect(`/dashboard/performance/${data.id}`);
}

export async function submitReview(reviewId: string) {
  const { profile } = await requireHR();
  const supabase = await createClient();
  await supabase
    .from("performance_reviews")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", reviewId)
    .eq("company_id", profile.company_id);
  revalidatePath(`/dashboard/performance/${reviewId}`);
  redirect(`/dashboard/performance/${reviewId}?submitted=1`);
}

export async function acknowledgeReview(reviewId: string) {
  const { profile } = await requireHR();
  const supabase = await createClient();
  await supabase
    .from("performance_reviews")
    .update({
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", reviewId)
    .eq("company_id", profile.company_id);
  revalidatePath(`/dashboard/performance/${reviewId}`);
  redirect(`/dashboard/performance/${reviewId}?acknowledged=1`);
}

export async function closeReview(reviewId: string) {
  const { profile } = await requireHR();
  const supabase = await createClient();
  await supabase
    .from("performance_reviews")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", reviewId)
    .eq("company_id", profile.company_id);
  revalidatePath(`/dashboard/performance/${reviewId}`);
  redirect(`/dashboard/performance/${reviewId}?closed=1`);
}
