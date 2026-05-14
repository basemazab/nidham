import Link from "next/link";
import { importEmployees } from "./actions";
import { requireHRPage } from "@/lib/permissions";
import { PDFImportFlow } from "@/components/pdf-import-flow";
import { FileDropZone } from "@/components/file-drop-zone";

type Params = Promise<{
  inserted?: string;
  skipped?: string;
  skips?: string;
  error?: string;
}>;

export const metadata = {
  title: "رفع موظفين من Excel | نِظام",
};

// Bulk-import landing. HR uploads an .xlsx -- the action parses,
// validates per row, inserts whatever it can, and redirects back here
// with a summary of inserted + skipped rows (and the first 20 skip
// reasons packed into the URL).
export default async function ImportEmployeesPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  await requireHRPage();
  const params = await searchParams;
  const inserted = params.inserted ? parseInt(params.inserted, 10) : null;
  const skipped = params.skipped ? parseInt(params.skipped, 10) : null;
  const skips = (params.skips ?? "")
    .split("|")
    .filter(Boolean)
    .map((entry) => {
      const [row, ...rest] = entry.split(":");
      return { row, reason: rest.join(":") };
    });
  const error = params.error ?? null;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/employees"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لليستة الموظفين
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            رفع موظفين من Excel
          </h1>
          <p className="text-sm text-slate-500">
            ارفع شيت يضم بيانات موظفينك دفعة واحدة. السطر الأول لازم يكون عناوين الأعمدة.
          </p>
        </header>

        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 font-cairo text-sm">
            ⚠ {error}
          </div>
        )}

        {inserted !== null && (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5 font-cairo">
            <div className="font-bold text-emerald-800 text-base mb-2">
              ✓ تم الرفع
            </div>
            <ul className="text-sm text-slate-700 space-y-1">
              <li>تم إضافة <b>{inserted}</b> موظف جديد</li>
              {skipped !== null && skipped > 0 && (
                <li className="text-amber-700">
                  تم تجاهل <b>{skipped}</b> سطر (يبص الأسباب تحت)
                </li>
              )}
            </ul>
            {skips.length > 0 && (
              <div className="mt-4 bg-white rounded-lg border border-amber-200 p-3 max-h-64 overflow-auto">
                <div className="text-xs font-bold text-amber-700 mb-2 font-cairo">
                  الأسطر اللي اتجاهلت ({skips.length} سطر — أول 20 فقط):
                </div>
                <ul className="text-xs text-slate-600 space-y-1 font-cairo">
                  {skips.map((s, i) => (
                    <li key={i}>
                      السطر {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">
          <h2 className="text-lg font-bold font-cairo text-slate-800 mb-3">
            📋 الأعمدة المدعومة
          </h2>
          <p className="text-sm text-slate-600 mb-4 font-cairo">
            النظام بيقبل أي من العناوين دي للأعمدة (بالعربي أو الإنجليزي):
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm font-cairo">
            <ColumnSpec
              required
              ar="الاسم"
              en="Name / Full Name"
              hint="مطلوب"
            />
            <ColumnSpec ar="كود الموظف" en="Employee Code" />
            <ColumnSpec ar="الوظيفة" en="Job Title" />
            <ColumnSpec ar="القسم" en="Department" />
            <ColumnSpec ar="تليفون" en="Phone / Mobile" />
            <ColumnSpec ar="إيميل" en="Email" />
            <ColumnSpec
              ar="تاريخ التعيين"
              en="Hire Date"
              hint="YYYY-MM-DD أو DD/MM/YYYY"
            />
            <ColumnSpec ar="المرتب الأساسي" en="Basic Salary" />
            <ColumnSpec
              ar="الرقم القومي"
              en="National ID"
              hint="14 رقم بالظبط"
            />
          </div>
          <p className="text-xs text-slate-500 mt-4 font-cairo">
            الموظف اللي معاه نفس الرقم القومي أو نفس الكود في الشركة هيتجاهل تلقائيًا.
            باقي الحقول (بدل سكن، بنك...) ممكن تكتبها من صفحة كل موظف بعدين.
          </p>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">
          <h2 className="text-lg font-bold font-cairo text-slate-800 mb-1">
            ⬆ Excel / CSV
          </h2>
          <p className="text-sm text-slate-500 mb-4 font-cairo">
            الطريقة الأسرع لو عندك شيت منظّم بصفوف وأعمدة محددة.
          </p>
          <form action={importEmployees} className="space-y-4">
            <FileDropZone
              name="file"
              accept=".xlsx,.xls,.csv"
              required
              hint=".xlsx أو .xls أو .csv · حد أقصى 5 ميجا"
              maxBytes={5 * 1024 * 1024}
            />
            <p className="text-xs text-slate-500 font-cairo">
              2000 موظف لكل رفعة
            </p>
            <button
              type="submit"
              className="w-full px-5 py-3 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white font-bold text-sm font-cairo transition"
            >
              ابدأ الرفع
            </button>
          </form>
        </section>

        <section className="bg-gradient-to-br from-amber-50 via-white to-amber-50/50 rounded-2xl shadow-sm border-2 border-amber-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold font-cairo text-slate-800">
              ✦ PDF بالـ AI
            </h2>
            <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
              جديد
            </span>
          </div>
          <p className="text-sm text-slate-600 mb-4 font-cairo">
            عندك PDF من برنامج HR قديم، أو ورقة موظفين مطبوعة، أو أي ملف
            فيه أسامي وبيانات؟ الـ AI هيقراها ويستخرج الصفوف، وانت بتراجعها
            قبل ما تنحفظ.
          </p>
          <PDFImportFlow />
        </section>
      </div>
    </main>
  );
}

function ColumnSpec({
  ar,
  en,
  hint,
  required,
}: {
  ar: string;
  en: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
      <div className="flex items-center gap-2">
        <span className="text-slate-800 font-bold">{ar}</span>
        {required && (
          <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-bold">
            مطلوب
          </span>
        )}
      </div>
      <div className="text-xs text-slate-500 mt-1" dir="ltr">
        {en}
      </div>
      {hint && (
        <div className="text-[11px] text-slate-400 mt-1">{hint}</div>
      )}
    </div>
  );
}
