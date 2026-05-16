// ============================================================================
// /dashboard/forms/investigation-memo — Investigation Memo (مذكرة تحقيق)
// ============================================================================
//
// Formal internal investigation record. Captures:
//   - Incident description
//   - Date / time / location
//   - Witnesses
//   - Q&A between investigator and employee
//   - Employee's free-form statement
//   - Investigator's conclusion + recommendation
//
// Required document for any disciplinary action under Egyptian Labour Law.
// Without it, a termination decision can be reversed in labour court.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveFormContext, formatArabicDate } from "@/lib/forms";
import { FormShell } from "@/components/forms/form-shell";
import { FormLetterhead } from "@/components/forms/form-letterhead";
import {
  SignatureBlock,
  SectionTitle,
  FormFooter,
  FieldLine,
  CheckBox,
} from "@/components/forms/form-pieces";

type SearchParams = Promise<{ employeeId?: string }>;

export default async function InvestigationMemoPage({
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
    formTypeCode: "INV",
  });
  const emp = ctx.employee;

  return (
    <FormShell
      title="مذكرة تحقيق"
      filename={`investigation-${emp?.full_name ?? "blank"}-${ctx.today}`}
      preFilledFor={emp?.full_name ?? null}
      blankHref="/dashboard/forms/investigation-memo"
    >
      <FormLetterhead
        company={ctx.company}
        reference={ctx.reference}
        date={ctx.today}
        subtitle="مذكرة تحقيق رسمية"
      />

      <div className="px-12 py-8 font-cairo">
        <h1 className="text-center text-xl font-black text-slate-900 mb-2 border-b-2 border-slate-200 pb-2">
          مذكرة تحقيق
        </h1>
        <p className="text-center text-xs text-slate-500 mb-6">
          Internal Investigation Memo
        </p>

        {/* Header info */}
        <SectionTitle number="١" title="بيانات التحقيق" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
          <Field label="تاريخ التحقيق" value={formatArabicDate(ctx.today)} />
          <Field label="مكان التحقيق" value="" />
          <Field label="اسم المحقق" value="" />
          <Field label="صفته الوظيفية" value="" />
        </div>

        {/* Employee details */}
        <SectionTitle number="٢" title="بيانات الموظف محل التحقيق" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
          <Field label="الاسم" value={emp?.full_name} />
          <Field label="كود الموظف" value={emp?.employee_code} mono />
          <Field label="المسمى الوظيفي" value={emp?.job_title} />
          <Field label="القسم" value={emp?.department} />
          <Field
            label="تاريخ التعيين"
            value={formatArabicDate(emp?.hire_date)}
          />
          <Field label="المدير المباشر" value="" />
        </div>

        {/* Incident */}
        <SectionTitle number="٣" title="موضوع التحقيق / الواقعة" />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="تاريخ الواقعة" value="" />
          <Field label="وقت الواقعة" value="" />
        </div>
        <FieldLine label="وصف تفصيلي للواقعة" rows={5} />

        <FieldLine label="أسماء الشهود (إن وُجدوا)" rows={2} />

        {/* Q&A */}
        <SectionTitle number="٤" title="أسئلة المحقق وإجابات الموظف" />
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="mb-4">
            <div className="text-xs font-bold text-slate-700 mb-1 font-cairo">
              السؤال {n}:
            </div>
            <div className="border-b-2 border-slate-300 h-7 mb-2" />
            <div className="text-xs font-bold text-slate-700 mb-1 font-cairo">
              الإجابة:
            </div>
            <div className="space-y-1">
              <div className="border-b border-slate-300 h-7" />
              <div className="border-b border-slate-300 h-7" />
            </div>
          </div>
        ))}

        {/* Employee statement */}
        <SectionTitle number="٥" title="إقرار الموظف وردّه" />
        <FieldLine label="ما يرغب الموظف في إضافته أو إقراره بشأن الواقعة" rows={5} />

        {/* Conclusion */}
        <SectionTitle number="٦" title="نتيجة التحقيق والتوصية" />
        <div className="mb-4 grid grid-cols-2 gap-3">
          <CheckBox label="حفظ التحقيق (لا توجد مخالفة)" />
          <CheckBox label="إنذار شفهي" />
          <CheckBox label="إنذار كتابي" />
          <CheckBox label="خصم من الراتب" />
          <CheckBox label="إيقاف عن العمل" />
          <CheckBox label="إنهاء العقد" />
        </div>
        <FieldLine label="التوصية النهائية ومبرراتها" rows={3} />

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 mt-10">
          <SignatureBlock role="المحقق" />
          <SignatureBlock role="مدير الموارد البشرية" showStamp />
          <SignatureBlock
            role="الموظف (إقرار بالاطلاع)"
            name={emp?.full_name ?? null}
          />
        </div>

        <div className="mt-6 p-3 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-800 font-cairo leading-relaxed">
          <strong>تنويه قانوني:</strong> هذه المذكرة محرّرة وفقاً للإجراءات
          التأديبية المنصوص عليها في قانون العمل المصري رقم 12 لسنة 2003.
          توقيع الموظف يفيد علمه بالواقعة، وليس بالضرورة موافقته على
          النتيجة.
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
