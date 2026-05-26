import Link from "next/link";
import {
  createShift,
  createRotation,
  deleteShift,
  deleteRotation,
} from "./actions";
import { requireHRPage } from "@/lib/permissions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

// Shift management page. Three sections:
//   1. Today's roster -- live calculation of who's on which shift today
//      via the get_todays_roster RPC from migration 024.
//   2. Shifts list + inline "create shift" form.
//   3. Rotation patterns list + a "create rotation" wizard that takes
//      2-4 shift IDs and a "days per shift" number and assembles the
//      JSONB pattern automatically (the standard 6-on / 1-off setup).
//
// Employee-to-shift assignment lives on the employee detail page so
// HR sees one screen per employee.

type Params = Promise<{
  created?: string;
  updated?: string;
  deleted?: string;
  error?: string;
}>;

type Shift = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_overnight: boolean;
  expected_hours: number;
  color: string;
  is_active: boolean;
};

type Rotation = {
  id: string;
  name: string;
  cycle_days: number;
  pattern: (string | null)[];
  description: string | null;
};

type RosterRow = {
  employee_id: string;
  employee_name: string;
  department: string | null;
  shift_id: string | null;
  shift_name: string | null;
  shift_start: string | null;
  shift_end: string | null;
  is_off: boolean;
};

export const metadata = {
  title: "الورديات والتدوير | نِظام",
};

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  cyan:    { bg: "bg-cyan-50",    text: "text-cyan-800",    border: "border-cyan-200" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200" },
  amber:   { bg: "bg-amber-50",   text: "text-amber-800",   border: "border-amber-200" },
  red:     { bg: "bg-red-50",     text: "text-red-800",     border: "border-red-200" },
  purple:  { bg: "bg-purple-50",  text: "text-purple-800",  border: "border-purple-200" },
  slate:   { bg: "bg-slate-100",  text: "text-slate-700",   border: "border-slate-200" },
  gold:    { bg: "bg-amber-100",  text: "text-amber-900",   border: "border-amber-300" },
  rose:    { bg: "bg-rose-50",    text: "text-rose-800",    border: "border-rose-200" },
};

function colorFor(color: string) {
  return COLOR_CLASSES[color] ?? COLOR_CLASSES.cyan;
}

function formatTime(t: string): string {
  return t.slice(0, 5); // HH:MM
}

