// ============================================================================
// /dashboard/forms/employment-contract — Employment Contract (عقد عمل)
// ============================================================================
//
// Full legal employment contract aligned with the Egyptian Labour Law
// 12/2003. Two-page layout in practice:
//   - Page 1: Parties + position + compensation
//   - Page 2: Hours/leave/obligations/termination clauses + signatures
//
// Heavy text — but every clause references the relevant law article so
// HR (and the employee) can verify the legal basis.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  resolveFormContext,
  totalCompensation,
  formatArabicDate,
  numberToArabicWords,
} from "@/lib/forms";
import { FormShell } from "@/components/forms/form-shell";
import { FormLetterhead } from "@/components/forms/form-letterhead";
import {
  SignatureBlock,
  SectionTitle,
  FormFooter,
} from "@/components/forms/form-pieces";
import { formatEGP } from "@/lib/format";

type SearchParams = Promise<{ employeeId?: string }>;

export default async function EmploymentContractPage({
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
    formTypeCode: "CON",
  });
  const emp = ctx.employee;
  const totalComp = totalCompensation(emp);

  return (
    <FormShell
      title="عقد عمل"
      filename={`contract-${emp?.full_name ?? "blank"}-${ctx.today}`}
      preFilledFor={emp?.full_name ?? null}
      blankHref="/dashboard/forms/employment-contract"
    >
      <FormLetterhead
        company={ctx.company}
        reference={ctx.reference}
        date={ctx.today}
        subtitle="عقد عمل وفقاً لقانون العمل المصري رقم 12 لسنة 2003"
      />

      <div className="px-12 py-8 font-cairo text-slate-800">
        <h1 className="text-center text-2xl font-black mb-2">
          عقد عمل
        </h1>
        <p className="text-center text-xs text-slate-500 mb-1">
          Employment Contract
        </p>
        <p className="text-center text-[11px] text-slate-500 mb-6">
          (نموذج مطابق للائحة التنفيذية للقانون رقم 12 لسنة 2003)
        </p>

        {/* Preamble */}
        <p className="text-sm leading-loose mb-4 text-justify">
          إنه في يوم{" "}
          <strong className="border-b border-slate-300 px-1" dir="ltr">
            {formatArabicDate(ctx.today)}
          </strong>{" "}
          الموافق ........................... تم الاتفاق بين كل من:
        </p>

        {/* Party 1: Employer */}
        <div className="border-2 border-slate-300 rounded-lg p-4 mb-4">
          <div className="text-[10px] font-bold text-amber-700 tracking-wider mb-2 uppercase">
            الطرف الأول — صاحب العمل
          </div>
          <div className="text-sm leading-relaxed">
            شركة{" "}
            <strong className="border-b border-slate-300 px-1">
              {ctx.company.name}
            </strong>
            {" "}— وعنوانها{" "}
            <span className="border-b border-slate-300 px-1">
              ..................................................
            </span>
            {" "}ويمثلها في التوقيع على هذا العقد السيد/ة{" "}
            <span className="border-b border-slate-300 px-1">
              ..............................
            </span>
            {" "}بصفته/ا{" "}
            <span className="border-b border-slate-300 px-1">
              .........................
            </span>
            {" "}(ويُشار إليه فيما بعد بـ <strong>&quot;صاحب العمل&quot;</strong>)
          </div>
        </div>

        {/* Party 2: Employee */}
        <div className="border-2 border-slate-300 rounded-lg p-4 mb-6">
          <div className="text-[10px] font-bold text-amber-700 tracking-wider mb-2 uppercase">
            الطرف الثاني — العامل
          </div>
          <div className="text-sm leading-relaxed">
            السيد/ة{" "}
            <strong className="border-b border-slate-300 px-1">
              {emp?.full_name ?? "................................"}
            </strong>
            {" "}— رقم البطاقة القومية{" "}
            <strong className="font-mono border-b border-slate-300 px-1" dir="ltr">
              {emp?.national_id ?? "..............."}
            </strong>
            {" "}الصادرة في .............. — ومحل الإقامة{" "}
            <span className="border-b border-slate-300 px-1">
              ..............................................
            </span>
            {" "}(ويُشار إليه فيما بعد بـ <strong>&quot;العامل&quot;</strong>)
          </div>
        </div>

        <p className="text-sm leading-loose mb-6 text-justify">
          وحيث إن صاحب العمل يحتاج إلى تعيين عامل لشغل وظيفة{" "}
          <strong className="border-b border-slate-300 px-1">
            {emp?.job_title ?? "....................."}
          </strong>
          ، وقد رغب الطرف الثاني (العامل) في الانضمام إلى الشركة، فقد اتفق
          الطرفان وهما بكامل الأهلية المعتبرة شرعاً وقانوناً على ما يلي:
        </p>

        {/* Clauses */}
        <SectionTitle number="١" title="موضوع العقد" />
        <p className="text-sm leading-loose mb-4 text-justify pr-4">
          يلتزم العامل بأداء عمله بوظيفة{" "}
          <strong>{emp?.job_title ?? "...................."}</strong>
          {emp?.department && (
            <> بقسم <strong>{emp.department}</strong></>
          )}
          {" "}تحت إشراف صاحب العمل أو من ينوب عنه، وذلك بمقر العمل الكائن
          بـ ..................................................، مع الالتزام بأداء أي مهام
          أخرى تكلفه بها الشركة تتناسب مع طبيعة وظيفته وكفاءته.
        </p>

        <SectionTitle number="٢" title="مدة العقد وفترة الاختبار" />
        <p className="text-sm leading-loose mb-4 text-justify pr-4">
          يبدأ هذا العقد اعتباراً من تاريخ{" "}
          <strong className="border-b border-slate-300 px-1" dir="ltr">
            {formatArabicDate(emp?.hire_date ?? ctx.today)}
          </strong>
          ، وتبدأ فترة الاختبار لمدة <strong>ثلاثة (3) أشهر</strong>{" "}
          استناداً للمادة (33) من قانون العمل. خلال هذه الفترة لأي من
          الطرفين الحق في إنهاء العقد دون التزام بإنذار أو تعويض.
        </p>

        <SectionTitle number="٣" title="الأجر والمستحقات" />
        {totalComp > 0 ? (
          <>
            <p className="text-sm leading-loose mb-3 text-justify pr-4">
              يحصل العامل على أجر شهري إجمالي قدره{" "}
              <strong className="border-b-2 border-slate-400 px-2">
                {formatEGP(totalComp)}
              </strong>{" "}
              (
              <em className="text-slate-600">
                {numberToArabicWords(totalComp)}
              </em>
              ) يُصرف في موعد أقصاه الخامس من الشهر التالي.
            </p>
            <div className="border border-slate-300 rounded p-3 mb-4 text-xs space-y-1">
              <ContractRow label="الراتب الأساسي" value={emp?.basic_salary ?? 0} />
              {Number(emp?.housing_allowance) > 0 && (
                <ContractRow label="بدل سكن" value={emp?.housing_allowance ?? 0} />
              )}
              {Number(emp?.transport_allowance) > 0 && (
                <ContractRow label="بدل انتقال" value={emp?.transport_allowance ?? 0} />
              )}
              {Number(emp?.other_allowances) > 0 && (
                <ContractRow label="بدلات أخرى" value={emp?.other_allowances ?? 0} />
              )}
              {Number(emp?.incentive_allowance) > 0 && (
                <ContractRow label="حافز شهري" value={emp?.incentive_allowance ?? 0} />
              )}
            </div>
          </>
        ) : (
          <p className="text-sm leading-loose mb-4 text-justify pr-4">
            يحصل العامل على أجر شهري إجمالي قدره ............................ جنيهاً
            (............................) فقط لا غير، تُصرف في موعد أقصاه الخامس
            من الشهر التالي.
          </p>
        )}

        <SectionTitle number="٤" title="ساعات العمل والراحة الأسبوعية" />
        <p className="text-sm leading-loose mb-4 text-justify pr-4">
          يلتزم العامل بالعمل لمدة <strong>ثماني (8) ساعات يومياً</strong>،
          و<strong>ثمان وأربعون (48) ساعة أسبوعياً</strong> على الأكثر، وذلك
          استناداً للمادة (80) من قانون العمل. يستحق العامل راحة أسبوعية
          مدتها 24 ساعة متصلة على الأقل (المادة 84).
        </p>

        <SectionTitle number="٥" title="الإجازات" />
        <ul className="text-sm leading-relaxed mb-4 space-y-1 pr-8">
          <li>
            <strong>الإجازة الاعتيادية:</strong> 21 يوماً سنوياً بعد إتمام سنة
            كاملة (المادة 47).
          </li>
          <li>
            <strong>الإجازة العارضة:</strong> 6 أيام سنوياً (يومان متتاليان كحد
            أقصى).
          </li>
          <li>
            <strong>الإجازة المرضية:</strong> حتى 180 يوماً سنوياً وفقاً
            لقانون التأمينات (75% أول 90 يوم، 85% الباقي).
          </li>
        </ul>

        <SectionTitle number="٦" title="التزامات العامل" />
        <ul className="text-sm leading-relaxed mb-4 space-y-1 pr-8">
          <li>أداء العمل المسند إليه بأمانة ودقة وعناية.</li>
          <li>المحافظة على أسرار العمل وعدم إفشائها قبل أو بعد انتهاء العقد.</li>
          <li>الالتزام بتعليمات الشركة ولوائحها الداخلية.</li>
          <li>عدم الاشتغال بأي عمل آخر منافس لنشاط الشركة.</li>
        </ul>

        <SectionTitle number="٧" title="إنهاء العقد" />
        <p className="text-sm leading-loose mb-4 text-justify pr-4">
          يحق لأي من الطرفين إنهاء هذا العقد بإخطار كتابي للطرف الآخر قبل{" "}
          <strong>شهرين (2)</strong> من تاريخ الإنهاء إذا كانت مدة الخدمة أقل
          من 10 سنوات، و<strong>ثلاثة (3) أشهر</strong> إذا تجاوزت 10 سنوات
          (المادة 111). يستحق العامل مكافأة نهاية الخدمة وفقاً للقانون.
        </p>

        <SectionTitle number="٨" title="فض النزاعات" />
        <p className="text-sm leading-loose mb-6 text-justify pr-4">
          في حالة نشوء أي نزاع بين الطرفين بشأن تطبيق أو تفسير هذا العقد،
          يلتزم الطرفان بمحاولة تسويته ودياً. وفي حالة تعذر ذلك، تختص محاكم
          العمل المصرية بنظر النزاع وفقاً لأحكام قانون العمل المصري.
        </p>

        <p className="text-sm leading-loose mb-10 text-justify pr-4">
          حُرر هذا العقد من أصلين، بيد كل طرف نسخة للعمل بمقتضاها عند
          اللزوم.
        </p>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-12">
          <SignatureBlock role="الطرف الأول (صاحب العمل)" name={null} showStamp />
          <SignatureBlock
            role="الطرف الثاني (العامل)"
            name={emp?.full_name ?? null}
          />
        </div>
      </div>

      <FormFooter company={ctx.company} />
    </FormShell>
  );
}

function ContractRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between border-b border-dotted border-slate-200 py-1 last:border-0">
      <span className="text-slate-600">{label}</span>
      <span className="font-bold text-slate-800 font-cairo">
        {formatEGP(value)}
      </span>
    </div>
  );
}
