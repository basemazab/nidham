import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import {
  TrendingUp,
  Target,
  Users,
  Globe,
  BarChart3,
  Zap,
  Shield,
  Lightbulb,
  ArrowLeft,
  CheckCircle,
  LineChart,
  Building2,
} from "lucide-react";

export const metadata = {
  title: "الاستثمار في نِظام | Investors",
};

const METRICS = [
  { value: "$٢٨٠ب+", label: "سوق HR-Tech في MENA", sub: "بحلول ٢٠٣٠ (Grand View Research)" },
  { value: "٧٠٪", label: "الشركات المصرية بدون نظام HR", sub: "سوق غير مخترق — فرصة كبيرة" },
  { value: "٤٥م+", label: "قوة العمل في مصر", sub: "عدد الموظفين المستهدفين (CAPMAS)" },
  { value: "٣.٢م+", label: "شركة صغيرة ومتوسطة", sub: "السوق المستهدف في مصر فقط" },
];

const ADVANTAGES = [
  {
    icon: Shield,
    title: "First-Mover في السوق المصري",
    desc: "نظام HR سحابي متكامل مبني خصيصاً للسوق المصري بالعربي وبالامتثال القانوني المحلي. مفيش منافس عالمي عنده نفس المستوى من التوطين.",
  },
  {
    icon: Zap,
    title: "AI-native Architecture",
    desc: "النظام مبني من الصفر بـ AI integrations — مش إضافة سطحية. AI Agent بـ ١٥ أداة، تحليل احتفاظ، فرز سير ذاتية، وبوت WhatsApp.",
  },
  {
    icon: TrendingUp,
    title: "Recurring Revenue SaaS",
    desc: "نموذج اشتراك شهري بأسعار تنافسية. متوسط عمر العميل المتوقع ٢٤+ شهر مع نسبة احتفاظ عالية بفضل الـ switching costs.",
  },
  {
    icon: Globe,
    title: "MENA Expansion Ready",
    desc: "البنية التحتية بتدعم الإطلاق في أي سوق عربي — دعم RTL، تعدد العملات، والتوافق مع القوانين المحلية.",
  },
];

const ROADMAP = [
  { phase: "Q1-Q2 2026", title: "Product-Market Fit", items: ["٢٠٠+ موظف على المنصة", "عملاء دافعين", "تقييم ٤.٨/٥"] },
  { phase: "Q3-Q4 2026", title: "Seed / Pre-Seed", items: ["جمع تمويل أولي", "فريق أساسي", "التوسع في مصر"] },
  { phase: "Q1-Q2 2027", title: "Scale in Egypt", items: ["١٠٠٠+ موظف", "فريق ٢٠+ شخص", "دخول قطاع المؤسسات"] },
  { phase: "Q3-Q4 2027", title: "MENA Expansion", items: ["السعودية، الإمارات", "الامتثال المحلي", "شراكات استراتيجية"] },
  { phase: "٢٠٢٨+", title: "Series A", items: ["١٠,٠٠٠+ موظف", "٣ أسواق", "الربحية"] },
];

