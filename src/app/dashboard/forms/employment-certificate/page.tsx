// ============================================================================
// /dashboard/forms/employment-certificate — شهادة عمل
// ============================================================================
//
// Official "still employed here" certificate. Distinct from hr-letter
// in that it's a more compact, formal document specifically meant for
// government/court/embassy submission — not bank loans (use hr-letter
// for those because they want salary on the same page).
//
// Pre-fills from ?employeeId=. Blank mode also works for "hand-write
// later" cases.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveFormContext, formatArabicDate } from "@/lib/forms";
import { FormShell } from "@/components/forms/form-shell";
import { FormLetterhead } from "@/components/forms/form-letterhead";
import {
  SignatureBlock,
  StampPlaceholder,
  FormFooter,
} from "@/components/forms/form-pieces";

type SearchParams = Promise<{ employeeId?: string }>;

export default async function EmploymentCertificatePage({
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
    formTypeCode: "EMP-CERT",
  });
  const emp = ctx.employee;

  const tenureLabel = emp?.hire_date ? computeTenure(emp.hire_date) : null;

  return (
    <FormShell
      title="شهادة عمل"
      filename={`employment-certificate-${emp?.full_name ?? "blank"}-${ctx.today}`}
      preFilledFor={emp?.full_name ?? null}
      blankHref="/dashboard/forms/employment-certificate"
    >
      <FormLetterhead
        company={ctx.company}
        reference={ctx.reference}
        date={ctx.today}
        subtitle="شهادة عمل صادرة من إدارة الموارد البشرية"
      />

      <div className="px-12 py-10 font-cairo">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-black text-slate-900 border-b-4 border-double border-slate-400 inline-block pb-2 px-8">
            شهادة عمل
          </h2>
        </div>

        <p className="text-base leading-loose text-slate-800 mb-6 text-justify">
          نشهد نحن{" "}
          <strong className="underline">
            شركة {ctx.company?.name ?? "............................"}
          </strong>{" "}
          بأن السيد /{" "}
          <strong className="underline">
            {emp?.full_name ?? "...................................................."}
          </strong>{" "}
          ، يعمل لدينا منذ تاريخ{" "}
          <strong>
            {emp?.hire_date
              ? formatArabicDate(emp.hire_date)
              : "....../....../......"}
          </strong>{" "}
          {tenureLabel ? `(مدة العمل: ${tenureLabel})` : ""} ، ويشغل
          وظيفة{" "}
          <strong className="underline">
            {emp?.job_title ?? ".........................."}
          </strong>
          {emp?.department ? ` بقسم ${emp.department}` : ""} ، ولا
          يزال على رأس العمل حتى تاريخه.
        </p>

        <p className="text-base leading-loose text-slate-800 mb-10 text-justify">
          وقد تم تحرير هذه الشهادة بناءً على طلب صاحب الشأن لاستخدامها
          في الأغراض القانونية والإدارية التي يحتاجها — ولا تترتب
          عليها أي التزامات مالية على الشركة.
        </p>

        <div className="grid grid-cols-2 gap-10 mt-16 items-end">
          <SignatureBlock role="مدير الموارد البشرية" />
          <div className="flex justify-center">
            <StampPlaceholder size="lg" />
          </div>
        </div>
      </div>

      {ctx.company && <FormFooter company={ctx.company} />}
    </FormShell>
  );
}

function computeTenure(hireDate: string): string {
  const hire = new Date(hireDate + "T00:00:00");
  const now = new Date();
  const months = Math.max(
    0,
    (now.getFullYear() - hire.getFullYear()) * 12 +
      (now.getMonth() - hire.getMonth()),
  );
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${months} شهر`;
  if (rem === 0) return `${years} سنة`;
  return `${years} سنة و${rem} شهر`;
}
