import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ReviewBatchTable } from "./review-batch-table";
import {
  updateAttendanceRow,
  deleteAttendanceRow,
  confirmAttendanceBatch,
  deleteAttendanceBatch,
} from "./actions";

// Two display modes:
//   ?batch=<uuid>  -> details of ONE batch (editable table of its rows)
//   (no batch)     -> list of recent batches with row counts + actions
//
// HR lands on the single-batch view automatically after import; the
// no-param view is reached from the sidebar / banner "راجع الكل".

export const metadata = {
  title: "مراجعة الحضور المستورد | نِظام",
};

type Params = Promise<{
  batch?: string;
  just_imported?: string;
  imported?: string;
  skipped?: string;
  filtered?: string;
  mode?: string;
  errors?: string;
  confirmed?: string;
  row_saved?: string;
  row_deleted?: string;
  batch_deleted?: string;
  error?: string;
}>;

type BatchSummary = {
  batch_id: string;
  imported_at: string | null;
  row_count: number;
  earliest_date: string;
  latest_date: string;
  employee_count: number;
};

export type ReviewRow = {
  id: string;
  date: string;
  status: "present" | "absent" | "half_day" | "leave" | "holiday" | "weekend";
  check_in: string | null;
  check_out: string | null;
  tardiness_minutes: number;
  early_leave_minutes: number;
  notes: string | null;
  employees: {
    id: string;
    full_name: string;
    employee_code: string | null;
    pay_frequency: "monthly" | "weekly" | null;
  } | null;
};

export default async function AttendanceReviewPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Resolve the caller's company once so every nested view scopes
  // its attendance/batch queries to it — otherwise super-admin
  // sessions can browse other tenants' batches via a forged ?batch UUID.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const sp = await searchParams;
  const batchId = sp.batch ?? null;

  if (batchId) {
    return (
      <SingleBatchView
        supabase={supabase}
        batchId={batchId}
        callerCompanyId={callerCompanyId}
        sp={sp}
      />
    );
  }
  return <BatchListView supabase={supabase} sp={sp} />;
}

// ============================================================================
// SINGLE-BATCH VIEW
// ============================================================================

