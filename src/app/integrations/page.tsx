// ============================================================================
// /integrations — Integrations + tools that connect to Nidham (التكاملات)
// ============================================================================
//
// Closes "does this play nice with my existing tools?" — a CFO question
// that kills deals when unanswered.
//
// Status as of 2026-05-25:
//   ✅ ZKTeco (file import)
//   ✅ Excel/CSV import (employees + payroll + attendance)
//   ✅ WhatsApp Business (notifications)
//   ✅ Egyptian banks (payroll transfer file format)
//   ⏳ QuickBooks (roadmap)
//   ⏳ Egyptian tax authority direct submission (roadmap)
//   ⏳ Sage Egypt (roadmap)
//   ⏳ Bayzat / ZenHR migration tool (roadmap — most-requested)
//
// Honest about what we have vs what's planned.

import Link from "next/link";

export const metadata = {
  title: "التكاملات | نِظام",
  description:
    "Nidham بيتكامل مع ZKTeco و Excel وأنظمة البنوك المصرية. تكاملات إضافية في الـ roadmap: QuickBooks, Sage, مصلحة الضرايب.",
};

type Integration = {
  name: string;
  category: string;
  status: "live" | "beta" | "roadmap";
  description: string;
  emoji: string;
};

const INTEGRATIONS: Integration[] = [
  // ─── LIVE ─────────────────────────────────────────────────────────────
  {
    name: "ZKTeco",
    category: "أجهزة الحضور",
    status: "live",
    description:
      "استيراد ملف الحضور من ZKTeco devices مباشرة. النظام بيـ parse الملف + يحسب overtime + يطبّق على المرتبات تلقائي.",
    emoji: "🕐",
  },
  {
    name: "Excel / CSV Import",
    category: "بيانات",
    status: "live",
    description:
      "استيراد بيانات الموظفين + المرتبات + الحضور من Excel/CSV واحد. الـ AI بيـ map الـ columns تلقائياً.",
    emoji: "📊",
  },
  {
    name: "WhatsApp Business API",
    category: "تواصل",
    status: "live",
    description:
      "إشعارات تلقائية للموظفين عبر واتساب (موعد المرتبات، الإجازات، البدلات الجديدة). دعم Egyptian numbers بالكامل.",
    emoji: "💬",
  },
  {
    name: "Egyptian Banks (Payroll File)",
    category: "بنوك",
    status: "live",
    description:
      "توليد ملف Excel مفصّل للتحويل البنكي بصيغة CIB / NBE / Banque Misr / AlexBank. تقدر تحمّله وترفعه على بوابة البنك مباشرة.",
    emoji: "🏦",
  },
  {
    name: "Mobile App (Android + iOS)",
    category: "موبايل",
    status: "live",
    description:
      "تطبيق Nidham Mobile للـ check-in بالـ GPS + طلب إجازة + شوف قسيمة الراتب. Native على Android 8+ و iOS 14+.",
    emoji: "📱",
  },
  {
    name: "Vercel + Cloudflare",
    category: "بنية تحتية",
    status: "live",
    description:
      "Hosting على Vercel (edge network) + DNS و SSL من Cloudflare. uptime 99.5%+ تلقائياً.",
    emoji: "☁️",
  },

  // ─── ROADMAP ──────────────────────────────────────────────────────────
  {
    name: "QuickBooks",
    category: "محاسبة",
    status: "roadmap",
    description:
      "تصدير دورة المرتبات الشهرية مباشرة لـ QuickBooks Online. الـ Beta customers هياخدوها أولاً.",
    emoji: "📒",
  },
  {
    name: "Sage Egypt",
    category: "محاسبة",
    status: "roadmap",
    description:
      "تكامل مع Sage 50 و Sage Cloud Egypt — تصدير المرتبات + التأمينات تلقائياً.",
    emoji: "📔",
  },
  {
    name: "مصلحة الضرايب — Direct Submission",
    category: "حكومي",
    status: "roadmap",
    description:
      "تقديم الإقرارات الضريبية مباشرة من Nidham لبوابة الـ ETA — بدون ما تنزّل وتعدّل ملف Excel.",
    emoji: "🏛",
  },
  {
    name: "Bayzat / ZenHR Migration",
    category: "هجرة بيانات",
    status: "roadmap",
    description:
      "أداة هجرة من Bayzat أو ZenHR لـ Nidham في يومين بدلاً من 7. الأكثر طلباً من العملاء.",
    emoji: "🔄",
  },
  {
    name: "Slack / Microsoft Teams",
    category: "تواصل",
    status: "roadmap",
    description:
      "إشعارات Nidham داخل Slack أو Teams — مفيد للشركات الـ tech-savvy.",
    emoji: "💼",
  },
  {
    name: "Webhooks + REST API",
    category: "تطوير",
    status: "roadmap",
    description:
      "API كامل للـ developers — مفيد للشركات الـ enterprise اللي عندهم نظام محاسبة custom. شوف /api-docs للتفاصيل.",
    emoji: "🔌",
  },
];

