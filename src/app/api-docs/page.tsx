// ============================================================================
// /api-docs — API documentation landing (وثائق الـ API)
// ============================================================================
//
// Honest stub for the API documentation. The IT person at any enterprise
// prospect will ask "do you have an API?" — saying "no" kills the deal.
// Saying "it's in the roadmap with a clear timeline + early-access form"
// keeps the conversation alive.
//
// When the actual API ships (planned Q3 2026), this page becomes the
// hub for endpoints, auth, rate limits, code samples, etc.

import Link from "next/link";

export const metadata = {
  title: "API Documentation | نِظام",
  description:
    "Nidham REST API — للـ developers اللي عايزين يبنوا integrations مخصصة مع نظام محاسبة أو ERP داخلي. Early access متاح للـ Enterprise customers.",
};

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="text-sm text-brand-cyan-dark hover:underline font-cairo mb-6 inline-block"
        >
          ← الرجوع للصفحة الرئيسية
        </Link>

        <header className="mb-10 text-center">
          <div className="inline-block px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold mb-3 font-cairo">
            🚧 Coming Q3 2026 · Early Access متاح
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-cairo text-slate-900 mb-3">
            API Documentation
          </h1>
          <p className="text-lg text-slate-600 font-cairo max-w-2xl mx-auto">
            REST API كامل للـ developers اللي عايزين يبنوا integrations
            مخصصة مع Nidham.
          </p>
        </header>

        {/* Status — be honest */}
        <section className="mb-10 p-6 rounded-3xl bg-amber-50 border-2 border-amber-300">
          <h2 className="text-xl font-black font-cairo text-amber-900 mb-3">
            📋 الحالة الحالية (تحديث 25 مايو 2026)
          </h2>
          <ul className="space-y-2 text-sm font-cairo text-amber-900 leading-relaxed">
            <li>
              ✅ <strong>Internal API:</strong> Nidham بالكامل بيشتغل على REST
              API داخلي (Server Actions في Next.js 16). نفس الـ API بيخدم الـ
              dashboard + الـ mobile app.
            </li>
            <li>
              ⏳ <strong>Public API + Documentation:</strong> في الـ roadmap
              لـ Q3 2026 (يوليو-سبتمبر). هتشمل: REST endpoints، OAuth 2.0
              authentication، rate limiting، code samples (JavaScript +
              Python + PHP).
            </li>
            <li>
              ✅ <strong>Early Access للـ Enterprise:</strong> لو عندك
              integration حرج محتاج تـ ship قبل Q3، تواصل معانا — بنفتح
              endpoints مخصصة للـ Enterprise customers.
            </li>
          </ul>
        </section>

        {/* What it will cover */}
        <section className="mb-10">
          <h2 className="text-2xl font-black font-cairo text-slate-900 mb-5">
            اللي هيتغطّى في الـ API الكامل
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <EndpointCard
              method="GET"
              path="/api/v1/employees"
              description="List + filter + paginate الموظفين"
            />
            <EndpointCard
              method="POST"
              path="/api/v1/employees"
              description="إنشاء موظف جديد + ربطه بالـ payroll"
            />
            <EndpointCard
              method="GET"
              path="/api/v1/payroll/runs"
              description="دورات المرتبات السابقة + تفاصيل كل دورة"
            />
            <EndpointCard
              method="POST"
              path="/api/v1/payroll/calculate"
              description="حساب راتب موظف بالشهر + الضرايب + التأمينات"
            />
            <EndpointCard
              method="GET"
              path="/api/v1/attendance"
              description="سجلات الحضور + GPS check-ins"
            />
            <EndpointCard
              method="POST"
              path="/api/v1/leave-requests"
              description="إنشاء طلب إجازة + موافقة تلقائية"
            />
            <EndpointCard
              method="GET"
              path="/api/v1/forms/insurance/{type}"
              description="توليد نموذج 1، 2، 6 PDF بالـ employee ID"
            />
            <EndpointCard
              method="POST"
              path="/api/v1/webhooks"
              description="استقبال events من Nidham (payroll done، employee added، إلخ)"
            />
          </div>
        </section>

        {/* Technical specs */}
        <section className="mb-10 p-6 rounded-3xl bg-slate-900 text-white">
          <h2 className="text-xl font-black font-cairo mb-4">
            المواصفات التقنية
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm font-cairo">
            <Spec label="Protocol" value="REST + JSON" />
            <Spec label="Authentication" value="OAuth 2.0 + API Keys" />
            <Spec label="Rate Limiting" value="1000 req/hour (Free), 10k (Pro), unlimited (Enterprise)" />
            <Spec label="Versioning" value="URL-based (/api/v1/, /api/v2/)" />
            <Spec label="Response Time" value="< 200ms (p95)" />
            <Spec label="Webhooks" value="HMAC signed payloads" />
            <Spec label="SDKs" value="JavaScript / Python / PHP (Q4 2026)" />
            <Spec label="Sandbox" value="api-sandbox.nidhamhr.com (Q3 2026)" />
          </div>
        </section>

        {/* CTA */}
        <section className="p-8 rounded-3xl bg-gradient-to-br from-brand-cyan-dark to-brand-navy text-white text-center">
          <h2 className="text-2xl font-black font-cairo mb-3">
            عندك use case ما يقدر يستنّى Q3؟
          </h2>
          <p className="text-cyan-100 font-cairo mb-6">
            Early Access متاح للـ Enterprise customers — بنفتح endpoints مخصصة
            في 2-3 أسابيع
          </p>
          <a
            href="https://wa.me/201055356622?text=أهلاً، عايز Early Access للـ Nidham API"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 rounded-xl bg-white text-brand-cyan-dark font-black font-cairo hover:bg-cyan-50 transition"
          >
            💬 اطلب Early Access
          </a>
        </section>

        <footer className="mt-12 text-center">
          <p className="text-xs text-slate-500 font-cairo">
            هنحدّث الصفحة دي شهرياً بـ status الـ API
          </p>
        </footer>
      </div>
    </main>
  );
}

function EndpointCard({
  method,
  path,
  description,
}: {
  method: string;
  path: string;
  description: string;
}) {
  const methodColor =
    method === "GET"
      ? "bg-emerald-100 text-emerald-700"
      : method === "POST"
      ? "bg-cyan-100 text-cyan-700"
      : "bg-amber-100 text-amber-700";

  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-md font-bold font-mono ${methodColor}`}
        >
          {method}
        </span>
        <code className="text-sm font-mono text-slate-800" dir="ltr">
          {path}
        </code>
      </div>
      <p className="text-xs text-slate-600 font-cairo leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-cyan-300 mb-1 font-bold tracking-wider uppercase">
        {label}
      </div>
      <div className="text-sm text-white" dir="ltr">
        {value}
      </div>
    </div>
  );
}
