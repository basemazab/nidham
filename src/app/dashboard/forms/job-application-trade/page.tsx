// ============================================================================
// /dashboard/forms/job-application-trade — Job Application for trades/manual
// ============================================================================
//
// Targeted at production / craft workers (نجار، حداد، سباك، فني، عامل
// إنتاج). Simpler than the admin application — drops sections that
// don't apply (formal degrees, foreign languages, computer skills) and
// emphasizes hands-on experience + health + safety.

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

const TRADES = [
  "نجار",
  "حداد",
  "سباك",
  "كهربائي",
  "ميكانيكي",
  "خراط",
  "لحام",
  "نقاش",
  "محارة",
  "بلاط ورخام",
  "ألوميتال",
  "WPC أبواب",
  "حدادة معمارية",
  "حدادة مسلحة",
  "تركيب مكيفات",
  "صيانة عامة",
];

export default async function JobAppTradePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await resolveFormContext({
    employeeId: null,
    formTypeCode: "APT",
  });

  return (
    <FormShell
      title="طلب توظيف — وظائف حرفية"
      filename={`job-application-trade-${ctx.today}`}
    >
      <FormLetterhead
        company={ctx.company}
        reference={ctx.reference}
        date={ctx.today}
        subtitle="طلب توظيف للوظائف الحرفية والإنتاج"
      />

      <div className="px-12 py-8 font-cairo">
        <div className="flex items-start gap-6 mb-6">
          <div className="flex-1">
            <h1 className="text-xl font-black text-slate-900 mb-2 border-b-2 border-slate-200 pb-2">
              طلب توظيف للعمال والحرفيين
            </h1>
            <p className="text-sm text-slate-500 mb-4">
              Trade / Production Job Application
            </p>
            <div className="text-xs leading-relaxed text-slate-700 bg-amber-50 border border-amber-200 rounded p-3">
              <strong>قبل التعبئة:</strong> لو ما تقدرش تقرا أو تكتب،
              مفيش مشكلة — احنا هنساعدك في تعبئة الطلب. قول للموظف الي
              قدامك تفاصيلك وهو يعبيها.
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
          <FieldBox label="السن" />
          <FieldBox label="محل الميلاد" />
          <FieldBox label="الديانة (اختياري)" />
          <FieldBox label="الحالة الاجتماعية" />
          <FieldBox label="عدد الأولاد" />
          <FieldBox label="الموقف من التجنيد" />
          <FieldBox label="رقم الموبايل" mono />
        </div>
        <FieldLine label="العنوان (المنطقة / الشارع / علامة مميزة)" rows={2} />

        {/* Trade */}
        <SectionTitle number="٢" title="الحرفة" />
        <div className="text-xs text-slate-600 font-cairo mb-2">
          الحرفة الأساسية:
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-4">
          {TRADES.map((t) => (
            <CheckBox key={t} label={t} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <FieldBox label="حرفة أخرى" />
          <FieldBox label="درجة المهارة (مبتدئ / متوسط / محترف / معلم)" />
        </div>

        {/* Education */}
        <SectionTitle number="٣" title="التعليم (إن وُجد)" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
          <FieldBox label="آخر مرحلة تعليمية" />
          <FieldBox label="سنة الترك / التخرج" />
          <FieldBox label="هل تعرف القراءة والكتابة؟" />
          <FieldBox label="هل عندك رخصة قيادة؟ نوعها؟" />
        </div>

        {/* Work history */}
        <SectionTitle number="٤" title="أعمال سابقة" />
        <p className="text-[11px] text-slate-500 font-cairo mb-3">
          اكتب الأعمال الأهم اللي اشتغلت فيها (مش لازم بترتيب)
        </p>
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="border border-slate-300 rounded-lg p-3 mb-3 bg-slate-50/40"
          >
            <div className="text-[10px] font-bold text-slate-500 mb-2 tracking-wider">
              العمل #{n}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <FieldBox label="جهة العمل / صاحب العمل" />
              <FieldBox label="نوع الشغل" />
              <FieldBox label="مدة العمل" />
              <FieldBox label="آخر مرتب" />
              <div className="col-span-2">
                <FieldBox label="سبب ترك الشغل" />
              </div>
            </div>
          </div>
        ))}

        {/* Tools & Health */}
        <SectionTitle number="٥" title="العدّة والصحة" />
        <div className="mb-4">
          <div className="text-xs text-slate-600 font-cairo mb-2">
            هل عندك عدتك الشخصية؟
          </div>
          <div className="flex gap-6">
            <CheckBox label="نعم — كاملة" />
            <CheckBox label="نعم — جزئية" />
            <CheckBox label="لا" />
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs text-slate-600 font-cairo mb-2">
            هل تعمل في ارتفاعات؟
          </div>
          <div className="flex gap-6">
            <CheckBox label="نعم" />
            <CheckBox label="لا" />
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs text-slate-600 font-cairo mb-2">
            هل عندك أي حالة صحية تمنعك من العمل البدني؟
          </div>
          <div className="flex gap-6 mb-2">
            <CheckBox label="نعم" />
            <CheckBox label="لا" />
          </div>
          <FieldLine label="لو نعم، اشرح بإيجاز" rows={2} />
        </div>

        {/* Position applied for */}
        <SectionTitle number="٦" title="الوظيفة المطلوبة" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
          <FieldBox label="الوظيفة" />
          <FieldBox label="الراتب المطلوب" />
          <FieldBox label="هل تقبل العمل بنظام الإنتاج / القطعة؟" />
          <FieldBox label="هل تقبل الانتقال خارج المحافظة؟" />
          <FieldBox label="تاريخ الاستعداد للعمل" />
          <FieldBox label="ساعات العمل المفضّلة" />
        </div>

        {/* Emergency contact */}
        <SectionTitle number="٧" title="جهة الاتصال في الطوارئ" />
        <div className="grid grid-cols-3 gap-x-6 gap-y-3 mb-6">
          <FieldBox label="الاسم" />
          <FieldBox label="صلة القرابة" />
          <FieldBox label="رقم الموبايل" mono />
        </div>

        {/* Declaration */}
        <SectionTitle number="٨" title="إقرار" />
        <p className="text-xs leading-relaxed text-slate-700 mb-4">
          أقرّ أنا الموقّع أدناه بأن كل المعلومات اللي كتبتها صحيحة. لو
          الشركة لقت أي معلومة غير صحيحة بعد التعيين، يحق ليها تنهي
          التعاقد فوراً. كمان أوافق على إن الشركة تتأكد من بياناتي وتسأل
          عني من أصحاب الأعمال السابقين.
        </p>

        {/* Signature / fingerprint */}
        <div className="grid grid-cols-2 gap-x-6 mt-8">
          <div>
            <div className="text-xs font-bold text-slate-700 font-cairo mb-2">
              توقيع / بصمة المتقدم
            </div>
            <div className="border-2 border-slate-400 rounded h-20 flex items-center justify-center text-[10px] text-slate-400 font-cairo">
              (توقيع أو بصمة الإبهام)
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-700 font-cairo mb-2">
              التاريخ
            </div>
            <div className="border-b-2 border-slate-400 h-12" />
            <div className="text-xs font-bold text-slate-700 font-cairo mt-4 mb-2">
              توقيع المسؤول
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
