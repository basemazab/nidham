import { SectionHeader } from "./section-helpers";

export function HowItWorksSection() {
  const steps = [
    { n: "١", title: "سجّل شركتك", desc: "إيميل + كلمة سر + اسم الشركة. 30 ثانية. 14 يوم تجربة مجانًا." },
    { n: "٢", title: "ارفع موظفيك", desc: "Excel أو CSV أو PDF بالـ AI. أو ضيفهم واحد واحد. النظام بيمنت رصيد إجازاتهم تلقائيًا." },
    { n: "٣", title: "ابعت لهم كود الـ QR", desc: "كل موظف بيصوّر الكود من جيبه، التطبيق بيتفتح ومسجّل دخوله. يبدأ يثبّت حضور." },
    { n: "٤", title: "اعمل أول payroll", desc: "اضغط زرار. النظام بيحسب التأمينات والضرائب والسلف. وقّع وابعت." },
    { n: "٥", title: "أطلق أول حملة تسويق", desc: "(Enterprise) خلّي الـ AI يصمم حملة + landing page + يجيب الـ leads أوتوماتيك في الـ CRM." },
  ];
  return (
    <section className="px-6 py-20 bg-gradient-to-b from-cyan-50/30 to-white">
      <div className="max-w-6xl mx-auto">
        <SectionHeader eyebrow="بداية سهلة" title="من التسجيل لأول راتب + أول حملة — في يوم واحد" />
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {steps.map((s, i) => (
            <div key={s.n} className={`relative bg-white border rounded-2xl p-6 hover:shadow-lg transition ${i === 4 ? "border-amber-300" : "border-slate-200"}`}>
              <div className={`absolute -top-4 right-6 w-10 h-10 rounded-full text-white font-black text-lg flex items-center justify-center shadow-lg font-display ${i === 4 ? "bg-gradient-to-br from-amber-500 to-rose-500" : "bg-gradient-to-br from-brand-cyan to-brand-cyan-dark"}`}>
                {s.n}
              </div>
              <h3 className="font-black text-slate-800 mt-3 mb-2 font-cairo">{s.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-cairo">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
