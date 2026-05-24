// ============================================================================
// /dashboard/forms/nosi-form-1 — استمارة 1 تأمينات (تسجيل عامل)
// ============================================================================
//
// NOSI's worker-registration form. Used when a new hire joins —
// submitted to the local NOSI office within 7 days of the hire date.
// We don't recreate the gov form pixel-perfectly (that would require
// the official PDF + scanning every revision); instead we lay the data
// out in the same SECTIONS the official form uses, so HR can copy
// values onto the official paper or transcribe to the NOSI portal.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveFormContext, formatArabicDate } from "@/lib/forms";
import { FormShell } from "@/components/forms/form-shell";
import { FormLetterhead } from "@/components/forms/form-letterhead";
import {
  SectionTitle,
  FieldBox,
  CheckBox,
  SignatureBlock,
  StampPlaceholder,
  FormFooter,
} from "@/components/forms/form-pieces";
import { formatEGP } from "@/lib/format";

type SearchParams = Promise<{ employeeId?: string }>;

export default async function NosiForm1Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const ctx = await resolveFormContext({
    employeeId: sp.employeeId,
    formTypeCode: "NOSI-1",
  });
  const emp = ctx.employee;
  const total =
    (emp?.basic_salary ?? 0) +
    (emp?.housing_allowance ?? 0) +
    (emp?.transport_allowance ?? 0) +
    (emp?.other_allowances ?? 0) +
    (emp?.incentive_allowance ?? 0);

  return (
    <FormShell
      title="استمارة 1 تأمينات — تسجيل عامل"
      filename={`nosi-form-1-${emp?.full_name ?? "blank"}-${ctx.today}`}
      preFilledFor={emp?.full_name ?? null}
      blankHref="/dashboard/forms/nosi-form-1"
    >
      <FormLetterhead
        company={ctx.company}
        reference={ctx.reference}
        date={ctx.today}
        subtitle="استمارة (1) — قيد العامل في التأمين الاجتماعي · قانون 148/2019"
      />

      <div className="px-10 py-8 font-cairo">
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-slate-900 border-b-4 border-double border-slate-400 inline-block pb-1 px-6">
            استمارة (1) تأمينات اجتماعية
          </h2>
          <p className="text-xs text-slate-500 mt-2">
            تُسلم للهيئة القومية للتأمين الاجتماعي خلال 7 أيام من تاريخ التحاق العامل
          </p>
        </div>

        {/* Section 1: Employer */}
        <SectionTitle number={1} title="بيانات صاحب العمل (المنشأة)" />
        <div className="grid grid-cols-12 gap-3 mb-4">
          <FieldBox label="اسم المنشأة" value={ctx.company?.name} width="full" />
          <FieldBox label="النشاط" value={ctx.company?.industry} width="half" />
          <FieldBox label="رقم الملف التأميني" width="half" />
          <FieldBox label="مكتب التأمينات التابع له" width="half" />
          <FieldBox label="رقم السجل التجاري" width="half" />
          <FieldBox label="عنوان المنشأة" width="full" />
        </div>

        {/* Section 2: Employee */}
        <SectionTitle number={2} title="بيانات العامل" />
        <div className="grid grid-cols-12 gap-3 mb-4">
          <FieldBox label="اسم العامل بالكامل" value={emp?.full_name} width="full" />
          <FieldBox label="اسم الأم" width="half" />
          <FieldBox label="الرقم القومي (14 رقم)" width="half" dir="ltr" />
          <FieldBox label="رقم التأمين الاجتماعي" width="half" dir="ltr" />
          <FieldBox label="تاريخ الميلاد" width="half" />
          <FieldBox label="محل الميلاد" width="half" />
          <FieldBox label="الديانة" width="quarter" />
          <FieldBox label="الجنس" width="quarter" />
          <FieldBox label="الحالة الاجتماعية" width="half" />
          <FieldBox label="عنوان السكن" width="full" />
          <FieldBox label="التليفون" value={emp?.phone} width="half" dir="ltr" />
          <FieldBox label="البريد الإلكتروني" value={emp?.email} width="half" dir="ltr" />
        </div>

        {/* Section 3: Employment */}
        <SectionTitle number={3} title="بيانات الالتحاق بالعمل" />
        <div className="grid grid-cols-12 gap-3 mb-4">
          <FieldBox
            label="تاريخ بدء العمل"
            value={emp?.hire_date ? formatArabicDate(emp.hire_date) : null}
            width="half"
          />
          <FieldBox label="المسمى الوظيفي" value={emp?.job_title} width="half" />
          <FieldBox label="القسم / الإدارة" value={emp?.department} width="half" />
          <FieldBox label="الكود التأميني للمهنة" width="half" />
        </div>

        {/* Section 4: Wages */}
        <SectionTitle number={4} title="بيانات الأجر التأميني (شهري)" />
        <div className="grid grid-cols-12 gap-3 mb-4">
          <FieldBox
            label="الأجر الأساسي"
            value={emp?.basic_salary ? formatEGP(emp.basic_salary) : null}
            width="third"
            dir="ltr"
          />
          <FieldBox
            label="بدلات منتظمة"
            value={
              emp
                ? formatEGP(
                    (emp.housing_allowance ?? 0) +
                      (emp.transport_allowance ?? 0) +
                      (emp.other_allowances ?? 0) +
                      (emp.incentive_allowance ?? 0),
                  )
                : null
            }
            width="third"
            dir="ltr"
          />
          <FieldBox
            label="الإجمالي الشهري"
            value={emp ? formatEGP(total) : null}
            width="third"
            dir="ltr"
          />
        </div>

        {/* Section 5: Family */}
        <SectionTitle number={5} title="المعالون (الأسرة)" />
        <table className="w-full text-sm border-2 border-slate-700 mb-4">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-700">
              <th className="px-2 py-1.5 text-right font-bold w-10">م</th>
              <th className="px-2 py-1.5 text-right font-bold">الاسم</th>
              <th className="px-2 py-1.5 text-right font-bold w-32">صلة القرابة</th>
              <th className="px-2 py-1.5 text-right font-bold w-32">تاريخ الميلاد</th>
              <th className="px-2 py-1.5 text-right font-bold w-36">الرقم القومي</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-slate-300">
                <td className="px-2 py-2 text-slate-400">{i + 1}</td>
                <td className="px-2 py-2">&nbsp;</td>
                <td className="px-2 py-2">&nbsp;</td>
                <td className="px-2 py-2">&nbsp;</td>
                <td className="px-2 py-2">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Declaration */}
        <SectionTitle number={6} title="إقرار العامل" />
        <div className="text-sm leading-loose mb-6 text-justify">
          أقر أنا /{" "}
          <strong className="underline">
            {emp?.full_name ?? "............................"}
          </strong>{" "}
          ، صحة كافة البيانات الموضحة أعلاه ، وأتعهد بإخطار الهيئة القومية
          للتأمين الاجتماعي فوراً بأي تعديل يطرأ عليها.
        </div>

        <div className="flex flex-wrap gap-6 mb-8">
          <CheckBox label="مرفق صورة بطاقة الرقم القومي" />
          <CheckBox label="مرفق شهادة الميلاد" />
          <CheckBox label="مرفق المؤهل الدراسي" />
          <CheckBox label="مرفق نموذج 1 (إفادة الموقف من التجنيد)" />
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 mt-10 items-end">
          <SignatureBlock role="توقيع العامل" />
          <SignatureBlock role="مدير الموارد البشرية" />
          <div className="flex justify-center items-end h-full">
            <StampPlaceholder size="lg" />
          </div>
        </div>
      </div>

      {ctx.company && <FormFooter company={ctx.company} />}
    </FormShell>
  );
}
