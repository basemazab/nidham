import Link from "next/link";
import { signup } from "../login/actions";
import { SubmitButton } from "@/components/submit-button";
import { POLICY_VERSION } from "../privacy/page";

// `plan` rides along when the user clicks a CTA on /pricing — we capture
// it here as a hidden input so the server action can save which tier the
// user intended (lets the dashboard show "you picked Pro" in the welcome
// flow). The signup action whitelists allowed values, so a forged query
// can't write arbitrary text into the company record.
type SearchParams = Promise<{ error?: string; plan?: string }>;

const PLAN_LABEL: Record<string, string> = {
  free: "مجاني (5 موظفين)",
  starter: "Starter (25 موظف · 500 ج/شهر)",
  pro: "Pro (100 موظف · 1,500 ج/شهر)",
  business: "Business (500 موظف · 3,500 ج/شهر)",
  enterprise: "Enterprise (تواصل لتسعير خاص)",
  // CRM-only plans — for customers who want CRM/Sales pipeline only,
  // not HR. The signup action detects these and applies feature
  // overrides that hide all HR/Payroll modules in the dashboard.
  crm: "CRM فقط — تجربة مجانية 14 يوم",
  "crm-starter": "CRM Starter (5 بائعين · 599 ج/شهر)",
  "crm-pro": "CRM Pro (15 بائع · 1,490 ج/شهر)",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, plan } = await searchParams;
  const planChoice = plan && PLAN_LABEL[plan] ? plan : "";

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30">
      <div className="max-w-md w-full">
        <Link href="/" className="flex flex-col items-center mb-8 group">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-navy shadow-lg shadow-cyan-500/20 mb-3 group-hover:scale-105 transition">
            <span className="text-3xl font-black text-white font-display">ن</span>
          </div>
          <h1 className="text-3xl font-black font-display bg-gradient-to-r from-brand-cyan-dark via-brand-cyan to-brand-navy bg-clip-text text-transparent">
            نِظام
          </h1>
        </Link>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          <h2 className="text-2xl font-bold text-slate-800 mb-2 font-cairo text-center">
            إنشاء حساب جديد
          </h2>
          <p className="text-sm text-slate-500 text-center mb-6">
            ابدأ تجربة نِظام لشركتك مجانًا
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
              ⚠ {decodeURIComponent(error)}
            </div>
          )}

          {/* If they arrived from /pricing with a plan in the query, show
              a confirmation chip so the choice doesn't feel forgotten
              between pages. The hidden input below carries it through to
              the server action. */}
          {planChoice && (
            <div className="mb-4 p-3 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-900 text-sm font-cairo flex items-center gap-2">
              <span>✓</span>
              <span>
                اخترت <strong>{PLAN_LABEL[planChoice]}</strong> — هتبدأ بـ trial
                مجاني، تقدر تأكد الباقة من dashboard في أي وقت.
              </span>
            </div>
          )}

          <form action={signup} className="space-y-4">
            {/* Carries the pricing-page plan choice into the signup action
                so the dashboard's welcome flow can pre-select it. */}
            {planChoice && <input type="hidden" name="plan" value={planChoice} />}
            <div>
              <label
                htmlFor="company_name"
                className="block text-sm font-medium text-slate-700 mb-2 font-cairo"
              >
                اسم الشركة
              </label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                required
                placeholder="مثلًا: مجموعة الاتحاد"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="full_name"
                className="block text-sm font-medium text-slate-700 mb-2 font-cairo"
              >
                اسمك
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                placeholder="مثلًا: باسم عزب"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-2 font-cairo"
              >
                الإيميل
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-2 font-cairo"
              >
                كلمة السر
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
              <ul className="mt-2 text-[11px] text-slate-500 font-cairo space-y-0.5 list-disc pr-5">
                <li>12 حرف على الأقل</li>
                <li>حرف كابيتال + حرف صغير (A-Z + a-z)</li>
                <li>رقم واحد على الأقل (0-9)</li>
                <li>رمز واحد على الأقل (مثل @ # ! % &amp;)</li>
              </ul>
            </div>

            {/* PDPL 151/2020 Article 12 — explicit, recorded consent. The
                checkbox is `required` so the form won't submit without it,
                and the server action re-validates (a curl with no consent
                gets rejected). consent_version is hidden so we record
                exactly which policy version the user agreed to. */}
            <input type="hidden" name="consent_version" value={POLICY_VERSION} />
            <label className="flex items-start gap-2 text-sm text-slate-700 font-cairo cursor-pointer">
              <input
                type="checkbox"
                name="consent"
                value="on"
                required
                className="mt-1 w-4 h-4 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan/40 cursor-pointer"
              />
              <span>
                أوافق على{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-brand-cyan-dark font-bold hover:underline"
                >
                  الشروط والأحكام
                </Link>
                {" "}و{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-brand-cyan-dark font-bold hover:underline"
                >
                  سياسة الخصوصية
                </Link>
                {" "}وعلى معالجة بيانات شركتي والموظفين وفقاً لقانون 151/2020.
              </span>
            </label>

            <SubmitButton
              loadingText="جاري إنشاء الحساب..."
              className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all font-cairo"
            >
              إنشاء حساب الشركة
            </SubmitButton>
          </form>

          <p className="text-center text-sm text-slate-600 mt-6">
            عندك حساب بالفعل؟{" "}
            <Link
              href="/login"
              className="text-brand-cyan-dark font-bold hover:underline"
            >
              تسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
