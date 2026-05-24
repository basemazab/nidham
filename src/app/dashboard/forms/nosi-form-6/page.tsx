// ============================================================================
// /dashboard/forms/nosi-form-6 — استمارة 6 تأمينات (إخطار ترك الخدمة)
// ============================================================================
//
// Filed with NOSI within 7 days of an employee's last day. Marks the
// end of their insurance period so accumulated benefits start
// flowing. Required to release the worker's "النموذج 6" so they can
// take it to their next employer (who needs it to add them).

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

export default async function NosiForm6Page({
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
    formTypeCode: "NOSI-6",
  });
  const emp = ctx.employee;

  // Pull termination_date + eos_gratuity directly (not in FormEmployee).
  type TerminationRow = {
    termination_date: string | null;
    termination_reason: string | null;
    eos_gratuity: number | null;
  };
  let termination: TerminationRow | null = null;
  if (sp.employeeId) {
    const { data } = await supabase
      .from("employees")
      .select("termination_date, termination_reason, eos_gratuity")
      .eq("id", sp.employeeId)
      .maybeSingle<TerminationRow>();
    termination = data ?? null;
  }

  return (
    <FormShell
      title="استمارة 6 تأمينات — ترك الخدمة"
      filename={`nosi-form-6-${emp?.full_name ?? "blank"}-${ctx.today}`}
      preFilledFor={emp?.full_name ?? null}
      blankHref="/dashboard/forms/nosi-form-6"
    >
      <FormLetterhead
        company={ctx.company}
        reference={ctx.reference}
        date={ctx.today}
        subtitle="استمارة (6) — إخطار بترك الخدمة وانتهاء التأمين"
      />

      <div className="px-10 py-8 font-cairo">
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-slate-900 border-b-4 border-double border-slate-400 inline-block pb-1 px-6">
            استمارة (6) تأمينات اجتماعية
          </h2>
          <p className="text-xs text-slate-500 mt-2">
            تُسلم لمكتب التأمينات خلال 7 أيام من تاريخ ترك الخدمة
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
            label="المسمى الوظيفي عند ترك الخدمة"
            value={emp?.job_title}
            width="half"
          />
          <FieldBox
            label="تاريخ بدء العمل"
            value={emp?.hire_date ? formatArabicDate(emp.hire_date) : null}
            width="half"
          />
        </div>

        <SectionTitle number={3} title="بيانات ترك الخدمة" />
        <div className="grid grid-cols-12 gap-3 mb-4">
          <FieldBox
            label="آخر يوم عمل"
            value={
              termination?.termination_date
                ? formatArabicDate(termination.termination_date)
                : null
            }
            width="half"
          />
          <FieldBox
            label="مدة الخدمة الكلية"
            value={
              emp?.hire_date && termination?.termination_date
                ? computeServiceLength(emp.hire_date, termination.termination_date)
                : null
            }
            width="half"
          />
        </div>

        {/* Reason checkboxes */}
        <div className="mb-4">
          <div className="text-sm font-bold text-slate-700 mb-2">
            سبب ترك الخدمة:
          </div>
          <div className="grid grid-cols-3 gap-3">
            <CheckBox
              label="استقالة"
              checked={termination?.termination_reason?.includes("استقالة") ?? false}
            />
            <CheckBox
              label="انتهاء عقد"
              checked={termination?.termination_reason?.includes("انتهاء") ?? false}
            />
            <CheckBox
              label="فصل"
              checked={termination?.termination_reason?.includes("فصل") ?? false}
            />
            <CheckBox label="بلوغ سن المعاش" />
            <CheckBox label="عجز" />
            <CheckBox label="وفاة" />
          </div>
          {termination?.termination_reason && (
            <div className="mt-3 text-xs text-slate-600 italic">
              تفاصيل: {termination.termination_reason}
            </div>
          )}
        </div>

        <SectionTitle number={4} title="المستحقات النهائية" />
        <table className="w-full text-sm border-2 border-slate-700 mb-6">
          <tbody>
            <tr className="border-b border-slate-300">
              <td className="px-3 py-2 w-72 font-bold">
                مكافأة نهاية الخدمة
              </td>
              <td className="px-3 py-2 text-left font-mono">
                {termination?.eos_gratuity
                  ? formatEGP(termination.eos_gratuity)
                  : "............................"}
              </td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="px-3 py-2 font-bold">
                رصيد الإجازات المستحق
              </td>
              <td className="px-3 py-2 text-left font-mono">
                ............................
              </td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="px-3 py-2 font-bold">آخر مرتب شهري</td>
              <td className="px-3 py-2 text-left font-mono">
                {emp?.basic_salary ? formatEGP(emp.basic_salary) : "..............."}
              </td>
            </tr>
            <tr className="bg-slate-50 border-t-2 border-slate-700">
              <td className="px-3 py-2 font-black">إجمالي المستحقات</td>
              <td className="px-3 py-2 text-left font-mono font-black">
                ............................
              </td>
            </tr>
          </tbody>
        </table>

        <div className="text-sm leading-loose mb-8 text-justify">
          نقر بصحة البيانات المذكورة أعلاه ، ونرفق صورة من{" "}
          <strong>مخالصة العامل</strong> و{" "}
          <strong>قرار إنهاء الخدمة</strong> الصادر من الإدارة.
        </div>

        <div className="grid grid-cols-3 gap-8 mt-8 items-end">
          <SignatureBlock role="العامل" />
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

function computeServiceLength(hire: string, end: string): string {
  const a = new Date(hire + "T00:00:00");
  const b = new Date(end + "T00:00:00");
  const months = Math.max(
    0,
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()),
  );
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} شهر`;
  if (m === 0) return `${y} سنة`;
  return `${y} سنة و${m} شهر`;
}
