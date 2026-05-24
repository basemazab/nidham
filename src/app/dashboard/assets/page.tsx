// ============================================================================
// /dashboard/assets — Asset inventory list view
// ============================================================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { formatEGP } from "@/lib/format";

export const dynamic = "force-dynamic";

type AssetRow = {
  id: string;
  name: string;
  asset_type: string;
  serial_number: string | null;
  asset_tag: string | null;
  status: string;
  purchase_cost: number | null;
  current_estimated_value: number | null;
  assigned_employee_id: string | null;
  employees: { full_name: string; avatar_url: string | null } | null;
};

const TYPE_LABELS: Record<string, { ar: string; icon: string }> = {
  laptop:      { ar: "لاب توب",       icon: "💻" },
  desktop:     { ar: "كمبيوتر مكتبي",  icon: "🖥" },
  phone:       { ar: "تليفون",         icon: "📱" },
  tablet:      { ar: "تابلت",          icon: "📲" },
  monitor:     { ar: "شاشة",           icon: "🖼" },
  printer:     { ar: "طابعة",          icon: "🖨" },
  car:         { ar: "سيارة",          icon: "🚗" },
  motorcycle:  { ar: "موتوسيكل",       icon: "🏍" },
  tool:        { ar: "أداة / معدة",    icon: "🔧" },
  uniform:     { ar: "زي / يونيفورم",  icon: "👔" },
  sim_card:    { ar: "خط محمول",       icon: "📞" },
  access_card: { ar: "بطاقة دخول",     icon: "🔑" },
  other:       { ar: "أخرى",           icon: "📦" },
};

const STATUS_LABELS: Record<string, { ar: string; cls: string }> = {
  available:      { ar: "متاح",        cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  assigned:       { ar: "مخصص",        cls: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  in_maintenance: { ar: "صيانة",       cls: "bg-amber-50 text-amber-700 border-amber-200" },
  retired:        { ar: "خارج الخدمة", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  lost:           { ar: "مفقود",       cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

export default async function AssetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const { data: assets } = await supabase
    .from("assets")
    .select(
      "id, name, asset_type, serial_number, asset_tag, status, purchase_cost, current_estimated_value, assigned_employee_id, employees(full_name, avatar_url)",
    )
    .eq("company_id", callerCompanyId)
    .order("created_at", { ascending: false })
    .returns<AssetRow[]>();

  const list = assets ?? [];

  // KPIs
  const totalValue = list.reduce(
    (s, a) => s + Number(a.current_estimated_value ?? a.purchase_cost ?? 0),
    0,
  );
  const byStatus = list.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الـ Dashboard
          </Link>
        </div>

        <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              📦 إدارة الأصول
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              لابتوبات، تليفونات، عربيات، أدوات — مع تاريخ كل أصل ومين عنده.
            </p>
          </div>
          <Link
            href="/dashboard/assets/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 font-cairo text-sm"
          >
            <span>+</span>
            <span>أضف أصل جديد</span>
          </Link>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi icon="📦" label="إجمالي الأصول" value={list.length.toString()} />
          <Kpi
            icon="💰"
            label="القيمة التقديرية"
            value={formatEGP(totalValue)}
          />
          <Kpi
            icon="✅"
            label="متاح"
            value={(byStatus.available ?? 0).toString()}
          />
          <Kpi
            icon="👤"
            label="مخصص لموظفين"
            value={(byStatus.assigned ?? 0).toString()}
          />
        </div>

        {/* List */}
        {list.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">الأصل</th>
                  <th className="px-4 py-3">النوع</th>
                  <th className="px-4 py-3">الكود</th>
                  <th className="px-4 py-3">المخصص</th>
                  <th className="px-4 py-3">القيمة</th>
                  <th className="px-4 py-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((a) => {
                  const type = TYPE_LABELS[a.asset_type] ?? TYPE_LABELS.other;
                  const st = STATUS_LABELS[a.status] ?? STATUS_LABELS.available;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/assets/${a.id}`}
                          className="font-bold text-slate-800 hover:text-brand-cyan-dark font-cairo"
                        >
                          {type.icon} {a.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-cairo">
                        {type.ar}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs font-mono" dir="ltr">
                        {a.asset_tag ?? a.serial_number ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-cairo">
                        {a.employees?.full_name ?? (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-mono" dir="ltr">
                        {a.current_estimated_value || a.purchase_cost
                          ? formatEGP(
                              Number(a.current_estimated_value ?? a.purchase_cost),
                            )
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-bold font-cairo ${st.cls}`}
                        >
                          {st.ar}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function Kpi({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-base font-black font-display text-slate-800">{value}</div>
      <div className="text-[10px] text-slate-500 font-cairo mt-1">{label}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
      <div className="text-6xl mb-4">📦</div>
      <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">
        مفيش أصول مسجلة
      </h2>
      <p className="text-slate-500 font-cairo mb-6">
        ابدأ سجل الأصول بإضافة أول لاب توب / تليفون / موتوسيكل في الشركة
      </p>
      <Link
        href="/dashboard/assets/new"
        className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo"
      >
        أضف أول أصل
      </Link>
    </div>
  );
}
