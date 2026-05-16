// ============================================================================
// /dashboard/forms/job-application-admin — Job Application for office roles
// ============================================================================
//
// Targeted at administrative/office candidates. Captures education,
// languages, computer skills, work history, references — the same info
// a recruiter would pull from a CV but on a structured form.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveFormContext } from "@/lib/forms";
import { FormShell } from "@/components/forms/form-shell";
import { FormLetterhead } from "@/components/forms/form-letterhead";
import {
  SectionTitle,
  FormFooter,
  FieldLine,
  CheckBox,
  PhotoPlaceholder,
} from "@/components/forms/form-pieces";

export default async function JobAppAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await resolveFormContext({
    employeeId: null,
    formTypeCode: "APP",
  });

  return (
    <FormShell
      title="طلب توظيف — وظائف إدارية"
      filename={`job-application-admin-${ctx.today}`}
    >
      <FormLetterhead
        company={ctx.company}
        reference={ctx.reference}
        date={ctx.today}
        subtitle="طلب التقدم لشغل وظيفة إدارية"
      />

      <div className="px-12 py-8 font-cairo">
        <div className="flex items-start gap-6 mb-6">
          <div className="flex-1">
            <h1 className="text-xl font-black text-slate-900 mb-2 border-b-2 border-slate-200 pb-2">
              طلب توظيف
            </h1>
            <p className="text-sm text-slate-500 mb-4">
              للوظائف الإدارية والمكتبية · Administrative Job Application
            </p>
            <div className="text-xs leading-relaxed text-slate-700 bg-amber-50 border border-amber-200 rounded p-3">
              <strong>تعليمات:</strong> يرجى تعبئة جميع الحقول بخط واضح
              ومقروء. الحقول المتروكة فارغة قد تؤخر النظر في طلبك. أرفق صورة
              من البطاقة + المؤهل الدراسي + شهادات الخبرة السابقة.
            </div>
          </div>
          <PhotoPlaceholder />
        </div>

        {/* Personal */}
        <SectionTitle number="١" title="البيانات الشخصية" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
          <FieldBox label="الاسم رباعي" />
          <FieldBox label="الرقم القومي" mono />
          <FieldBox label="تاريخ الميلاد" />
          <FieldBox label="محل الميلاد" />
          <FieldBox label="الجنسية" />
          <FieldBox label="الديانة (اختياري)" />
          <FieldBox label="الحالة الاجتماعية" />
          <FieldBox label="الموقف من التجنيد (ذكور)" />
          <FieldBox label="رقم الموبايل" mono />
          <FieldBox label="بريد إلكتروني" mono />
        </div>
        <FieldLine label="العنوان بالتفصيل" rows={2} />

        {/* Education */}
        <SectionTitle number="٢" title="المؤهلات الدراسية" />
        <div className="border border-slate-300 rounded-lg overflow-hidden mb-6">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 font-bold text-slate-600 font-cairo">
                  المؤهل
                </th>
                <th className="px-3 py-2 font-bold text-slate-600 font-cairo">
                  التخصص
                </th>
                <th className="px-3 py-2 font-bold text-slate-600 font-cairo">
                  الجهة المانحة
                </th>
                <th className="px-3 py-2 font-bold text-slate-600 font-cairo">
                  سنة التخرج
                </th>
                <th className="px-3 py-2 font-bold text-slate-600 font-cairo">
                  التقدير
                </th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((n) => (
                <tr key={n} className="border-t border-slate-200">
                  <td className="px-3 py-3 border-b-2 border-dotted border-slate-300 h-10" />
                  <td className="px-3 py-3 border-b-2 border-dotted border-slate-300 h-10" />
                  <td className="px-3 py-3 border-b-2 border-dotted border-slate-300 h-10" />
                  <td className="px-3 py-3 border-b-2 border-dotted border-slate-300 h-10" />
                  <td className="px-3 py-3 border-b-2 border-dotted border-slate-300 h-10" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Languages */}
        <SectionTitle number="٣" title="اللغات" />
        <div className="grid grid-cols-3 gap-3 mb-6">
          <FieldBox label="اللغة الأم" />
          <FieldBox label="لغة ثانية + المستوى" />
          <FieldBox label="لغة ثالثة + المستوى" />
        </div>

        {/* Computer skills */}
        <SectionTitle number="٤" title="مهارات الحاسب الآلي" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
          <CheckBox label="Microsoft Word" />
          <CheckBox label="Microsoft Excel" />
          <CheckBox label="Microsoft PowerPoint" />
          <CheckBox label="Outlook / Email" />
          <CheckBox label="ERP / محاسبة" />
          <CheckBox label="Photoshop / تصميم" />
          <CheckBox label="برمجة / تحليل بيانات" />
          <CheckBox label="مهارات الإنترنت والبحث" />
          <CheckBox label="أخرى: ............................" />
        </div>

        {/* Work history */}
        <SectionTitle number="٥" title="الخبرات السابقة (الأحدث أولاً)" />
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="border border-slate-300 rounded-lg p-3 mb-3 bg-slate-50/40"
          >
            <div className="text-[10px] font-bold text-slate-500 mb-2 tracking-wider">
              الوظيفة #{n}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <FieldBox label="اسم الشركة" />
              <FieldBox label="مجال النشاط" />
              <FieldBox label="المسمى الوظيفي" />
              <FieldBox label="مدة العمل (من / إلى)" />
              <div className="col-span-2">
                <FieldLine label="أهم المهام والمسؤوليات" rows={2} />
              </div>
              <div className="col-span-2">
                <FieldBox label="سبب ترك العمل" />
              </div>
            </div>
          </div>
        ))}

        {/* Position applied for */}
        <SectionTitle number="٦" title="الوظيفة المتقدم لها" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
          <FieldBox label="الوظيفة المطلوبة" />
          <FieldBox label="الراتب المتوقع" />
          <FieldBox label="تاريخ الاستعداد للعمل" />
          <FieldBox label="مكان العمل المفضل" />
        </div>
        <FieldLine
          label="ما هي نقاط قوتك التي تجعلك مرشحاً مناسباً لهذه الوظيفة؟"
          rows={3}
        />

        {/* References */}
        <SectionTitle number="٧" title="معرّفون (Reference)" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
          <FieldBox label="الاسم 1" />
          <FieldBox label="الموبايل" mono />
          <FieldBox label="الصلة" />
          <FieldBox label="جهة العمل" />
          <FieldBox label="الاسم 2" />
          <FieldBox label="الموبايل" mono />
          <FieldBox label="الصلة" />
          <FieldBox label="جهة العمل" />
        </div>

        {/* Declaration */}
        <SectionTitle number="٨" title="إقرار" />
        <p className="text-xs leading-relaxed text-slate-700 mb-4">
          أقرّ أنا الموقّع/ة أدناه بأن كل البيانات المدوّنة في هذا الطلب
          صحيحة، وأتحمّل المسؤولية القانونية الكاملة عن أي معلومة غير
          صحيحة. كما أقرّ بأن للشركة الحق في التحقق من أي بيانات أوردتها،
          ولها حق رفض الطلب أو إنهاء التعاقد لاحقاً في حالة ثبوت عدم صحة
          البيانات.
        </p>
        <div className="grid grid-cols-2 gap-x-6 mt-8">
          <div>
            <div className="text-xs font-bold text-slate-700 font-cairo mb-2">
              توقيع المتقدم/ة
            </div>
            <div className="border-b-2 border-slate-400 h-12" />
            <div className="text-xs text-slate-500 font-cairo text-center mt-1">
              (الاسم والتوقيع)
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-700 font-cairo mb-2">
              التاريخ
            </div>
            <div className="border-b-2 border-slate-400 h-12" />
          </div>
        </div>
      </div>

      <FormFooter company={ctx.company} />
    </FormShell>
  );
}

function FieldBox({ label, mono = false }: { label: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 font-cairo mb-1">{label}</div>
      <div
        className={`border-b-2 border-slate-300 pb-1 min-h-[1.5rem] ${
          mono ? "font-mono text-sm" : "font-cairo"
        }`}
        dir={mono ? "ltr" : "rtl"}
      />
    </div>
  );
}
