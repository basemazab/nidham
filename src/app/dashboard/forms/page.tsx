// ============================================================================
// /dashboard/forms — HR Forms Hub
// ============================================================================
//
// Single entry-point that lists all 8 printable HR templates. Each card
// links to the form's page. When the user reaches the form from an
// employee's profile (with ?employeeId= in the URL), the form pre-fills
// with that employee's data.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ employeeId?: string }>;

type FormCard = {
  href: string;
  title: string;
  description: string;
  icon: string;
  category:
    | "letter"
    | "contract"
    | "evaluation"
    | "application"
    | "internal"
    | "certificate"
    | "official";
};

const CATEGORIES: Record<
  FormCard["category"],
  { label: string; classes: string }
> = {
  letter: {
    label: "خطابات",
    classes: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  contract: {
    label: "عقود",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  evaluation: {
    label: "تقييم",
    classes: "bg-amber-50 text-amber-700 border-amber-200",
  },
  application: {
    label: "توظيف",
    classes: "bg-violet-50 text-violet-700 border-violet-200",
  },
  internal: {
    label: "داخلي",
    classes: "bg-rose-50 text-rose-700 border-rose-200",
  },
  certificate: {
    label: "شهادات",
    classes: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  official: {
    label: "تأمينات ومكتب عمل",
    classes: "bg-slate-100 text-slate-800 border-slate-300",
  },
};

const FORMS: FormCard[] = [
  {
    href: "/dashboard/forms/ai-generator",
    title: "المولّد الذكي للمستندات",
    description: "AI بيكتب عقود، إنذارات، مخالصات، شهادات خبرة وراتب بالعربية القانونية",
    icon: "🤖",
    category: "letter",
  },
  {
    href: "/dashboard/forms/hr-letter",
    title: "خطاب موارد بشرية",
    description: "خطاب رسمي بصفة الموظف ومرتبه — لكل الجهات (بنوك، سفارات، حكومي)",
    icon: "✉",
    category: "letter",
  },
  {
    href: "/dashboard/forms/offer-letter",
    title: "خطاب تعيين موظف",
    description: "عرض رسمي للالتحاق بالعمل — الراتب، فترة الاختبار، الموقع",
    icon: "🎯",
    category: "letter",
  },
  {
    href: "/dashboard/forms/employment-contract",
    title: "عقد عمل",
    description: "عقد قانوني كامل حسب قانون العمل المصري 12/2003 — مع كل البنود",
    icon: "📜",
    category: "contract",
  },
  {
    href: "/dashboard/forms/performance-evaluation",
    title: "نموذج تقييم أداء سنوي",
    description: "تقييم سنوي بنظام النقاط 1-5 على ٧ معايير + ملخص وتوصيات",
    icon: "📊",
    category: "evaluation",
  },
  {
    href: "/dashboard/forms/monthly-evaluation",
    title: "نموذج تقييم شهري",
    description: "متابعة شهرية سريعة على ٥ معايير + اقتراح مكافأة + توصية الشهر القادم",
    icon: "📈",
    category: "evaluation",
  },
  {
    href: "/dashboard/forms/promotion",
    title: "نموذج ترقية",
    description: "ترقية موظف لمنصب أعلى — مع تغيير الراتب والاعتمادات الرسمية",
    icon: "🏆",
    category: "evaluation",
  },
  {
    href: "/dashboard/forms/investigation-memo",
    title: "مذكرة تحقيق",
    description: "تحقيق رسمي مع موظف — سرد الواقعة + الأسئلة + الإقرار",
    icon: "⚖",
    category: "internal",
  },
  {
    href: "/dashboard/forms/job-application-admin",
    title: "طلب توظيف — وظائف إدارية",
    description: "للوظائف المكتبية: مؤهلات، خبرات سابقة، مهارات لغات وحاسب",
    icon: "💼",
    category: "application",
  },
  {
    href: "/dashboard/forms/job-application-trade",
    title: "طلب توظيف — وظائف حرفية",
    description: "للعمال والفنيين: الحرفة، الخبرة العملية، الحالة الصحية",
    icon: "🔧",
    category: "application",
  },
  // Employee certificates — added with mig-053 push. Distinct from the
  // hr-letter (general purpose) in formality + use case.
  {
    href: "/dashboard/forms/employment-certificate",
    title: "شهادة عمل",
    description: "للموظفين الحاليين — تأكيد إنه على رأس العمل بمنصبه",
    icon: "🆔",
    category: "certificate",
  },
  {
    href: "/dashboard/forms/experience-certificate",
    title: "شهادة خبرة",
    description: "للموظفين بعد ترك الخدمة — فترة العمل والمنصب الذي شغله",
    icon: "🎓",
    category: "certificate",
  },
  {
    href: "/dashboard/forms/salary-certificate",
    title: "شهادة راتب",
    description: "للبنوك والسفارات — تفصيل الراتب الشهري في جدول رسمي",
    icon: "💰",
    category: "certificate",
  },
  // Official NOSI forms — added after the audit's §7 gap analysis. Other
  // SaaS competitors expect HR to fill these by hand on the gov portal;
  // pre-filling them from the employee record cuts that down to a
  // copy/paste step.
  {
    href: "/dashboard/forms/nosi-form-1",
    title: "نموذج 1 تأمينات — تسجيل عامل",
    description: "تُسلم لمكتب التأمينات خلال 7 أيام من التحاق الموظف",
    icon: "🆕",
    category: "official",
  },
  {
    href: "/dashboard/forms/nosi-form-2",
    title: "نموذج 2 تأمينات — تعديل أجر",
    description: "عند الترقية أو زيادة المرتب — تُسلم خلال 14 يوم",
    icon: "📈",
    category: "official",
  },
  {
    href: "/dashboard/forms/nosi-form-6",
    title: "نموذج 6 تأمينات — ترك الخدمة",
    description: "إخطار بانتهاء عمل الموظف — تُسلم خلال 7 أيام من آخر يوم",
    icon: "👋",
    category: "official",
  },
];

export default async function FormsHubPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const employeeId = sp.employeeId?.trim() ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // If pre-fill mode, fetch the employee name for the banner
  let employeeName: string | null = null;
  if (employeeId && /^[0-9a-f-]{36}$/i.test(employeeId)) {
    const { data } = await supabase
      .from("employees")
      .select("full_name")
      .eq("id", employeeId)
      .maybeSingle<{ full_name: string }>();
    employeeName = data?.full_name ?? null;
  }

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-amber-50/20 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-amber-50 to-cyan-50 border border-amber-200 text-amber-700 text-xs font-bold mb-2 font-cairo">
            📋 النماذج الرسمية
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            نماذج الموارد البشرية
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
            ٩ نماذج رسمية احترافية — ٨ جاهزة للطباعة + المولّد الذكي اللي بيكتب
            المستندات بالذكاء الاصطناعي تلقائياً. اختار نموذج وحمّله PDF أو
            اطبعه مباشرة.
          </p>
        </header>

        {/* Pre-fill banner */}
        {employeeName && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-cyan-50 border-2 border-emerald-200 flex items-start gap-3">
            <span className="text-2xl">✦</span>
            <div className="flex-1">
              <div className="font-black font-cairo text-slate-800 mb-0.5">
                وضع التعبئة التلقائية
              </div>
              <p className="text-sm text-slate-600 font-cairo">
                النموذج اللي هتختاره هيتعبّى تلقائياً ببيانات{" "}
                <strong className="text-emerald-700">{employeeName}</strong>.
                الحقول الناقصة في ملف الموظف هتفضل فارغة عشان تكتبها بخط
                إيدك.
              </p>
            </div>
          </div>
        )}

        {/* Forms grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FORMS.map((f) => {
            const cat = CATEGORIES[f.category];
            const href = employeeId
              ? `${f.href}?employeeId=${employeeId}`
              : f.href;
            return (
              <Link
                key={f.href}
                href={href}
                className="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-amber-300 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-50 via-amber-100 to-amber-50 border border-amber-200 flex items-center justify-center text-2xl shrink-0">
                    {f.icon}
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-bold font-cairo ${cat.classes}`}
                  >
                    {cat.label}
                  </span>
                </div>
                <h3 className="text-base font-black font-cairo text-slate-800 mb-1 group-hover:text-amber-700 transition">
                  {f.title}
                </h3>
                <p className="text-[11px] text-slate-500 font-cairo leading-relaxed line-clamp-3">
                  {f.description}
                </p>
                <div className="mt-3 text-[11px] text-amber-700 font-bold font-cairo group-hover:text-amber-800">
                  افتح النموذج →
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick tips */}
        <div className="mt-8 grid md:grid-cols-3 gap-3">
          <Tip
            icon="📄"
            title="A4 جاهزة للطباعة"
            text="كل النماذج بمقاس A4 رسمي مع هوامش مظبوطة للطباعة المباشرة"
          />
          <Tip
            icon="✦"
            title="ترويسة تلقائية"
            text="اسم شركتك بيظهر فوق كل نموذج — تعديل اسم الشركة من Settings"
          />
          <Tip
            icon="🔄"
            title="تعبئة تلقائية"
            text="افتح ملف الموظف واضغط 'نماذج HR' — هتلاقي بياناته متعبّاية"
          />
        </div>
      </div>
    </main>
  );
}

function Tip({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-start gap-2.5">
        <span className="text-xl shrink-0">{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800 font-cairo">
            {title}
          </div>
          <div className="text-[11px] text-slate-500 font-cairo leading-relaxed mt-0.5">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}