export default function InvestorsPage() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pb-20 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(8,145,178,0.12)_0%,transparent_70%)]" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-800 bg-cyan-950/50 px-4 py-1.5">
                <TrendingUp className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-medium text-cyan-300">
                  Investor Relations
                </span>
              </div>
              <h1 className="text-4xl font-black text-white sm:text-5xl md:text-6xl leading-tight">
                نظام تشغيل الموارد البشرية
                <br />
                <span className="bg-gradient-to-r from-cyan-300 to-cyan-500 bg-clip-text text-transparent">
                  لمصر والشرق الأوسط
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 leading-relaxed">
                نِظام هو أول HR-Tech Platform مصري متكامل بـ AI-native
                architecture — بيحل مشكلة حقيقية في سوق غير مخترق.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/investors#metrics"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-6 py-3 text-base font-bold text-white shadow-lg transition-all hover:from-cyan-600 hover:to-cyan-700 hover:shadow-xl"
                >
                  <BarChart3 className="h-5 w-5" />
                  استعرض المقاييس
                </Link>
                <Link
                  href="https://wa.me/201055356622"
                  target="_blank"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-3 text-base font-bold text-slate-200 backdrop-blur transition-all hover:bg-slate-800 hover:text-white"
                >
                  <Users className="h-5 w-5" />
                  تواصل مع المؤسس
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Market Opportunity */}
        <section className="border-y border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center" id="metrics">
              <Target className="mx-auto h-10 w-10 text-cyan-500" />
              <h2 className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
                فرصة السوق
              </h2>
              <p className="mt-2 text-slate-500">
                سوق HR-Tech في الشرق الأوسط وشمال أفريقيا لسه في بدايته —
                وفيه فرصة ذهبية لأول لاعب محلي يقدم منتج متكامل.
              </p>
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {METRICS.map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="text-3xl font-black text-cyan-600 dark:text-cyan-400">
                    {m.value}
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                    {m.label}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{m.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Competitive Advantages */}
        <section className="bg-slate-50 py-20 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <Lightbulb className="mx-auto h-10 w-10 text-cyan-500" />
              <h2 className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
                الميزة التنافسية
              </h2>
              <p className="mt-2 text-slate-500">
                إيه اللي يخلّي نِظام مختلف عن أي حل تاني في السوق؟
              </p>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {ADVANTAGES.map((a) => (
                <div
                  key={a.title}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-cyan-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-800"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-400">
                    <a.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    {a.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                    {a.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="bg-white py-20 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <Users className="mx-auto h-10 w-10 text-cyan-500" />
              <h2 className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
                الفريق
              </h2>
              <p className="mt-2 text-slate-500">
                مؤسس واحد بنى المنتج بالكامل — وأثبت Product-Market Fit.
              </p>
            </div>
            <div className="mt-10">
              <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-950">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 text-3xl font-black text-white shadow-lg">
                  ب
                </div>
                <h3 className="mt-4 text-xl font-black text-slate-900 dark:text-white">
                  باسم عزاب
                </h3>
                <div className="text-sm text-cyan-600 dark:text-cyan-400">
                  Founder & Solo Builder
                </div>
                <p className="mt-4 text-sm text-slate-500 leading-relaxed">
                  مدير موارد بشرية سابق في شركات مصرية كبرى. بقاله ٨ سنين
                  في المجال — شغل بنفسه على ERP محلي وخبرة عملية في تطبيق
                  قانون العمل والتأمينات. بنى نِظام بالكامل من الصفر.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {["HR Manager", "ERP Implementation", "Egypt Labor Law", "Full-Stack Developer"].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mx-auto mt-6 max-w-xl text-center">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                💡 فريق استثماري: نِظام بيبحث عن CTO شريك و Seed Investment
                عشان يوسع الفريق ويسرع النمو.
              </p>
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section className="bg-slate-50 py-20 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <LineChart className="mx-auto h-10 w-10 text-cyan-500" />
              <h2 className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
                خريطة الطريق
              </h2>
              <p className="mt-2 text-slate-500">
                من الـ MVP لدخول ٣ أسواق — خطة ٣ سنين.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-5">
              {ROADMAP.map((r, i) => (
                <div
                  key={r.phase}
                  className="relative rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"
                >
                  {i < ROADMAP.length - 1 && (
                    <div className="absolute -left-2 top-1/2 hidden h-0.5 w-4 bg-cyan-300 md:block" />
                  )}
                  <div className="mb-2 inline-block rounded-full bg-cyan-100 px-2.5 py-0.5 text-[10px] font-bold text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300">
                    {r.phase}
                  </div>
                  <div className="mb-2 font-bold text-slate-900 dark:text-white">
                    {r.title}
                  </div>
                  <ul className="space-y-1">
                    {r.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-1.5 text-xs text-slate-500"
                      >
                        <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Investment Thesis */}
        <section className="bg-white py-20 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <Building2 className="h-10 w-10 text-cyan-500" />
                <h2 className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
                  لماذا نِظام الآن؟
                </h2>
                <div className="mt-6 space-y-4">
                  {[
                    { title: "السوق جاهز", desc: "٧٠٪ من الشركات المصرية لسه بتستخدم Excel في HR — التحول الرقمي إجباري حسب رؤية ٢٠٣٠." },
                    { title: "المنتج شغال", desc: "منتج كامل بـ ١٥٠+ ميزة، بدخل حقيقي من عملاء دافعين، ومعدل احتفاظ مرتفع." },
                    { title: "AI هو الفارق", desc: "AI-native مش surface-level. الـ AI Agent بينفذ مهام حقيقية — مش مجرد شات بوت." },
                    { title: "مصر بوابك للمنطقة", desc: "الامتثال القانوني مع قوانين العمل والتأمينات المصرية يخلّي التوسع للسعودية والإمارات أسهل." },
                  ].map((t) => (
                    <div key={t.title} className="flex items-start gap-3">
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {t.title}
                        </div>
                        <div className="text-sm text-slate-500">{t.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  نموذج العوائد (Unit Economics)
                </h3>
                <div className="mt-6 space-y-4">
                  {[
                    { label: "متوسط الإيراد لكل عميل (ARPU)", value: "~١,٥٠٠ ج/شهر" },
                    { label: "تكلفة اكتساب العميل (CAC)", value: "~٣,٠٠٠ ج (عضوي)" },
                    { label: "القيمة العمرية للعميل (LTV)", value: "~٣٦,٠٠٠ ج (٢٤ شهر)" },
                    { label: "نسبة LTV/CAC", value: "~١٢x" },
                  ].map((u) => (
                    <div
                      key={u.label}
                      className="flex items-center justify-between border-b border-slate-200 pb-3 last:border-0 dark:border-slate-700"
                    >
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {u.label}
                      </span>
                      <span className="font-black text-cyan-600 dark:text-cyan-400">
                        {u.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 py-20">
          <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6">
            <TrendingUp className="mx-auto h-12 w-12 text-cyan-400" />
            <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">
              عايز تسمع أكتر؟
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
              المؤسس متاح لمناقشة الشراكة أو الاستثمار. كلمه مباشرة على
              واتساب أو ابعت إيميل.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="https://wa.me/201055356622"
                target="_blank"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-8 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:from-cyan-600 hover:to-cyan-700 hover:shadow-xl"
              >
                <Users className="h-5 w-5" />
                كلم المؤسس
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-8 py-3.5 text-base font-bold text-slate-200 backdrop-blur transition-all hover:bg-slate-800 hover:text-white"
              >
                جرب المنصة بنفسك
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
