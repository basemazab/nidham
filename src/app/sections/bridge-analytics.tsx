import Link from "next/link";
import { SectionHeader, Quote, TableRow } from "./section-helpers";

export function BridgeAnalyticsSection() {
  return (
    <section className="px-6 py-20 bg-gradient-to-br from-brand-navy via-slate-900 to-brand-navy text-white relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 opacity-20"
        style={{ backgroundImage: "radial-gradient(circle at 70% 30%, rgba(34,211,238,0.6), transparent 50%)" }}
      />
      <div className="max-w-5xl mx-auto relative">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-xs font-bold mb-4 font-cairo">
              ✦ الميزة اللي مفيش حد عاملها
            </div>
            <h2 className="text-3xl md:text-4xl font-black font-cairo mb-4 leading-tight">
              Bridge Analytics<br />
              <span className="text-brand-cyan">التزام × إنتاجية = صورة الموظف الحقيقية</span>
            </h2>
            <p className="text-lg text-slate-300 mb-6 leading-relaxed font-cairo">
              معظم الأنظمة بتقولك &quot;محمد ملتزم 95%&quot; — وخلاص. نِظام بيوصّل بيانات الحضور بـ بيانات الـ CRM ويقولك:
            </p>
            <div className="space-y-3 mb-6">
              <Quote text="محمد حضور 95% بس عمل 3 تفاعلات إيجابية بس الشهر ده. ملتزم — مش منتج." />
              <Quote text="أحمد حضور 75%، عمل 22 تفاعل، 8 صفقات Active. منتج — حتى لو متأخر يومين." />
            </div>
            <p className="text-sm text-slate-400 font-cairo">
              ده الفرق بين موظف &quot;بيتجوّز شغل&quot; وموظف &quot;بيدفع لشركتك تنمو&quot;.
            </p>
          </div>
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <div className="text-xs text-slate-400 mb-3 font-cairo">تقرير Bridge — يونيو 2026</div>
            <table className="w-full text-xs md:text-sm font-cairo">
              <thead className="border-b border-slate-700 text-slate-400">
                <tr>
                  <th className="text-right py-2">الموظف</th>
                  <th className="text-center py-2">حضور</th>
                  <th className="text-center py-2">تفاعلات</th>
                  <th className="text-center py-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                <TableRow name="أحمد محمد" attendance="75%" interactions="22" status="ممتاز" good />
                <TableRow name="محمد علي" attendance="95%" interactions="3" status="مراجعة" warn />
                <TableRow name="سارة حسن" attendance="88%" interactions="15" status="جيد" good />
                <TableRow name="عمر إبراهيم" attendance="60%" interactions="0" status="خطر" bad />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
