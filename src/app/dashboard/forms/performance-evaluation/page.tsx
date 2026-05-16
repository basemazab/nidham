// ============================================================================
// /dashboard/forms/performance-evaluation — Annual Performance Review
// ============================================================================
//
// 7-criteria 5-point evaluation form covering attendance, productivity,
// quality, teamwork, initiative, technical skill, and customer focus.
// Includes free-form comment sections + manager recommendation + employee
// acknowledgment signature.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveFormContext, formatArabicDate } from "@/lib/forms";
import { FormShell } from "@/components/forms/form-shell";
import { FormLetterhead } from "@/components/forms/form-letterhead";
import {
  SignatureBlock,
  SectionTitle,
  RatingScale,
  FormFooter,
  FieldLine,
  CheckBox,
} from "@/components/forms/form-pieces";

type SearchParams = Promise<{ employeeId?: string; period?: string }>;

export default async function PerformanceEvalPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const ctx = await resolveFormContext({
    employeeId: sp.employeeId,
    formTypeCode: "EVL",
  });
  const emp = ctx.employee;
  const period = sp.period ?? new Date().getFullYear().toString();

  return (
    <FormShell
      title="نموذج تقييم أداء"
      filename={`evaluation-${emp?.full_name ?? "blank"}-${ctx.today}`}
      preFilledFor={emp?.full_name ?? null}
      blankHref="/dashboard/forms/performance-evaluation"
    >
      <FormLetterhead
        company={ctx.company}
        reference={ctx.reference}
        date={ctx.today}
        subtitle={`تقييم أداء سنوي · فترة التقييم: ${period}`}
      />

      <div className="px-12 py-8 font-cairo">
        <h1 className="text-center text-xl font-black text-slate-900 mb-2 border-b-2 border-slate-200 pb-2">
          نموذج تقييم الأداء السنوي
        </h1>
        <p className="text-center text-xs text-slate-500 mb-6">
          Annual Performance Evaluation
        </p>

        {/* Section: Employee info */}
        <SectionTitle number="١" title="بيانات الموظف" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
          <Field label="الاسم" value={emp?.full_name} />
          <Field label="كود الموظف" value={emp?.employee_code} mono />
          <Field label="المسمى الوظيفي" value={emp?.job_title} />
          <Field label="القسم" value={emp?.department} />
          <Field
            label="تاريخ التعيين"
            value={formatArabicDate(emp?.hire_date)}
          />
          <Field label="فترة التقييم" value={period} />
        </div>

        {/* Section: Rating scale legend */}
        <SectionTitle number="٢" title="معايير التقييم" />
        <p className="text-xs text-slate-600 mb-3 font-cairo leading-relaxed">
          ضع دائرة حول الرقم الذي يعكس مستوى الموظف في كل معيار:
          <br />
          <strong>1</strong> = ضعيف · <strong>2</strong> = أقل من المتوقع ·{" "}
          <strong>3</strong> = جيد · <strong>4</strong> = جيد جداً ·{" "}
          <strong>5</strong> = ممتاز
        </p>

        <div className="border-2 border-slate-300 rounded-lg overflow-hidden mb-6">
          <div className="bg-slate-50 px-3 py-2 grid grid-cols-12 gap-2 border-b-2 border-slate-300">
            <div className="col-span-7 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              المعيار
            </div>
            <div className="col-span-5 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-center">
              التقييم (1-5)
            </div>
          </div>
          <div className="px-3">
            <RatingScale
              label="الالتزام بمواعيد العمل"
              description="الحضور في الميعاد، الانصراف بعد إنهاء المطلوب"
            />
            <RatingScale
              label="جودة العمل"
              description="الدقة، الإتقان، خلو الأخطاء"
            />
            <RatingScale
              label="السرعة والإنتاجية"
              description="إنجاز المهام في الوقت المحدد"
            />
            <RatingScale
              label="التعاون مع الفريق"
              description="العمل الجماعي، روح المساعدة"
            />
            <RatingScale
              label="المبادرة وحل المشكلات"
              description="الاستباق، تقديم حلول جديدة"
            />
            <RatingScale
              label="المهارات الفنية / التقنية"
              description="إتقان أدوات العمل المتعلقة بوظيفته"
            />
            <RatingScale
              label="التعامل مع العملاء / الزملاء"
              description="الاحترام، اللباقة، حل النزاعات بهدوء"
            />
          </div>
        </div>

        {/* Free-form sections */}
        <SectionTitle number="٣" title="نقاط القوة" />
        <FieldLine label="ما الذي يتميز به الموظف خلال فترة التقييم؟" rows={3} />

        <SectionTitle number="٤" title="نقاط التطوير" />
        <FieldLine label="ما الذي يحتاج الموظف لتطويره؟" rows={3} />

        <SectionTitle number="٥" title="الإنجازات الأبرز" />
        <FieldLine label="مشاريع أو مساهمات بارزة في فترة التقييم" rows={3} />

        <SectionTitle number="٦" title="التوصية النهائية" />
        <div className="grid grid-cols-2 gap-3 mb-6">
          <CheckBox label="ترقية / زيادة" />
          <CheckBox label="استمرار العمل بنفس الوضع" />
          <CheckBox label="تدريب وتطوير" />
          <CheckBox label="إنذار / مراجعة الأداء" />
        </div>

        <FieldLine label="ملاحظات إضافية من المدير المباشر" rows={2} />

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 mt-10">
          <SignatureBlock role="المدير المباشر" />
          <SignatureBlock role="مدير الموارد البشرية" />
          <SignatureBlock role="الموظف (إقرار بالاطلاع)" name={emp?.full_name ?? null} />
        </div>

        <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 font-cairo leading-relaxed">
          <strong>إقرار:</strong> أقرّ أنا الموظع/ة الموقّع/ة أدناه بأنني
          اطلعت على هذا التقييم وأن المسؤولين ناقشوني فيه. توقيعي لا يعني
          بالضرورة موافقتي على كل بنوده.
        </div>
      </div>

      <FormFooter company={ctx.company} />
    </FormShell>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] text-slate-500 font-cairo mb-1">{label}</div>
      <div
        className={`border-b-2 border-slate-300 pb-1 font-bold text-slate-800 min-h-[1.5rem] ${
          mono ? "font-mono text-sm" : "font-cairo"
        }`}
        dir={mono ? "ltr" : "rtl"}
      >
        {value || (
          <span className="text-slate-300">..........................</span>
        )}
      </div>
    </div>
  );
}
