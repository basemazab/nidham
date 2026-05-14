import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateOfficeLocation } from "./actions";
import { UseMyLocationButton } from "./use-my-location";
import { OfficeMapPickerClient } from "./map-picker-client";

type SearchParams = Promise<{ error?: string; saved?: string }>;

type Company = {
  id: string;
  name: string;
  office_address: string | null;
  office_lat: number | null;
  office_lng: number | null;
  office_radius_meters: number | null;
  geofence_enabled: boolean;
};

export default async function OfficeLocationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, saved } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Read the company via the profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/dashboard");

  const { data: company } = await supabase
    .from("companies")
    .select(
      "id, name, office_address, office_lat, office_lng, office_radius_meters, geofence_enabled",
    )
    .eq("id", profile.company_id)
    .single<Company>();

  if (!company) redirect("/dashboard");

  const isConfigured = company.office_lat !== null && company.office_lng !== null;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            📍 موقع المكتب
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed">
            دي إعدادات الـ Geofence — الموقع اللي الموظفين هيثبتوا حضور منه عبر
            تطبيق الموبايل. لو حدّدته، التطبيق هيرفض الحضور لو الموظف بعيد عن
            المكان (أو يحفظ موقعه للمراجعة، حسب الوضع المختار).
          </p>
        </header>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(error)}
          </div>
        )}
        {saved && (
          <div className="mb-6 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-cairo">
            ✓ تم الحفظ — التطبيق هيستخدم الإعدادات الجديدة من المرة الجاية
          </div>
        )}

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          <form action={updateOfficeLocation} className="space-y-6">
            {/* Address (optional, free text) */}
            <div>
              <label
                htmlFor="office_address"
                className="block text-sm font-bold text-slate-700 mb-2 font-cairo"
              >
                عنوان المكتب
                <span className="text-slate-400 text-xs mr-2">— اختياري</span>
              </label>
              <input
                id="office_address"
                name="office_address"
                type="text"
                defaultValue={company.office_address ?? ""}
                placeholder="مثلًا: 12 شارع التحرير، الدقي، الجيزة"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
              />
            </div>

            {/* GPS coordinates */}
            <div className="border-t border-slate-100 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold text-slate-800 font-cairo">
                  📍 إحداثيات GPS <span className="text-red-500">*</span>
                </h3>
                <UseMyLocationButton />
              </div>
              <p className="text-xs text-slate-500 mb-3 font-cairo leading-relaxed">
                <strong>أسهل طريقة:</strong> اضغط على المكان بتاع المكتب على
                الخريطة تحت، أو اسحب الـ marker لضبط دقيق. الزرار اللي فوق
                مفيد بس من الموبايل اللي عنده GPS — على الكمبيوتر غالبًا
                ميشتغلش.
              </p>

              {/* Interactive map picker */}
              <div className="mb-4">
                <OfficeMapPickerClient
                  initialLat={company.office_lat}
                  initialLng={company.office_lng}
                  initialRadius={company.office_radius_meters ?? 100}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="office_lat"
                    className="block text-xs font-medium text-slate-600 mb-1 font-cairo"
                  >
                    خط العرض (Latitude)
                  </label>
                  <input
                    id="office_lat"
                    name="office_lat"
                    type="number"
                    step="0.0000001"
                    min="-90"
                    max="90"
                    defaultValue={company.office_lat ?? ""}
                    placeholder="30.0444196"
                    dir="ltr"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-mono text-right"
                  />
                </div>
                <div>
                  <label
                    htmlFor="office_lng"
                    className="block text-xs font-medium text-slate-600 mb-1 font-cairo"
                  >
                    خط الطول (Longitude)
                  </label>
                  <input
                    id="office_lng"
                    name="office_lng"
                    type="number"
                    step="0.0000001"
                    min="-180"
                    max="180"
                    defaultValue={company.office_lng ?? ""}
                    placeholder="31.2357116"
                    dir="ltr"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-mono text-right"
                  />
                </div>
              </div>

              {isConfigured && (
                <a
                  href={`https://www.google.com/maps?q=${company.office_lat},${company.office_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-xs text-brand-cyan-dark hover:underline font-cairo"
                >
                  🗺 افتح الموقع المحفوظ على Google Maps ↗
                </a>
              )}
            </div>

            {/* Radius */}
            <div>
              <label
                htmlFor="office_radius_meters"
                className="block text-sm font-bold text-slate-700 mb-2 font-cairo"
              >
                نطاق المسموح به (متر)
              </label>
              <input
                id="office_radius_meters"
                name="office_radius_meters"
                type="number"
                min="10"
                max="5000"
                step="10"
                defaultValue={company.office_radius_meters ?? 100}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
              <p className="text-xs text-slate-500 mt-1 font-cairo">
                مكتب صغير: 50-100 م · مبنى كامل: 100-200 م · حرم كبير: 300+ م
              </p>
            </div>

            {/* Geofence mode toggle */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="geofence_enabled"
                  defaultChecked={company.geofence_enabled}
                  className="mt-1 w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan"
                />
                <div>
                  <div className="text-sm font-bold text-slate-800 font-cairo">
                    🔒 الوضع الصارم — ارفض الحضور من خارج النطاق
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-cairo leading-relaxed">
                    لو مفعّل: الموظف لازم يكون في النطاق عشان يقدر يثبت حضور.
                    <br />
                    لو مش مفعّل: الحضور يُسجّل لكن مع تنبيه &quot;خارج النطاق&quot; للـ HR.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo"
              >
                حفظ الإعدادات
              </button>
              <Link
                href="/dashboard"
                className="px-6 py-3 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo"
              >
                إلغاء
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6 font-cairo leading-relaxed">
          💡 مش لازم تحدّد موقع. لو سيبته فاضي، الموظفين يقدروا يثبتوا حضور من
          أي مكان (مفيد للشركات اللي عندها أكتر من فرع).
        </p>
      </div>
    </main>
  );
}
