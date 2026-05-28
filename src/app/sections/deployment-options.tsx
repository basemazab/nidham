import Link from "next/link";
import { SectionHeader, Check, CheckDark } from "./section-helpers";

export function DeploymentOptionsSection() {
  return (
    <section className="px-6 py-20 bg-gradient-to-br from-slate-100 via-white to-slate-100 relative">
      <div className="max-w-6xl mx-auto">
        <SectionHeader eyebrow="نشر مرن" title="Cloud أو On-Premise — انت تختار" subtitle="نفس الكود، نفس الواجهة، نفس الـ features — متاحة على السحابة أو على سيرفر شركتك الداخلي." />
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border-2 border-brand-cyan/30 rounded-3xl p-8 shadow-lg relative overflow-hidden">
            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan-dark text-[10px] font-bold font-cairo">الأكثر شيوعًا</div>
            <div className="text-4xl mb-3">☁</div>
            <h3 className="text-2xl font-black text-slate-800 mb-2 font-cairo">Nidham Cloud</h3>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed font-cairo">السحابة المُدارة. تشغّل شركتك في دقيقة، التحديثات تنزل تلقائيًا، مفيش بنية تحتية بتديرها.</p>
            <ul className="space-y-2.5 mb-6 text-sm font-cairo">
              <Check text="تشغيل فوري في 30 ثانية" />
              <Check text="تحديثات + ميزات جديدة تلقائيًا" />
              <Check text="Backups يومية تلقائية" />
              <Check text="بنية متعددة المناطق (multi-region)" />
              <Check text="14 يوم تجربة مجانية، اشتراك شهري بعدها" />
            </ul>
            <div className="mb-6 pb-4 border-b border-slate-100">
              <div className="text-xs text-slate-500 font-cairo mb-1">المناسب لـ</div>
              <div className="text-sm text-slate-700 font-cairo">الشركات الصغيرة والمتوسطة (5 – 500 موظف) اللي محتاجة تبدأ دلوقتي بدون IT.</div>
            </div>
            <Link href="/signup" className="block w-full text-center px-5 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-sm hover:shadow-lg transition font-cairo">
              ابدأ التجربة المجانية
            </Link>
          </div>
          <div className="bg-gradient-to-br from-slate-900 via-brand-navy to-slate-900 text-white border-2 border-brand-gold/40 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-[10px] font-bold font-cairo">للشركات والمؤسسات</div>
            <div className="text-4xl mb-3">🏢</div>
            <h3 className="text-2xl font-black mb-2 font-cairo">Nidham Enterprise</h3>
            <p className="text-sm text-slate-300 mb-5 leading-relaxed font-cairo">تثبيت كامل على سيرفر شركتك الداخلي. بياناتك ما تخرجش من شبكتك. تحكم كامل، عزل كامل، وخصوصية على مستوى الصفر.</p>
            <ul className="space-y-2.5 mb-6 text-sm font-cairo">
              <CheckDark text="نشر على بنية شركتك (On-premise / Private Cloud)" />
              <CheckDark text="عزل بيانات كامل — صفر مشاركة مع أي طرف ثالث" />
              <CheckDark text="عمل بدون إنترنت (Air-gapped) ممكن" />
              <CheckDark text="Dockerized — تشغيل + ترقية بضغطة" />
              <CheckDark text="دومين خاص + Branding مخصص" />
              <CheckDark text="SLA ودعم فني مباشر + تدريب على الفريق" />
            </ul>
            <div className="mb-6 pb-4 border-b border-slate-700">
              <div className="text-xs text-slate-400 font-cairo mb-1">المناسب لـ</div>
              <div className="text-sm text-slate-200 font-cairo">البنوك، الجهات الحكومية، المستشفيات، المصانع، أي شركة عندها متطلبات سيادة بيانات أو قطاع منظّم.</div>
            </div>
            <a href="https://wa.me/201055356622?text=أهلاً، عايز أعرف تفاصيل نسخة Nidham Enterprise" target="_blank" rel="noopener noreferrer"
              className="block w-full text-center px-5 py-3 rounded-xl bg-gradient-to-r from-brand-gold to-amber-600 text-slate-900 font-bold text-sm hover:shadow-xl transition font-cairo">
              احجز جلسة تعريفية
            </a>
          </div>
        </div>
        <div className="mt-8 p-5 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row items-center gap-4 max-w-4xl mx-auto text-sm">
          <div className="text-3xl shrink-0">🔄</div>
          <div className="flex-1 text-center md:text-right font-cairo text-slate-700 leading-relaxed">
            <b>نفس النظام بالظبط في النشرتين.</b> نفس الواجهة، نفس الموديولات، نفس الـ AI، نفس تطبيق الموبايل. الفرق الوحيد: مين بيشغّل السيرفر.
          </div>
        </div>
      </div>
    </section>
  );
}
