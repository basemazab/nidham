import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClockInClient } from "./clock-in-client";

// ============================================================================
// /clock-in — mobile-first employee clock-in page
// ============================================================================
//
// Employee opens this on their phone after logging in. The page:
//   1. Requests geolocation permission
//   2. Captures a selfie via the device camera
//   3. Uploads the selfie to Supabase Storage
//   4. Calls public.mobile_clock_in(lat, lng) RPC which validates
//      the geofence and creates the attendance row
//   5. UPDATEs the new row with check_in_photo_url
//
// Auth is required. Employees use their HR-issued account (linked to
// employees.user_id via mig 015 invitation flow).

export const dynamic = "force-dynamic";

export default async function ClockInPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/clock-in");
  }

  // Fetch the employee record + company geofence settings for display
  const { data: employee } = await supabase
    .from("employees")
    .select(
      "id, full_name, company_id, companies!inner(name, office_lat, office_lng, office_radius_meters, geofence_enabled)",
    )
    .eq("user_id", user.id)
    .maybeSingle<{
      id: string;
      full_name: string;
      company_id: string;
      companies: {
        name: string;
        office_lat: number | null;
        office_lng: number | null;
        office_radius_meters: number | null;
        geofence_enabled: boolean;
      } | null;
    }>();

  if (!employee) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-6 text-center font-cairo">
          <div className="text-5xl mb-3">⚠</div>
          <h1 className="text-lg font-bold text-slate-800 mb-2">
            حسابك مش متربط بأي موظف
          </h1>
          <p className="text-sm text-slate-600">
            تواصل مع HR الشركة بتاعتك علشان يربط حسابك بسجل الموظف.
          </p>
        </div>
      </main>
    );
  }

  // Today's existing attendance — used to decide if this is a clock-in
  // or clock-out request (and to show the current state).
  const todayIso = new Date().toISOString().split("T")[0];
  const { data: today } = await supabase
    .from("attendance")
    .select(
      "id, check_in_at, check_out_at, check_in_photo_url, check_out_photo_url",
    )
    .eq("employee_id", employee.id)
    .eq("date", todayIso)
    .maybeSingle<{
      id: string;
      check_in_at: string | null;
      check_out_at: string | null;
      check_in_photo_url: string | null;
      check_out_photo_url: string | null;
    }>();

  const company = employee.companies;

  return (
    <ClockInClient
      employeeId={employee.id}
      employeeName={employee.full_name}
      companyName={company?.name ?? "—"}
      officeLat={company?.office_lat ?? null}
      officeLng={company?.office_lng ?? null}
      radiusMeters={company?.office_radius_meters ?? 100}
      geofenceEnabled={company?.geofence_enabled ?? false}
      todayAttendanceId={today?.id ?? null}
      checkedInAt={today?.check_in_at ?? null}
      checkedOutAt={today?.check_out_at ?? null}
    />
  );
}