async function SingleBatchView({
  supabase,
  batchId,
  callerCompanyId,
  sp,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  batchId: string;
  callerCompanyId: string;
  sp: Awaited<Params>;
}) {
  const { data: rowsData } = await supabase
    .from("attendance")
    .select(
      "id, date, status, check_in, check_out, tardiness_minutes, early_leave_minutes, notes, employees(id, full_name, employee_code, pay_frequency)",
    )
    .eq("company_id", callerCompanyId)
    .eq("import_batch_id", batchId)
    .order("date", { ascending: true })
    .order("employees(full_name)" as never, { ascending: true });

  // Supabase resolves embedded employees(...) join as array; normalize.
  const rows: ReviewRow[] = (rowsData ?? []).map((r) => {
    const row = r as Record<string, unknown> & {
      employees:
        | ReviewRow["employees"]
        | { id: string; full_name: string; employee_code: string | null; pay_frequency: "monthly" | "weekly" | null }[]
        | null;
    };
    const emp = Array.isArray(row.employees) ? row.employees[0] ?? null : row.employees;
    return {
      id: row.id as string,
      date: row.date as string,
      status: row.status as ReviewRow["status"],
      check_in: (row.check_in as string | null) ?? null,
      check_out: (row.check_out as string | null) ?? null,
      tardiness_minutes: (row.tardiness_minutes as number | null) ?? 0,
      early_leave_minutes: (row.early_leave_minutes as number | null) ?? 0,
      notes: (row.notes as string | null) ?? null,
      employees: emp,
    };
  });

  const justImported = sp.just_imported === "1";
  const confirmed = sp.confirmed === "1";

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/attendance/review"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← كل دفعات الاستيراد
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            🔍 مراجعة دفعة استيراد
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            راجع كل سطر · عدّل اللي محتاج تعديل · احذف الغلط · اعتمد الدفعة لما تخلص
          </p>
        </header>

        {/* Banner reflecting the just-completed import */}
        {justImported && (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 font-cairo">
            <div className="font-bold text-emerald-900 mb-1">
              ✓ تم الاستيراد بنجاح ({sp.mode === "weekly" ? "أسبوعي" : sp.mode === "all" ? "كل الموظفين" : "شهري"})
            </div>
            <div className="text-sm text-emerald-800 leading-relaxed">
              اتسجل <b>{sp.imported}</b> سجل حضور
              {sp.skipped && parseInt(sp.skipped) > 0 && (
                <>
                  {" · "}
                  <b>{sp.skipped}</b> سطر اتخطى بسبب أخطاء
                </>
              )}
              {sp.filtered && parseInt(sp.filtered) > 0 && (
                <>
                  {" · "}
                  <b>{sp.filtered}</b> سطر اتتجاهل (موظفين{" "}
                  {sp.mode === "monthly" ? "أسبوعيين" : "شهريين"})
                </>
              )}
            </div>
            {sp.errors && (
              <details className="mt-2">
                <summary className="text-xs text-emerald-700 cursor-pointer font-bold">
                  شوف تفاصيل الأخطاء
                </summary>
                <pre className="mt-2 p-2 bg-white rounded text-xs text-slate-700 whitespace-pre-wrap font-mono">
                  {decodeURIComponent(sp.errors)}
                </pre>
              </details>
            )}
          </div>
        )}

        {confirmed && (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3 text-emerald-800 font-cairo text-sm">
            ✓ تم اعتماد الدفعة. الـ banner مش هيظهر تاني على /dashboard/attendance.
          </div>
        )}

        {sp.row_saved && (
          <div className="mb-4 bg-sky-50 border border-sky-200 rounded-lg p-2 text-sky-800 font-cairo text-xs">
            ✓ تم حفظ سجل #{sp.row_saved}
          </div>
        )}

        {sp.row_deleted && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-800 font-cairo text-xs">
            ✓ تم حذف السجل
          </div>
        )}

        {sp.error && (
          <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 font-cairo text-sm">
            ⚠ {decodeURIComponent(sp.error)}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
            <div className="text-5xl mb-3">📭</div>
            <h2 className="text-lg font-bold font-cairo mb-2 text-slate-700">
              الدفعة دي فاضية أو اتحذفت كلها
            </h2>
            <Link
              href="/dashboard/attendance/review"
              className="text-sm text-brand-cyan-dark hover:underline font-bold font-cairo"
            >
              ← شوف دفعات تانية
            </Link>
          </div>
        ) : (
          <>
            <ReviewBatchTable
              rows={rows}
              batchId={batchId}
              saveAction={updateAttendanceRow}
              deleteRowAction={deleteAttendanceRow}
            />

            {/* Batch-level actions: confirm OR delete-all */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-slate-100 shadow-md p-4">
              <div className="text-sm text-slate-600 font-cairo">
                خلصت مراجعة الـ <b>{rows.length}</b> سجل؟
              </div>
              <div className="flex items-center gap-2">
                <form action={confirmAttendanceBatch}>
                  <input type="hidden" name="batch_id" value={batchId} />
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition font-cairo"
                  >
                    ✓ اعتمد الدفعة
                  </button>
                </form>
                <form action={deleteAttendanceBatch}>
                  <input type="hidden" name="batch_id" value={batchId} />
                  <input type="hidden" name="confirm" value="حذف" />
                  <ConfirmSubmitButton
                    label="🗑 احذف الدفعة كلها"
                    message={`هتمسح كل الـ ${rows.length} سجل في الدفعة دي. الحذف نهائي.`}
                    confirmLabel="نعم احذف"
                    className="px-4 py-2 rounded-lg border-2 border-red-200 text-red-700 hover:bg-red-50 font-bold text-sm font-cairo cursor-pointer"
                  />
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// ============================================================================
// BATCH LIST VIEW
// ============================================================================

async function BatchListView({
  supabase,
  sp,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  sp: Awaited<Params>;
}) {
  const { data: batchData } = await supabase.rpc(
    "list_recent_attendance_batches",
    { p_limit: 30 },
  );
  const batches = (Array.isArray(batchData) ? batchData : []) as BatchSummary[];

  const batchDeleted = sp.batch_deleted
    ? parseInt(decodeURIComponent(sp.batch_deleted), 10)
    : null;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/attendance"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لتسجيل الحضور
          </Link>
        </div>

        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              📥 دفعات استيراد الحضور
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              كل ملف رفعته بيظهر هنا كـ "دفعة". اضغط واحدة عشان تراجع سطورها.
            </p>
          </div>
          <Link
            href="/dashboard/attendance/import"
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition font-cairo"
          >
            ⚡ استيراد جديد
          </Link>
        </header>

        {batchDeleted !== null && (
          <div className="mb-6 bg-amber-50 border-2 border-amber-200 rounded-xl p-4 font-cairo text-amber-900">
            <div className="font-bold mb-1">🗑 تم حذف الدفعة</div>
            <p className="text-sm">
              اتمسح <b>{batchDeleted.toLocaleString("ar-EG")}</b> سجل حضور
              مع كل البيانات المرتبطة.
            </p>
          </div>
        )}

        {batches.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">
              مفيش دفعات استيراد لسه
            </h2>
            <p className="text-sm text-slate-500 mb-6 font-cairo">
              ارفع شيت حضور من البصمة عشان يبقى عندك دفعة تراجعها
            </p>
            <Link
              href="/dashboard/attendance/import"
              className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo"
            >
              📥 استيراد حضور
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map((b) => (
              <Link
                key={b.batch_id}
                href={`/dashboard/attendance/review?batch=${b.batch_id}`}
                className="block bg-white rounded-2xl border border-slate-100 hover:border-brand-cyan/40 shadow-sm hover:shadow-md p-5 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="font-black font-cairo text-slate-800 mb-1">
                      📦 {formatBatchLabel(b)}
                    </div>
                    <div className="text-xs text-slate-500 font-cairo">
                      {b.imported_at
                        ? new Date(b.imported_at).toLocaleString("ar-EG", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-cairo">
                    <Stat label="سجلات" value={Number(b.row_count)} />
                    <Stat label="موظفين" value={Number(b.employee_count)} />
                    <Stat
                      label="من"
                      value={b.earliest_date}
                      mono
                    />
                    <Stat label="لـ" value={b.latest_date} mono />
                    <span className="text-brand-cyan-dark font-bold">راجع ←</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: number | string;
  mono?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-slate-500 font-bold font-cairo uppercase">
        {label}
      </div>
      <div
        className={`text-sm font-black text-slate-700 ${mono ? "font-mono" : ""}`}
        dir={mono ? "ltr" : undefined}
      >
        {typeof value === "number" ? value.toLocaleString("ar-EG") : value}
      </div>
    </div>
  );
}

function formatBatchLabel(b: BatchSummary): string {
  if (b.earliest_date === b.latest_date) {
    return `دفعة ${b.earliest_date}`;
  }
  return `دفعة ${b.earliest_date} → ${b.latest_date}`;
}
