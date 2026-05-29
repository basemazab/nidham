import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import {
  Shield,
  Building2,
  Users,
  Lock,
  Glasses,
  Network,
  Headphones,
  CheckCircle,
  ArrowLeft,
  Star,
} from "lucide-react";

export const metadata = {
  title: "حلول المؤسسات | Enterprise",
};

const FEATURES = [
  {
    icon: Shield,
    title: "أمان من الدرجة المؤسسية",
    desc: "RBAC متقدم، تشفير PII، سجل تدقيق immutable، وفصل كامل للبيانات بين العملاء.",
  },
  {
    icon: Building2,
    title: "Multi-Tenant حقيقي",
    desc: "كل شركة في Tenant منفصل بقاعدة بيانات معزولة. عزل كامل للبيانات مع RLS على كل query.",
  },
  {
    icon: Users,
    title: "غير محدود الموظفين",
    desc: "مافيش حد أقصى لعدد الموظفين. الخطط المخصصة بتدعم آلاف الموظفين بدون مشاكل أداء.",
  },
  {
    icon: Network,
    title: "سلسلة موافقات ورقابة",
    desc: "Workflow approvals متكاملة — موافقات المرتبات، الإجازات، السلف، وطلبات التوظيف.",
  },
  {
    icon: Lock,
    title: "SSO و SAML",
    desc: "ربط بحساب Microsoft Entra ID أو Google Workspace أو أي IdP يدعم SAML 2.0.",
  },
  {
    icon: Glasses,
    title: "Audit Log الكتروني",
    desc: "Hash-chain audit log لكل عملية — متوافق مع متطلبات المراجعة القانونية والضريبية.",
  },
  {
    icon: Headphones,
    title: "دعم مخصص 24/7",
    desc: "مدير حساب مخصص + فريق دعم فني على WhatsApp — استجابة أقل من 30 دقيقة.",
  },
  {
    icon: Star,
    title: "SLA 99.9%",
    desc: "اتفاقية مستوى خدمة مع تعويضات — نضمن تشغيل النظام بشكل متواصل.",
  },
];

const CASE_STUDIES = [
  {
    name: "الاتحاد للإنشاءات المعدنية",
    industry: "إنشاءات وتصنيع معدني",
    employees: "٢٠٠+",
    challenge: "تشتت بيانات الموظفين والمرتبات على Excel + نظام حضور قديم",
    result: "دمج كل حاجة في منصة واحدة — حضور GPS، مرتبات آلية، تقارير لحظية",
    quote: "نِظام خلانا نقفل المرتبات في يوم واحد بدل ٥ أيام",
    person: "أحمد السيد",
    role: "مدير الموارد البشرية",
  },
  {
    name: "مجموعة المصرية الألمانية WPC",
    industry: "صناعة ألواح WPC",
    employees: "١٥٠+",
    challenge: "تعقيد حسابات المرتبات بسبب البدلات المتعددة والورديات",
    result: "حسبة المرتبات مع البدلات والخصومات والغياب — كلها أوتوماتيك",
    quote: "الـ AI Assistant وفر علينا ٣ أيام شغل كل شهر",
    person: "محمد عبد الرحمن",
    role: "المدير المالي",
  },
];

const COMPLIANCE = [
  { label: "قانون العمل المصري 12/2003", desc: "متوافق مع أحكام القانون" },
  { label: "قانون التأمينات 148/2019", desc: "النماذج والحسابات معتمدة" },
  { label: "PDPL 151/2020", desc: "تشفير PII وموافقة المستخدم" },
  { label: "GDPR Readiness", desc: "جاهز للتوافق مع GDPR" },
  { label: "ضريبة المرتبات", desc: "شرائح 2026 مع خصم ضريبي تلقائي" },
  { label: "SOC 2 Type II", desc: "قيد التنفيذ — متوقع Q3 2026" },
];

