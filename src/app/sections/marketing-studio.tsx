import Link from "next/link";
import { ToolCard, FlowCard, Pill, Stat, ProviderBadge } from "./section-helpers";

export function MarketingStudioSection() {
  return (
    <section className="px-6 py-20 bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900 text-white relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 opacity-30"
        style={{ backgroundImage: "radial-gradient(circle at 20% 30%, rgba(245,158,11,0.4), transparent 50%), radial-gradient(circle at 80% 70%, rgba(244,63,94,0.3), transparent 50%)" }}
      />
      <div className="max-w-6xl mx-auto relative">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold mb-4 font-cairo">
            👑 Enterprise Exclusive · جديد ٢٠٢٦
          </div>
          <h2 className="text-3xl md:text-5xl font-black font-cairo mb-4 leading-tight">
            استوديو التسويق الذكي<br />
            <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent">وكالة Big4 جواه نظامك</span>
          </h2>
          <p className="text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed font-cairo">
            بدل ما تدفع <strong className="text-amber-300">10,000-50,000 ج/شهر</strong> لوكالة تسويق، AI بيصمم لك حملاتك، يكتب إعلاناتك، يبني landing pages، ويجيب لك leads — وكله بالعربي المصري.
          </p>
        </div>

        <div className="mb-12">
          <h3 className="text-center text-xs tracking-[0.3em] text-amber-400 font-bold mb-6 font-cairo">✦ ٦ أدوات AI متكاملة</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <ToolCard icon="🔬" title="محلل المنتج" desc="USP + Positioning + قنوات التسويق المناسبة" />
            <ToolCard icon="🎯" title="باني الجمهور" desc="2-4 buyer personas مع targeting كامل لـ Meta/Google" />
            <ToolCard icon="✍" title="كاتب الإعلانات" desc="3-8 ad variants لـ Meta / Google / TikTok جاهزة للنشر" />
            <ToolCard icon="🔍" title="ماستر SEO" desc="10-25 keyword + content strategy + quick wins" />
            <ToolCard icon="🚀" title="معالج الحملات" desc="استراتيجية كاملة: ميزانية + مراحل + توقعات CPA" />
            <ToolCard icon="🩺" title="Page Doctor" desc="تشخيص مشاكل صفحتك قبل الإعلان + خطة إصلاح مرقمة" />
          </div>
        </div>

        <div className="mb-12">
          <h3 className="text-center text-xs tracking-[0.3em] text-amber-400 font-bold mb-6 font-cairo">⚡ Pipeline التشغيلي — من الـ AI لحد العميل</h3>
          <div className="grid md:grid-cols-4 gap-3 mb-4">
            <FlowCard num="١" icon="🏠" title="Landing Pages" desc="ابني صفحة هبوط في دقايق. WhatsApp + tracking + lead form قابل للتخصيص." accent="cyan" />
            <FlowCard num="٢" icon="📥" title="Leads Inbox" desc="كل lead بيدخل CRM تلقائياً مع مصدره الكامل (UTM + landing page)." accent="violet" />
            <FlowCard num="٣" icon="🎯" title="Pipeline Kanban" desc="اسحب الـ leads بين 6 مراحل (جديد → عميل) بـ drag-and-drop." accent="rose" />
            <FlowCard num="٤" icon="📊" title="Analytics" desc="Funnel كامل + ROI لكل حملة + leaderboard للصفحات." accent="emerald" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur rounded-2xl border border-amber-400/20 p-6 mb-10">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="text-4xl shrink-0">🔌</div>
            <div className="flex-1 min-w-[250px]">
              <h3 className="text-lg font-black font-cairo mb-1 text-white">Meta Lead Ads Integration</h3>
              <p className="text-sm text-slate-300 font-cairo leading-relaxed">
                اربط Facebook/Instagram → الـ leads من إعلاناتك الممولة بيدخلوا CRM <strong className="text-amber-300">تلقائياً في ثوانٍ</strong> — بدون تنزيل CSV يدوي.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Pill text="🔒 HMAC verification" />
              <Pill text="🔐 Encrypted tokens" />
              <Pill text="📥 Auto-dedup" />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-10">
          <Stat big="٥ د" label="بدل ٥ أيام مع وكالة تسويق" />
          <Stat big="٠ ج" label="بدل ١٠ آلاف ج/شهر لوكالة" />
          <Stat big="١٠٠٪" label="بالعربي المصري — مش ترجمة من إنجليزي" />
        </div>

        <div className="text-center mb-8">
          <p className="text-xs text-slate-400 font-cairo mb-3">مدعوم بـ multi-provider AI fallback</p>
          <div className="flex flex-wrap justify-center gap-2 text-[10px]">
            <ProviderBadge text="Groq · gpt-oss-120b" />
            <ProviderBadge text="Groq · gpt-oss-20b" />
            <ProviderBadge text="Groq · Llama 4 Scout" />
            <ProviderBadge text="Google · Gemini 2.5 Flash Lite" />
          </div>
          <p className="text-[10px] text-slate-500 font-cairo mt-3">لو وصلنا حد الـ quota في أي provider، النظام يـ fallback تلقائياً</p>
        </div>

        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] font-bold mb-4 font-cairo">👑 متاح للنسخة Enterprise فقط</div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="https://wa.me/201055356622?text=أهلاً، عايز أعرف تفاصيل استوديو التسويق Enterprise" target="_blank" rel="noopener noreferrer"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-black text-lg shadow-2xl hover:shadow-amber-500/50 hover:scale-105 transition-all font-cairo">
              ✦ احجز جلسة تعريفية
            </a>
            <Link href="/signup"
              className="px-8 py-4 rounded-xl border-2 border-amber-400/40 text-amber-200 font-bold text-lg hover:bg-amber-500/10 transition-all font-cairo">
              ابدأ تجربة 14 يوم
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
