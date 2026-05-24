// ============================================================================
// /dashboard/forms/salary-certificate — شهادة راتب
// ============================================================================
//
// Compact salary-only certificate. Banks + embassies ask for this to
// verify monthly income before approving loans / visas. Distinct from
// hr-letter (which is a general-purpose letter that also mentions
// salary in prose) — this one shows the breakdown in a TABLE, which
// is what bank credit officers expect.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  resolveFormContext,
  totalCompensation,
  formatArabicDate,
} from "@/lib/forms";
import { FormShell } from "@/components/forms/form-shell";
import { FormLetterhead } from "@/components/forms/form-letterhead";
import {
  SignatureBlock,
  StampPlaceholder,
  FormFooter,
} from "@/components/forms/form-pieces";
import { formatEGP } from "@/lib/format";

type SearchParams = Promise<{ employeeId?: string; purpose?: string }>;

export default async function SalaryCertificatePage({
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
    formTypeCode: "SAL-CERT",
  });
  const emp = ctx.employee;
  const total = totalCompensation(emp);
  const purpose = sp.purpose ?? "general";
  const purposeLabel = purpose === "bank"
    ? "إلى السادة بنك .........................."
    : purpose === "embassy"
      ? "إلى سفارة .........................."
      : "إلى من يهمه الأمر";

  return (
    <FormShell
      title="شهادة راتب"
      filename={`salary-certificate-${emp?.full_name ?? "blank"}-${ctx.today}`}
      preFilledFor={emp?.full_name ?? null}
      blankHref="/dashboard/forms/salary-certificate"
    >
      <FormLetterhead
        company={ctx.company}
        reference={ctx.reference}
        date={ctx.today}
        subtitle="شهادة راتب صادرة من إدارة الموارد البشرية والمالية"
      />

      <div className="px-12 py-10 font-cairo">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-slate-900 border-b-4 border-double border-slate-400 inline-block pb-2 px-8">
            شهادة راتب
          </h2>
        </div>

        <div className="mb-6">
          <div className="text-base font-bold text-slate-800 mb-1">
            {purposeLabel}
          </div>
          <div className="text-sm text-slate-600">تحية طيبة وبعد ،</div>
        </div>

        <p className="text-base leading-loose text-slate-800 mb-6 text-justify">
          نشهد نحن{" "}
          <strong className="underline">
            شركة {ctx.company?.name ?? "............................"}
          </strong>{" "}
          ، بأن السيد /{" "}
          <strong className="underline">
            {emp?.full_name ?? "............................................"}
          </strong>{" "}
          ، يعمل لدينا منذ{" "}
          <strong>
            {emp?.hire_date
              ? formatArabicDate(emp.hire_date)
              : "....../....../......"}
          </strong>{" "}
          ، بوظيفة{" "}
          <strong className="underline">
            {emp?.job_title ?? ".........................."}
          </strong>
          {emp?.department ? ` بقسم ${emp.department}` : ""} ، براتب
          شهري إجمالي قدره <strong>{formatEGP(total)}</strong> ، وفقاً
          للتفصيل التالي:
        </p>

        {/* Salary breakdown table */}
        <table className="w-full text-sm border-2 border-slate-700 mb-8">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-700">
              <th className="px-4 py-2 text-right font-bold">البند</th>
              <th className="px-4 py-2 text-left font-bold w-40">
                المبلغ (ج.م)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-300">
              <td className="px-4 py-2">الراتب الأساسي</td>
              <td className="px-4 py-2 text-left font-mono">
                {formatEGP(emp?.basic_salary ?? 0)}
              </td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="px-4 py-2">بدل السكن</td>
              <td className="px-4 py-2 text-left font-mono">
                {formatEGP(emp?.housing_allowance ?? 0)}
              </td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="px-4 py-2">بدل الانتقال</td>
              <td className="px-4 py-2 text-left font-mono">
                {formatEGP(emp?.transport_allowance ?? 0)}
              </td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="px-4 py-2">بدلات أخرى</td>
              <td className="px-4 py-2 text-left font-mono">
                {formatEGP(emp?.other_allowances ?? 0)}
              </td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="px-4 py-2">حافز شهري</td>
              <td className="px-4 py-2 text-left font-mono">
                {formatEGP(emp?.incentive_allowance ?? 0)}
              </td>
            </tr>
            <tr className="bg-slate-100 border-t-2 border-slate-700 font-black">
              <td className="px-4 py-2">الإجمالي الشهري</td>
              <td className="px-4 py-2 text-left font-mono">
                {formatEGP(total)}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="text-base leading-loose text-slate-800 mb-10 text-justify">
          وقد تم تحرير هذه الشهادة بناءً على طلب صاحب الشأن دون أدنى
          مسؤولية على الشركة.
        </p>

        <div className="grid grid-cols-2 gap-10 mt-12 items-end">
          <SignatureBlock role="المدير المالي / مدير الموارد البشرية" />
          <div className="flex justify-center">
            <StampPlaceholder size="lg" />
          </div>
        </div>
      </div>

      {ctx.company && <FormFooter company={ctx.company} />}
    </FormShell>
  );
}
