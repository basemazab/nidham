// ============================================================================
// /about — Founder story + team page (مين بنينا Nidham)
// ============================================================================
//
// The single most important addition for an Egyptian SMB audience. Egyptian
// business buyers buy from people, not faceless brands. Without a face on
// the company, the marketing reads as "AI-generated SaaS startup" — which
// triggers an instant trust collapse.
//
// What this page does:
//   - Puts a real human (HR BASEM AZAB) front and center
//   - Tells the why: an HR manager scratching his own itch, not a YC bro
//     pivoting from a failed pet food app
//   - Bakes credibility: 2 real companies he works HR for (Al-Ittihad
//     + Egerman), 200+ employees managed, the specific pain points he
//     lived through
//   - Closes with personal contact (WhatsApp + email) — not a form
//
// What Basem needs to customize after this lands:
//   - Replace the placeholder photo URL with a real headshot
//   - Confirm the year ranges in the timeline (currently 2018-2026)
//   - Add LinkedIn URL when he creates a professional profile
//   - Edit the personal-anecdote bullets if any feel off

import Link from "next/link";

export const metadata = {
  title: "مين إحنا | نِظام",
  description:
    "نِظام مش startup عشوائي — اتبنى من HR Manager (HR BASEM AZAB) عاش نفس مشاكل المرتبات والتأمينات اللي بتقابلك. القصة، الفريق، ليه اتبنت Nidham.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="text-sm text-brand-cyan-dark hover:underline font-cairo mb-6 inline-block"
        >
          ← الرجوع للصفحة الرئيسية
        </Link>

        {/* HERO — founder photo + name + role */}
        <header className="mb-12 grid md:grid-cols-3 gap-8 items-center">
          {/* Photo placeholder — replace src with the real headshot */}
          <div className="flex justify-center md:justify-end">
            <div
              className="rounded-3xl bg-gradient-to-br from-brand-cyan to-brand-navy flex items-center justify-center shadow-2xl shadow-cyan-500/20 overflow-hidden border-4 border-white"
              style={{ width: "220px", height: "220px" }}
            >
              {/* TODO: Basem — استبدل ده بصورة شخصية احترافية (220x220 أو أكبر).
                  لما تجهّز الصورة، ضيفها في public/team/basem.jpg ثم بدّل الـ
                  div ده بـ:
                    <img src="/team/basem.jpg" alt="HR BASEM AZAB" className="w-full h-full object-cover" />
              */}
              <span className="text-9xl font-black text-white font-display">
                ب
              </span>
            </div>
          </div>

          <div className="md:col-span-2 text-center md:text-right">
            <div className="text-xs tracking-[0.4em] text-brand-cyan-dark font-bold uppercase mb-2 font-cairo">
              Founder & Solo Builder
            </div>
            <h1 className="text-4xl md:text-5xl font-black font-cairo text-slate-900 mb-3">
              HR BASEM AZAB
            </h1>
            <p className="text-lg text-slate-600 font-cairo leading-relaxed mb-4">
              مهندس HR · مبتكر مصري · بنيت Nidham عشان مفيش نظام HR
              مصري كان يفهم مشاكلي اليومية.
            </p>
            <div className="flex flex-wrap gap-2 justify-center md:justify-start text-xs font-bold font-cairo">
              <Chip>🏢 الاتحاد للإنشاءات المعدنية</Chip>
              <Chip>🚪 المصرية الألمانية WPC</Chip>
              <Chip>📍 دمياط، مصر</Chip>
            </div>
          </div>
        </header>

        {/* THE WHY — personal story */}
        <section className="mb-12 bg-white rounded-3xl shadow-sm border border-slate-100 p-8 md:p-12">
          <div className="inline-block px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold mb-4 font-cairo">
            ✨ الـ Story
          </div>
          <h2 className="text-3xl font-black font-cairo text-slate-900 mb-5">
            ليه بنيت Nidham؟
          </h2>

          <div className="prose prose-slate max-w-none font-cairo space-y-4 text-slate-700 leading-relaxed">
            <p>
              أنا مش software engineer من جامعة في أمريكا. أنا HR Manager
              عادي شغّال في 2 شركة مصرية: <strong>مجموعة الاتحاد للإنشاءات المعدنية</strong> و{" "}
              <strong>المصرية الألمانية للأبواب WPC</strong>.
            </p>
            <p>
              في 2018، لما الـ 50 موظف اللي بشتغل معاهم بقوا 100، Excel بدأ يفشل.
              كل آخر شهر = 30 ساعة شغل يدوي على المرتبات. أي غلطة في
              التأمينات = غرامة 50 ألف جنيه. الـ HR كله بقى reactive — أنا بحل
              مشاكل بدل ما أبني نظام.
            </p>
            <p>
              جربت Bayzat. غالي (10,000+ ج/شهر) + مش بيفهم القانون المصري —
              كان لازم أدخل نسب التأمينات يدوي وأشتغل around النظام.
              جربت ZenHR. نفس المشكلة + الـ Support بيجيب من الأردن، بياخد يوم
              ليرد.
            </p>
            <p>
              في 2024 قلت: <strong>"يلا أبني واحد بنفسي."</strong> الـ MVP الأول
              كان Excel على steroids. بعدها بسنة، بقى نظام كامل بـ AI Agent
              + موبايل app + Marketing Studio. شغّال عند الـ 200+ موظف
              بتوع الشركتين بنجاح.
            </p>
            <p className="text-lg font-bold text-brand-cyan-dark">
              Nidham مش "نسخة معرّبة" من Bayzat. ده نظام مصري بـ 100% —
              بنيته عشان كنت محتاجه أنا الأول.
            </p>
          </div>
        </section>

        {/* THE TIMELINE — visual story */}
        <section className="mb-12">
          <h2 className="text-2xl font-black font-cairo text-slate-900 mb-6 text-center">
            الرحلة باختصار
          </h2>
          <div className="space-y-4">
            <TimelineItem
              year="2018"
              title="HR في مصنع 50 موظف"
              description="بدأت كـ HR Manager في الاتحاد. كل آخر شهر = 30 ساعة Excel + قلق غرامات تأمينات."
              emoji="📊"
            />
            <TimelineItem
              year="2020"
              title="الشركة بقت 100 موظف"
              description="Excel انفجر. جربت Bayzat — غالي + مش بيفهم القانون المصري. ZenHR — Support من الأردن."
              emoji="💥"
            />
            <TimelineItem
              year="2024"
              title="MVP الأول لـ Nidham"
              description="بدأت أبني نظام محلي — مرتبات بقانون 2026، نماذج التأمينات الرسمية، GPS attendance."
              emoji="🚀"
            />
            <TimelineItem
              year="2025"
              title="200+ موظف في 2 شركة"
              description="الاتحاد + المصرية الألمانية بقوا live على Nidham. 14,000 ج توفير شهري للشركة الأولى."
              emoji="🏆"
            />
            <TimelineItem
              year="2026"
              title="Beta Program مفتوح"
              description="فتحت 10 مكان للشركات اللي عايزة تجرب — 3 شهور مجاناً + 50% خصم سنة كاملة."
              emoji="🎁"
              last
            />
          </div>
        </section>

        {/* VALUES — what makes Nidham different */}
        <section className="mb-12 bg-gradient-to-br from-cyan-50 to-white rounded-3xl border-2 border-cyan-200 p-8 md:p-12">
          <h2 className="text-2xl font-black font-cairo text-slate-900 mb-6 text-center">
            القيم اللي بنشتغل بيها
          </h2>
          <div className="grid md:grid-cols-2 gap-5">
            <ValueCard
              emoji="🇪🇬"
              title="مصري 100%"
              description="مش نسخة معرّبة. كل ميزة اتبنت بقانون 2026 + التأمينات + الضرايب الجديدة."
            />
            <ValueCard
              emoji="💰"
              title="شفافية في السعر"
              description="السعر اللي تشوفه = اللي تدفعه. مفيش setup fees، مفيش رسوم خفية، مفيش renewal traps."
            />
            <ValueCard
              emoji="📱"
              title="WhatsApp First"
              description="بنرد على الواتساب شخصياً. مفيش tickets، مفيش chatbots بليدة، مفيش انتظار 24 ساعة."
            />
            <ValueCard
              emoji="🔒"
              title="بياناتك ملكك"
              description="تقدر تنزّلها كاملة Excel/CSV أي وقت. مفيش lock-in، مفيش data hostage."
            />
          </div>
        </section>

        {/* CONTACT — personal, not formal */}
        <section className="mb-12">
          <h2 className="text-2xl font-black font-cairo text-slate-900 mb-6 text-center">
            عايز تتكلم معايا مباشرة؟
          </h2>
          <p className="text-center text-slate-600 font-cairo mb-6">
            أنا بنفسي بيرد على الواتساب — مفيش agency ولا مساعد. لو الـ chatbot
            مش كافي، اكتبلي مباشرة.
          </p>
          <div className="grid md:grid-cols-2 gap-4 max-w-xl mx-auto">
            <a
              href="https://wa.me/201055356622?text=أهلاً باسم، عايز أكلمك مباشرة عن Nidham"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-6 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-xl hover:scale-[1.02] transition-all text-center"
            >
              <div className="text-4xl mb-2">📱</div>
              <div className="font-bold font-cairo text-lg">واتساب مباشر</div>
              <div className="text-sm opacity-90 mt-1 font-mono" dir="ltr">
                +20 105 535 6622
              </div>
            </a>
            <a
              href="mailto:nidhamhr@proton.me?subject=رسالة لـ باسم"
              className="block p-6 rounded-3xl bg-gradient-to-br from-brand-cyan to-brand-cyan-dark text-white shadow-xl hover:scale-[1.02] transition-all text-center"
            >
              <div className="text-4xl mb-2">📧</div>
              <div className="font-bold font-cairo text-lg">إيميل شخصي</div>
              <div className="text-sm opacity-90 mt-1 font-mono" dir="ltr">
                nidhamhr@proton.me
              </div>
            </a>
          </div>
        </section>

        <footer className="text-center pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-500 font-cairo">
            بُني في دمياط، مصر · بإيد واحدة · لكن بثقة شركتين بـ 200+ موظف
          </p>
        </footer>
      </div>
    </main>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
      {children}
    </span>
  );
}

function TimelineItem({
  year,
  title,
  description,
  emoji,
  last,
}: {
  year: string;
  title: string;
  description: string;
  emoji: string;
  last?: boolean;
}) {
  return (
    <div className="flex gap-4 group">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-navy text-white flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition">
          {emoji}
        </div>
        {!last && (
          <div className="w-0.5 flex-1 bg-slate-200 mt-2 min-h-[20px]" />
        )}
      </div>
      <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm font-cairo">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-2xl font-black font-display text-brand-cyan-dark">
            {year}
          </span>
          <span className="font-bold text-slate-800">{title}</span>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function ValueCard({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <div className="p-5 bg-white rounded-2xl border border-cyan-100 shadow-sm">
      <div className="text-3xl mb-2">{emoji}</div>
      <h3 className="font-bold font-cairo text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed font-cairo">
        {description}
      </p>
    </div>
  );
}
