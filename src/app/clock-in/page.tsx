import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClockInClient } from "./clock-in-client";
import { linkSelfAsEmployee } from "./setup-actions";

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

type SearchParams = Promise<{ setup_done?: string; setup_error?: string }>;

export default async function ClockInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/clock-in");
  }

  // Look up the user's role first so we can show admin/HR a more useful
  // "no employee record" screen with a one-click self-link button.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle<{ role: string; full_name: string | null }>();

  const isAdminOrHR = profile?.role === "admin" || profile?.role === "manager";

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
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-7 font-cairo">
          {params.setup_error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              ⚠ {decodeURIComponent(params.setup_error)}
            </div>
          )}

          <div className="text-center mb-5">
            <div className="text-5xl mb-3">📋</div>
            <h1 className="text-xl font-black text-slate-800 mb-2">
              حسابك مش متربط بأي موظف
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              صفحة تسجيل الحضور بتشتغل لما حسابك يكون متربط بسجل موظف في
              النظام.
            </p>
          </div>

          {isAdminOrHR ? (
            <>
              {/* Admin/HR: offer two paths */}
              <div className="bg-cyan-50 border-2 border-cyan-200 rounded-xl p-4 mb-3">
                <div className="text-xs font-bold text-cyan-800 mb-1.5">
                  ✦ أنت من HR — عندك اختيارين:
                </div>
                <p className="text-xs text-cyan-700 leading-relaxed">
                  لو عايز تسجّل <strong>حضورك أنت كمؤسس / مدير</strong>،
                  ضيف نفسك كموظف في ثانية. أو افتح صفحة الحضور لتسجيل حضور
                  باقي الموظفين.
                </p>
              </div>

              <form action={linkSelfAsEmployee} className="mb-3">
                <button
                  type="submit"
                  className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold shadow-md transition active:scale-95"
                >
                  ✓ سجّلني كموظف عشان أسجّل حضوري
                </button>
              </form>

              <Link
                href="/dashboard/attendance"
                className="block w-full px-5 py-3 rounded-xl bg-white border-2 border-slate-200 hover:border-brand-cyan text-slate-700 font-bold text-center transition"
              >
                📋 افتح صفحة الحضور للموظفين
              </Link>

              <p className="text-[10px] text-slate-400 mt-3 text-center leading-relaxed">
                "سجّلني كموظف" بيعمل لك سجل بسيط (الاسم + الإيميل + قسم
                "الإدارة" + راتب صفر). تقدر تعدّل التفاصيل من ملف الموظف
                بعدين.
              </p>
            </>
          ) : (
            <>
              {/* Pure employee role with no link — must wait for HR */}
              <p className="text-sm text-slate-600 text-center">
                تواصل مع HR في الشركة بتاعتك علشان يربط حسابك بسجل الموظف،
                وبعدها الصفحة دي هتشتغل تلقائياً.
              </p>
            </>
          )}
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
