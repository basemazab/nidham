import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { updatePayrollSettings } from "./actions";

// Admin-only settings page for the two opt-in payroll deductions.
// Both default to OFF (most Egyptian SMBs don't formally file), and
// HR can flip them on when they're ready. The settings are stored
// on the companies row (migration 023) and read by the payroll
// generator + entry updater.

export const metadata = {
  title: "إعدادات الرواتب | نِظام",
};

type Params = Promise<{ saved?: string; error?: string }>;

type CompanyRow = {
  social_insurance_enabled: boolean | null;
  income_tax_enabled: boolean | null;
};

export default async function PayrollSettingsPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const { supabase, profile } = await requireAdmin();
  const sp = await searchParams;
  const saved = sp.saved === "1";
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  const { data: company } = await supabase
    .from("companies")
    .select("social_insurance_enabled, income_tax_enabled")
    .eq("id", profile.company_id)
    .single<CompanyRow>();

  const insuranceOn = company?.social_insurance_enabled === true;
  const taxOn = company?.income_tax_enabled === true;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/payroll"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للرواتب
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            ⚙ إعدادات الرواتب
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed">
            بشكل افتراضي النظام **مش بيخصم** تأمينات ولا ضريبة دخل من
            الرواتب — لأن أغلب الشركات الصغيرة في مصر بتدفع كاش بدون
            تسجيل رسمي. فعّل الخصومات دي بس لو شركتك بتقدّم اعتراضاتها
            على هيئة التأمينات / مصلحة الضرائب فعلاً.
          </p>
        </header>

        {saved && (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 font-cairo text-emerald-800 flex items-start gap-3">
            <span className="text-2xl">✓</span>
            <div>
              <div className="font-bold">تم الحفظ</div>
              <p className="text-sm mt-0.5">
                الإعدادات الجديدة هتطبّق على أي payroll period جديد
                هتعمله. الـ periods الموجودة بالفعل ما اتأثرتش.
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 font-cairo text-sm">
            ⚠ {errorMsg}
          </div>
        )}

        <form action={updatePayrollSettings} className="space-y-4">
          <ToggleCard
            name="social_insurance_enabled"
            defaultChecked={insuranceOn}
            title="التأمينات الاجتماعية"
            arabicSubtitle="حصة الموظف 14% من الأجر المؤمَّن عليه"
            explain={[
              "بالشغّال: النظام بيخصم 14% من المرتب (بحد أقصى 12,600 ج) من كل قسيمة.",
              "بالقافل: مفيش خصم تأمينات تلقائي. لو الشركة بتسجّل تأمينات يدويًا تقدر تكتبها في خانة 'خصومات إضافية'.",
            ]}
          />

          <ToggleCard
            name="income_tax_enabled"
            defaultChecked={taxOn}
            title="ضريبة الدخل"
            arabicSubtitle="6 شرائح من 10% إلى 27.5% بعد الإعفاء الشخصي 20,000 ج/سنة"
            explain={[
              "بالشغّال: النظام بيحسب الضريبة الشهرية من الشرائح المصرية 2024 ويخصمها تلقائيًا.",
              "بالقافل: مفيش خصم ضريبة. مناسب للشركات اللي بتدفع كاش بدون تسجيل رسمي.",
            ]}
          />

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="text-sm text-amber-900 font-cairo leading-relaxed">
              <b>ملاحظة قانونية:</b> النظام بيوفّر لك أداة لحساب الرواتب
              زي ما إنت بتفضّل تشغّلها. مسؤوليتك القانونية تجاه هيئة
              التأمينات ومصلحة الضرائب تتم بشكل منفصل — استشر محاسب
              قانوني لشركتك لما تكبر.
            </div>
          </div>

          <button
            type="submit"
            className="w-full px-5 py-3 rounded-xl bg-brand-cyan-dark hover:bg-brand-cyan text-white font-bold font-cairo transition shadow-md"
          >
            حفظ الإعدادات
          </button>
        </form>
      </div>
    </main>
  );
}

function ToggleCard({
  name,
  defaultChecked,
  title,
  arabicSubtitle,
  explain,
}: {
  name: string;
  defaultChecked: boolean;
  title: string;
  arabicSubtitle: string;
  explain: string[];
}) {
  return (
    <div
      className={`rounded-2xl border-2 p-5 transition ${
        defaultChecked
          ? "bg-emerald-50/40 border-emerald-200"
          : "bg-white border-slate-200"
      }`}
    >
      <label className="flex items-start gap-4 cursor-pointer">
        <div className="pt-0.5 shrink-0">
          {/* Native checkbox -- styled large + clear */}
          <input
            type="checkbox"
            name={name}
            defaultChecked={defaultChecked}
            className="w-6 h-6 accent-brand-cyan-dark cursor-pointer"
          />
        </div>
        <div className="flex-1">
          <div className="font-bold text-slate-800 font-cairo text-base mb-1">
            {title}
          </div>
          <div className="text-xs text-slate-500 font-cairo mb-3">
            {arabicSubtitle}
          </div>
          <ul className="space-y-1.5 text-sm text-slate-700 font-cairo">
            {explain.map((line, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-slate-400 shrink-0">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </label>
    </div>
  );
}
