import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { bulkImportCustomers } from "./actions";

// ============================================================================
// /dashboard/customers/import — Bulk customer import from Excel/CSV
// ============================================================================
//
// Diagnostic showed CircleCode manually added 13 customers in 2 hours.
// They almost certainly have a full Excel sheet of contacts they'd
// rather paste in once. This page accepts CSV / XLSX, parses the
// first sheet, maps columns, and bulk-inserts.
//
// Expected columns (Arabic-friendly headers):
//   • الاسم / Name / Full Name / full_name      → full_name (required)
//   • النوع / Type                              → "company" or "individual"
//   • الموبايل / Phone / phone                   → phone
//   • الإيميل / Email / email                    → email
//   • جهة الاتصال / Contact / contact            → contact_name
//   • الحالة / Status                            → lead/active/won/lost
//   • القيمة المتوقعة / Value / estimated_value  → estimated_value (number)
//   • الملاحظات / Notes                          → notes
//   • المصدر / Source                            → website/referral/etc.

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string; result?: string }>;

export default async function CustomerImportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getMyProfile();
  if (!profile?.company_id) redirect("/dashboard");

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/customers"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للعملاء
          </Link>
        </div>

        <header className="mb-8">
          <div className="inline-block px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold mb-3 font-cairo">
            📥 استيراد سريع
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-2">
            استيراد العملاء من Excel
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
            ارفع ملف Excel أو CSV — هنستورد كل العملاء في ثواني، مع التحقق
            من البيانات والتعامل مع التكرار تلقائياً.
          </p>
        </header>

        {/* Result banner */}
        {params.result && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-900 font-cairo">
            <div className="font-bold text-lg mb-1">✓ تم الاستيراد بنجاح</div>
            <div className="text-sm">
              اتسجّل <strong>{params.result}</strong> عميل جديد في النظام.{" "}
              <Link
                href="/dashboard/customers"
                className="underline font-bold"
              >
                شوف القائمة ←
              </Link>
            </div>
          </div>
        )}
        {params.error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border-2 border-rose-200 text-rose-700 font-cairo text-sm">
            ⚠ {decodeURIComponent(params.error)}
          </div>
        )}

        {/* Upload form */}
        <form
          action={bulkImportCustomers}
          encType="multipart/form-data"
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6"
        >
          <div className="mb-5">
            <label
              htmlFor="file"
              className="block text-sm font-bold text-slate-700 mb-2 font-cairo"
            >
              اختار ملف Excel أو CSV
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".csv,.xls,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              required
              className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-slate-300 hover:border-brand-cyan focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none cursor-pointer file:mr-4 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-brand-cyan-dark file:text-white file:font-bold file:cursor-pointer hover:file:bg-brand-cyan"
            />
            <p className="text-xs text-slate-500 mt-2 font-cairo">
              الحد الأقصى: 5 MB · CSV / XLSX / XLS · أول صف لازم يكون أسماء
              الأعمدة
            </p>
          </div>

          <div className="mb-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="skip_duplicates"
                value="1"
                defaultChecked
                className="w-4 h-4 accent-brand-cyan-dark"
              />
              <span className="text-sm text-slate-700 font-cairo">
                تجاهل الـ duplicates (نفس الإيميل/تليفون موجود قبل كده)
              </span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-md hover:shadow-lg transition font-cairo"
          >
            📥 ابدأ الاستيراد
          </button>
        </form>

        {/* Sample template + help */}
        <section className="bg-slate-50 rounded-2xl border border-slate-200 p-6 font-cairo">
          <h2 className="font-bold text-slate-800 mb-3">
            📋 الأعمدة المدعومة في الـ Excel
          </h2>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            هذه أسماء الأعمدة اللي النظام يتعرف عليها (عربي أو إنجليزي):
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <ColRow
              col="الاسم / Name / full_name"
              required
              example="شركة الشحن السريع"
            />
            <ColRow
              col="النوع / Type"
              example="company أو individual"
              note="default: company"
            />
            <ColRow
              col="الموبايل / Phone"
              example="01055556622"
            />
            <ColRow
              col="الإيميل / Email"
              example="info@example.com"
            />
            <ColRow
              col="جهة الاتصال / Contact"
              example="أحمد محمد - مدير IT"
            />
            <ColRow
              col="الحالة / Status"
              example="lead/active/won/lost"
              note="default: lead"
            />
            <ColRow
              col="القيمة المتوقعة / Value"
              example="50000"
            />
            <ColRow
              col="الملاحظات / Notes"
              example="عايز demo الأسبوع الجاي"
            />
          </div>

          <div className="mt-5 p-3 rounded-lg bg-white border border-amber-200 text-xs text-amber-800">
            💡 <strong>tip</strong>: لو في عمود مش معروف، النظام بيتجاهله
            من غير error. الأعمدة المطلوبة فقط هي <strong>"الاسم"</strong>{" "}
            — الباقي اختياري.
          </div>
        </section>
      </div>
    </main>
  );
}

function ColRow({
  col,
  required,
  example,
  note,
}: {
  col: string;
  required?: boolean;
  example: string;
  note?: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-white border border-slate-200">
      <div className="flex items-center gap-2 mb-1">
        <code className="text-[11px] font-mono text-slate-800 font-bold">
          {col}
        </code>
        {required && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">
            مطلوب
          </span>
        )}
      </div>
      <div className="text-[10px] text-slate-500" dir="ltr">
        مثال: {example}
      </div>
      {note && (
        <div className="text-[10px] text-amber-600 mt-0.5">{note}</div>
      )}
    </div>
  );
}
