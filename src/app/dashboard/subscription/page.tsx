import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Subscription = {
  plan: "trial" | "basic" | "pro" | "enterprise";
  status: "trial" | "active" | "past_due" | "cancelled" | "expired";
  starts_at: string;
  ends_at: string;
  monthly_value: number | null;
};

const PLANS = [
  {
    id: "basic" as const,
    name: "Basic",
    monthlyPrice: 1500,
    employees: 25,
    description: "للشركات الصغيرة",
    features: [
      "HR موديول كامل",
      "CRM موديول كامل",
      "Bridge Analytics",
      "تقارير شهرية",
      "Excel Export",
      "حتى 25 موظف",
    ],
    color: "slate",
  },
  {
    id: "pro" as const,
    name: "Pro",
    monthlyPrice: 3500,
    employees: 75,
    description: "للشركات المتنامية",
    features: [
      "كل مميزات Basic",
      "حتى 75 موظف",
      "تقارير يومية تلقائية",
      "Customer Flight Risk",
      "تكامل واتساب",
      "Account Manager",
    ],
    color: "cyan",
    popular: true,
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    monthlyPrice: 7500,
    employees: 999,
    description: "للمصانع والمجموعات",
    features: [
      "كل مميزات Pro",
      "موظفين بدون حد أقصى",
      "تكامل ZKTeco",
      "Self-Hosted (سيرفر داخلي)",
      "تدريب On-site",
      "Dedicated Manager",
    ],
    color: "amber",
  },
];

