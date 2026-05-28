import { SectionHeader, AICard } from "./section-helpers";

export function AISection() {
  return (
    <section className="px-6 py-20 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="✦ ذكاء اصطناعي"
          title="الـ AI مدمج في نظامك — مش add-on"
          subtitle="نِظام بيستخدم Groq + Gemini مع multi-provider fallback، بحيث ما تقفش في وش حد قط. ١٠+ مواضع AI، كل واحد بيوفّر لك ساعات أسبوعيًا."
        />
        <div className="grid md:grid-cols-2 gap-5">
          <AICard icon="📑" title="فحص CVs بالـ AI" desc="ارفع CV → الـ AI بيقرا، يقيّم 0-100، يطلع نقاط القوة والضعف، ويقترح 5 أسئلة مقابلة محددة. كله بالعربي." cta="جرّب على /dashboard/jobs" />
          <AICard icon="📂" title="استيراد موظفين من PDF" desc="ارفع PDF فيه أسامي وبيانات (من برنامج HR قديم، شيت مطبوع، أي ملف). الـ AI بيستخرج كل صف ويعرضه عليك للتأكيد قبل الحفظ." cta="جرّب على /dashboard/employees/import" />
          <AICard icon="🤖" title="مساعد الموارد البشرية" desc="اسأل بالعربي: 'ضريبة الدخل على مرتب 8000 كام؟' أو 'مين أحسن موظف الشهر ده؟' — مدرّب على قانون العمل + بياناتك." cta="جرّب على /dashboard/ai" />
          <AICard icon="🎯" title="ترشيح أسئلة مقابلة" desc="بناءً على الـ JD والمرشح، الـ AI بيولّد أسئلة technical + behavioral مفصّلة، كل واحدة بسبب فني واضح." cta="ضمن فحص الـ CV" />
          <AICard icon="✦" title="٦ أدوات تسويق AI (Enterprise)" desc="محلل منتج + باني personas + كاتب إعلانات + ماستر SEO + معالج حملات + Page Doctor — وكالة Big4 جواه نظامك." cta="شوف القسم اللي تحت ↓" />
          <AICard icon="🏠" title="Landing Pages + Lead Capture (Enterprise)" desc="صفحات هبوط بتجمع leads تلقائياً مع UTM tracking كامل. Pipeline Kanban بـ drag-and-drop يخلّيك تتابع كل lead لحد ما يبقى عميل." cta="ضمن استوديو التسويق" />
        </div>
        <div className="mt-10 p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4 max-w-4xl mx-auto">
          <div className="text-2xl">🔒</div>
          <div className="text-sm text-slate-700 font-cairo leading-relaxed">
            <b>الخصوصية + Resilience:</b> بياناتك بتروح Groq أو Gemini للمعالجة بس — مش بتُستخدم training data، مفيش رفع تلقائي لأي طرف ثالث. والـ multi-provider fallback معناه إن لو حد منهم وقع، النظام تلقائياً يستخدم التاني — مفيش downtime.
          </div>
        </div>
      </div>
    </section>
  );
}
