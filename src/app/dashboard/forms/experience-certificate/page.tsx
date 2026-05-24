// ============================================================================
// /dashboard/forms/experience-certificate — شهادة خبرة (ex-employees)
// ============================================================================
//
// Issued AFTER the employee has left. Lists their start + end dates,
// final position, and a short professional-conduct line. Distinct from
// /dashboard/forms/employment-certificate which says "still working" —
// this one says "worked here from X to Y".
//
// Best loaded with ?employeeId=<former-employee-uuid> so it pulls
// termination_date for the end date.

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

export default async function ExperienceCertificatePage({
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
    formTypeCode: "EXP-CERT",
  });
  const emp = ctx.employee;

  // For an experience cert we also want termination_date — not in
  // FormEmployee, fetch it directly.
  let terminationDate: string | null = null;
  if (sp.employeeId) {
    const { data } = await supabase
      .from("employees")
      .select("termination_date")
      .eq("id", sp.employeeId)
      .maybeSingle<{ termination_date: string | null }>();
    terminationDate = data?.termination_date ?? null;
  }

  return (
    <FormShell
      title="شهادة خبرة"
      filename={`experience-certificate-${emp?.full_name ?? "blank"}-${ctx.today}`}
      preFilledFor={emp?.full_name ?? null}
      blankHref="/dashboard/forms/experience-certificate"
    >
      <FormLetterhead
        company={ctx.company}
        reference={ctx.reference}
        date={ctx.today}
        subtitle="شهادة خبرة صادرة من إدارة الموارد البشرية"
      />

      <div className="px-12 py-10 font-cairo">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-black text-slate-900 border-b-4 border-double border-slate-400 inline-block pb-2 px-8">
            شهادة خبرة
          </h2>
        </div>

        <p className="text-base leading-loose text-slate-800 mb-6 text-justify">
          نشهد نحن{" "}
          <strong className="underline">
            شركة {ctx.company?.name ?? "............................"}
          </strong>{" "}
          ، بأن السيد /{" "}
          <strong className="underline">
            {emp?.full_name ?? "...................................................."}
          </strong>{" "}
          ، قد عمل لدينا في الفترة من{" "}
          <strong>
            {emp?.hire_date
              ? formatArabicDate(emp.hire_date)
              : "....../....../......"}
          </strong>{" "}
          وحتى{" "}
          <strong>
            {terminationDate
              ? formatArabicDate(terminationDate)
              : "....../....../......"}
          </strong>{" "}
          ، حيث شغل وظيفة{" "}
          <strong className="underline">
            {emp?.job_title ?? ".........................."}
          </strong>
          {emp?.department ? ` بقسم ${emp.department}` : ""} ، وأظهر
          خلال فترة عمله كفاءة عالية وانضباطاً تاماً في أداء مهامه.
        </p>

        <p className="text-base leading-loose text-slate-800 mb-10 text-justify">
          ونؤكد أن المسمى الوظيفي المذكور أعلاه هو وصف دقيق للمهام
          التي قام بها أثناء فترة عمله، وأنه قد ترك العمل بناءً على
          رغبته الشخصية / بانتهاء العقد ، ولا توجد عليه أي مستحقات
          مالية أو إدارية للشركة حتى تاريخه.
        </p>

        <p className="text-base leading-loose text-slate-800 mb-12 text-justify">
          وقد منحت له هذه الشهادة بناءً على طلبه لتقديمها لمن يهمه
          الأمر ، متمنين له التوفيق والنجاح في مستقبله المهني.
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
