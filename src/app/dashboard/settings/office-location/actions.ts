"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/permissions";
import { bustDashboardCache } from "@/lib/cache";

function asNumber(value: FormDataEntryValue | null): number | null {
  if (value === null || typeof value !== "string") return null;
  const t = value.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function asText(value: FormDataEntryValue | null): string | null {
  if (value === null || typeof value !== "string") return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

function asBool(value: FormDataEntryValue | null): boolean {
  return value !== null && (value === "on" || value === "true" || value === "1");
}

export async function updateOfficeLocation(formData: FormData) {
  // The office geofence governs where the mobile clock-in is accepted.
  // Moving or disabling it is an admin-only action -- a manager-level
  // user shouldn't be able to silently turn off the geofence.
  const { supabase, profile } = await requireAdmin();

  const lat = asNumber(formData.get("office_lat"));
  const lng = asNumber(formData.get("office_lng"));
  const radius = asNumber(formData.get("office_radius_meters"));
  const address = asText(formData.get("office_address"));
  const geofence = asBool(formData.get("geofence_enabled"));

  if (lat !== null && (lat < -90 || lat > 90)) {
    redirect(
      "/dashboard/settings/office-location?error=" +
        encodeURIComponent("خط العرض لازم بين -90 و 90"),
    );
  }
  if (lng !== null && (lng < -180 || lng > 180)) {
    redirect(
      "/dashboard/settings/office-location?error=" +
        encodeURIComponent("خط الطول لازم بين -180 و 180"),
    );
  }

  const { error } = await supabase
    .from("companies")
    .update({
      office_address: address,
      office_lat: lat,
      office_lng: lng,
      office_radius_meters: radius ?? 100,
      geofence_enabled: geofence,
    })
    .eq("id", profile.company_id);

  if (error) {
    redirect(
      "/dashboard/settings/office-location?error=" +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/settings/office-location");
  bustDashboardCache();
  redirect("/dashboard/settings/office-location?saved=1");
}
