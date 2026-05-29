import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import {
  Code2,
  BookOpen,
  Webhook,
  Blocks,
  Key,
  Shield,
  ArrowLeft,
  CheckCircle,
  Terminal,
  FileJson,
  Workflow,
  Cpu,
} from "lucide-react";

export const metadata = {
  title: "بوابة المطورين | Developer Portal",
};

const GUIDES = [
  {
    icon: BookOpen,
    title: "Getting Started",
    desc: "إنشاء API Key، أول طلب، المصادقة، والتعامل مع الأخطاء.",
    href: "/developers#getting-started",
  },
  {
    icon: FileJson,
    title: "REST API Reference",
    desc: "توثيق كامل لكل endpoints — الموظفين، الحضور، المرتبات، والتقارير.",
    href: "/api-docs",
  },
  {
    icon: Key,
    title: "Authentication & Security",
    desc: "API Keys، JWT، Rate Limiting، وأفضل ممارسات الأمان.",
    href: "/developers#auth",
  },
  {
    icon: Webhook,
    title: "Webhooks",
    desc: "استقبل أحداث حية — موظف جديد، مرتبات، حضور — في نظامك.",
    href: "/developers#webhooks",
  },
  {
    icon: Blocks,
    title: "SDKs & Libraries",
    desc: "مكتبات جاهزة لـ Node.js، Python، PHP و JavaScript.",
    href: "/developers#sdks",
  },
  {
    icon: Workflow,
    title: "Automation & Integrations",
    desc: "اربط نِظام مع Zapier، Make، أو أنظمتك الداخلية.",
    href: "/developers#integrations",
  },
];

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/employees", desc: "قائمة الموظفين" },
  { method: "GET", path: "/api/v1/employees/:id", desc: "بيانات موظف" },
  { method: "POST", path: "/api/v1/employees", desc: "إضافة موظف" },
  { method: "PATCH", path: "/api/v1/employees/:id", desc: "تحديث موظف" },
  { method: "GET", path: "/api/v1/payroll", desc: "قائمة دورات المرتبات" },
  { method: "POST", path: "/api/v1/payroll", desc: "إنشاء دورة مرتبات" },
];

const WEBHOOK_EVENTS = [
  { event: "employee.created", desc: "موظف جديد اتضاف" },
  { event: "employee.updated", desc: "بيانات موظف اتغيرت" },
  { event: "payroll.period.created", desc: "دورة مرتبات جديدة" },
  { event: "payroll.period.closed", desc: "دورة مرتبات اتنفذت" },
  { event: "attendance.imported", desc: "سجلات حضور جديدة" },
  { event: "leave.request.updated", desc: "تغيير في حالة طلب إجازة" },
];

