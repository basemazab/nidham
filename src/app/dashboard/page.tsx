import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RetentionBanner } from "@/components/retention-banner";
import { SmartInsights } from "@/components/smart-insights";
import { PWAInstallButton } from "@/components/pwa-install-button";

type Profile = {
  full_name: string | null;
  role: string;
  companies: {
    name: string;
    industry: string | null;
  } | null;
};

// Force the page to revalidate on every request. Without this, Next.js
// caches the row list + counters between requests, so newly-added rows
// from server actions or import flows take minutes to appear.
export const dynamic = "force-dynamic";

// `?welcome=1&plan=<tier>` is set by the signup server action so the
// first-ever visit lands on a friendlier "you're in" screen instead of
// the bare dashboard. Both params are sticky for one render only — the
// banner has a dismiss button (or just navigate anywhere else and the
// query drops off).
type DashboardSearchParams = Promise<{ welcome?: string; plan?: string }>;

const PLAN_LABEL_AR: Record<string, string> = {
  free: "Free (5 موظفين)",
  starter: "Starter (25 موظف)",
  pro: "Pro (100 موظف)",
  business: "Business (500 موظف)",
  enterprise: "Enterprise",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const { welcome, plan } = await searchParams;
  const isFirstVisit = welcome === "1";
  const intendedPlan = plan && PLAN_LABEL_AR[plan] ? plan : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the profile first so we can scope every count to the caller's
  // company. The other counts can't be safely parallelised with the
  // profile fetch because super-admin sessions would otherwise count
  // rows across every tenant (mig 038-style policies).
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, company_id, companies(name, industry)")
    .eq("id", user.id)
    .single<Profile & { company_id: string }>();

  const callerCompanyId = profile?.company_id ?? "";

  const [employeesCount, customersCount, interactionsCount] = await Promise.all([
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("company_id", callerCompanyId),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", callerCompanyId),
    supabase
      .from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("company_id", callerCompanyId),
  ]);

  const empCount = employeesCount.count ?? 0;
  const custCount = customersCount.count ?? 0;
  const intCount = interactionsCount.count ?? 0;

  // Subscription scoped to caller's company_id so super_admin sees
  // their OWN subscription, not the union of every tenant's row.
  const { data: subscription } = profile?.company_id
    ? await supabase
        .from("subscriptions")
        .select("plan, status, ends_at")
        .eq("company_id", profile.company_id)
        .maybeSingle<{ plan: string; status: string; ends_at: string }>()
    : { data: null };
  const subDaysLeft = subscription
    ? Math.round(
        (new Date(subscription.ends_at + "T00:00:00").getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;
  const subPlanLabel: Record<string, string> = {
    trial: "تجريبية",
    basic: "Basic",
    pro: "Pro",
    enterprise: "Enterprise",
  };

  const displayName = profile?.full_name ?? user.email?.split("@")[0] ?? "مستخدم";
  const companyName = profile?.companies?.name ?? "—";
  const roleLabel: Record<string, string> = {
    admin: "مدير",
    manager: "مشرف",
    employee: "موظف",
  };

  // Onboarding: HR is the core product; customers + interactions are CRM
  // bonus features the HR-only ICP (Egyptian SMB) will never touch. Gating
  // wizard completion on customers/interactions left the amber wizard
  // stuck on screen forever for the target customer. Now the wizard is
  // considered DONE once the company has at least one employee — the CRM
  // steps stay visible as optional next steps but no longer block "done".
  const onboardingDone = empCount > 0;
  const completedSteps =
    (empCount > 0 ? 1 : 0) +
    (custCount > 0 ? 1 : 0) +
    (intCount > 0 ? 1 : 0);

  const isEnterprise = subscription?.plan === "enterprise";

  return (
    <main className={`flex-1 px-6 py-8 min-h-screen ${
      isEnterprise
        ? "bg-gradient-to-b from-amber-50/40 via-white to-amber-50/20"
        : "bg-gradient-to-b from-slate-50 via-white to-cyan-50/30"
    }`}>
      <div className="max-w-6xl mx-auto">
        {/* Enterprise premium banner -- only shown to enterprise tier
            customers so they immediately feel the upgrade value. */}
        {isEnterprise && (
          <div className="bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100 border-2 border-amber-300 rounded-2xl p-5 mb-6 flex items-center gap-4 shadow-lg shadow-amber-500/10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-md">
              <span className="text-2xl">👑</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] tracking-[0.3em] text-amber-700 font-bold uppercase font-cairo mb-0.5">
                Enterprise Account
              </div>
              <div className="text-lg font-black text-amber-900 font-cairo">
                مرحبًا بك في الباقة المميزة ✨
              </div>
              <div className="text-xs text-amber-800 font-cairo mt-0.5">
                كل الميزات مفتوحة · دعم متميز · Bridge Analytics · سجل النشاط
              </div>
            </div>
            <Link
              href="/dashboard/subscription"
              className="text-xs text-amber-800 hover:text-amber-900 hover:underline font-bold font-cairo whitespace-nowrap"
            >
              عرض التفاصيل ↗
            </Link>
          </div>
        )}

        {/* First-visit welcome banner — fires on ?welcome=1 set by the
            signup server action. Stays sticky until the user clicks
            anywhere off the dashboard (the query drops on navigation). */}
        {isFirstVisit && (
          <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-cyan-600 text-white rounded-3xl p-8 mb-6 shadow-2xl shadow-emerald-500/20 relative overflow-hidden">
            {/* Decorative orbs for visual interest */}
            <div
              className="absolute rounded-full bg-amber-400/20 blur-3xl"
              style={{ width: "300px", height: "300px", top: "-100px", right: "-100px" }}
            />
            <div
              className="absolute rounded-full bg-white/10 blur-3xl"
              style={{ width: "200px", height: "200px", bottom: "-50px", left: "-50px" }}
            />

            <div className="relative">
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-3xl md:text-4xl font-black font-cairo mb-2">
                أهلاً بيك في Nidham يا {profile?.full_name?.split(" ")[0] ?? "صديقي"}!
              </h2>
              <p className="text-emerald-50 font-cairo text-lg mb-5">
                حسابك جاهز.{" "}
                {intendedPlan ? (
                  <>
                    اخترت <strong>{PLAN_LABEL_AR[intendedPlan]}</strong> — بدأت بـ trial
                    مجاني 14 يوم.{" "}
                  </>
                ) : (
                  <>بدأت بـ trial مجاني 14 يوم. </>
                )}
                خلّيني أرشدك في أول خطوة 👇
              </p>

              <div className="grid md:grid-cols-3 gap-3 mb-5">
                <FirstStepCard
                  num="1"
                  emoji="👥"
                  title="ضيف أول موظف"
                  href="/dashboard/employees/new"
                />
                <FirstStepCard
                  num="2"
                  emoji="📱"
                  title="ابعت دعوة للموبايل"
                  href="/dashboard/employees"
                />
                <FirstStepCard
                  num="3"
                  emoji="💰"
                  title="جرّب دورة مرتبات"
                  href="/dashboard/payroll"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Link
                  href="/help"
                  className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 font-bold font-cairo transition"
                >
                  📚 مركز المساعدة
                </Link>
                <a
                  href="https://wa.me/201055356622?text=أهلاً، عملت حساب جديد على Nidham وعايز مساعدة"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 font-bold font-cairo transition"
                >
                  💬 كلّم باسم على واتساب
                </a>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-xl bg-white text-emerald-700 hover:bg-emerald-50 font-bold font-cairo transition mr-auto"
                >
                  ابدأ بنفسي ←
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Welcome card */}
        <div className={`bg-white p-8 rounded-2xl shadow-xl mb-6 ${
          isEnterprise
            ? "border-2 border-amber-200"
            : "border border-slate-100"
        }`}>
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
              {/* Install-as-app CTA — only renders on installable browsers
                  when the app isn't already a standalone window. */}
              <div className="mt-3">
                <PWAInstallButton />
              </div>
            </div>

            {/* Subscription badge */}
            {subscription && (
              <Link
                href="/dashboard/subscription"
                className={`flex flex-col items-center justify-center px-4 py-3 rounded-xl border-2 transition hover:-translate-y-0.5 ${
                  subscription.status === "trial"
                    ? subDaysLeft <= 3
                      ? "bg-red-50 border-red-300 hover:border-red-500"
                      : "bg-amber-50 border-amber-300 hover:border-amber-500"
                    : "bg-emerald-50 border-emerald-200 hover:border-emerald-400"
                }`}
              >
                <div className="text-[10px] text-slate-500 tracking-wider font-cairo">
                  💎 خطتك
                </div>
                <div className="text-lg font-black text-slate-800 font-cairo">
                  {subPlanLabel[subscription.plan] ?? subscription.plan}
                </div>
                <div
                  className={`text-xs font-bold font-cairo ${
                    subscription.status === "trial"
                      ? subDaysLeft <= 3
                        ? "text-red-600"
                        : "text-amber-700"
                      : "text-emerald-700"
                  }`}
                >
                  {subDaysLeft >= 0
                    ? `${subDaysLeft} يوم متبقي`
                    : `انتهت من ${Math.abs(subDaysLeft)} يوم`}
                </div>
              </Link>
            )}
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

        {/* Retention banner — only renders if there are pending insights
            AND the subscription unlocks retention_insights. Otherwise null. */}
        <RetentionBanner />

        {/* Smart Insights — surfaces 6 categories of actionable HR signals
            (tardiness offenders, contracts expiring, pending leaves, new
            hires onboarding, today's unmarked attendance, work
            anniversaries). Renders nothing if no data is actionable. */}
        <SmartInsights companyId={callerCompanyId} />

        {/* ─────────────────────────────────────────────────────────────
            Modules — grouped by job-to-be-done.
            Six categories matching the sidebar IA. Each group is a
            small grid of compact cards so the user scans visually
            instead of reading a wall of 30+ tiles.
            ───────────────────────────────────────────────────────────── */}

        <ModuleGroup
          title="👥 الفريق"
          subtitle="إدارة الموظفين والأداء"
          modules={[
            { href: "/dashboard/employees", emoji: "👥", title: "الموظفين", desc: "ضيف، عدّل، استورد" },
            { href: "/dashboard/org-chart", emoji: "🌳", title: "الهيكل التنظيمي", desc: "خريطة المناصب" },
            { href: "/dashboard/performance", emoji: "📈", title: "تقييم الأداء", desc: "KPIs + مراجعات" },
            { href: "/dashboard/assets", emoji: "📦", title: "الأصول والعهد", desc: "اللاب توب + الموبايل" },
            { href: "/dashboard/celebrations", emoji: "🎉", title: "الاحتفالات", desc: "ذكريات + أعياد ميلاد" },
          ]}
        />

        <ModuleGroup
          title="⏰ الوقت والحضور"
          subtitle="الحضور، الورديات، الإجازات"
          modules={[
            { href: "/dashboard/attendance", emoji: "⏰", title: "تسجيل الحضور", desc: "يومي + دخول/خروج" },
            { href: "/dashboard/shifts", emoji: "🕒", title: "الورديات", desc: "جدول أسبوعي للطباعة" },
            { href: "/dashboard/team-calendar", emoji: "📅", title: "تقويم الإجازات", desc: "مين في إجازة الأسبوع ده" },
            { href: "/dashboard/requests", emoji: "📨", title: "طلبات الموظفين", desc: "إجازة + سلفة + استئذان" },
          ]}
        />

        <ModuleGroup
          title="💰 المرتبات"
          subtitle="الرواتب والاستحقاقات"
          modules={[
            { href: "/dashboard/payroll", emoji: "💰", title: "الرواتب", desc: "دورات + كشف صرف" },
            { href: "/dashboard/loans", emoji: "💵", title: "السلف والمرتجعات", desc: "خصم تلقائي شهري" },
            { href: "/dashboard/eos-calculator", emoji: "⚖", title: "نهاية الخدمة", desc: "حاسبة قانون 12/2003" },
          ]}
        />

        <ModuleGroup
          title="💼 العملاء والمبيعات"
          subtitle="CRM + Pipeline + عقود"
          modules={[
            { href: "/dashboard/customers", emoji: "💼", title: "العملاء", desc: "Pipeline + متابعة" },
            { href: "/dashboard/interactions", emoji: "💬", title: "التفاعلات", desc: "قلب Bridge", highlight: "amber" },
            { href: "/dashboard/contracts", emoji: "📋", title: "العقود", desc: "تنبيه قبل التجديد" },
          ]}
        />

        <ModuleGroup
          title="📄 المستندات والامتثال"
          subtitle="نماذج رسمية + توقيع + لوائح"
          modules={[
            { href: "/dashboard/forms", emoji: "📄", title: "النماذج", desc: "٩ نماذج تأمينات + ضرايب" },
            { href: "/dashboard/signatures", emoji: "✍", title: "التوقيع الإلكتروني", desc: "بإصبع الموظف على الموبايل" },
            { href: "/dashboard/compliance", emoji: "🏛", title: "دليل الامتثال", desc: "٧ جهات تفتيش" },
          ]}
        />

        <ModuleGroup
          title="🤖 ذكاء + تسويق"
          subtitle="AI + Recruitment + Marketing Studio"
          modules={[
            { href: "/dashboard/ai", emoji: "🤖", title: "المساعد الذكي", desc: "١٥ أداة + شات بالعربي", highlight: "amber" },
            { href: "/dashboard/jobs", emoji: "🎯", title: "التوظيف الذكي", desc: "ATS + فحص CV بالـ AI" },
            { href: "/dashboard/retention", emoji: "🛡", title: "احتفاظ بالموظفين", desc: "زيادات + إنذارات" },
            { href: "/dashboard/marketing", emoji: "✦", title: "Marketing Studio", desc: "👑 Enterprise", highlight: "gold" },
          ]}
        />

        <ModuleGroup
          title="📊 التقارير والتحليلات"
          subtitle="لوحات أرقام + تحليل عميق"
          modules={[
            { href: "/dashboard/analytics", emoji: "📊", title: "لوحة التحليلات", desc: "٧ رسوم بيانية" },
            { href: "/dashboard/reports/attendance", emoji: "📋", title: "تقرير الحضور", desc: "شهري + Top Performer" },
            { href: "/dashboard/reports/bridge", emoji: "✦", title: "Bridge Analytics", desc: "ربط إداري × إنتاجية", highlight: "gold" },
          ]}
        />

        {/* Status note */}
        <div className="mt-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 font-cairo text-center">
          ✓ النظام كامل: HR + CRM + Bridge + AI + PWA + WhatsApp bot. ده اللي مفيش نظام تاني في السوق المصري بيعمله.
        </div>
      </div>
    </main>
  );
}

// First-visit welcome banner step card. Rendered inside the green hero
// shown on ?welcome=1. Kept tiny + self-contained so we don't pull a
// shared component file in for a one-off.
function FirstStepCard({
  num,
  emoji,
  title,
  href,
}: {
  num: string;
  emoji: string;
  title: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block p-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 transition group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black text-lg">
          {num}
        </div>
        <div className="flex-1">
          <div className="text-2xl mb-0.5">{emoji}</div>
          <div className="font-bold font-cairo text-sm">{title}</div>
        </div>
        <div className="text-xl opacity-70 group-hover:translate-x-1 transition">
          ←
        </div>
      </div>
    </Link>
  );
}

// ----------------------------------------------------------------------------
// ModuleGroup + ModuleCard — compact tile renderer used in the modules grid.
//
// Each group renders one section header + a 2/3/4-column grid of cards.
// The card is intentionally small (single-line title, one-line desc) so
// the user can scan 30+ modules across 7 groups without scrolling for
// 5 screens. The previous 6xl-padding cards looked great with 9 items
// but became overwhelming once the count tripled.
//
// highlight props paint the card with a brand-tinted background for
// modules that need extra pull (Marketing Studio premium, Bridge premium,
// Interactions = heart of Bridge analytics).
// ----------------------------------------------------------------------------

type ModuleCardProps = {
  href: string;
  emoji: string;
  title: string;
  desc?: string;
  highlight?: "amber" | "gold" | "default";
};

function ModuleGroup({
  title,
  subtitle,
  modules,
}: {
  title: string;
  subtitle?: string;
  modules: ModuleCardProps[];
}) {
  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-700 font-cairo">{title}</h2>
        {subtitle && (
          <p className="text-[10px] text-slate-400 font-cairo">{subtitle}</p>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {modules.map((m) => (
          <ModuleCard key={m.href} {...m} />
        ))}
      </div>
    </section>
  );
}

function ModuleCard({
  href,
  emoji,
  title,
  desc,
  highlight = "default",
}: ModuleCardProps) {
  // Tone palettes — keep these tight so the card stays readable
  const palettes: Record<NonNullable<ModuleCardProps["highlight"]>, string> = {
    default:
      "bg-white border-slate-100 hover:border-brand-cyan/40",
    amber:
      "bg-gradient-to-br from-amber-50 to-cyan-50 border-2 border-amber-200 hover:border-amber-400",
    gold:
      "bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100 border-2 border-amber-400 hover:border-amber-500",
  };
  return (
    <Link
      href={href}
      className={`block p-4 rounded-xl border transition hover:shadow-md hover:-translate-y-0.5 ${palettes[highlight]}`}
    >
      <div className="text-2xl mb-1">{emoji}</div>
      <h3 className="font-bold font-cairo text-sm text-slate-800 mb-0.5 leading-tight">
        {title}
      </h3>
      {desc && (
        <p
          className={`text-[10px] leading-snug ${
            highlight === "default" ? "text-slate-500" : "text-amber-800 font-bold"
          }`}
        >
          {desc}
        </p>
      )}
    </Link>
  );
}
