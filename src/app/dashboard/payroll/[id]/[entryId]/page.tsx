import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { updatePayrollEntry } from "../../actions";
import { SubmitButton } from "@/components/submit-button";
import { formatEGP } from "@/lib/payroll";

type PageProps = {
  params: Promise<{ id: string; entryId: string }>;
  searchParams: Promise<{ error?: string }>;
};

type Entry = {
  id: string;
  period_id: string;
  employee_id: string;
  attended_days: number;
  half_day_days: number;
  leave_days: number;
  absent_days: number;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowances: number;
  bonuses: number;
  overtime: number;
  // Egyptian Labor Law Art. 85 overtime breakdown — multipliers applied
  // by the payroll engine (×1.35 day, ×1.7 night, ×2.0 rest).
  overtime_hours_day: number;
  overtime_hours_night: number;
  overtime_hours_rest: number;
  gross_salary: number;
  absence_deduction: number;
  social_insurance: number;
  income_tax: number;
  loan_deduction: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  notes: string | null;
  employees: { full_name: string; job_title: string | null } | null;
};

export default async function EditPayrollEntryPage({ params, searchParams }: PageProps) {
  const { id, entryId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS hardening: explicit company_id clamp. Without it, a super-admin
  // session (mig 038's "Super-Admin Read Access Policies") would resolve
  // an entryId from any tenant. The clamp ensures we only return entries
  // belonging to the caller's company — super-admins who want cross-tenant
  // payroll inspection should use /admin instead.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const { data: entry } = await supabase
    .from("payroll_entries")
    .select(
      "*, employees(full_name, job_title)",
    )
    .eq("id", entryId)
    .eq("company_id", callerCompanyId)
    .single<Entry>();

  if (!entry) notFound();

  const updateAction = updatePayrollEntry.bind(null, entryId);

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href={`/dashboard/payroll/${id}`} className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع للشهر
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            تعديل راتب — {entry.employees?.full_name}
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            {entry.employees?.job_title ?? "—"}
          </p>
        </header>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(error)}
          </div>
        )}

        <form action={updateAction} className="space-y-6">
          {/* Attendance */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold font-cairo text-slate-800 mb-4">📅 الحضور</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-cairo">حضور كامل</label>
                <input type="number" name="attended_days" step="0.5" min="0" defaultValue={entry.attended_days} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-cairo">نص يوم</label>
                <input type="number" name="half_day_days" step="0.5" min="0" defaultValue={entry.half_day_days} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-cairo">إجازة</label>
                <input type="number" name="leave_days" step="0.5" min="0" defaultValue={entry.leave_days} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-cairo">غياب</label>
                <input type="number" name="absent_days" step="0.5" min="0" defaultValue={entry.absent_days} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo" />
              </div>
            </div>
          </section>

          {/* Earnings */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold font-cairo text-slate-800 mb-4">💵 الإيرادات</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-cairo">الراتب الأساسي</label>
                <input type="number" name="basic_salary" step="0.01" min="0" defaultValue={entry.basic_salary} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-cairo">بدل سكن</label>
                <input type="number" name="housing_allowance" step="0.01" min="0" defaultValue={entry.housing_allowance} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-cairo">بدل انتقال</label>
                <input type="number" name="transport_allowance" step="0.01" min="0" defaultValue={entry.transport_allowance} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-cairo">بدلات أخرى</label>
                <input type="number" name="other_allowances" step="0.01" min="0" defaultValue={entry.other_allowances} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-cairo">مكافأة</label>
                <input type="number" name="bonuses" step="0.01" min="0" defaultValue={entry.bonuses} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-cairo">
                  أوفر تايم (مبلغ يدوي — اتركه فارغ لو هتدخل الساعات تحت)
                </label>
                <input
                  type="number"
                  name="overtime"
                  step="0.01"
                  min="0"
                  defaultValue={entry.overtime}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
                />
              </div>
            </div>

            {/* Egyptian Labor Law Art. 85 overtime — preferred path:
                3 hour inputs, system computes the money at the correct
                multiplier (×1.35 / ×1.7 / ×2.0). Overrides the "manual
                amount" field above whenever ANY of these is > 0. */}
            <div className="mt-5 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold font-cairo text-slate-700">
                  ⏰ ساعات إضافية (قانون العمل المادة 85)
                </h3>
                <span className="text-[10px] text-slate-500 font-cairo">
                  لو حطيت ساعات هنا، النظام بيحسب المبلغ تلقائياً
                </span>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-cairo">
                    نهاري (×1.35)
                  </label>
                  <input
                    type="number"
                    name="overtime_hours_day"
                    step="0.25"
                    min="0"
                    max="744"
                    defaultValue={entry.overtime_hours_day ?? 0}
                    placeholder="ساعات"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-cairo">
                    ليلي 7م-7ص (×1.7)
                  </label>
                  <input
                    type="number"
                    name="overtime_hours_night"
                    step="0.25"
                    min="0"
                    max="744"
                    defaultValue={entry.overtime_hours_night ?? 0}
                    placeholder="ساعات"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-cairo">
                    عطلة / راحة (×2.0)
                  </label>
                  <input
                    type="number"
                    name="overtime_hours_rest"
                    step="0.25"
                    min="0"
                    max="744"
                    defaultValue={entry.overtime_hours_rest ?? 0}
                    placeholder="ساعات"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Deductions */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold font-cairo text-slate-800 mb-4">💸 الاستقطاعات الإضافية</h2>
            <p className="text-xs text-slate-500 mb-4 font-cairo">
              التأمينات والضريبة بتتحسب تلقائيًا. هنا تضيف خصومات مثل القروض والسلف.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-cairo">قسط قرض</label>
                <input type="number" name="loan_deduction" step="0.01" min="0" defaultValue={entry.loan_deduction} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-cairo">خصومات أخرى</label>
                <input type="number" name="other_deductions" step="0.01" min="0" defaultValue={entry.other_deductions} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo" />
              </div>
            </div>
          </section>

          {/* Computed (read-only) */}
          <section className="bg-gradient-to-br from-cyan-50 to-white p-6 rounded-2xl border-2 border-brand-cyan/30">
            <h2 className="text-lg font-bold font-cairo text-slate-800 mb-3">📊 الحساب الحالي (قبل الحفظ)</h2>
            <div className="grid md:grid-cols-2 gap-3 text-sm font-cairo">
              <div className="flex justify-between"><span>الإجمالي:</span><strong>{formatEGP(entry.gross_salary)}</strong></div>
              <div className="flex justify-between"><span>خصم الغياب:</span><strong className="text-red-600">{formatEGP(entry.absence_deduction)}</strong></div>
              <div className="flex justify-between"><span>التأمينات:</span><strong className="text-amber-700">{formatEGP(entry.social_insurance)}</strong></div>
              <div className="flex justify-between"><span>الضريبة:</span><strong className="text-red-600">{formatEGP(entry.income_tax)}</strong></div>
              <div className="flex justify-between md:col-span-2 pt-2 border-t border-cyan-200">
                <span className="font-bold">الصافي:</span>
                <strong className="text-emerald-700 text-lg">{formatEGP(entry.net_salary)}</strong>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3 font-cairo">
              ⚡ الأرقام دي من آخر حفظ. لو غيرت قيم في الفورم، اضغط «حفظ» عشان النظام يعيد الحساب.
            </p>
          </section>

          <div>
            <label className="block text-xs text-slate-600 mb-1 font-cairo">ملاحظات</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={entry.notes ?? ""}
              placeholder="مثلًا: تأجيل قسط القرض شهر، مكافأة Eid..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo resize-none"
            />
          </div>

          <div className="flex gap-3">
            <SubmitButton
              loadingText="جاري إعادة الحساب..."
              className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold font-cairo shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all"
            >
              حفظ وإعادة الحساب
            </SubmitButton>
            <Link href={`/dashboard/payroll/${id}`} className="px-6 py-3 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo">
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
