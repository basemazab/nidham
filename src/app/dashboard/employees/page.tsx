import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteAllEmployeesButton } from "@/components/delete-all-employees-button";
import { getMyProfile } from "@/lib/permissions";

type Employee = {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  status: "active" | "on_leave" | "terminated";
  hire_date: string | null;
};

type Params = Promise<{
  deleted_all?: string;
  error?: string;
  updated?: string;
}>;

const statusLabel: Record<Employee["status"], { text: string; classes: string }> = {
  active: { text: "نشط", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  on_leave: { text: "إجازة", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  terminated: { text: "منتهي", classes: "bg-slate-100 text-slate-600 border-slate-200" },
};

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

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name, job_title, department, phone, status, hire_date")
    .order("created_at", { ascending: false })
    .returns<Employee[]>();

  const list = employees ?? [];

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Breadcrumb + title */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        {deletedAll !== null && (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 font-cairo text-emerald-800 flex items-start gap-3">
            <span className="text-2xl">✓</span>
            <div>
              <div className="font-bold">تم الحذف الجماعي</div>
              <p className="text-sm mt-0.5">
                اتمسح <b>{deletedAll.toLocaleString("ar-EG")}</b> موظف
                مع كل بياناتهم المرتبطة.
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 font-cairo text-sm">
            ⚠ {errorMsg}
          </div>
        )}

        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              الموظفين
            </h1>
            <p className="text-sm text-slate-500">
              {list.length === 0
                ? "لسه مفيش موظفين — ابدأ ضيف أول واحد"
                : `${list.length} ${list.length === 1 ? "موظف" : "موظفين"}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/employees/import"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-brand-cyan/30 bg-brand-cyan/5 text-brand-cyan-dark font-bold hover:bg-brand-cyan/10 transition font-cairo text-sm"
            >
              <span>📂</span>
              <span>رفع من Excel</span>
            </Link>
            <Link
              href="/dashboard/employees/new"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all font-cairo"
            >
              <span className="text-lg leading-none">+</span>
              <span>إضافة موظف</span>
            </Link>
          </div>
        </header>

        {/* Table or empty state */}
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
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الاسم</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">المسمى الوظيفي</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">القسم</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الموبايل</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الحالة</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((employee) => {
                  const status = statusLabel[employee.status];
                  return (
                    <tr key={employee.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-4">
                        <Link href={`/dashboard/employees/${employee.id}`} className="flex items-center gap-3 group">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center text-white font-bold text-sm">
                            {employee.full_name[0]}
                          </div>
                          <span className="font-medium text-slate-800 font-cairo group-hover:text-brand-cyan-dark transition">{employee.full_name}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{employee.job_title ?? "—"}</td>
                      <td className="px-5 py-4 text-slate-600">{employee.department ?? "—"}</td>
                      <td className="px-5 py-4 text-slate-600 font-mono text-sm" dir="ltr">{employee.phone ?? "—"}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${status.classes} font-cairo`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/employees/${employee.id}`}
                          className="text-xs text-brand-cyan-dark hover:text-brand-cyan font-cairo font-bold"
                        >
                          تعديل
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Danger zone -- admin-only bulk delete. Lives at the bottom of
            the page on purpose: out of the way for normal HR work, but
            available for a clean reset (e.g. wrong import that needs to
            be re-done from scratch). */}
        {isAdmin && list.length > 0 && (
          <section className="mt-12 bg-red-50/50 border-2 border-red-200 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-red-800 font-cairo mb-1">
                  ⚠ منطقة الخطر
                </h3>
                <p className="text-sm text-red-700 leading-relaxed font-cairo max-w-xl">
                  حذف كل الموظفين بياخد معاه كل سجلات الحضور والرواتب
                  والطلبات. مفيش رجوع — استعملها بس لو حابب تبدأ من الصفر.
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