export default function DevelopersPage() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pb-20 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(8,145,178,0.15)_0%,transparent_70%)]" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-800 bg-cyan-950/50 px-4 py-1.5">
                <Code2 className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-medium text-cyan-300">
                  Developer Portal
                </span>
              </div>
              <h1 className="text-4xl font-black text-white sm:text-5xl md:text-6xl leading-tight">
                بني فوق
                <br />
                <span className="bg-gradient-to-r from-cyan-300 to-cyan-500 bg-clip-text text-transparent">
                  نِظام API
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 leading-relaxed">
                نِظام عنده REST API كامل ومفتوح — اقدر تربط أي حاجة:
                الموظفين، المرتبات، الحضور، والتقارير. كل حاجة بتشتغل
                بـ API Keys مع Rate Limiting مدمج.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/api-docs"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-6 py-3 text-base font-bold text-white shadow-lg transition-all hover:from-cyan-600 hover:to-cyan-700 hover:shadow-xl"
                >
                  <FileJson className="h-5 w-5" />
                  استعرض API Docs
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-3 text-base font-bold text-slate-200 backdrop-blur transition-all hover:bg-slate-800 hover:text-white"
                >
                  <Key className="h-5 w-5" />
                  احصل على API Key
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Start */}
        <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="mx-auto max-w-2xl text-center" id="getting-started">
              <Terminal className="mx-auto h-10 w-10 text-cyan-500" />
              <h2 className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
                Quick Start
              </h2>
              <p className="mt-2 text-slate-500">
                أول طلب API خلال دقيقة واحدة.
              </p>
            </div>
            <div className="mt-10 grid gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-2 text-sm font-bold text-slate-500">
                  ١. صادق على طلبك
                </div>
                <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-cyan-300">
                  <code>{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://api.nidhamhr.com/api/v1/employees`}</code>
                </pre>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-2 text-sm font-bold text-slate-500">
                  ٢. الرد — JSON
                </div>
                <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-green-400">
                  <code>{`{
  "data": [
    {
      "id": "uuid",
      "full_name": "أحمد محمد",
      "employee_code": "EMP-001",
      "department": "المبيعات",
      "basic_salary": 5000
    }
  ],
  "meta": { "total": 1, "page": 1 }
}`}</code>
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* API Reference */}
        <section className="bg-white py-16 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              المزيد من الـ Endpoints
            </h2>
            <p className="mt-1 text-slate-500">
              كل endpoints الموظفين والمرتبات متاحة عبر REST. راجع{" "}
              <Link href="/api-docs" className="text-cyan-600 underline dark:text-cyan-400">
                API Docs
              </Link>{" "}
              للتفاصيل الكاملة.
            </p>
            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-right">Method</th>
                    <th className="px-4 py-3 text-right">Path</th>
                    <th className="px-4 py-3 text-right">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ENDPOINTS.map((ep) => (
                    <tr key={ep.path} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                            ep.method === "GET"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                              : ep.method === "POST"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                          }`}
                        >
                          {ep.method}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {ep.path}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {ep.desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-center">
              <Link
                href="/api-docs"
                className="inline-flex items-center gap-2 text-sm font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400"
              >
                <FileJson className="h-4 w-4" />
                عرض كل الـ Endpoints في Swagger UI
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Webhooks */}
        <section
          className="bg-slate-50 py-16 dark:bg-slate-900"
          id="webhooks"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <Webhook className="h-10 w-10 text-cyan-500" />
                <h2 className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
                  Webhooks — أحداث حية في نظامك
                </h2>
                <p className="mt-3 text-slate-500 leading-relaxed">
                  استقبل أحداث فورية في نظامك الداخلي أو Zapier أو Make
                  كل ما يحصل حدث في نِظام — موظف جديد، دورة مرتبات، طلب
                  إجازة. الـ JSON payload بيروح على endpoint انت تحدده.
                </p>
                <div className="mt-6 space-y-3">
                  {WEBHOOK_EVENTS.map((w) => (
                    <div
                      key={w.event}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950"
                    >
                      <Cpu className="h-5 w-5 shrink-0 text-cyan-500" />
                      <div>
                        <code className="text-xs font-bold text-slate-900 dark:text-white">
                          {w.event}
                        </code>
                        <div className="text-xs text-slate-500">{w.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 blur-3xl" />
                <div className="relative rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-3 text-sm font-bold text-slate-500">
                    Webhook Payload Example
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-cyan-300">
                    <code>{`{
  "event": "employee.created",
  "timestamp": "2026-05-29T10:30:00Z",
  "data": {
    "id": "uuid",
    "full_name": "أحمد محمد",
    "employee_code": "EMP-042",
    "company_id": "uuid"
  }
}`}</code>
                  </pre>
                  <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    <strong>ملاحظة:</strong> الـ webhooks بتدعم توقيع
                    الرسائل بـ HMAC-SHA256 للتحقق من المصدر.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SDKs */}
        <section className="bg-white py-16 dark:bg-slate-950" id="sdks">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">
              SDKs و Libraries
            </h2>
            <p className="mt-2 text-slate-500">
              مكتبات جاهزة عشان تبدأ بسرعة في لغتك المفضلة.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name: "Node.js / TypeScript", icon: "📦", status: "Stable", docs: "#" },
                { name: "Python", icon: "🐍", status: "Stable", docs: "#" },
                { name: "PHP", icon: "🐘", status: "Beta", docs: "#" },
                { name: "JavaScript", icon: "🌐", status: "Stable", docs: "#" },
              ].map((sdk) => (
                <div
                  key={sdk.name}
                  className="rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-cyan-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{sdk.icon}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        sdk.status === "Stable"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                      }`}
                    >
                      {sdk.status}
                    </span>
                  </div>
                  <div className="mt-3 font-bold text-slate-900 dark:text-white">
                    {sdk.name}
                  </div>
                  <Link
                    href={sdk.docs}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400"
                  >
                    التوثيق
                    <ArrowLeft className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 py-20">
          <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6">
            <Code2 className="mx-auto h-12 w-12 text-cyan-400" />
            <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">
              جاهز تبدأ تبني؟
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
              سجل مجاناً واحصل على API Key فوراً. بدون بطاقة ائتمان، بدون
              تعقيد.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-8 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:from-cyan-600 hover:to-cyan-700 hover:shadow-xl"
              >
                <Key className="h-5 w-5" />
                احصل على API Key
              </Link>
              <Link
                href="/api-docs"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-8 py-3.5 text-base font-bold text-slate-200 backdrop-blur transition-all hover:bg-slate-800 hover:text-white"
              >
                <BookOpen className="h-5 w-5" />
                استعرض التوثيق الكامل
              </Link>
            </div>
            <div className="mt-6 flex items-center justify-center gap-6 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                Rate Limiting مدمج
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                التوثيق بـ Swagger
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                دعم CORS
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-950 py-8 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-500 sm:px-6">
          © {new Date().getFullYear()} نِظام HR · API v1 · جميع الحقوق محفوظة
        </div>
      </footer>
    </>
  );
}
