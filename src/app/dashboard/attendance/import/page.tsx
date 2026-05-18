import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { importAttendance } from "./actions";
import { SubmitButton } from "@/components/submit-button";

type SearchParams = Promise<{
  error?: string;
  imported?: string;
  skipped?: string;
  filtered?: string;
  mode?: string;
  errors?: string;
}>;

export default async function AttendanceImportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  // Scope counts to the caller's company so super-admin sessions
  // don't inflate the "active employees" badge with cross-tenant rows.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  // Count employees with codes + split by pay_frequency so the mode
  // picker can show "X monthly · Y weekly" badges.
  const [
    { count: totalEmployees },
    { count: withCode },
    { count: monthlyCount },
    { count: weeklyCount },
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("company_id", callerCompanyId)
      .eq("status", "active"),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("company_id", callerCompanyId)
      .eq("status", "active")
      .not("employee_code", "is", null),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("company_id", callerCompanyId)
      .eq("status", "active")
      .eq("pay_frequency", "monthly"),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("company_id", callerCompanyId)
      .eq("status", "active")
      .eq("pay_frequency", "weekly"),
  ]);

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/attendance"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لتسجيل الحضور
          </Link>
        </div>

        <header className="mb-8">
          <div className="inline-block px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold mb-2 font-cairo">
            ⚡ Bulk Import
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            استيراد حضور (من ZKTeco أو Excel)
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed">
            صدّر بيانات الحضور من جهاز البصمة بصيغة Excel، ارفعها هنا، والنظام
            هياخدها ويوزّعها على الموظفين تلقائيًا.
          </p>
        </header>

        {/* Success/Error */}
        {params.imported && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border-2 border-emerald-200">
            <h3 className="font-bold text-emerald-800 mb-1 font-cairo">
              ✓ تم الاستيراد بنجاح
              {params.mode === "monthly" && " (وضع شهري)"}
              {params.mode === "weekly" && " (وضع أسبوعي)"}
            </h3>
            <p className="text-sm text-emerald-700 font-cairo">
              تم حفظ {params.imported} سجل حضور
              {params.skipped && parseInt(params.skipped) > 0
                ? ` · ${params.skipped} سطر تم تخطيهم بسبب أخطاء`
                : ""}
            </p>
            {params.filtered && parseInt(params.filtered) > 0 && (
              <p className="text-sm text-amber-700 font-cairo mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                ⓘ <b>{params.filtered}</b> سجل تم تجاهله لأنهم لموظفين{" "}
                {params.mode === "monthly" ? "أسبوعيين" : "شهريين"} (مش في الـ
                workflow ده). لو محتاج تضيف حضورهم، ارفع نفس الملف بوضع{" "}
                <b>{params.mode === "monthly" ? "أسبوعي" : "شهري"}</b>.
              </p>
            )}
            {params.errors && (
              <details className="mt-3">
                <summary className="text-xs text-emerald-700 font-cairo cursor-pointer">
                  شوف الأخطاء التفصيلية
                </summary>
                <pre className="mt-2 p-2 bg-white rounded text-xs text-slate-700 whitespace-pre-wrap font-mono">
                  {decodeURIComponent(params.errors)}
                </pre>
              </details>
            )}
          </div>
        )}

        {params.error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
            <h3 className="font-bold text-red-800 mb-1 font-cairo">⚠ حصل خطأ</h3>
            <p className="text-sm text-red-700 font-cairo">{decodeURIComponent(params.error)}</p>
          </div>
        )}

        {/* Warning if employees don't have codes */}
        {(totalEmployees ?? 0) > 0 && (withCode ?? 0) === 0 && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <h3 className="font-bold text-amber-800 mb-1 font-cairo">
              ⚠ ولا موظف عنده "كود الموظف"
            </h3>
            <p className="text-sm text-amber-700 font-cairo mb-3">
              عشان الاستيراد يشتغل بدقة 100%، اضبط كود كل موظف. النظام برضو هيحاول يطابق بالاسم لو ما لقاش الكود، لكن الكود أدق.
            </p>
            <Link
              href="/dashboard/employees"
              className="text-sm text-brand-cyan-dark hover:underline font-bold font-cairo"
            >
              روح ضبط أكواد الموظفين ←
            </Link>
          </div>
        )}

        {/* Step 1: Download template */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-brand-cyan/10 flex items-center justify-center text-brand-cyan-dark font-black">
              1
            </div>
            <div>
              <h2 className="text-lg font-bold font-cairo text-slate-800 mb-1">
                نزّل التيمبليت
              </h2>
              <p className="text-sm text-slate-600 font-cairo">
                Excel جاهز فيه موظفينك بالأسماء والأكواد — أنت بس بتضيف التواريخ والحالات
              </p>
            </div>
          </div>
          <a
            href="/api/attendance/template"
            download
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm font-cairo transition shadow-md"
          >
            <span>📥</span>
            <span>نزّل Excel template</span>
          </a>
        </section>

        {/* Step 2: How to fill */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-brand-cyan/10 flex items-center justify-center text-brand-cyan-dark font-black">
              2
            </div>
            <div>
              <h2 className="text-lg font-bold font-cairo text-slate-800 mb-1">
                املا البيانات
              </h2>
              <p className="text-sm text-slate-600 font-cairo">
                للأعمدة دي — أي عمود تاني هيتم تجاهله
              </p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 font-bold text-slate-700 font-cairo">العمود</th>
                  <th className="px-3 py-2 font-bold text-slate-700 font-cairo">مطلوب؟</th>
                  <th className="px-3 py-2 font-bold text-slate-700 font-cairo">مثال</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr><td className="px-3 py-2 font-mono">كود الموظف</td><td className="px-3 py-2 text-amber-700">إما كود أو اسم</td><td className="px-3 py-2 font-mono">100</td></tr>
                <tr><td className="px-3 py-2 font-mono">الاسم</td><td className="px-3 py-2 text-amber-700">إما كود أو اسم</td><td className="px-3 py-2">محمد طه حجاج</td></tr>
                <tr><td className="px-3 py-2 font-mono">التاريخ</td><td className="px-3 py-2 text-red-600 font-bold">مطلوب</td><td className="px-3 py-2 font-mono">2026-05-13</td></tr>
                <tr><td className="px-3 py-2 font-mono">الحالة</td><td className="px-3 py-2 text-red-600 font-bold">مطلوب</td><td className="px-3 py-2 font-mono">present</td></tr>
                <tr><td className="px-3 py-2 font-mono">وقت الحضور</td><td className="px-3 py-2 text-slate-500">اختياري</td><td className="px-3 py-2 font-mono">08:30</td></tr>
                <tr><td className="px-3 py-2 font-mono">وقت الانصراف</td><td className="px-3 py-2 text-slate-500">اختياري</td><td className="px-3 py-2 font-mono">17:00</td></tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-slate-600 font-cairo">
            <strong>أكواد الحالة المقبولة:</strong> <span className="font-mono">present</span>, <span className="font-mono">absent</span>, <span className="font-mono">half_day</span>, <span className="font-mono">leave</span>, <span className="font-mono">holiday</span>, <span className="font-mono">weekend</span>
            <br/>
            <em>(تقدر تكتب بالعربي كمان: "حاضر", "غايب", "نص يوم", "إجازة")</em>
          </div>
        </section>

        {/* Step 3: Upload */}
        <section className="bg-gradient-to-br from-cyan-50 to-white p-6 rounded-2xl border-2 border-brand-cyan/30">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-brand-cyan flex items-center justify-center text-white font-black">
              3
            </div>
            <div>
              <h2 className="text-lg font-bold font-cairo text-slate-800 mb-1">
                ارفع الملف بعد ما تملاه
              </h2>
              <p className="text-sm text-slate-600 font-cairo">
                النظام هيمسح بياناتك ويسجّلها · لو موجود حضور بنفس اليوم لنفس الموظف، هيتعدّل
              </p>
            </div>
          </div>

          <form action={importAttendance} encType="multipart/form-data">
            {/* Import mode -- picks WHICH employees get their attendance
                written from the file. The ZKTeco fingerprint exports a
                monthly sheet that includes weekly employees too; HR
                imports the same file under each mode in turn (or
                "الكل" for tenants that don't separate). */}
            <fieldset className="mb-4 bg-white border border-slate-200 rounded-xl p-4">
              <legend className="px-2 text-xs font-bold text-slate-700 font-cairo">
                نوع الموظفين في الشيت
              </legend>
              <div className="grid sm:grid-cols-3 gap-2 mt-1">
                <ModeOption
                  value="monthly"
                  emoji="📅"
                  label="شهري"
                  description="الإدارة + المكاتب"
                  count={monthlyCount ?? 0}
                  color="sky"
                  defaultChecked
                />
                <ModeOption
                  value="weekly"
                  emoji="📆"
                  label="أسبوعي"
                  description="عمال الإنتاج"
                  count={weeklyCount ?? 0}
                  color="violet"
                />
                <ModeOption
                  value="all"
                  emoji="🌐"
                  label="كل الموظفين"
                  description="بدون فلتر"
                  count={(monthlyCount ?? 0) + (weeklyCount ?? 0)}
                  color="slate"
                />
              </div>
              <p className="text-[11px] text-slate-500 font-cairo mt-3 leading-relaxed">
                💡 لو رفعت شيت شهري وفيه أكواد لعمال أسبوعيين، النظام
                هيتجاهل سطورهم تلقائيًا. ارفع نفس الملف بوضع <b>"أسبوعي"</b>
                {" "}لما تيجي تسجّل حضورهم في كشف منفصل.
              </p>
            </fieldset>

            <input
              type="file"
              name="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              className="block w-full mb-4 text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-white file:text-brand-cyan-dark file:border file:border-slate-200 hover:file:bg-slate-50 file:cursor-pointer font-cairo"
            />
            <SubmitButton
              loadingText="جاري التحليل والحفظ..."
              className="w-full md:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo"
            >
              ارفع وحلّل الملف ✦
            </SubmitButton>
          </form>
        </section>
      </div>
    </main>
  );
}

