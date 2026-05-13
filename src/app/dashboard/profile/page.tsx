import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  updateMyProfile,
  changeMyPassword,
  updateMyCompany,
} from "./actions";

type SearchParams = Promise<{
  error?: string;
  profile_updated?: string;
  password_changed?: string;
  company_updated?: string;
}>;

type Profile = {
  full_name: string | null;
  role: string;
  company_id: string;
  companies: { name: string; industry: string | null } | null;
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, company_id, companies(name, industry)")
    .eq("id", user.id)
    .single<Profile>();

  const isAdmin = profile?.role === "admin";
  const roleLabel: Record<string, string> = {
    admin: "مدير",
    manager: "مشرف",
    employee: "موظف",
  };

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
            الإعدادات الشخصية
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            بياناتك الشخصية، كلمة السر، وإعدادات شركتك
          </p>
        </header>

        {/* Status messages */}
        {params.profile_updated && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-cairo">
            ✓ تم تحديث بياناتك الشخصية
          </div>
        )}
        {params.password_changed && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-cairo">
            ✓ تم تغيير كلمة السر بنجاح
          </div>
        )}
        {params.company_updated && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-cairo">
            ✓ تم تحديث بيانات الشركة
          </div>
        )}
        {params.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(params.error)}
          </div>
        )}

        {/* Personal info */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <h2 className="text-lg font-bold font-cairo text-slate-800 mb-1">👤 بياناتك الشخصية</h2>
          <p className="text-xs text-slate-500 mb-5 font-cairo">
            الإيميل: <span className="font-mono text-slate-700">{user.email}</span> · الصلاحية: <strong className="text-brand-cyan-dark">{roleLabel[profile?.role ?? "admin"]}</strong>
          </p>

          <form action={updateMyProfile} className="space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                اسمك الكامل
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                defaultValue={profile?.full_name ?? ""}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white font-bold text-sm font-cairo transition"
            >
              حفظ التعديلات
            </button>
          </form>
        </section>

        {/* Change password */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <h2 className="text-lg font-bold font-cairo text-slate-800 mb-1">🔒 تغيير كلمة السر</h2>
          <p className="text-xs text-slate-500 mb-5 font-cairo">
            اختار كلمة سر قوية — 8 حروف على الأقل. هتطلب منك كلمة السر الحالية للتأكد.
          </p>

          <form action={changeMyPassword} className="space-y-4">
            <div>
              <label htmlFor="current_password" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                كلمة السر الحالية
              </label>
              <input
                id="current_password"
                name="current_password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                كلمة السر الجديدة
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="confirm_password" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                تأكيد كلمة السر الجديدة
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white font-bold text-sm font-cairo transition"
            >
              تحديث كلمة السر
            </button>
          </form>
        </section>

        {/* Data Export — backup all data as Excel */}
        <section className="bg-gradient-to-br from-emerald-50 to-cyan-50 p-6 rounded-2xl border-2 border-emerald-200 mb-6">
          <h2 className="text-lg font-bold font-cairo text-slate-800 mb-1">
            💾 نسخة احتياطية من بياناتك
          </h2>
          <p className="text-xs text-slate-600 mb-4 font-cairo leading-relaxed">
            نزّل كل بيانات شركتك (موظفين + عملاء + حضور + تفاعلات) في ملف Excel
            واحد. خزّنه على جهازك أو سيرفر مكتبك — بياناتك ملكك ١٠٠%.
          </p>
          <a
            href="/api/export"
            download
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm font-cairo transition shadow-md"
          >
            <span>📥</span>
            <span>تنزيل Excel كامل</span>
          </a>
        </section>

        {/* Company settings (admin only) */}
        <section className={`bg-white p-6 rounded-2xl shadow-sm border ${isAdmin ? "border-slate-100" : "border-slate-100 opacity-60"}`}>
          <h2 className="text-lg font-bold font-cairo text-slate-800 mb-1">
            🏢 بيانات الشركة {!isAdmin && <span className="text-xs text-slate-400 font-normal">(للمديرين فقط)</span>}
          </h2>
          <p className="text-xs text-slate-500 mb-5 font-cairo">
            اسم شركتك يظهر في كل تقاريرك وعلى الـ Login لو ضفت إيميل دومينك
          </p>

          <form action={updateMyCompany} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="company_name" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  اسم الشركة
                </label>
                <input
                  id="company_name"
                  name="company_name"
                  type="text"
                  required
                  disabled={!isAdmin}
                  defaultValue={profile?.companies?.name ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label htmlFor="industry" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  القطاع (اختياري)
                </label>
                <select
                  id="industry"
                  name="industry"
                  disabled={!isAdmin}
                  defaultValue={profile?.companies?.industry ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 disabled:bg-slate-50 disabled:cursor-not-allowed"
                >
                  <option value="">— اختار —</option>
                  <option value="manufacturing">مصنع</option>
                  <option value="real-estate">عقاري</option>
                  <option value="retail">تجزئة / E-commerce</option>
                  <option value="services">خدمات</option>
                  <option value="other">آخر</option>
                </select>
              </div>
            </div>
            {isAdmin && (
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white font-bold text-sm font-cairo transition"
              >
                حفظ بيانات الشركة
              </button>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}
