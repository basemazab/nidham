// ============================================================================
// /help — Public Help Center (مركز المساعدة)
// ============================================================================
//
// The dashboard help center at /dashboard/help is auth-gated, so prospects
// can't see it before signing up. This is the public mirror: same content,
// no login required, helps SEO + reduces support load.

import Link from "next/link";

export const metadata = {
  title: "مركز المساعدة | نِظام",
  description:
    "إجابات على أكتر الأسئلة شيوعاً عن Nidham — التسجيل، المرتبات، التأمينات، الـ AI Agent، وأكتر.",
};

// ─── FAQ data ──────────────────────────────────────────────────────────────
// Organized by category to mirror the in-app /dashboard/help structure.
const FAQ_CATEGORIES = [
  {
    emoji: "🚀",
    title: "البدء + التسجيل",
    items: [
      {
        q: "إزاي أعمل حساب جديد؟",
        a: 'روح nidhamhr.com/signup → ادخل اسمك + اسم شركتك + إيميل → اختار كلمة سر قوية. هتدخل dashboard فاضي جاهز للاستخدام. ابدأ بإضافة أول موظف.',
      },
      {
        q: "هل في فترة تجريبية مجانية؟",
        a: 'أيوة، Free Plan كامل لشركات حتى 5 موظفين بدون أي تكلفة وبدون credit card. لو شركتك أكبر، تقدر تجرب أي باقة 30 يوم مع ضمان استرداد كامل.',
      },
      {
        q: "كام بياخد Setup كامل؟",
        a: 'Setup كامل من تسجيل لـ live mode = 7 أيام:\n- يوم 1-2: إنشاء الحساب + invitations\n- يوم 3-4: استيراد بيانات الموظفين\n- يوم 5-7: أول دورة مرتبات تجريبية\n- يوم 8: Live\n\nبنعملها معاك مجاناً.',
      },
      {
        q: "هل ينفع أستورد بياناتي من Excel؟",
        a: 'أيوة! النظام بياخد Excel/CSV واحد فيه كل بيانات الموظفين + المرتبات + الحضور، وبيستوردهم في دقايق. لو محتاج مساعدة، باسم بيعمل الـ import شخصياً للـ Beta عملاء.',
      },
    ],
  },
  {
    emoji: "💰",
    title: "الأسعار + الفوترة",
    items: [
      {
        q: "كام السعر؟",
        a: 'الأسعار حسب عدد الموظفين:\n• مجاني: 5 موظفين = 0 ج\n• Starter: 25 موظف = 500 ج/شهر\n• Pro ⭐: 100 موظف = 1,500 ج/شهر\n• Business: 500 موظف = 3,500 ج/شهر\n• Enterprise: تواصل لتسعير خاص\n\nشاهد التفاصيل: nidhamhr.com/pricing',
      },
      {
        q: "هل في رسوم خفية؟",
        a: 'أبداً. السعر = اللي تشوفه. Onboarding مجاناً، Support مجاناً، Updates مجاناً. الـ VAT 14% بيتضاف للأفراد فقط (للشركات بـ TRN بنطبّق reverse charge).',
      },
      {
        q: "هل أقدر أدفع سنوي بخصم؟",
        a: 'أيوة، الدفع السنوي بياخد خصم 20% (Pro بـ 14,400 ج/سنة بدل 18,000). الـ Beta plan بياخد خصم 50% لسنة كاملة بعد الـ 3 شهور المجانية.',
      },
      {
        q: "إزاي أدفع؟",
        a: 'بنقبل: InstaPay، Vodafone Cash، Orange Cash، Fawry، Visa/Mastercard، تحويل بنكي. الدفع شهري أو سنوي على نفس البطاقة بشكل تلقائي.',
      },
      {
        q: "هل أقدر ألغي اشتراكي؟",
        a: 'أيوة، أي وقت بدون عقوبات من /dashboard/subscription. الاشتراك يفضل شغّال لحد نهاية الـ billing cycle المدفوع. بعد الإلغاء، عندك 30 يوم تنزّل بياناتك.',
      },
      {
        q: "هل في ضمان استرداد؟",
        a: '30 يوم ضمان كامل على أول دفعة. لو مش راضي، ابعتلنا إيميل وبنرجّع المبلغ في 7-14 يوم عمل. تفاصيل: nidhamhr.com/refund',
      },
    ],
  },
  {
    emoji: "📋",
    title: "المرتبات + التأمينات",
    items: [
      {
        q: "هل النظام بيحسب المرتبات بقانون 2026؟",
        a: 'أيوة 100%. النظام محدّث بشرايح ضريبة 2026 (0%، 10%، 15%، 20%، 22.5%) + نسبة تأمينات 2026 (11% موظف + 18.75% صاحب عمل) + الراتب اليومي ÷26.',
      },
      {
        q: "هل بيطبع نماذج التأمينات الرسمية؟",
        a: 'أيوة. كل النماذج بنقرة واحدة:\n• نموذج 1: تسجيل موظف جديد\n• نموذج 2: تعديل أجر\n• نموذج 6: ترك الخدمة + EOS\n• شهادات عمل / خبرة / راتب',
      },
      {
        q: "هل بيحسب الـ Overtime تلقائي؟",
        a: 'أيوة، بمعدلات القانون المصري:\n• 35% فوق الأساسي (نهاراً)\n• 50% (ليلاً)\n• 100% (يوم راحة أو عطلة رسمية)\n\nبيتم تلقائياً من بيانات ZKTeco أو الـ GPS check-ins.',
      },
      {
        q: "إيه فايدة الـ Audit Log Immutable؟",
        a: 'كل عملية حساسة (مرتبات، تأمينات، إنذارات) بتتسجّل في log محصّن بـ hash chain — يعني محدش يقدر يعدّلها بأثر رجعي. لو في تفتيش، التقرير جاهز للطبع.',
      },
    ],
  },
  {
    emoji: "📱",
    title: "موبايل App",
    items: [
      {
        q: "هل في موبايل app للموظفين؟",
        a: 'أيوة، متاح على Android (8+) و iPhone (iOS 14+). الموظف يقدر يعمل:\n• Check-in بالـ GPS\n• طلب إجازة\n• شوف قسيمة الراتب\n• شات مع HR',
      },
      {
        q: "إزاي بدعو الموظفين يحمّلوا التطبيق؟",
        a: 'من dashboard → Employees → اضغط على أي موظف → في أعلى الصفحة QR code أزرق. اطبعه أو ابعته للموظف على واتساب. الموظف يفتح كاميرا الموبايل، يصوّر الـ QR، ويـ install في ثواني.',
      },
      {
        q: "هل الـ GPS check-in آمن من التزوير؟",
        a: 'أيوة. النظام بيشوف:\n• الـ GPS coordinates الفعلي\n• Geofencing (لازم يكون داخل radius معيّن من مقر الشركة)\n• Pattern detection (لو نفس الموظف بيـ check-in من مكان غريب، بيتم flag)',
      },
    ],
  },
  {
    emoji: "🤖",
    title: "الـ AI Features",
    items: [
      {
        q: "إيه هو AI Agent؟",
        a: 'AI Agent هو ميزة فريدة في Nidham — تقدر تكتب أوامر بالعربي زي:\n• "ضيف موظف اسمه أحمد، راتب 5000"\n• "شوف غياب محمد الشهر ده"\n• "اطبع نموذج 6 لـ سارة"\n\nوالنظام بينفّذ تلقائياً.',
      },
      {
        q: "هل الـ AI بيتعلم من بيانات شركتي؟",
        a: 'لا. بياناتك تستخدم بس عندك. الـ AI بيشتغل على بيانات شركتك بشكل isolated بدون مشاركتها مع أي شركة تانية أو الـ AI model. بيستخدم Gemini + Groq APIs مع zero data retention.',
      },
      {
        q: "إيه الـ Marketing Studio؟",
        a: 'أداة بـ AI داخل dashboard بتكتب لك:\n• إعلانات Facebook + Instagram بالعربي المصري\n• Captions للسوشيال\n• Email templates للموظفين\n• Landing pages مخصصة لكل حملة',
      },
    ],
  },
  {
    emoji: "🔒",
    title: "الأمان + الخصوصية",
    items: [
      {
        q: "هل بياناتي آمنة؟",
        a: '100% آمنة:\n• PII (رقم قومي، بنك) مشفّر AES-256\n• Backup يومي على AWS\n• 2FA إجباري للـ admins\n• ISO 27001 compliant\n• متوافق مع PDPL 151/2020',
      },
      {
        q: "هل أقدر أنزل بياناتي وأمشي؟",
        a: 'أيوة، أي وقت. من Settings → Export → بياناتك بصيغة Excel/CSV/JSON كاملة. مفيش lock-in.',
      },
      {
        q: "بياناتي بتتخزن فين؟",
        a: 'على Supabase (AWS Singapore + USA backup). كل البيانات مشفّرة على disk + in-transit. الـ access logs بتتسجّل لكل عملية.',
      },
    ],
  },
  {
    emoji: "🎁",
    title: "Beta Program",
    items: [
      {
        q: "إيه عرض Beta؟",
        a: 'لأول 10 شركات تنضم:\n✅ 3 شهور مجاناً 100%\n✅ + 50% خصم لسنة كاملة بعدها\n✅ Onboarding شخصي\n✅ Dedicated support\n\nفي المقابل: feedback نص شهري + testimonial اختياري.',
      },
      {
        q: "إزاي أنضم لـ Beta؟",
        a: 'ابعت رسالة واتساب على 0105 535 6622 — اكتب اسم شركتك + عدد موظفين + نشاطها. هنرتب Demo 20 دقيقة للتأكد من المناسبة. التفاصيل: nidhamhr.com/beta-terms',
      },
      {
        q: "هل لازم أوقّع عقد؟",
        a: 'مش عقد رسمي بمحامي، بس بنطلب موافقة على شروط Beta البسيطة (nidhamhr.com/beta-terms). بنعتمد على الثقة.',
      },
    ],
  },
];

