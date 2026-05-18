// ============================================================================
// /dashboard/settings/holidays — Public Holidays Calendar
// ============================================================================
//
// Shows two grouped lists:
//   1) العطلات الرسمية المشتركة (global rows, company_id IS NULL)
//   2) عطلات شركتك الخاصة (tenant-specific rows, company_id = current)
//
// Admin can:
//   - Add a custom company holiday
//   - Delete a tenant-specific row (global rows are read-only here —
//     they're seeded once and shared across every tenant)
//   - Override is_paid for an upcoming global holiday via the override
//     action (creates a tenant-specific row that shadows the global one)

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { addHoliday, removeHoliday } from "./actions";

// Force fresh data each request — admins add/edit holidays and need to
// see them reflected immediately.
export const dynamic = "force-dynamic";

type Holiday = {
  id: string;
  company_id: string | null;
  date: string;
  name_ar: string;
  name_en: string | null;
  holiday_type:
    | "national"
    | "religious"
    | "seasonal"
    | "company"
    | "other";
  is_paid: boolean;
  notes: string | null;
};

const TYPE_LABEL: Record<Holiday["holiday_type"], { ar: string; cls: string }> = {
  national: {
    ar: "عيد قومي",
    cls: "bg-rose-50 text-rose-800 border-rose-200",
  },
  religious: {
    ar: "ديني",
    cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  seasonal: {
    ar: "موسمي",
    cls: "bg-amber-50 text-amber-800 border-amber-200",
  },
  company: {
    ar: "شركة",
    cls: "bg-cyan-50 text-cyan-800 border-cyan-200",
  },
  other: {
    ar: "أخرى",
    cls: "bg-slate-50 text-slate-700 border-slate-200",
  },
};

type SearchParams = Promise<{
  error?: string;
  saved?: string;
  deleted?: string;
}>;

export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { profile } = await getMyProfile();
  if (!profile) {
    return null;
  }
  const isAdmin = profile.role === "admin";

  // Pull global + tenant holidays in one round-trip. RLS already filters
  // tenant-scoped rows to the caller's company, and global rows have
  // company_id IS NULL which the read policy allows for everyone.
  const today = new Date().toISOString().split("T")[0];
  const { data: holidays } = await supabase
    .from("public_holidays")
    .select(
      "id, company_id, date, name_ar, name_en, holiday_type, is_paid, notes",
    )
    .gte("date", today)
    .order("date")
    .returns<Holiday[]>();

  const all = holidays ?? [];
  const globalHolidays = all.filter((h) => h.company_id === null);
  const companyHolidays = all.filter((h) => h.company_id !== null);

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            📅 تقويم العطلات الرسمية
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            النظام يستخدم التقويم ده في حساب المرتبات + الحضور — عشان ما يحاسبش
            موظف على غيابه يوم عيد.
          </p>
        </header>

        {sp.saved && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-cairo">
            ✓ تم الحفظ
          </div>
        )}
        {sp.deleted && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-cairo">
            🗑 اتمسحت العطلة
          </div>
        )}
        {sp.error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm font-cairo">
            ⚠ {decodeURIComponent(sp.error)}
          </div>
        )}

        {/* Add custom holiday — admins only */}
        {isAdmin && (
          <section className="bg-gradient-to-br from-cyan-50 to-white border-2 border-brand-cyan/30 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-bold font-cairo text-slate-800 mb-1">
              ➕ ضيف عطلة شركة جديدة
            </h2>
            <p className="text-xs text-slate-600 mb-4 font-cairo">
              يوم الافتتاح، تأسيس الشركة، نصف يوم رمضان… أي يوم انت بتقفل فيه
              الشركة عن العمل
            </p>

            <form action={addHoliday} className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                  التاريخ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan outline-none text-sm font-cairo"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                  الاسم بالعربي <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="name_ar"
                  required
                  placeholder="مثلاً: ذكرى تأسيس الشركة"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan outline-none text-sm font-cairo"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                  النوع
                </label>
                <select
                  name="holiday_type"
                  defaultValue="company"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan outline-none text-sm font-cairo"
                >
                  <option value="company">🏢 شركة</option>
                  <option value="national">🇪🇬 عيد قومي</option>
                  <option value="religious">🕌 ديني</option>
                  <option value="seasonal">🌸 موسمي</option>
                  <option value="other">📌 أخرى</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                  حالة الأجر
                </label>
                <select
                  name="is_paid"
                  defaultValue="true"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan outline-none text-sm font-cairo"
                >
                  <option value="true">💰 مدفوعة</option>
                  <option value="false">📉 غير مدفوعة</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full md:w-auto px-6 py-2.5 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-sm shadow-md hover:shadow-lg transition font-cairo"
                >
                  ضيف العطلة ✓
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Company-specific holidays */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6">
          <div className="px-5 py-3 border-b border-slate-200 bg-gradient-to-l from-cyan-50 to-white">
            <h2 className="text-sm font-black font-cairo text-slate-700">
              🏢 عطلات شركتك ({companyHolidays.length})
            </h2>
            <p className="text-[11px] text-slate-500 font-cairo">
              عطلات أنت ضفتها — تقدر تحذفها في أي وقت
            </p>
          </div>
          {companyHolidays.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400 font-cairo">
              مفيش عطلات شركة لسه. ضيف أول واحدة من فوق ↑
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {companyHolidays.map((h) => (
                <HolidayRow
                  key={h.id}
                  holiday={h}
                  showRemove={isAdmin}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Global holidays (shared seed, read-only) */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="px-5 py-3 border-b border-slate-200 bg-gradient-to-l from-rose-50 to-white">
            <h2 className="text-sm font-black font-cairo text-slate-700">
              🇪🇬 العطلات الرسمية الموحّدة ({globalHolidays.length})
            </h2>
            <p className="text-[11px] text-slate-500 font-cairo">
              عطلات مصرية رسمية — كل tenant بيستخدمها. للتعديل، ضيف صف خاص
              بشركتك بنفس التاريخ.
            </p>
          </div>
          {globalHolidays.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400 font-cairo">
              مفيش عطلات رسمية مسجّلة — تواصل مع الـ super-admin
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {globalHolidays.map((h) => (
                <HolidayRow key={h.id} holiday={h} showRemove={false} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function HolidayRow({
  holiday,
  showRemove,
}: {
  holiday: Holiday;
  showRemove: boolean;
}) {
  const type = TYPE_LABEL[holiday.holiday_type];
  const dateObj = new Date(holiday.date + "T00:00:00");
  const dayName = dateObj.toLocaleDateString("ar-EG", { weekday: "long" });
  const dateFull = dateObj.toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <li className="px-5 py-3 flex items-center gap-3 flex-wrap">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 flex flex-col items-center justify-center shrink-0">
        <span className="text-[10px] text-slate-500 font-cairo leading-none">
          {dateObj.toLocaleDateString("ar-EG", { month: "short" })}
        </span>
        <span className="text-base font-black text-slate-800 leading-tight">
          {dateObj.getDate()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-slate-800 font-cairo truncate">
          {holiday.name_ar}
        </div>
        <div className="text-[11px] text-slate-500 font-cairo">
          {dayName} · {dateFull}
          {holiday.name_en ? (
            <span className="mx-1" dir="ltr">
              · {holiday.name_en}
            </span>
          ) : null}
        </div>
      </div>
      <span
        className={`text-[10px] px-2 py-0.5 rounded-full border font-bold font-cairo ${type.cls}`}
      >
        {type.ar}
      </span>
      <span
        className={`text-[10px] px-2 py-0.5 rounded-full border font-bold font-cairo ${
          holiday.is_paid
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-slate-50 text-slate-600 border-slate-200"
        }`}
      >
        {holiday.is_paid ? "💰 مدفوعة" : "📉 غير مدفوعة"}
      </span>
      {showRemove && (
        <form action={removeHoliday}>
          <input type="hidden" name="id" value={holiday.id} />
          <ConfirmSubmitButton
            label="🗑"
            message={`هتمسح "${holiday.name_ar}" من تقويم الشركة. تأكد؟`}
            confirmLabel="نعم احذف"
            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer border border-rose-200"
          />
        </form>
      )}
    </li>
  );
}
