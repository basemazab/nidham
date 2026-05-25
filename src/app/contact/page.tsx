// ============================================================================
// /contact — Contact page (تواصل معانا)
// ============================================================================
//
// Required for Egyptian e-commerce trust + every modern SaaS. Prospects
// who don't want to sign up yet still need a way to reach the team.
//
// Format: contact card with WhatsApp + email + office address. No form
// (yet) — the WhatsApp deeplink is faster + more familiar for Egyptian
// SMB owners, and form spam from cold leads is a net loss.

import Link from "next/link";

export const metadata = {
  title: "تواصل معانا | نِظام",
  description:
    "كل طرق التواصل مع فريق Nidham — واتساب، إيميل، عنوان المكتب، وساعات العمل.",
};

export default function ContactPage() {
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
          <h1 className="text-4xl md:text-5xl font-black font-cairo text-slate-900 mb-3">
            تواصل معانا
          </h1>
          <p className="text-lg text-slate-600 font-cairo">
            باسم بيرد شخصياً خلال ساعة في وقت العمل 🙌
          </p>
        </header>

        {/* Primary CTAs — WhatsApp first because Egyptian SMB owners prefer it */}
        <section className="grid md:grid-cols-2 gap-5 mb-10">
          <a
            href="https://wa.me/201055356622?text=أهلاً، عايز أعرف أكتر عن Nidham"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-7 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all"
          >
            <div className="text-5xl mb-3">📱</div>
            <h2 className="text-2xl font-black font-cairo mb-2">واتساب</h2>
            <p className="text-emerald-50 font-cairo mb-4">
              الأسرع — رد خلال دقايق في ساعات العمل
            </p>
            <div className="font-mono text-xl font-bold" dir="ltr">
              +20 105 535 6622
            </div>
          </a>

          <a
            href="mailto:nidhamhr@proton.me"
            className="block p-7 rounded-3xl bg-gradient-to-br from-brand-cyan to-brand-cyan-dark text-white shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all"
          >
            <div className="text-5xl mb-3">📧</div>
            <h2 className="text-2xl font-black font-cairo mb-2">إيميل</h2>
            <p className="text-cyan-50 font-cairo mb-4">
              للموضوعات الرسمية والتفاصيل الطويلة
            </p>
            <div className="font-mono text-base font-bold break-all" dir="ltr">
              nidhamhr@proton.me
            </div>
          </a>
        </section>

        {/* Office details + hours */}
        <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 mb-8">
          <h2 className="text-2xl font-black font-cairo text-slate-900 mb-6">
            معلومات إضافية
          </h2>
          <div className="grid md:grid-cols-2 gap-6 font-cairo">
            <Item icon="🏢" title="المكتب الرئيسي">
              <p>HR BASEM AZAB</p>
              <p>دمياط، مصر</p>
            </Item>

            <Item icon="⏰" title="ساعات العمل">
              <p>السبت - الخميس: 9 صباحاً - 6 مساءً</p>
              <p>الجمعة: مغلق</p>
            </Item>

            <Item icon="🌐" title="الموقع">
              <p>
                <a
                  href="https://nidhamhr.com"
                  className="text-brand-cyan-dark hover:underline"
                  dir="ltr"
                >
                  nidhamhr.com
                </a>
              </p>
            </Item>

            <Item icon="📘" title="Facebook Page">
              <p>
                <a
                  href="https://www.facebook.com/profile.php?id=61589810406479"
                  className="text-brand-cyan-dark hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Nidham Egypt
                </a>
              </p>
            </Item>
          </div>
        </section>

        {/* Quick links to common resources */}
        <section className="bg-gradient-to-br from-cyan-50 to-white rounded-3xl border-2 border-cyan-200 p-8">
          <h2 className="text-xl font-black font-cairo text-slate-900 mb-5">
            ✨ قبل ما تتواصل — جرّب الأول
          </h2>
          <div className="grid md:grid-cols-2 gap-3 font-cairo">
            <QuickLink href="/brochure" emoji="📄" title="البرشور الكامل">
              4 صفحات بكل التفاصيل + ROI calculator
            </QuickLink>
            <QuickLink href="/pricing" emoji="💰" title="الأسعار والباقات">
              مقارنة شاملة + Beta Offer
            </QuickLink>
            <QuickLink href="/help" emoji="❓" title="مركز المساعدة">
              أسئلة شائعة + أدلة استخدام
            </QuickLink>
            <QuickLink href="/signup" emoji="🚀" title="ابدأ مجاناً">
              Free Plan لـ 5 موظفين، بدون كارت
            </QuickLink>
          </div>
        </section>

        <footer className="mt-12 text-center">
          <p className="text-xs text-slate-500 font-cairo">
            Nidham · بُني في دمياط، مصر · 2026
          </p>
        </footer>
      </div>
    </main>
  );
}

function Item({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
        <h3 className="font-bold text-slate-900">{title}</h3>
      </div>
      <div className="text-sm text-slate-600 mr-9 space-y-1">{children}</div>
    </div>
  );
}

function QuickLink({
  href,
  emoji,
  title,
  children,
}: {
  href: string;
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block p-4 rounded-2xl bg-white border border-slate-200 hover:border-brand-cyan transition"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{emoji}</span>
        <div>
          <div className="font-bold text-slate-900 text-sm">{title}</div>
          <div className="text-xs text-slate-500 mt-1">{children}</div>
        </div>
      </div>
    </Link>
  );
}
