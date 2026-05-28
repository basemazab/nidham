import { MockupCard, SectionHeader } from "./section-helpers";
import { BridgeMockup, PayslipMockup, MobileAttendanceMockup, CvReviewMockup } from "./section-mockups";

export function LiveScreenshotsSection() {
  return (
    <section className="px-6 py-20 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="لقطات حقيقية من السيستم"
          title="شوف نِظام شغّال"
          subtitle="مش screenshots محسّنة بالـ Photoshop — دي شاشات فعلية من المنتج، مرسومة بالـ SVG علشان تشوف الـ UX قبل ما تجرّب."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MockupCard caption="Bridge Analytics — لوحة قياس الالتزام × الإنتاجية لكل موظف">
            <BridgeMockup />
          </MockupCard>
          <MockupCard caption="قسيمة الراتب — حساب تلقائي للتأمينات (14%) + الضريبة (شرائح 2024)">
            <PayslipMockup />
          </MockupCard>
          <MockupCard caption="تطبيق الموبايل — حضور بالـ GPS مع Geofence حول المكتب">
            <MobileAttendanceMockup />
          </MockupCard>
          <MockupCard caption="فحص CVs بالـ AI — score من 100 + أسئلة مقابلة جاهزة">
            <CvReviewMockup />
          </MockupCard>
        </div>
      </div>
    </section>
  );
}