export default function HelpPage() {
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
            مركز المساعدة
          </h1>
          <p className="text-lg text-slate-600 font-cairo">
            إجابات على أكتر الأسئلة شيوعاً — مفيش لازم تكلم Support
          </p>
        </header>

        {/* Quick search hint */}
        <section className="mb-10 p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-center">
          <p className="text-sm font-cairo text-amber-900">
            💡 ما لقيتش إجابة لسؤالك؟ ابعت على{" "}
            <a
              href="https://wa.me/201055356622"
              className="font-bold underline"
              dir="ltr"
            >
              واتساب 0105 535 6622
            </a>{" "}
            وهنرد عليك خلال ساعة في وقت العمل.
          </p>
        </section>

        {/* FAQ accordions by category */}
        <div className="space-y-8">
          {FAQ_CATEGORIES.map((cat) => (
            <section key={cat.title} className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-2xl font-black font-cairo text-slate-900 mb-5 flex items-center gap-3">
                <span className="text-3xl">{cat.emoji}</span>
                {cat.title}
              </h2>
              <div className="space-y-3">
                {cat.items.map((item, idx) => (
                  <details
                    key={idx}
                    className="group border border-slate-200 rounded-2xl overflow-hidden"
                  >
                    <summary className="px-5 py-4 cursor-pointer hover:bg-slate-50 transition flex items-start justify-between gap-3 font-cairo">
                      <span className="font-bold text-slate-800">{item.q}</span>
                      <span className="text-brand-cyan-dark text-xl group-open:rotate-45 transition-transform shrink-0">
                        +
                      </span>
                    </summary>
                    <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
                      <p className="text-sm text-slate-700 font-cairo leading-relaxed whitespace-pre-line">
                        {item.a}
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Contact CTA */}
        <section className="mt-12 p-8 rounded-3xl bg-gradient-to-br from-brand-cyan-dark to-brand-navy text-white text-center">
          <h2 className="text-2xl font-black font-cairo mb-3">
            لسة محتاج مساعدة؟
          </h2>
          <p className="text-cyan-100 mb-6 font-cairo">
            باسم بيرد شخصياً خلال ساعة في وقت العمل
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://wa.me/201055356622"
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold transition"
            >
              💬 واتساب
            </a>
            <a
              href="mailto:nidhamhr@proton.me"
              className="px-6 py-3 rounded-xl bg-white text-brand-cyan-dark font-bold hover:bg-cyan-50 transition"
            >
              📧 إيميل
            </a>
            <Link
              href="/contact"
              className="px-6 py-3 rounded-xl bg-white/10 border-2 border-white/30 font-bold hover:bg-white/20 transition"
            >
              📞 كل طرق التواصل
            </Link>
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
