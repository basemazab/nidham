import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { importAttendance } from "./actions";
import { SubmitButton } from "@/components/submit-button";

type SearchParams = Promise<{
  error?: string;
  imported?: string;
  skipped?: string;
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

  // Count employees with codes (for the user's awareness)
  const { count: totalEmployees } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  const { count: withCode } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .not("employee_code", "is", null);

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
            </h3>
            <p className="text-sm text-emerald-700 font-cairo">
              تم حفظ {params.imported} سجل حضور
              {params.skipped && parseInt(params.skipped) > 0
                ? ` · ${params.skipped} سطر تم تخطيهم بسبب أخطاء`
                : ""}
            </p>
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
