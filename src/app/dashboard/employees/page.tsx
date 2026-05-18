// ============================================================================
// /dashboard/employees — the Employees command center
// ============================================================================
//
// Used to be a flat searchable table. Now it's a three-band layout:
//
//   ┌────────────────────────────────────────────────┐
//   │  Band 1: Analytics                             │
//   │   • 4 KPI cards (active, payroll, average,     │
//   │     departments)                               │
//   │   • Top earners (bars) + Lowest earners (bars) │
//   │   • Department distribution                    │
//   │   • Hiring timeline                            │
//   ├────────────────────────────────────────────────┤
//   │  Band 2: Search + View toggle                  │
//   │   • Text search                                │
//   │   • Tabs: By Department  /  Flat Table         │
//   ├────────────────────────────────────────────────┤
//   │  Band 3: Either grouped sections or table      │
//   └────────────────────────────────────────────────┘
//
// All analytics computed server-side from the fetched rows. The list
// itself is client-side (search + filter is instant for <500 employees).

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteAllEmployeesButton } from "@/components/delete-all-employees-button";
import { getMyProfile } from "@/lib/permissions";
import {
  EmployeesExplorer,
  type EmployeeRow,
} from "./employees-explorer";
import { EmployeesAnalytics } from "./employees-analytics";

export type { EmployeeRow as Employee };

// Force the employees page to revalidate on every request. Without
// this, Next.js was holding the row list + analytics counters in the
// Data Cache, so newly added employees / department-count changes
// took up to several minutes to appear (the operator reported adding
// "كذا موظف في قسم التشطيب والعدد متغيرش"). Marking it dynamic
// trades a tiny latency hit for fresh numbers — the right call for
// a write-heavy admin page.
export const dynamic = "force-dynamic";

type Params = Promise<{
  deleted_all?: string;
  error?: string;
  updated?: string;
}>;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = await searchParams;
  const deletedAll = params.deleted_all
    ? parseInt(params.deleted_all, 10)
    : null;
  const errorMsg = params.error ? decodeURIComponent(params.error) : null;

  const { profile } = await getMyProfile();
  const isAdmin = profile?.role === "admin";

  // CRITICAL: scope the employees list to the caller's company explicitly.
  // RLS already does this for regular tenants, but super-admin sessions
  // (mig 038's "Super-Admin Read Access Policies") let them SELECT
  // employees from EVERY tenant — handy for the /admin panel, disastrous
  // here because:
  //   1) The deleteAllEmployees action filters by profile.company_id,
  //      so the count it reports (0) won't match the list shown (4
  //      cross-tenant rows leaking in).
  //   2) Editing one of those leaked rows from this page would touch
  //      another tenant's data via the .update().eq("id", ...) path.
  // Adding the explicit company_id filter restores the per-tenant view
  // that the dashboard is meant to be. Super-admins who want cross-
  // tenant data should use /admin instead.
  const callerCompanyId = profile?.company_id ?? "";

  const [employeesRes, dupCountRes] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "id, full_name, employee_code, job_title, department, phone, status, hire_date, pay_frequency, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, avatar_url",
      )
      .eq("company_id", callerCompanyId)
      .order("created_at", { ascending: false })
      .returns<EmployeeRow[]>(),
    isAdmin
      ? supabase.rpc("count_duplicate_employee_groups")
      : Promise.resolve({ data: 0 }),
  ]);

  const list = employeesRes.data ?? [];
  const duplicateGroupCount =
    typeof dupCountRes.data === "number" ? dupCountRes.data : 0;

  // Active employees drive every analytic. Terminated/on-leave still
  // show in the list but don't pollute the metrics.
  const activeList = list.filter((e) => e.status === "active");

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        {/* Status messages */}
        {deletedAll !== null && (
          <div className="mb-5 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 font-cairo text-emerald-800 flex items-start gap-3">
            <span className="text-2xl">✓</span>
            <div>
              <div className="font-bold">تم الحذف الجماعي</div>
              <p className="text-sm mt-0.5">
                اتمسح <b>{deletedAll.toLocaleString("ar-EG")}</b> موظف مع كل
                بياناتهم المرتبطة.
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-5 bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 font-cairo text-sm">
            ⚠ {errorMsg}
          </div>
        )}

        {/* Duplicate banner */}
        {isAdmin && duplicateGroupCount > 0 && (
          <div className="mb-5 bg-amber-50 border-2 border-amber-200 rounded-xl p-4 font-cairo flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className="text-2xl">⚠</span>
              <div>
                <div className="font-bold text-amber-900 mb-0.5">
                  فيه {duplicateGroupCount.toLocaleString("ar-EG")} حالة تكرار
                  محتملة بين موظفينك
                </div>
                <p className="text-sm text-amber-800 leading-relaxed">
                  موظفين بنفس الرقم القومي / كود الموظف / إيميل / تليفون. راجعهم
                  واحذف المكرر منهم عشان البيانات تبقى نضيفة.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/employees/duplicates"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition whitespace-nowrap"
            >
              🔍 راجع التكرارات →
            </Link>
          </div>
        )}

        {/* Header */}
        <header className="flex items-start justify-between gap-3 flex-wrap mb-6">
          <div>
            <div className="inline-block px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-[11px] font-bold mb-2 font-cairo">
              👥 إدارة الفريق
            </div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              الموظفين
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              {list.length === 0
                ? "لسه مفيش موظفين — ابدأ ضيف أول واحد"
                : `${list.length} موظف · ${activeList.length} نشط`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/dashboard/employees/import"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-cyan/30 bg-brand-cyan/5 text-brand-cyan-dark font-bold hover:bg-brand-cyan/10 transition font-cairo text-sm"
            >
              <span>📂</span>
              <span>رفع من Excel</span>
            </Link>
            <Link
              href="/dashboard/employees/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all font-cairo text-sm"
            >
              <span className="text-lg leading-none">+</span>
              <span>إضافة موظف</span>
            </Link>
          </div>
        </header>

        {/* Empty state */}
        {list.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">👥</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">
              مفيش موظفين بعد
            </h2>
            <p className="text-slate-500 mb-6">
              ضيف أول موظف عشان تبدأ تشوف الحضور وتقارير Bridge
            </p>
            <Link
              href="/dashboard/employees/new"
              className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo"
            >
              ضيف أول موظف
            </Link>
          </div>
        ) : (
          <>
            {/* Band 1: Analytics — server component, computed from the fetched rows */}
            <EmployeesAnalytics employees={list} />

            {/* Band 2+3: Search + view toggle + grouped or table view */}
            <EmployeesExplorer employees={list} />
          </>
        )}

        {/* Danger zone — admin-only bulk delete */}
        {isAdmin && list.length > 0 && (
          <section className="mt-12 bg-red-50/50 border-2 border-red-200 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-red-800 font-cairo mb-1">
                  ⚠ منطقة الخطر
                </h3>
                <p className="text-sm text-red-700 leading-relaxed font-cairo max-w-xl">
                  حذف كل الموظفين بياخد معاه كل سجلات الحضور والرواتب والطلبات.
                  مفيش رجوع — استعملها بس لو حابب تبدأ من الصفر.
                </p>
              </div>
              <DeleteAllEmployeesButton employeeCount={list.length} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