// Radio-style mode picker. Renders as a colour-coded card per option;
// clicking activates the underlying <input type="radio"> so the FormData
// arrives with import_mode=monthly|weekly|all.
function ModeOption({
  value,
  emoji,
  label,
  description,
  count,
  color,
  defaultChecked,
}: {
  value: "monthly" | "weekly" | "all";
  emoji: string;
  label: string;
  description: string;
  count: number;
  color: "sky" | "violet" | "slate";
  defaultChecked?: boolean;
}) {
  const activeBorder = {
    sky: "peer-checked:border-sky-400 peer-checked:bg-sky-50 peer-checked:ring-2 peer-checked:ring-sky-300",
    violet:
      "peer-checked:border-violet-400 peer-checked:bg-violet-50 peer-checked:ring-2 peer-checked:ring-violet-300",
    slate:
      "peer-checked:border-slate-400 peer-checked:bg-slate-50 peer-checked:ring-2 peer-checked:ring-slate-300",
  }[color];
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name="import_mode"
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only peer"
      />
      <div
        className={`p-3 rounded-xl border-2 border-slate-200 hover:bg-slate-50 transition text-right ${activeBorder}`}
      >
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="font-bold text-sm text-slate-800 font-cairo">
            {emoji} {label}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-cairo">
            {count.toLocaleString("ar-EG")} موظف
          </span>
        </div>
        <div className="text-[10px] text-slate-500 font-cairo">{description}</div>
      </div>
    </label>
  );
}
