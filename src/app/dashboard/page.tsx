import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";

type Profile = {
  full_name: string | null;
  role: string;
  companies: {
    name: string;
    industry: string | null;
  } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile + company in one query (RLS filters to user's own company)
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, companies(name, industry)")
    .eq("id", user.id)
    .single<Profile>();

  const displayName = profile?.full_name ?? user.email?.split("@")[0] ?? "مستخدم";
  const companyName = profile?.companies?.name ?? "—";
  const roleLabel: Record<string, string> = {
    admin: "مدير",
    manager: "مشرف",
    employee: "موظف",
  };

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Top bar */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-navy shadow-md shadow-cyan-500/20">
              <span className="text-xl font-black text-white font-display">ن</span>
            </div>
            <div>
              <div className="text-xl font-black font-display bg-gradient-to-r from-brand-cyan-dark to-brand-navy bg-clip-text text-transparent leading-none">
                نِظام
              </div>
              <div className="text-[10px] tracking-widest text-brand-gold font-semibold">
                DASHBOARD
              </div>
            </div>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition font-cairo"
            >
              تسجيل الخروج
            </button>
          </form>
        </header>

        {/* Welcome card */}
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-black text-white">
                {displayName[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black font-cairo mb-1 text-slate-800">
                أهلًا {displayName} 👋
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 mb-3">
                <span>
                  الشركة: <strong className="text-slate-700">{companyName}</strong>
                </span>
                <span>•</span>
                <span>
                  الصلاحية: <strong className="text-brand-cyan-dark">
                    {roleLabel[profile?.role ?? "admin"] ?? profile?.role}
                  </strong>
                </span>
              </div>
              <p className="inline-block text-brand-cyan-dark font-bold font-mono bg-cyan-50 px-3 py-1.5 rounded-lg text-xs">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Module Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/dashboard/employees"
            className="bg-white p-6 rounded-2xl border border-slate-100 hover:border-brand-cyan/40 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <div className="text-3xl mb-2">👥</div>
            <h3 className="font-bold font-cairo mb-1 text-slate-800">الموظفين</h3>
            <p className="text-xs text-brand-cyan-dark font-bold">جاهز ✓</p>
          </Link>

          <Link
            href="/dashboard/attendance"
            className="bg-white p-6 rounded-2xl border border-slate-100 hover:border-brand-cyan/40 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <div className="text-3xl mb-2">⏰</div>
            <h3 className="font-bold font-cairo mb-1 text-slate-800">الحضور والانصراف</h3>
            <p className="text-xs text-brand-cyan-dark font-bold">جاهز ✓</p>
          </Link>

          <Link
            href="/dashboard/reports/attendance"
            className="bg-gradient-to-br from-cyan-50 to-white p-6 rounded-2xl border-2 border-brand-cyan/30 hover:border-brand-cyan hover:shadow-lg hover:-translate-y-0.5 transition-all relative overflow-hidden"
          >
            <div className="absolute top-2 left-2 text-[10px] text-brand-gold font-bold tracking-wider">
              جديد ✦
            </div>
            <div className="text-3xl mb-2">📊</div>
            <h3 className="font-bold font-cairo mb-1 text-slate-800">تقرير الحضور الشهري</h3>
            <p className="text-xs text-brand-cyan-dark font-bold">جاهز ✓</p>
          </Link>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 opacity-60">
            <div className="text-3xl mb-2">💼</div>
            <h3 className="font-bold font-cairo mb-1">العملاء + Bridge</h3>
            <p className="text-xs text-slate-500">قريبًا</p>
          </div>
        </div>

        {/* Status note */}
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-cairo text-center">
          🚧 نسخة Beta · موديولات شغّالة: الموظفين + الحضور + تقرير الحضور · العملاء + Bridge جايين
        </div>
      </div>
    </main>
  );
}