const LIVE = INTEGRATIONS.filter((i) => i.status === "live");
const ROADMAP = INTEGRATIONS.filter((i) => i.status === "roadmap");

export default function IntegrationsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/"
          className="text-sm text-brand-cyan-dark hover:underline font-cairo mb-6 inline-block"
        >
          ← الرجوع للصفحة الرئيسية
        </Link>

        <header className="mb-10 text-center">
          <div className="inline-block px-3 py-1 rounded-full bg-cyan-50 border border-cyan-300 text-cyan-700 text-xs font-bold mb-3 font-cairo">
            🔌 6 تكاملات live · 6 على الـ roadmap
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-cairo text-slate-900 mb-3">
            التكاملات
          </h1>
          <p className="text-lg text-slate-600 font-cairo max-w-2xl mx-auto">
            Nidham بيشتغل مع الأدوات اللي عندك بالفعل — مفيش لازم تغيّر
            workflow شركتك.
          </p>
        </header>

        {/* LIVE integrations */}
        <section className="mb-12">
          <h2 className="text-2xl font-black font-cairo text-slate-900 mb-5 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            متاحة دلوقتي
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {LIVE.map((int) => (
              <Card key={int.name} integration={int} />
            ))}
          </div>
        </section>

        {/* ROADMAP integrations */}
        <section className="mb-12">
          <h2 className="text-2xl font-black font-cairo text-slate-900 mb-5 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            في الـ Roadmap (Q3-Q4 2026)
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {ROADMAP.map((int) => (
              <Card key={int.name} integration={int} />
            ))}
          </div>
          <div className="mt-6 p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-center">
            <p className="text-sm text-amber-900 font-cairo">
              💡 محتاج تكامل مش في الـ roadmap؟ ابعتلنا — Beta customers
              يقدروا يطلبوا custom integrations مجاناً.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="p-8 rounded-3xl bg-gradient-to-br from-brand-cyan-dark to-brand-navy text-white text-center">
          <h2 className="text-2xl font-black font-cairo mb-3">
            محتاج تكامل مخصّص؟
          </h2>
          <p className="text-cyan-100 font-cairo mb-6">
            للـ Enterprise customers — بنبني custom integrations في 2-4 أسابيع
          </p>
          <a
            href="https://wa.me/201055356622?text=أهلاً، عايز أعرف عن custom integrations في Nidham"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 rounded-xl bg-white text-brand-cyan-dark font-black font-cairo hover:bg-cyan-50 transition"
          >
            💬 اتكلم مع فريق التكاملات
          </a>
        </section>

        <footer className="mt-12 text-center">
          <p className="text-xs text-slate-500 font-cairo">
            Last updated: 25 مايو 2026 · بنحدّث الصفحة دي شهرياً
          </p>
        </footer>
      </div>
    </main>
  );
}

function Card({ integration }: { integration: Integration }) {
  return (
    <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-brand-cyan/40 transition">
      <div className="flex items-start gap-3">
        <div className="text-4xl shrink-0">{integration.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-black text-slate-900 font-cairo">
              {integration.name}
            </h3>
            <StatusBadge status={integration.status} />
          </div>
          <p className="text-xs text-slate-500 font-cairo mb-2">
            {integration.category}
          </p>
          <p className="text-sm text-slate-700 font-cairo leading-relaxed">
            {integration.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Integration["status"] }) {
  if (status === "live") {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold tracking-wider">
        LIVE
      </span>
    );
  }
  if (status === "beta") {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold tracking-wider">
        BETA
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold tracking-wider">
      ROADMAP
    </span>
  );
}
