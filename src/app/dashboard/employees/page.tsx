import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Employee = {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  status: "active" | "on_leave" | "terminated";
  hire_date: string | null;
};

const statusLabel: Record<Employee["status"], { text: string; classes: string }> = {
  active: { text: "نشط", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  on_leave: { text: "إجازة", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  terminated: { text: "منتهي", classes: "bg-slate-100 text-slate-600 border-slate-200" },
};

export default async function EmployeesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
      </div>
    </main>
  );
}
