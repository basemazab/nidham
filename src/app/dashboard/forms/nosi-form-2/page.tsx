// ============================================================================
// /dashboard/forms/nosi-form-2 — استمارة 2 تأمينات (تعديل أجر)
// ============================================================================
//
// Filed with NOSI when an employee's insurable wage changes (annual
// raise, promotion, bonus restructuring, etc.). Triggers a recompute
// of their social insurance contributions starting the effective date.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveFormContext, formatArabicDate } from "@/lib/forms";
import { FormShell } from "@/components/forms/form-shell";
import { FormLetterhead } from "@/components/forms/form-letterhead";
import {
  SectionTitle,
  FieldBox,
  SignatureBlock,
  StampPlaceholder,
  FormFooter,
} from "@/components/forms/form-pieces";
import { formatEGP } from "@/lib/format";

type SearchParams = Promise<{ employeeId?: string }>;

export default async function NosiForm2Page({
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
    formTypeCode: "NOSI-2",
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
      title="استمارة 2 تأمينات — تعديل أجر"
      filename={`nosi-form-2-${emp?.full_name ?? "blank"}-${ctx.today}`}
      preFilledFor={emp?.full_name ?? null}
      blankHref="/dashboard/forms/nosi-form-2"
    >
      <FormLetterhead
        company={ctx.company}
        reference={ctx.reference}
        date={ctx.today}
        subtitle="استمارة (2) — تعديل بيانات الأجر التأميني"
      />

      <div className="px-10 py-8 font-cairo">
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-slate-900 border-b-4 border-double border-slate-400 inline-block pb-1 px-6">
            استمارة (2) تأمينات اجتماعية
          </h2>
          <p className="text-xs text-slate-500 mt-2">
            تُسلم لمكتب التأمينات خلال 14 يوم من تاريخ التعديل
          </p>
        </div>

        <SectionTitle number={1} title="بيانات صاحب العمل" />
        <div className="grid grid-cols-12 gap-3 mb-4">
          <FieldBox label="اسم المنشأة" value={ctx.company?.name} width="full" />
          <FieldBox label="رقم الملف التأميني" width="half" />
          <FieldBox label="مكتب التأمينات التابع له" width="half" />
        </div>

        <SectionTitle number={2} title="بيانات العامل" />
        <div className="grid grid-cols-12 gap-3 mb-4">
          <FieldBox label="اسم العامل" value={emp?.full_name} width="full" />
          <FieldBox label="الرقم القومي" width="half" dir="ltr" />
          <FieldBox label="رقم التأمين الاجتماعي" width="half" dir="ltr" />
          <FieldBox
            label="المسمى الوظيفي"
            value={emp?.job_title}
            width="half"
          />
          <FieldBox
            label="تاريخ بدء العمل"
            value={emp?.hire_date ? formatArabicDate(emp.hire_date) : null}
            width="half"
          />
        </div>

        <SectionTitle number={3} title="الأجر التأميني — قبل التعديل" />
        <div className="grid grid-cols-12 gap-3 mb-4">
          <FieldBox label="الأجر الأساسي السابق" width="third" dir="ltr" />
          <FieldBox label="البدلات المنتظمة السابقة" width="third" dir="ltr" />
          <FieldBox label="الإجمالي السابق" width="third" dir="ltr" />
        </div>

        <SectionTitle number={4} title="الأجر التأميني — بعد التعديل" />
        <div className="grid grid-cols-12 gap-3 mb-4">
          <FieldBox
            label="الأجر الأساسي الجديد"
            value={emp?.basic_salary ? formatEGP(emp.basic_salary) : null}
            width="third"
            dir="ltr"
          />
          <FieldBox
            label="البدلات المنتظمة الجديدة"
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
            label="الإجمالي الجديد"
            value={emp ? formatEGP(total) : null}
            width="third"
            dir="ltr"
          />
        </div>

        <SectionTitle number={5} title="تفاصيل التعديل" />
        <div className="grid grid-cols-12 gap-3 mb-6">
          <FieldBox label="تاريخ سريان التعديل" width="half" />
          <FieldBox label="سبب التعديل (ترقية / علاوة / إعادة هيكلة...)" width="half" />
        </div>

        <div className="text-sm leading-loose mb-8 text-justify">
          نقر بصحة جميع البيانات المذكورة أعلاه ، ونرفق صورة من
          المستندات المؤيدة لها (قرار الترقية / العلاوة / إعادة الهيكلة).
        </div>

        <div className="grid grid-cols-2 gap-10 mt-8 items-end">
          <SignatureBlock role="المسؤول المالي / مدير الموارد البشرية" />
          <div className="flex justify-center">
            <StampPlaceholder size="lg" />
          </div>
        </div>
      </div>

      {ctx.company && <FormFooter company={ctx.company} />}
    </FormShell>
  );
}
