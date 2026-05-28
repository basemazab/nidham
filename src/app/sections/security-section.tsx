import { SectionHeader } from "./section-helpers";

export function SecuritySection() {
  const points = [
    { icon: "🛡", title: "Multi-tenant RLS", desc: "كل شركة معزولة على مستوى الـ DB. مفيش طريقة لشركة تشوف بيانات شركة تانية حتى لو حاولت." },
    { icon: "👁", title: "Audit Log", desc: "كل تعديل في الموظفين / الرواتب / العقود متسجّل — مين عمله، إمتى، وإيه القيم قبل وبعد." },
    { icon: "🔐", title: "Role-based access", desc: "Admin / Manager / Employee — كل واحد بيشوف اللي يخصه فقط. PII (رقم قومي، بنك) للـ HR بس." },
    { icon: "📜", title: "متوافق قانونيًا", desc: "حسابات الضرائب والتأمينات بآخر تعديلات 2024، إجازات Article 47، نهاية الخدمة Article 122." },
  ];
  return (
    <section className="px-6 py-20 bg-white">
      <div className="max-w-6xl mx-auto">
        <SectionHeader eyebrow="🔒 الأمان" title="بياناتك أهم من بيانات بنكك" subtitle="منذ اليوم الأول: عزل tenants، تشفير، audit، وامتثال كامل لقانون العمل المصري." />
        <div className="grid md:grid-cols-4 gap-4">
          {points.map((p) => (
            <div key={p.title} className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
              <div className="text-3xl mb-3">{p.icon}</div>
              <h3 className="font-black text-slate-800 mb-2 font-cairo">{p.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-cairo">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
