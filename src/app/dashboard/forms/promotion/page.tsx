// ============================================================================
// /dashboard/forms/promotion — Promotion form (نموذج ترقية)
// ============================================================================
//
// Internal HR form that captures a promotion: from-position, to-position,
// salary change, effective date, justification, and three-tier approval
// (direct manager, HR, company owner).

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
  SectionTitle,
  FormFooter,
  FieldLine,
} from "@/components/forms/form-pieces";
import { formatEGP } from "@/lib/format";

type SearchParams = Promise<{ employeeId?: string }>;

export default async function PromotionFormPage({
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
    formTypeCode: "PRM",
  });
  const emp = ctx.employee;
  const currentTotal = totalCompensation(emp);

  return (
    <FormShell
      title="نموذج ترقية"
      filename={`promotion-${emp?.full_name ?? "blank"}-${ctx.today}`}
      preFilledFor={emp?.full_name ?? null}
      blankHref="/dashboard/forms/promotion"
    >
      <FormLetterhead
        company={ctx.company}
        reference={ctx.reference}
        date={ctx.today}
        subtitle="نموذج ترقية موظف"
      />

      <div className="px-12 py-8 font-cairo">
        <h1 className="text-center text-xl font-black text-slate-900 mb-2 border-b-2 border-slate-200 pb-2">
          نموذج ترقية / تعديل وظيفي
        </h1>
        <p className="text-center text-xs text-slate-500 mb-6">
          Employee Promotion Form
        </p>

        {/* Employee */}
        <SectionTitle number="١" title="بيانات الموظف" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
          <Field label="الاسم" value={emp?.full_name} />
          <Field label="كود الموظف" value={emp?.employee_code} mono />
          <Field
            label="تاريخ التعيين"
            value={formatArabicDate(emp?.hire_date)}
          />
          <Field
            label="إجمالي سنوات الخدمة"
            value="............................"
          />
        </div>

        {/* Before / After */}
        <SectionTitle number="٢" title="التغيير الوظيفي" />
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border-2 border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              قبل الترقية
            </div>
            <div className="p-3 space-y-2 text-sm">
              <Row label="المسمى" value={emp?.job_title ?? "—"} />
              <Row label="القسم" value={emp?.department ?? "—"} />
              <Row
                label="إجمالي الراتب"
                value={currentTotal > 0 ? formatEGP(currentTotal) : "—"}
              />
            </div>
          </div>
          <div className="border-2 border-emerald-300 rounded-lg overflow-hidden bg-emerald-50/30">
            <div className="bg-emerald-100 px-3 py-2 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
              بعد الترقية ✦
            </div>
            <div className="p-3 space-y-2 text-sm">
              <Row label="المسمى الجديد" value="" />
              <Row label="القسم الجديد" value="" />
              <Row label="إجمالي الراتب الجديد" value="" />
            </div>
          </div>
        </div>

        {/* Effective date */}
        <div className="mb-6">
          <SectionTitle number="٣" title="تاريخ تطبيق الترقية" />
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center gap-3 text-sm">
            <span className="text-slate-600 font-cairo">
              يبدأ تطبيق الترقية اعتباراً من تاريخ:
            </span>
            <span className="flex-1 border-b-2 border-slate-400 px-3 py-1 font-bold text-slate-800 font-cairo">
              ..............................................................
            </span>
          </div>
        </div>

        {/* Reason */}
        <SectionTitle number="٤" title="مبررات الترقية" />
        <FieldLine
          label="ما الإنجازات / المهارات التي استحق الموظف على أساسها هذه الترقية؟"
          rows={4}
        />

        {/* Conditions */}
        <SectionTitle number="٥" title="الشروط والتعهدات" />
        <ul className="list-decimal pr-6 space-y-1.5 text-sm leading-relaxed text-slate-700 mb-8">
          <li>
            تخضع الترقية لفترة تقييم لمدة ثلاثة أشهر يقيّم الموظف خلالها بناءً
            على المهام الجديدة.
          </li>
          <li>
            يلتزم الموظف بأداء المهام الجديدة بنفس مستوى الكفاءة والجودة
            المتوقعة لمستوى الترقية.
          </li>
          <li>
            تظل بقية شروط عقد العمل الأصلية سارية ولم تتعدل إلا في النواحي
            المحددة في هذا النموذج.
          </li>
        </ul>

        {/* 3-tier approval */}
        <SectionTitle number="٦" title="الاعتمادات الرسمية" />
        <div className="grid grid-cols-3 gap-6">
          <SignatureBlock role="المدير المباشر" />
          <SignatureBlock role="مدير الموارد البشرية" />
          <SignatureBlock role="رئيس مجلس الإدارة / المالك" showStamp />
        </div>

        {/* Employee acknowledgment */}
        <div className="mt-8 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
          <div className="text-sm font-bold text-amber-800 font-cairo mb-2">
            إقرار قبول الترقية
          </div>
          <p className="text-xs text-amber-700 font-cairo leading-relaxed mb-4">
            أقرّ أنا الموظع/ة الموقّع/ة أدناه بأنني اطلعت على شروط هذه
            الترقية والمسؤوليات المرتبطة بها، وأنني أقبلها وألتزم بأدائها
            على الوجه الأكمل.
          </p>
          <div className="grid grid-cols-2 gap-6">
            <SignatureBlock role="توقيع الموظف" name={emp?.full_name ?? null} />
            <div className="text-sm font-cairo">
              <div className="text-xs text-slate-600 mb-1">التاريخ:</div>
              <div className="border-b-2 border-slate-400 h-7" />
            </div>
          </div>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-dotted border-slate-300 pb-1">
      <span className="text-[11px] text-slate-500 font-cairo shrink-0">
        {label}:
      </span>
      <span className="flex-1 font-bold text-slate-800 font-cairo">
        {value || (
          <span className="text-slate-300">..............................</span>
        )}
      </span>
    </div>
  );
}
