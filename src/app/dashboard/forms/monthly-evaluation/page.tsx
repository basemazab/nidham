// ============================================================================
// /dashboard/forms/monthly-evaluation — Monthly Performance Snapshot
// ============================================================================
//
// A lighter, faster cousin of the annual performance-evaluation form.
// Designed to be filled in 2-3 minutes by a direct manager every
// month so HR has continuous performance data instead of one
// once-a-year deep review.
//
// Differences vs the annual evaluation:
//   - 5 criteria (not 7) — keeps the form on one A4 page
//   - No "achievements over the year" section
//   - Includes an explicit bonus suggestion (amount + reason) that
//     ties straight into the Retention Insights + Bulk-Bonus workflow
//   - The recommendation buttons skew toward THIS-MONTH actions
//     ("استمرار التميز" / "تحفيز" / "متابعة") instead of annual decisions

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveFormContext, formatArabicDate } from "@/lib/forms";
import { FormShell } from "@/components/forms/form-shell";
import { FormLetterhead } from "@/components/forms/form-letterhead";
import {
  SignatureBlock,
  SectionTitle,
  RatingScale,
  FormFooter,
  FieldLine,
  CheckBox,
} from "@/components/forms/form-pieces";

type SearchParams = Promise<{
  employeeId?: string;
  month?: string;
  year?: string;
}>;

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export default async function MonthlyEvaluationPage({
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
    formTypeCode: "MEV",
  });
  const emp = ctx.employee;

  // Resolve target month — defaults to the CURRENT month (not last
  // month) because monthly evaluations are typically filled at month-end
  // for the month that just ended, OR at month-start as a snapshot.
  const now = new Date();
  const month = sp.month
    ? Math.max(1, Math.min(12, parseInt(sp.month, 10)))
    : now.getMonth() + 1;
  const year = sp.year
    ? Math.max(2020, Math.min(2100, parseInt(sp.year, 10)))
    : now.getFullYear();
  const monthLabel = `${ARABIC_MONTHS[month - 1]} ${year}`;

  return (
    <FormShell
      title="نموذج تقييم شهري"
      filename={`monthly-evaluation-${emp?.full_name ?? "blank"}-${year}-${month}`}
      preFilledFor={emp?.full_name ?? null}
      blankHref="/dashboard/forms/monthly-evaluation"
    >
      <FormLetterhead
        company={ctx.company}
        reference={ctx.reference}
        date={ctx.today}
        subtitle={`تقييم أداء شهري · ${monthLabel}`}
      />

      <div className="px-12 py-8 font-cairo">
        <h1 className="text-center text-xl font-black text-slate-900 mb-1 border-b-2 border-slate-200 pb-2">
          نموذج التقييم الشهري
        </h1>
        <p className="text-center text-xs text-slate-500 mb-6">
          Monthly Performance Snapshot · {monthLabel}
        </p>

        {/* Section 1: Employee + period */}
        <SectionTitle number="١" title="بيانات الموظف وفترة التقييم" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
          <Field label="الاسم" value={emp?.full_name} />
          <Field label="كود الموظف" value={emp?.employee_code} mono />
          <Field label="المسمى الوظيفي" value={emp?.job_title} />
          <Field label="القسم" value={emp?.department} />
          <Field label="شهر التقييم" value={monthLabel} />
          <Field label="تاريخ التقييم" value={formatArabicDate(ctx.today)} />
        </div>

        {/* Section 2: 5-criteria rating */}
        <SectionTitle number="٢" title="معايير التقييم الشهري" />
        <p className="text-xs text-slate-600 mb-3 font-cairo leading-relaxed">
          ضع دائرة حول الرقم اللي يعكس مستوى الموظف هذا الشهر:
          <br />
          <strong>1</strong> = ضعيف · <strong>2</strong> = أقل من المتوقع ·{" "}
          <strong>3</strong> = جيد · <strong>4</strong> = جيد جداً ·{" "}
          <strong>5</strong> = ممتاز
        </p>

        <div className="border-2 border-slate-300 rounded-lg overflow-hidden mb-6">
          <div className="bg-slate-50 px-3 py-2 grid grid-cols-12 gap-2 border-b-2 border-slate-300">
            <div className="col-span-7 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              المعيار
            </div>
            <div className="col-span-5 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-center">
              التقييم (1-5)
            </div>
          </div>
          <div className="px-3">
            <RatingScale
              label="الالتزام بمواعيد العمل"
              description="حضور وانصراف منتظم في المواعيد المحددة"
            />
            <RatingScale
              label="إنجاز المهام"
              description="تسليم العمل في الوقت المحدد بكفاءة"
            />
            <RatingScale
              label="جودة العمل"
              description="الدقة والإتقان وقلة الأخطاء"
            />
            <RatingScale
              label="التعاون مع الفريق"
              description="المساعدة والعمل الجماعي وحسن التعامل"
            />
            <RatingScale
              label="الالتزام بسياسات الشركة"
              description="الانضباط، اللائحة، الزي، السلوك المهني"
            />
          </div>
        </div>

        {/* Section 3: Highlights */}
        <SectionTitle number="٣" title="أبرز ما تميز به الموظف هذا الشهر" />
        <FieldLine
          label="إنجازات، مواقف جيدة، أو سلوك مميز يستحق الإشادة"
          rows={3}
        />

        {/* Section 4: Areas to improve */}
        <SectionTitle number="٤" title="نقاط تحتاج لتحسين" />
        <FieldLine
          label="ملاحظات أو مشكلات حصلت هذا الشهر تستوجب المتابعة"
          rows={3}
        />

        {/* Section 5: Manager's recommendation */}
        <SectionTitle number="٥" title="توصية المدير المباشر للشهر القادم" />
        <div className="grid grid-cols-2 gap-y-2 gap-x-3 mb-4">
          <CheckBox label="استمرار التميز — يستحق التشجيع" />
          <CheckBox label="تحفيز إضافي مطلوب (مكافأة معنوية أو مادية)" />
          <CheckBox label="متابعة دورية لتحسين الأداء" />
          <CheckBox label="إنذار شفهي / اجتماع 1:1" />
        </div>

        {/* Section 6: Bonus suggestion — ties to the Retention/Bulk-Bonus flow */}
        <SectionTitle number="٦" title="اقتراح مكافأة شهرية" />
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-3 gap-3 items-end">
            <div className="col-span-1">
              <div className="text-[11px] text-amber-700 font-bold mb-1 font-cairo">
                هل تقترح مكافأة؟
              </div>
              <div className="flex gap-3">
                <CheckBox label="نعم" />
                <CheckBox label="لا" />
              </div>
            </div>
            <div className="col-span-1">
              <div className="text-[11px] text-amber-700 font-bold mb-1 font-cairo">
                المبلغ المقترح (ج)
              </div>
              <div className="border-b-2 border-amber-300 h-7 font-cairo font-bold text-slate-800 px-2" />
            </div>
            <div className="col-span-1">
              <div className="text-[11px] text-amber-700 font-bold mb-1 font-cairo">
                سبب المكافأة
              </div>
              <div className="border-b-2 border-amber-300 h-7 font-cairo text-slate-800 px-2" />
            </div>
          </div>
          <p className="text-[10px] text-amber-700 font-cairo mt-3 leading-relaxed">
            💡 لو الـ HR وافق على المكافأة، يقدر يصرفها بسهولة من{" "}
            <strong>المرتبات → الدورة الحالية → مكافأة جماعية</strong>.
          </p>
        </div>

        {/* Final score box (optional manual total) */}
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 mb-6 grid grid-cols-3 gap-3">
          <div>
            <div className="text-[11px] font-bold text-emerald-700 mb-1 font-cairo">
              مجموع النقاط (من ٢٥)
            </div>
            <div className="border-b-2 border-emerald-400 h-8 font-cairo font-bold text-emerald-800 text-lg px-2" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-700 mb-1 font-cairo">
              النسبة المئوية
            </div>
            <div className="border-b-2 border-emerald-400 h-8 font-cairo font-bold text-emerald-800 text-lg px-2" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-700 mb-1 font-cairo">
              التقدير النهائي
            </div>
            <div className="border-b-2 border-emerald-400 h-8 font-cairo font-bold text-emerald-800 text-lg px-2" />
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-12 mt-8">
          <SignatureBlock role="المدير المباشر" />
          <SignatureBlock
            role="الموظف (إقرار بالاطلاع)"
            name={emp?.full_name ?? null}
          />
        </div>

        <div className="mt-6 p-3 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 font-cairo leading-relaxed">
          <strong>ملاحظة:</strong> هذا التقييم الشهري جزء من نظام
          المتابعة المستمر بالشركة. التقييمات الشهرية بتتجمع لتكوّن صورة
          عن الأداء السنوي وتدعم قرارات الترقية والمكافآت ومراجعة الراتب.
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