const STATUS_LABELS: Record<Subscription["status"], { text: string; classes: string }> = {
  trial: { text: "تجريبية", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  active: { text: "نشطة", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  past_due: { text: "متأخرة الدفع", classes: "bg-red-50 text-red-700 border-red-200" },
  cancelled: { text: "ملغية", classes: "bg-slate-100 text-slate-600 border-slate-200" },
  expired: { text: "منتهية", classes: "bg-red-50 text-red-700 border-red-200" },
};

const PLAN_LABELS: Record<Subscription["plan"], string> = {
  trial: "تجريبية مجانية",
  basic: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
};

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // For non-super-admin users the view_own_subscription RLS policy
  // returns at most one row. But super_admin gets the bypass policy
  // from migration 008 and sees every tenant's subscription -- in
  // which case .single() blows up. Resolve the caller's company
  // explicitly and filter so this page is always tenant-scoped.
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single<{ company_id: string }>();

  if (!profile) {
    return (
      <main className="p-8 text-center font-cairo">
        <p>محصلش لاقي حساب. سجّل دخول تاني.</p>
      </main>
    );
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status, starts_at, ends_at, monthly_value")
    .eq("company_id", profile.company_id)
    .maybeSingle<Subscription>();

  if (!subscription) {
    // shouldn't happen — trigger auto-creates — but handle gracefully
    return (
      <main className="p-8 text-center">
        <p>محصلش لاقي اشتراك. كلمنا على واتساب.</p>
      </main>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(subscription.ends_at + "T00:00:00");
  const daysLeft = daysBetween(today, endDate);

  const isTrial = subscription.status === "trial";
  const isExpired = daysLeft < 0;
  const isUrgent = daysLeft <= 7 && daysLeft >= 0;
  const statusBadge = STATUS_LABELS[subscription.status];

  const whatsappMessage = encodeURIComponent(
    `السلام عليكم، أنا [اسمك] من شركة [اسم الشركة].
حابب أعرف تفاصيل تجديد/ترقية اشتراكي في نِظام.
الخطة الحالية: ${PLAN_LABELS[subscription.plan]}
ينتهي: ${subscription.ends_at}`,
  );
  const whatsappLink = `https://wa.me/201055356622?text=${whatsappMessage}`;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            خطتك واشتراكك
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            بياناتك عن الاشتراك الحالي والخطط المتاحة
          </p>
        </header>

        {/* Current subscription card */}
        <div
          className={`rounded-2xl border-2 p-6 mb-8 ${
            isExpired
              ? "bg-red-50 border-red-300"
              : isUrgent
              ? "bg-amber-50 border-amber-300"
              : isTrial
              ? "bg-gradient-to-br from-amber-50 via-cyan-50 to-white border-amber-200"
              : "bg-gradient-to-br from-emerald-50 to-white border-emerald-200"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${statusBadge.classes} font-cairo`}>
                  {statusBadge.text}
                </span>
                {isUrgent && !isExpired && (
                  <span className="text-xs text-amber-700 font-bold font-cairo">
                    ⚠ ينتهي قريب
                  </span>
                )}
                {isExpired && (
                  <span className="text-xs text-red-700 font-bold font-cairo">
                    ⛔ انتهى
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black font-cairo text-slate-800 mb-1">
                خطة {PLAN_LABELS[subscription.plan]}
              </h2>
              <p className="text-sm text-slate-600 font-cairo">
                من {subscription.starts_at} إلى {subscription.ends_at}
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-500 mb-1 font-cairo">
                {isExpired ? "انتهى من" : "متبقي"}
              </div>
              <div
                className={`text-4xl font-black font-display ${
                  isExpired
                    ? "text-red-700"
                    : isUrgent
                    ? "text-amber-700"
                    : "text-emerald-700"
                }`}
              >
                {Math.abs(daysLeft)}
              </div>
              <div className="text-xs text-slate-500 font-cairo">يوم</div>
            </div>
          </div>

          {(isTrial || isUrgent || isExpired) && (
            <div className="mt-6 pt-6 border-t border-slate-200/60">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold font-cairo transition shadow-md"
              >
                <span>💬</span>
                <span>{isTrial ? "حوّل لخطة مدفوعة" : isExpired ? "جدّد الاشتراك" : "جدّد قبل الانتهاء"}</span>
              </a>
              <p className="text-xs text-slate-500 mt-2 font-cairo">
                {isTrial
                  ? "تجربتك المجانية هتنتهي. حوّل لخطة مدفوعة عشان تحافظ على بياناتك."
                  : "كلمنا على واتساب لإتمام الدفع وتفعيل الاشتراك."}
              </p>
            </div>
          )}
        </div>

        {/* Plans grid */}
        <section>
          <h2 className="text-xl font-black font-cairo text-slate-800 mb-1">
            الخطط المتاحة
          </h2>
          <p className="text-sm text-slate-500 mb-6 font-cairo">
            اختار اللي يناسب حجم شركتك. كل الخطط ممكن تترقّى أو تنزّل في أي وقت.
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            {PLANS.map((plan) => {
              const isCurrentPlan = subscription.plan === plan.id;
              const ring = plan.popular
                ? "border-2 border-brand-cyan ring-4 ring-brand-cyan/20"
                : "border border-slate-200";

              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-2xl p-6 ${ring} relative ${
                    isCurrentPlan ? "opacity-100" : ""
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-brand-cyan text-white text-[10px] font-bold tracking-wider">
                      الأكثر شيوعًا
                    </div>
                  )}
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold tracking-wider">
                      خطتك الحالية ✓
                    </div>
                  )}

                  <h3 className="text-xl font-black font-cairo text-slate-800 mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4 font-cairo">
                    {plan.description}
                  </p>

                  <div className="mb-4">
                    <span className="text-4xl font-black text-slate-800 font-display">
                      {plan.monthlyPrice.toLocaleString("ar-EG")}
                    </span>
                    <span className="text-sm text-slate-500 font-cairo"> ج / شهر</span>
                  </div>

                  <ul className="space-y-2 mb-5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700 font-cairo">
                        <span className="text-emerald-500 font-bold">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrentPlan ? (
                    <div className="w-full py-2.5 text-center text-sm font-bold text-emerald-700 bg-emerald-50 rounded-lg font-cairo">
                      ✓ خطتك الحالية
                    </div>
                  ) : (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener"
                      className={`block w-full py-2.5 text-center text-sm font-bold rounded-lg transition font-cairo ${
                        plan.popular
                          ? "bg-brand-cyan-dark hover:bg-brand-cyan text-white"
                          : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      اطلب الترقية
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <p className="text-center text-xs text-slate-400 mt-8 font-cairo">
          الدفع حاليًا بنك ترانسفر أو فودافون كاش — كلمنا على واتساب
          <a href="https://wa.me/201055356622" target="_blank" rel="noopener" className="text-brand-cyan-dark hover:underline mr-1">
            01055356622
          </a>
        </p>
      </div>
    </main>
  );
}
