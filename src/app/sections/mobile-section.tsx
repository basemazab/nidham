import { MobileAppQR } from "@/components/mobile-app-qr";
import { MobileFeature } from "./section-helpers";

export function MobileSection() {
  return (
    <section className="px-6 py-20 bg-gradient-to-br from-brand-navy to-slate-900 text-white">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan text-xs font-bold mb-4 font-cairo">
            📱 تطبيق منفصل للموظفين
          </div>
          <h2 className="text-3xl md:text-4xl font-black font-cairo mb-4 leading-tight">موظفك في جيبه نِظام كامل</h2>
          <p className="text-lg text-slate-300 mb-6 leading-relaxed font-cairo">
            بدل ما يتصل بـ HR كل مرة، يقدر من تطبيق Nidham للموظفين على الأندرويد والـ iOS:
          </p>
          <ul className="space-y-3 mb-8">
            <MobileFeature text="يثبّت حضور وانصراف من موقعه (GPS)" />
            <MobileFeature text="يطلب إجازة / سلفة / استئذان في ثوانٍ" />
            <MobileFeature text="يشوف رصيد إجازاته السنوية الحالي" />
            <MobileFeature text="يحمّل قسائم مرتباته الشهرية" />
            <MobileFeature text="يستلم إشعار الموافقة على طلباته" />
          </ul>
          <div className="text-sm text-slate-400 font-cairo">
            ✓ كود QR من صفحة الموظف بيفتح التطبيق بالكود تلقائيًا — مفيش تعقيد.
          </div>
        </div>
        <div className="flex justify-center">
          <div className="max-w-sm w-full">
            <MobileAppQR variant="card" />
          </div>
        </div>
      </div>
    </section>
  );
}