export default function EnterprisePage() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pb-20 pt-16">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-800 bg-cyan-950/50 px-4 py-1.5">
                <Building2 className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-medium text-cyan-300">Enterprise</span>
              </div>
              <h1 className="text-4xl font-black text-white sm:text-5xl md:text-6xl leading-tight">
                منصة موارد بشرية
                <br />
                <span className="bg-gradient-to-r from-cyan-300 to-cyan-500 bg-clip-text text-transparent">
                  بمستوى المؤسسات
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 leading-relaxed">
                نِظام Enterprise بيجمع بين الأمان العسكري، والمرونة اللي
                تخلّي شركتك تشتغل من أول يوم — حضور، مرتبات، CRM، و AI
                في منصة واحدة بتدعم آلاف الموظفين.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-6 py-3 text-base font-bold text-white shadow-lg transition-all hover:from-cyan-600 hover:to-cyan-700 hover:shadow-xl"
                >
                  <ArrowLeft className="h-5 w-5" />
                  احجز Demo حية
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-3 text-base font-bold text-slate-200 shadow-lg backdrop-blur transition-all hover:bg-slate-800 hover:text-white"
                >
                  ابدأ تجربة مجانية
                </Link>
              </div>
              <div className="mt-6 flex items-center justify-center gap-6 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  بدون بطاقة ائتمان
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  14 يوم تجربة
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  دعم فني مخصص
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {[
                { value: "٢٠٠+", label: "موظف على المنصة", sub: "في شركات مصرية" },
                { value: "٩٩.٩٪", label: "وقت تشغيل", sub: "مضمون بـ SLA" },
                { value: "٣٠+", label: "تكامل مع أنظمة", sub: "API و Webhook" },
                { value: "٤.٨/٥", label: "تقييم المستخدمين", sub: "متوسط 12 تقييم" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-3xl font-black text-slate-900 dark:text-white">
                    {s.value}
                  </div>
                  <div className="text-sm font-bold text-slate-600 dark:text-slate-400">
                    {s.label}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">
                    {s.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="bg-slate-50 py-20 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white">
                مميزات المؤسسات
              </h2>
              <p className="mt-3 text-slate-500">
                كل اللي محتاجه عشان تدير آلاف الموظفين بثقة وأمان.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-cyan-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-800"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors group-hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-400">
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Compliance */}
        <section className="bg-white py-20 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <Shield className="h-4 w-4" />
                  الامتثال القانوني
                </div>
                <h2 className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
                  متوافق مع كل القوانين المصرية والدولية
                </h2>
                <p className="mt-3 text-slate-500 leading-relaxed">
                  النظام مبني من الصفر ليكون متوافقاً مع القوانين المصرية
                  والدولية — مش إضافة بعدية. كل حسابات المرتبات والتأمينات
                  والضرائب بتتم بشكل آلي وفق أحدث التشريعات.
                </p>
                <div className="mt-6 space-y-3">
                  {COMPLIANCE.map((c) => (
                    <div
                      key={c.label}
                      className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900"
                    >
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {c.label}
                        </div>
                        <div className="text-sm text-slate-500">{c.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 blur-3xl" />
                <div className="relative rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    نموذج الشراكة المؤسسية
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    هيكل تسعير مرن للمؤسسات والشراكات الاستراتيجية
                  </p>
                  <div className="mt-6 space-y-4">
                    {[
                      { name: "Enterprise Basic", price: "تبدأ من ٥,٠٠٠ ج/شهري", emp: "حتى ٢٠٠ موظف" },
                      { name: "Enterprise Plus", price: "تبدأ من ١٠,٠٠٠ ج/شهري", emp: "حتى ٥٠٠ موظف" },
                      { name: "Enterprise Unlimited", price: "مخصص", emp: "غير محدود" },
                    ].map((p) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {p.name}
                          </div>
                          <div className="text-sm text-slate-500">{p.emp}</div>
                        </div>
                        <div className="text-left">
                          <div className="font-black text-cyan-600 dark:text-cyan-400">
                            {p.price}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 rounded-xl bg-cyan-50 p-4 text-sm text-cyan-900 dark:bg-cyan-950 dark:text-cyan-300">
                    جميع الخطط المؤسسية تشمل: دعم مخصص، SSO، Audit Log،
                    وSLA مضمون.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Case Studies */}
        <section className="bg-slate-50 py-20 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white">
                شركات بتثق في نِظام
              </h2>
              <p className="mt-3 text-slate-500">
                مؤسسات مصرية حقيقية شغالة على المنصة النهاردة.
              </p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-2">
              {CASE_STUDIES.map((cs) => (
                <div
                  key={cs.name}
                  className="rounded-2xl border border-slate-200 bg-white p-8 transition-all hover:shadow-lg dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-lg font-black text-white">
                      {cs.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {cs.name}
                      </div>
                      <div className="text-sm text-slate-500">
                        {cs.industry} · {cs.employees} موظف
                      </div>
                    </div>
                  </div>
                  <div className="mb-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        التحدي:
                      </span>{" "}
                      {cs.challenge}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        الحل:
                      </span>{" "}
                      {cs.result}
                    </div>
                  </div>
                  <div className="rounded-xl bg-cyan-50 p-4 dark:bg-cyan-950">
                    <p className="text-sm font-medium italic text-cyan-900 dark:text-cyan-300">
                      &ldquo;{cs.quote}&rdquo;
                    </p>
                    <div className="mt-2 text-xs text-cyan-700 dark:text-cyan-400">
                      {cs.person} — {cs.role}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 py-20">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')]" />
          <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-black text-white sm:text-4xl">
              جاهز تنقل مؤسستك للنظام الجديد؟
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
              جدول Demo حية ٢٠ دقيقة — هتشوف النظام بنفسك وتقدر تسأل كل
              أسئلتك.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-8 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:from-cyan-600 hover:to-cyan-700 hover:shadow-xl"
              >
                <ArrowLeft className="h-5 w-5" />
                احجز Demo
              </Link>
              <Link
                href="https://wa.me/201055356622"
                target="_blank"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-8 py-3.5 text-base font-bold text-slate-200 backdrop-blur transition-all hover:bg-slate-800 hover:text-white"
              >
                كلم المبيعات على WhatsApp
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-950 py-8 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-500 sm:px-6">
          © {new Date().getFullYear()} نِظام HR · مصر · جميع الحقوق محفوظة
        </div>
      </footer>
    </>
  );
}
