// ============================================================================
// /dashboard/forms/offer-letter — Employment Offer Letter (خطاب تعيين)
// ============================================================================
//
// Sent to a successful candidate BEFORE the formal contract is signed.
// Confirms position, start date, salary, benefits, and probation period.
// Once countersigned by the candidate, it serves as a soft commitment.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveFormContext, totalCompensation, formatArabicDate } from "@/lib/forms";
import { FormShell } from "@/components/forms/form-shell";
import { FormLetterhead } from "@/components/forms/form-letterhead";
import {
  SignatureBlock,
  SectionTitle,
  FormFooter,
  CheckBox,
} from "@/components/forms/form-pieces";
import { formatEGP } from "@/lib/format";

type SearchParams = Promise<{ employeeId?: string }>;

export default async function OfferLetterPage({
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
    formTypeCode: "OFF",
  });
  const emp = ctx.employee;
  const totalComp = totalCompensation(emp);

  return (
    <FormShell
      title="خطاب تعيين موظف"
      filename={`offer-letter-${emp?.full_name ?? "blank"}-${ctx.today}`}
      preFilledFor={emp?.full_name ?? null}
      blankHref="/dashboard/forms/offer-letter"
    >
      <FormLetterhead
        company={ctx.company}
        reference={ctx.reference}
        date={ctx.today}
        subtitle="خطاب تعيين رسمي"
      />

      <div className="px-12 py-8 font-cairo">
        {/* Recipient */}
        <div className="mb-6">
          <div className="text-base font-bold text-slate-800 mb-1">
            السيد/ة:{" "}
            <span className="border-b border-slate-300 px-2">
              {emp?.full_name ?? "................................"}
            </span>
          </div>
          <div className="text-sm text-slate-600 mt-2">
            تحية طيبة وبعد،
          </div>
        </div>

        <h1 className="text-center text-xl font-black text-slate-900 mb-2 border-b-2 border-slate-200 pb-2">
          خطاب تعيين
        </h1>
        <p className="text-center text-xs text-slate-500 mb-6">
          Employment Offer Letter
        </p>

        {/* Opening paragraph */}
        <p className="text-base leading-loose text-slate-800 mb-6 text-justify">
          يسعدنا في شركة <strong>{ctx.company.name}</strong> أن نتقدم لكم
          بهذا العرض الرسمي للالتحاق بالعمل لدينا، تقديراً لخبراتكم ومؤهلاتكم،
          واستناداً لمقابلتكم الشخصية التي تمت معكم، نوافق على تعيينكم
          بالشروط والأحكام التالية:
        </p>

        {/* Section 1: Position */}
        <SectionTitle number="١" title="بيانات الوظيفة" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6">
          <Detail label="المسمى الوظيفي" value={emp?.job_title ?? "—"} />
          <Detail label="القسم / الإدارة" value={emp?.department ?? "—"} />
          <Detail
            label="تاريخ بداية العمل"
            value={formatArabicDate(emp?.hire_date)}
          />
          <Detail label="فترة الاختبار" value="٣ شهور (المادة 33 من قانون العمل)" />
        </div>

        {/* Section 2: Compensation */}
        <SectionTitle number="٢" title="هيكل الراتب الشهري" />
        {totalComp > 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-right text-sm font-cairo">
              <tbody className="divide-y divide-slate-100">
                <SalaryRow label="الراتب الأساسي" value={emp?.basic_salary ?? 0} />
                {Number(emp?.housing_allowance) > 0 && (
                  <SalaryRow
                    label="بدل سكن"
                    value={emp?.housing_allowance ?? 0}
                  />
                )}
                {Number(emp?.transport_allowance) > 0 && (
                  <SalaryRow
                    label="بدل انتقال"
                    value={emp?.transport_allowance ?? 0}
                  />
                )}
                {Number(emp?.other_allowances) > 0 && (
                  <SalaryRow
                    label="بدلات أخرى"
                    value={emp?.other_allowances ?? 0}
                  />
                )}
                {Number(emp?.incentive_allowance) > 0 && (
                  <SalaryRow
                    label="حافز شهري"
                    value={emp?.incentive_allowance ?? 0}
                  />
                )}
                <tr className="bg-emerald-50">
                  <td className="px-4 py-3 font-black text-emerald-800 font-cairo">
                    إجمالي الراتب الشهري
                  </td>
                  <td className="px-4 py-3 font-black text-emerald-800 text-base font-cairo">
                    {formatEGP(totalComp)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-6 text-center">
            <p className="text-sm text-slate-500 font-cairo">
              الراتب: ............................................. ج/شهرياً
            </p>
          </div>
        )}

        {/* Section 3: Work conditions */}
        <SectionTitle number="٣" title="شروط العمل" />
        <ul className="space-y-2 text-sm text-slate-700 mb-6 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-amber-500 shrink-0">▪</span>
            <span>
              <strong>أيام العمل:</strong> من الأحد إلى الخميس / من السبت إلى الخميس
              (حسب لائحة العمل بالشركة)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 shrink-0">▪</span>
            <span>
              <strong>ساعات العمل:</strong> 8 ساعات يومياً (48 ساعة أسبوعياً) — المادة 80 من قانون العمل
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 shrink-0">▪</span>
            <span>
              <strong>الإجازة السنوية:</strong> 21 يوم/سنة بعد إتمام سنة كاملة (المادة 47)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 shrink-0">▪</span>
            <span>
              <strong>التأمينات الاجتماعية:</strong> حسب قانون التأمينات 148/2019
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 shrink-0">▪</span>
            <span>
              <strong>التقارير المباشرة:</strong> تتبع إلى ............................
            </span>
          </li>
        </ul>

        {/* Section 4: Acceptance */}
        <SectionTitle number="٤" title="قبول العرض" />
        <p className="text-sm leading-relaxed text-slate-700 mb-3">
          يُرجى التوقيع على هذا الخطاب في موعد أقصاه أسبوع من تاريخ
          استلامه، علماً بأن قبولكم يعتبر إقراراً بالموافقة على الشروط
          الواردة أعلاه.
        </p>
        <div className="flex flex-col gap-2 mb-8">
          <CheckBox label="أوافق على الشروط الواردة في هذا الخطاب وأقبل التعيين" />
          <CheckBox label="ألتزم بحضور أوراق التعيين كاملة في اليوم المتفق عليه" />
        </div>

        <p className="text-sm leading-relaxed text-slate-700 mb-10">
          نتطلع لانضمامكم لفريق العمل ولمسيرة مهنية ناجحة معنا،،
        </p>

        {/* Two signatures */}
        <div className="grid grid-cols-2 gap-12">
          <SignatureBlock role="المدير / المسؤول" name={null} showStamp />
          <SignatureBlock role="الموظف (قبول العرض)" name={emp?.full_name ?? null} />
        </div>
      </div>

      <FormFooter company={ctx.company} />
    </FormShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <div className="text-[11px] text-slate-500 font-cairo mb-0.5">
        {label}
      </div>
      <div className="font-bold text-slate-800 font-cairo border-b border-slate-300 pb-0.5">
        {value || "—"}
      </div>
    </div>
  );
}

function SalaryRow({ label, value }: { label: string; value: number }) {
  return (
    <tr>
      <td className="px-4 py-2.5 text-slate-700 font-cairo">{label}</td>
      <td className="px-4 py-2.5 font-bold text-slate-800 font-cairo">
        {formatEGP(value)}
      </td>
    </tr>
  );
}
