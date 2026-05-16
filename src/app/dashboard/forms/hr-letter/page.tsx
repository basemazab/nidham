// ============================================================================
// /dashboard/forms/hr-letter — "To Whom It May Concern" HR letter
// ============================================================================
//
// The single most-requested HR document — an employee needs it when
// applying for a bank loan, a visa, a school admission, or a government
// service. Confirms the employee's position, salary, and tenure on
// official letterhead.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveFormContext, totalCompensation, formatArabicDate } from "@/lib/forms";
import { FormShell } from "@/components/forms/form-shell";
import { FormLetterhead } from "@/components/forms/form-letterhead";
import {
  SignatureBlock,
  StampPlaceholder,
  FormFooter,
} from "@/components/forms/form-pieces";
import { formatEGP } from "@/lib/format";

type SearchParams = Promise<{ employeeId?: string; purpose?: string }>;

const PURPOSES = [
  { key: "bank", label: "إلى البنك" },
  { key: "embassy", label: "إلى السفارة" },
  { key: "government", label: "إلى الجهة الحكومية" },
  { key: "school", label: "إلى المدرسة / الجامعة" },
  { key: "general", label: "إلى من يهمه الأمر" },
];

export default async function HrLetterPage({
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
    formTypeCode: "HR",
  });

  const purposeKey = sp.purpose ?? "general";
  const purpose = PURPOSES.find((p) => p.key === purposeKey) ?? PURPOSES[4];

  const emp = ctx.employee;
  const totalComp = totalCompensation(emp);

  // Compute tenure if hire_date is available
  let tenureLabel: string | null = null;
  if (emp?.hire_date) {
    const hire = new Date(emp.hire_date + "T00:00:00");
    const now = new Date();
    const months = Math.max(
      0,
      (now.getFullYear() - hire.getFullYear()) * 12 +
        (now.getMonth() - hire.getMonth()),
    );
    const years = Math.floor(months / 12);
    const rem = months % 12;
    tenureLabel =
      years === 0
        ? `${months} شهر`
        : rem === 0
          ? `${years} سنة`
          : `${years} سنة و${rem} شهر`;
  }

  return (
    <FormShell
      title="خطاب موارد بشرية"
      filename={`hr-letter-${emp?.full_name ?? "blank"}-${ctx.today}`}
      preFilledFor={emp?.full_name ?? null}
      blankHref="/dashboard/forms/hr-letter"
    >
      <FormLetterhead
        company={ctx.company}
        reference={ctx.reference}
        date={ctx.today}
        subtitle="خطاب رسمي صادر من إدارة الموارد البشرية"
      />

      {/* Body */}
      <div className="px-12 py-8 font-cairo">
        {/* Recipient */}
        <div className="mb-8">
          <div className="text-base font-bold text-slate-800 mb-1">
            {purpose.label}:
          </div>
          <div className="text-sm text-slate-600">
            تحية طيبة وبعد،
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-center text-xl font-black text-slate-900 mb-6 border-b-2 border-slate-200 pb-2">
          إفادة بالعمل والمرتب
        </h1>

        {/* The actual paragraph */}
        <p className="text-base leading-loose text-slate-800 mb-6 text-justify">
          تشهد إدارة الموارد البشرية بشركة{" "}
          <strong className="text-slate-900">
            {ctx.company.name}
          </strong>{" "}
          أن السيد/ة{" "}
          <strong className="text-slate-900 border-b border-slate-300 px-1">
            {emp?.full_name ?? "................................"}
          </strong>{" "}
          يعمل لدينا بوظيفة{" "}
          <strong className="text-slate-900 border-b border-slate-300 px-1">
            {emp?.job_title ?? "............................"}
          </strong>
          {emp?.department && (
            <>
              {" "}بقسم{" "}
              <strong className="text-slate-900 border-b border-slate-300 px-1">
                {emp.department}
              </strong>
            </>
          )}
          {emp?.hire_date && (
            <>
              {" "}منذ تاريخ{" "}
              <strong className="text-slate-900 border-b border-slate-300 px-1" dir="ltr">
                {formatArabicDate(emp.hire_date)}
              </strong>
              {tenureLabel && (
                <>
                  {" "}(بإجمالي خدمة{" "}
                  <strong className="text-slate-900">{tenureLabel}</strong>
                  )
                </>
              )}
            </>
          )}
          {totalComp > 0 && (
            <>
              {" "}ويتقاضى راتباً إجمالياً قدره{" "}
              <strong className="text-slate-900 border-b border-slate-300 px-1">
                {formatEGP(totalComp)}
              </strong>{" "}
              شهرياً، تشمل الراتب الأساسي والبدلات.
            </>
          )}
          {!totalComp && " ."}
        </p>

        <p className="text-base leading-loose text-slate-800 mb-8 text-justify">
          وقد صدر هذا الخطاب بناءً على طلب الموظف/ة لتقديمه للجهة المذكورة
          أعلاه، ولا يحق استخدامه لأي غرض آخر دون موافقة مكتوبة من الشركة.
        </p>

        {/* Employee snapshot */}
        {emp && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-8">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              ملخص بيانات الموظف
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <Detail label="الاسم" value={emp.full_name} />
              <Detail
                label="كود الموظف"
                value={emp.employee_code ?? "—"}
                mono
              />
              <Detail label="الوظيفة" value={emp.job_title ?? "—"} />
              <Detail label="القسم" value={emp.department ?? "—"} />
              <Detail
                label="الرقم القومي"
                value={emp.national_id ?? "—"}
                mono
              />
              <Detail
                label="رقم التأمينات"
                value={emp.social_insurance_number ?? "—"}
                mono
              />
            </div>
          </div>
        )}

        <p className="text-sm leading-relaxed text-slate-700 mb-12">
          وتفضلوا بقبول وافر الاحترام والتقدير،،
        </p>

        {/* Signature + stamp */}
        <div className="grid grid-cols-2 gap-12 items-end">
          <SignatureBlock role="إدارة الموارد البشرية" name={null} />
          <div className="text-center">
            <div className="text-xs font-bold text-slate-700 font-cairo mb-3">
              ختم الشركة
            </div>
            <div className="flex justify-center">
              <StampPlaceholder size="md" />
            </div>
          </div>
        </div>
      </div>

      <FormFooter company={ctx.company} />
    </FormShell>
  );
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-slate-500 font-cairo shrink-0">
        {label}:
      </span>
      <span
        className={`font-bold text-slate-800 ${mono ? "font-mono text-xs" : "font-cairo"}`}
        dir={mono ? "ltr" : "rtl"}
      >
        {value}
      </span>
    </div>
  );
}
