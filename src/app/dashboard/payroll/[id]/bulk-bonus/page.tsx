// ============================================================================
// /dashboard/payroll/[id]/bulk-bonus — apply a bonus to every (or some)
// entries in a period in one shot.
// ============================================================================
//
// Typical use: HR types "500" + "عيدية الفطر" and hits submit. The action
// tops up bonuses on every entry, recalculates net, and logs the run for
// audit. Optional: pick a subset of recipients (e.g. only one department).

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, requireHRPage } from "@/lib/permissions";
import { applyBulkBonus } from "../../actions";
import { formatEGP } from "@/lib/payroll";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

type EntryWithEmployee = {
  id: string;
  bonuses: number;
  employees: {
    full_name: string;
    job_title: string | null;
    department: string | null;
  } | null;
};

type Period = {
  id: string;
  status: "draft" | "approved" | "paid" | "cancelled";
  year: number;
  month: number;
  start_date: string | null;
  end_date: string | null;
};

export default async function BulkBonusPage({
  params,
  searchParams,
}: PageProps) {
  const { id: periodId } = await params;
  const { error: errorMsg } = await searchParams;

  await requireHRPage();
  const supabase = await createClient();

  // Scope the entries list to the caller's company so a super-admin
  // session can't load another tenant's period via a forged periodId.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [periodRes, entriesRes] = await Promise.all([
    supabase
      .from("payroll_periods")
      .select("id, status, year, month, start_date, end_date")
      .eq("id", periodId)
      .single<Period>(),
    supabase
      .from("payroll_entries")
      .select(
        "id, bonuses, employees(full_name, job_title, department)",
      )
      .eq("company_id", callerCompanyId)
      .eq("period_id", periodId)
      .returns<EntryWithEmployee[]>(),
  ]);

  if (!periodRes.data) notFound();
  const period = periodRes.data;
  const entries = entriesRes.data ?? [];

  // Block the form if the period is closed
  const isClosed = period.status === "paid" || period.status === "cancelled";

  // Build department list for the optional "department only" filter
  const departments = Array.from(
    new Set(
      entries
        .map((e) => e.employees?.department?.trim())
        .filter((d): d is string => !!d && d.length > 0),
    ),
  ).sort();

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/dashboard/payroll/${periodId}`}
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للدورة
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold mb-2 font-cairo">
            🎁 صرف جماعي
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            مكافأة جماعية للموظفين
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed">
            صرف نفس المبلغ كمكافأة لكل الموظفين في الدورة دي (أو لقسم محدد).
            بيتطبق على{" "}
            <span className="font-bold text-slate-700">
              خانة &quot;مكافآت&quot; في كل entry
            </span>{" "}
            وبيُعاد حساب الصافي تلقائياً.
          </p>
        </header>

        {errorMsg && (
          <div className="mb-5 bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 font-cairo text-sm">
            ⚠ {decodeURIComponent(errorMsg)}
          </div>
        )}

        {isClosed && (
          <div className="mb-5 bg-amber-50 border-2 border-amber-200 rounded-xl p-4 font-cairo text-amber-800">
            <div className="font-bold mb-1">⚠ الدورة دي مقفولة</div>
            <p className="text-sm">
              مينفعش تضيف مكافآت على دورة بحالة &quot;مدفوع&quot; أو &quot;ملغية&quot;. افتح
              الدورة الأول من زر &quot;إعادة فتح&quot; في صفحة الدورة.
            </p>
          </div>
        )}

        <form
          action={applyBulkBonus}
          className={`space-y-4 ${isClosed ? "opacity-50 pointer-events-none" : ""}`}
        >
          <input type="hidden" name="period_id" value={periodId} />

          {/* Amount */}
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <label className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
              💰 المبلغ لكل موظف (ج)
            </label>
            <input
              type="number"
              name="amount_each"
              required
              step="0.01"
              min="0.01"
              placeholder="مثلاً: 500"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo text-lg font-bold"
            />
            <p className="text-[11px] text-slate-500 mt-2 font-cairo">
              المبلغ ده هيتضاف لمكافآت كل الموظفين المختارين.
            </p>
          </section>

          {/* Reason */}
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <label className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
              📝 سبب المكافأة
            </label>
            <input
              type="text"
              name="reason"
              required
              minLength={3}
              placeholder="مثلاً: عيدية الفطر، مكافأة إنجاز مشروع..."
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
            />
            <p className="text-[11px] text-slate-500 mt-2 font-cairo">
              السبب هيظهر في كشف المكافأة + audit log.
            </p>
          </section>

          {/* Recipients (radio: all / specific department) */}
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <label className="block text-sm font-bold text-slate-700 mb-3 font-cairo">
              👥 المستفيدين
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                <input
                  type="radio"
                  name="recipients_mode"
                  value="all"
                  defaultChecked
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold text-slate-800 font-cairo text-sm">
                    كل الموظفين في الدورة ({entries.length})
                  </div>
                  <div className="text-[11px] text-slate-500 font-cairo">
                    الأكثر شيوعاً — عيدية موحّدة لكل الفريق
                  </div>
                </div>
              </label>

              {departments.length > 0 && (
                <details className="border border-slate-200 rounded-lg">
                  <summary className="px-3 py-2 cursor-pointer text-sm font-bold text-slate-700 font-cairo">
                    أو اختار قسم محدد ↓
                  </summary>
                  <div className="p-3 space-y-1.5">
                    {departments.map((d) => {
                      const count = entries.filter(
                        (e) => e.employees?.department === d,
                      ).length;
                      return (
                        <label
                          key={d}
                          className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer transition"
                        >
                          <input
                            type="radio"
                            name="recipients_mode"
                            value={`dept:${d}`}
                          />
                          <span className="text-sm font-cairo flex-1">
                            {d}
                          </span>
                          <span className="text-[11px] text-slate-500 font-cairo">
                            {count} موظف
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>

            {/* Hidden "recipients" field — populated by the form's submit
                handler is overkill; instead we have a client-side script
                that converts "recipients_mode" radio to the comma-sep
                "recipients" the server action expects. But since this is
                an SSR-only flow, simpler: the server action accepts
                "recipients_mode" semantically — let's stay with radio +
                let the server action handle it inline. */}
            <input
              type="hidden"
              name="recipients"
              value="all"
              id="recipients-hidden"
            />
            {/* Small inline script keeps the hidden field in sync with the
                chosen radio. Inline = no client-component bundle bloat. */}
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  document.querySelectorAll('input[name=recipients_mode]').forEach(r => {
                    r.addEventListener('change', () => {
                      const hidden = document.getElementById('recipients-hidden');
                      if (!hidden) return;
                      if (r.value === 'all') { hidden.value = 'all'; return; }
                      if (r.value.startsWith('dept:')) {
                        const dept = r.value.slice(5);
                        const ids = Array.from(document.querySelectorAll('[data-employee-dept]'))
                          .filter(el => el.getAttribute('data-employee-dept') === dept)
                          .map(el => el.getAttribute('data-entry-id'))
                          .filter(Boolean)
                          .join(',');
                        hidden.value = ids;
                      }
                    });
                  });
                `,
              }}
            />
          </section>

          {/* Preview table — also serves as the data source for the
              dept-filtering script above (data-attribute pickup) */}
          <details className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <summary className="px-5 py-3 cursor-pointer text-sm font-bold text-slate-700 font-cairo">
              📋 عرض كل الموظفين ({entries.length}) ↓
            </summary>
            <div className="max-h-72 overflow-y-auto border-t border-slate-100">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-[11px] font-bold text-slate-600 font-cairo">
                      الاسم
                    </th>
                    <th className="px-3 py-2 text-[11px] font-bold text-slate-600 font-cairo">
                      القسم
                    </th>
                    <th className="px-3 py-2 text-[11px] font-bold text-slate-600 font-cairo">
                      مكافأة حالية
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      data-entry-id={e.id}
                      data-employee-dept={e.employees?.department ?? ""}
                    >
                      <td className="px-3 py-2 font-cairo text-slate-800">
                        {e.employees?.full_name ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-cairo text-slate-600 text-xs">
                        {e.employees?.department ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-emerald-700 font-bold text-xs">
                        {formatEGP(e.bonuses ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isClosed}
              className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold font-cairo shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🎁 صرف المكافأة الجماعية
            </button>
            <Link
              href={`/dashboard/payroll/${periodId}`}
              className="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo"
            >
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
