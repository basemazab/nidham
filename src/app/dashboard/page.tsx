import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  // Fetch everything in parallel
  const [profileRes, employeesCount, customersCount, interactionsCount] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, role, companies(name, industry)")
        .eq("id", user.id)
        .single<Profile>(),
      supabase
        .from("employees")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("interactions")
        .select("id", { count: "exact", head: true }),
    ]);

  const profile = profileRes.data;
  const empCount = employeesCount.count ?? 0;
  const custCount = customersCount.count ?? 0;
  const intCount = interactionsCount.count ?? 0;

  const displayName = profile?.full_name ?? user.email?.split("@")[0] ?? "مستخدم";
  const companyName = profile?.companies?.name ?? "—";
  const roleLabel: Record<string, string> = {
    admin: "مدير",
    manager: "مشرف",
    employee: "موظف",
  };

  // Onboarding: show wizard if any module is empty
  const onboardingDone = empCount > 0 && custCount > 0 && intCount > 0;
  const completedSteps = (empCount > 0 ? 1 : 0) + (custCount > 0 ? 1 : 0) + (intCount > 0 ? 1 : 0);

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
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

        {/* Onboarding wizard (hidden once all 3 steps are done) */}
        {!onboardingDone && (
          <section className="bg-gradient-to-br from-amber-50 via-cyan-50 to-white rounded-2xl border-2 border-amber-200 p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs font-bold text-amber-700 tracking-wider mb-1 font-cairo">
                  ✦ ابدأ هنا
                </div>
                <h2 className="text-xl font-black font-cairo text-slate-800">
                  3 خطوات سريعة عشان النظام يبقى شغّال
                </h2>
                <p className="text-xs text-slate-600 mt-1 font-cairo">
                  كل خطوة بتاخد أقل من دقيقة. لما تخلّصهم، Bridge هيوريك أرقام حقيقية.
                </p>
              </div>
              <div className="text-2xl font-black text-amber-600 font-display">
                {completedSteps}/3
              </div>
            </div>

            <div className="space-y-2">
              {/* Step 1: Employee */}
              <Link
                href="/dashboard/employees/new"
                className={`flex items-center justify-between p-4 rounded-xl transition ${
                  empCount > 0
                    ? "bg-emerald-50 border border-emerald-200"
                    : "bg-white border border-amber-200 hover:border-amber-400 hover:shadow-md"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${
                    empCount > 0 ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-700"
                  }`}>
                    {empCount > 0 ? "✓" : "1"}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 font-cairo">ضيف أول موظف</div>
                    <div className="text-xs text-slate-500 font-cairo">
                      {empCount > 0 ? `تمام — عندك ${empCount} موظف${empCount > 1 ? "ين" : ""}` : "اسم + موبايل + قسم"}
                    </div>
                  </div>
                </div>
                <span className="text-sm text-brand-cyan-dark font-bold font-cairo">
                  {empCount > 0 ? "ضيف تاني ←" : "ابدأ ←"}
                </span>
              </Link>

              {/* Step 2: Customer */}
              <Link
                href="/dashboard/customers/new"
                className={`flex items-center justify-between p-4 rounded-xl transition ${
                  custCount > 0
                    ? "bg-emerald-50 border border-emerald-200"
                    : "bg-white border border-amber-200 hover:border-amber-400 hover:shadow-md"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${
                    custCount > 0 ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-700"
                  }`}>
                    {custCount > 0 ? "✓" : "2"}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 font-cairo">ضيف أول عميل</div>
                    <div className="text-xs text-slate-500 font-cairo">
                      {custCount > 0 ? `تمام — عندك ${custCount} عميل` : "اسم + موبايل + اربطه بموظف"}
                    </div>
                  </div>
                </div>
                <span className="text-sm text-brand-cyan-dark font-bold font-cairo">
                  {custCount > 0 ? "ضيف تاني ←" : "ابدأ ←"}
                </span>
              </Link>

              {/* Step 3: Interaction */}
              <Link
                href="/dashboard/interactions"
                className={`flex items-center justify-between p-4 rounded-xl transition ${
                  intCount > 0
                    ? "bg-emerald-50 border border-emerald-200"
                    : "bg-white border border-amber-200 hover:border-amber-400 hover:shadow-md"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${
                    intCount > 0 ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-700"
                  }`}>
                    {intCount > 0 ? "✓" : "3"}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 font-cairo">سجل أول تفاعل</div>
                    <div className="text-xs text-slate-500 font-cairo">
                      {intCount > 0 ? `تمام — عندك ${intCount} تفاعل` : "اللي بيخلي Bridge يبدأ يجيب أرقام"}
                    </div>
                  </div>
                </div>
                <span className="text-sm text-brand-cyan-dark font-bold font-cairo">
                  {intCount > 0 ? "ضيف تاني ←" : "ابدأ ←"}
                </span>
              </Link>
            </div>
          </section>
        )}

        {/* Modules section */}
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 font-cairo">
          الموديولات
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          <Link
            href="/dashboard/employees"
            className="bg-white p-6 rounded-2xl border border-slate-100 hover:border-brand-cyan/40 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <div className="text-3xl mb-2">👥</div>
            <h3 className="font-bold font-cairo mb-1 text-slate-800">الموظفين</h3>
            <p className="text-xs text-slate-500">إدارة فريقك</p>
          </Link>

          <Link
            href="/dashboard/attendance"
            className="bg-white p-6 rounded-2xl border border-slate-100 hover:border-brand-cyan/40 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <div className="text-3xl mb-2">⏰</div>
            <h3 className="font-bold font-cairo mb-1 text-slate-800">الحضور والانصراف</h3>
            <p className="text-xs text-slate-500">تسجيل يومي</p>
          </Link>

          <Link
            href="/dashboard/customers"
            className="bg-white p-6 rounded-2xl border border-slate-100 hover:border-brand-cyan/40 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <div className="text-3xl mb-2">💼</div>
            <h3 className="font-bold font-cairo mb-1 text-slate-800">العملاء</h3>
            <p className="text-xs text-slate-500">CRM + Pipeline</p>
          </Link>

          <Link
            href="/dashboard/interactions"
            className="bg-gradient-to-br from-amber-50 to-cyan-50 p-6 rounded-2xl border-2 border-amber-200 hover:border-amber-400 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <div className="text-3xl mb-2">💬</div>
            <h3 className="font-bold font-cairo mb-1 text-slate-800">التفاعلات</h3>
            <p className="text-xs text-amber-700 font-bold">قلب Bridge</p>
          </Link>

          <Link
            href="/dashboard/contracts"
            className="bg-white p-6 rounded-2xl border border-slate-100 hover:border-brand-cyan/40 hover:shadow-lg hover:-translate-y-0.5 transition-all relative overflow-hidden"
          >
            <div className="absolute top-2 left-2 text-[10px] text-brand-gold font-bold tracking-wider">
              جديد ✦
            </div>
            <div className="text-3xl mb-2">📋</div>
            <h3 className="font-bold font-cairo mb-1 text-slate-800">العقود</h3>
            <p className="text-xs text-slate-500">تنبيه قبل التجديد</p>
          </Link>
        </div>

        {/* Reports section */}
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 font-cairo">
          التقارير
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/dashboard/reports/attendance"
            className="bg-white p-6 rounded-2xl border border-slate-100 hover:border-brand-cyan/40 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <div className="text-3xl mb-2">📊</div>
            <h3 className="font-bold font-cairo mb-1 text-slate-800">تقرير الحضور الشهري</h3>
            <p className="text-xs text-slate-500">إحصائيات + Top Performer</p>
          </Link>

          <Link
            href="/dashboard/reports/bridge"
            className="bg-gradient-to-br from-amber-50 via-cyan-50 to-white p-6 rounded-2xl border-2 border-amber-300 hover:border-amber-500 hover:shadow-xl hover:-translate-y-0.5 transition-all relative overflow-hidden"
          >
            <div className="absolute top-2 left-2 text-[10px] text-brand-gold font-bold tracking-wider">
              جديد ✦
            </div>
            <div className="text-3xl mb-2">✦</div>
            <h3 className="font-bold font-cairo mb-1 text-slate-800">Bridge Analytics</h3>
            <p className="text-xs text-amber-700 font-bold">مين ملتزم إداريًا — وكمان منتج فعليًا؟</p>
          </Link>
        </div>

        {/* Status note */}
        <div className="mt-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 font-cairo text-center">
          ✓ النظام كامل: HR (موظفين + حضور) + CRM (عملاء) + Bridge (تفاعلات + تقارير تربط الاتنين). ده اللي مفيش نظام تاني في السوق بيعمله.
        </div>
      </div>
    </main>
  );
}