// Force the page to revalidate on every request. Without this, Next.js
// caches the row list + counters between requests, so newly-added rows
// from server actions or import flows take minutes to appear.
export const dynamic = "force-dynamic";

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const { supabase, profile } = await requireHRPage();
  const sp = await searchParams;

  // Scope shifts + rotations to the caller's company. While no
  // super-admin SELECT bypass exists for these tables today, future
  // policies could grant cross-tenant access, so the explicit filter
  // is defense in depth.
  const callerCompanyId = profile?.company_id ?? "";

  const [{ data: shifts }, { data: rotations }, rosterResult] = await Promise.all([
    supabase
      .from("shifts")
      .select("id, name, start_time, end_time, is_overnight, expected_hours, color, is_active")
      .eq("company_id", callerCompanyId)
      .order("start_time")
      .returns<Shift[]>(),
    supabase
      .from("shift_rotations")
      .select("id, name, cycle_days, pattern, description")
      .eq("company_id", callerCompanyId)
      .order("created_at", { ascending: false })
      .returns<Rotation[]>(),
    supabase.rpc("get_todays_roster"),
  ]);

  const shiftList = shifts ?? [];
  const activeShifts = shiftList.filter((s) => s.is_active);
  const rotationList = rotations ?? [];
  // supabase-js TS inference assumes RPC returns are single objects;
  // get_todays_roster is SETOF -- cast through unknown for the right
  // array shape.
  const rosterList: RosterRow[] = Array.isArray(rosterResult.data)
    ? (rosterResult.data as unknown as RosterRow[])
    : [];

  // Group roster by shift for the at-a-glance card
  const rosterByShift = new Map<string | null, RosterRow[]>();
  for (const r of rosterList) {
    const key = r.shift_id ?? null;
    const existing = rosterByShift.get(key) ?? [];
    existing.push(r);
    rosterByShift.set(key, existing);
  }

  const banner =
    sp.created === "shift"
      ? "✓ تم إضافة الوردية"
      : sp.created === "rotation"
      ? "✓ تم إضافة نمط التدوير"
      : sp.updated === "shift"
      ? "✓ تم تحديث الوردية"
      : sp.deleted === "shift"
      ? "تم حذف الوردية"
      : sp.deleted === "rotation"
      ? "تم حذف نمط التدوير"
      : null;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              ⏱ الورديات والتدوير
            </h1>
            <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-3xl">
              عرّف ورديات العمل (الأولى / الثانية / الثالثة / الإدارة) وأنماط التدوير
              (مثل 6 أيام × 3 ورديات). الموظف بيتربط على وردية ثابتة أو على نمط تدوير
              من صفحته.
            </p>
          </div>
          <Link
            href="/dashboard/shifts/weekly"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-bold text-sm shadow-md font-cairo transition whitespace-nowrap"
          >
            📅 جدول أسبوعي قابل للطباعة
          </Link>
        </header>

        {banner && (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3 text-emerald-800 font-cairo text-sm">
            {banner}
          </div>
        )}
        {sp.error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 font-cairo text-sm">
            ⚠ {decodeURIComponent(sp.error)}
          </div>
        )}

        {/* ----------------------------------------------------------------
            Today's roster
        ---------------------------------------------------------------- */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
          <h2 className="text-lg font-bold font-cairo text-slate-800 mb-1">
            📅 وردية اليوم — {new Date().toLocaleDateString("ar-EG", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
          <p className="text-xs text-slate-500 font-cairo mb-4">
            توزيع الموظفين النشطين على الورديات النهاردة (يتم الحساب تلقائيًا من نمط التدوير).
          </p>

          {rosterList.length === 0 ? (
            <div className="text-center py-8 text-slate-500 font-cairo text-sm">
              مفيش موظفين نشطين. ضيف موظفين من /dashboard/employees الأول.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* One card per active shift */}
              {activeShifts.map((s) => {
                const list = rosterByShift.get(s.id) ?? [];
                const c = colorFor(s.color);
                return (
                  <div
                    key={s.id}
                    className={`rounded-xl border-2 ${c.border} ${c.bg} p-4`}
                  >
                    <div className={`text-xs font-bold ${c.text} mb-1 font-cairo`}>
                      {s.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mb-2" dir="ltr">
                      {formatTime(s.start_time)} – {formatTime(s.end_time)}
                    </div>
                    <div className={`text-3xl font-black ${c.text} mb-2 font-display`}>
                      {list.length}
                    </div>
                    <div className="text-[11px] text-slate-700 font-cairo space-y-0.5 max-h-32 overflow-y-auto">
                      {list.slice(0, 5).map((r) => (
                        <div key={r.employee_id}>· {r.employee_name}</div>
                      ))}
                      {list.length > 5 && (
                        <div className="text-slate-400">و {list.length - 5} غيره</div>
                      )}
                      {list.length === 0 && (
                        <div className="text-slate-400">مفيش موظفين النهاردة</div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Off / unassigned */}
              <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-700 mb-1 font-cairo">
                  راحة / غير محدد
                </div>
                <div className="text-[10px] text-slate-500 font-cairo mb-2">
                  موظفين يومهم إجازة أو ما اتعينش لهم وردية
                </div>
                <div className="text-3xl font-black text-slate-700 mb-2 font-display">
                  {rosterByShift.get(null)?.length ?? 0}
                </div>
                <div className="text-[11px] text-slate-700 font-cairo space-y-0.5 max-h-32 overflow-y-auto">
                  {(rosterByShift.get(null) ?? []).slice(0, 5).map((r) => (
                    <div key={r.employee_id}>· {r.employee_name}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ----------------------------------------------------------------
            Shifts list + create form
        ---------------------------------------------------------------- */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold font-cairo text-slate-800 mb-1">
                🕒 الورديات ({shiftList.length})
              </h2>
              <p className="text-xs text-slate-500 font-cairo">
                وقت كل وردية وساعات الدوام المتوقعة.
              </p>
            </div>
          </div>

          {/* Existing shifts table */}
          {shiftList.length > 0 && (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm font-cairo">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-200">
                    <th className="px-2 py-2 text-right">الاسم</th>
                    <th className="px-2 py-2 text-right">من</th>
                    <th className="px-2 py-2 text-right">إلى</th>
                    <th className="px-2 py-2 text-right">ساعات</th>
                    <th className="px-2 py-2 text-right">يعدّي منتصف الليل؟</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {shiftList.map((s) => {
                    const c = colorFor(s.color);
                    return (
                      <tr key={s.id} className="border-b border-slate-100">
                        <td className="px-2 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-md ${c.bg} ${c.text} border ${c.border} font-bold`}
                          >
                            {s.name}
                          </span>
                        </td>
                        <td className="px-2 py-3 font-mono" dir="ltr">{formatTime(s.start_time)}</td>
                        <td className="px-2 py-3 font-mono" dir="ltr">{formatTime(s.end_time)}</td>
                        <td className="px-2 py-3">{s.expected_hours} س</td>
                        <td className="px-2 py-3">
                          {s.is_overnight ? "نعم 🌙" : "—"}
                        </td>
                        <td className="px-2 py-3 text-left">
                          <form action={async () => { "use server"; await deleteShift(s.id); }}>
                            <ConfirmSubmitButton
                              label="حذف"
                              message={`هتمسح الوردية "${s.name}". لو في موظفين مرتبطين بيها، ربطهم هيتلغى.`}
                              confirmLabel="نعم احذف"
                              className="text-xs text-red-600 hover:underline cursor-pointer font-cairo"
                            />
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Create shift form */}
          <details className="bg-slate-50 rounded-xl border border-slate-200 p-4 mt-3">
            <summary className="cursor-pointer text-sm font-bold text-slate-700 font-cairo">
              + إضافة وردية جديدة
            </summary>
            <form action={createShift} className="grid md:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                  اسم الوردية
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="مثلاً: الوردية الأولى"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                  اللون
                </label>
                <select
                  name="color"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-sm"
                >
                  <option value="cyan">سماوي</option>
                  <option value="emerald">أخضر</option>
                  <option value="amber">برتقالي</option>
                  <option value="purple">بنفسجي</option>
                  <option value="rose">وردي</option>
                  <option value="slate">رمادي</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                  وقت البداية
                </label>
                <input
                  type="time"
                  name="start_time"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                  وقت النهاية
                </label>
                <input
                  type="time"
                  name="end_time"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                  الساعات المتوقعة
                </label>
                <input
                  type="number"
                  name="expected_hours"
                  defaultValue="8"
                  min="1"
                  max="24"
                  step="0.5"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm"
                />
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700 font-cairo">
                  <input
                    type="checkbox"
                    name="is_overnight"
                    className="w-4 h-4 accent-brand-cyan-dark"
                  />
                  بتعدّي منتصف الليل (مثلاً 4م-12ص)
                </label>
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full px-4 py-2.5 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white font-bold text-sm font-cairo transition"
                >
                  أضف الوردية
                </button>
              </div>
            </form>
          </details>
        </section>

        {/* ----------------------------------------------------------------
            Rotation patterns
        ---------------------------------------------------------------- */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold font-cairo text-slate-800 mb-1">
                🔄 أنماط التدوير ({rotationList.length})
              </h2>
              <p className="text-xs text-slate-500 font-cairo leading-relaxed">
                نمط التدوير بيخلّي الموظف يتنقل بين الورديات بشكل دوري (مثل: 6 أيام × 3 ورديات + يوم راحة بين كل وردية = 21 يوم).
              </p>
            </div>
          </div>

          {rotationList.map((r) => (
            <RotationCard
              key={r.id}
              rotation={r}
              shifts={shiftList}
            />
          ))}

          {/* Create rotation -- standard pattern wizard */}
          <details className="bg-slate-50 rounded-xl border border-slate-200 p-4 mt-3">
            <summary className="cursor-pointer text-sm font-bold text-slate-700 font-cairo">
              + إنشاء نمط تدوير جديد
            </summary>
            <form action={createRotation} className="space-y-4 mt-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                    اسم النمط
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="مثلاً: تدوير 3 ورديات للإنتاج"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                    أيام كل وردية قبل التدوير
                  </label>
                  <input
                    type="number"
                    name="days_per_shift"
                    defaultValue="6"
                    min="1"
                    max="30"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 font-cairo">
                    عدد الأيام اللي الموظف بيشتغلهم في وردية واحدة قبل ما يتنقل لللي بعدها
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 font-cairo">
                  ترتيب الورديات في التدوير
                </label>
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-20 font-cairo">
                        الوردية {n}
                      </span>
                      <select
                        name={`shift_${n}`}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm font-cairo"
                      >
                        <option value="">— مفيش —</option>
                        {activeShifts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({formatTime(s.start_time)}–{formatTime(s.end_time)})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2 font-cairo">
                  لازم تختار وردتين على الأقل. بعد كل وردية هيكون في يوم راحة تلقائيًا.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                  ملاحظات (اختياري)
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="شرح مختصر للنمط"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full px-4 py-2.5 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white font-bold text-sm font-cairo transition"
              >
                إنشاء النمط
              </button>
            </form>
          </details>
        </section>

        <p className="text-center text-xs text-slate-400 font-cairo">
          💡 لتعيين موظف على وردية / نمط تدوير، روح صفحته في{" "}
          <Link href="/dashboard/employees" className="text-brand-cyan-dark hover:underline">
            الموظفين
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Rotation card -- shows the cycle visually
// ----------------------------------------------------------------------------

function RotationCard({
  rotation,
  shifts,
}: {
  rotation: Rotation;
  shifts: Shift[];
}) {
  const shiftById = new Map(shifts.map((s) => [s.id, s]));

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="font-bold text-slate-800 font-cairo">{rotation.name}</div>
          <div className="text-xs text-slate-500 font-cairo mt-0.5">
            دورة {rotation.cycle_days} يوم
          </div>
          {rotation.description && (
            <p className="text-xs text-slate-600 mt-2 font-cairo leading-relaxed max-w-2xl">
              {rotation.description}
            </p>
          )}
        </div>
        <form action={async () => { "use server"; await deleteRotation(rotation.id); }}>
          <ConfirmSubmitButton
            label="حذف"
            message={`هتمسح نمط التدوير "${rotation.name}". الموظفين المرتبطين بيه ربطهم هيتلغى.`}
            confirmLabel="نعم احذف"
            className="text-xs text-red-600 hover:underline cursor-pointer font-cairo"
          />
        </form>
      </div>

      {/* Pattern visualization */}
      <div className="flex flex-wrap gap-1 mt-3">
        {rotation.pattern.map((slot, i) => {
          if (slot === null || slot === "") {
            return (
              <div
                key={i}
                className="w-8 h-8 rounded-md bg-slate-200 border border-slate-300 text-[10px] text-slate-500 font-bold flex items-center justify-center"
                title={`اليوم ${i + 1}: راحة`}
              >
                ر
              </div>
            );
          }
          const s = shiftById.get(slot);
          if (!s) return (
            <div
              key={i}
              className="w-8 h-8 rounded-md bg-rose-50 border border-rose-200 text-[10px] text-rose-700 font-bold flex items-center justify-center"
              title={`اليوم ${i + 1}: وردية محذوفة`}
            >
              ?
            </div>
          );
          const c = colorFor(s.color);
          return (
            <div
              key={i}
              className={`w-8 h-8 rounded-md ${c.bg} ${c.text} border ${c.border} text-[10px] font-bold flex items-center justify-center`}
              title={`اليوم ${i + 1}: ${s.name}`}
            >
              {s.name.split(" ").pop()?.[0] ?? "?"}
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[10px] text-slate-500 font-cairo">
        كل مربع = يوم واحد. "ر" = راحة. الحرف = أول حرف من اسم الوردية.
      </div>
    </div>
  );
}
