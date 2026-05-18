import Link from "next/link";
import { requireHRPage } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";

// Audit log viewer. Migration 018 attaches an INSERT/UPDATE/DELETE
// trigger to every high-value table and writes the before/after JSON
// plus the actor's auth.uid() into public.audit_log. RLS already
// restricts SELECT to HR within the same company, so the page just
// queries with the user's session and gets back tenant-scoped rows.
//
// Filters: table_name, action (INSERT/UPDATE/DELETE), date window,
// and a free-text search across the JSON diff. Pagination is keyset
// on (created_at desc, id desc).

type Params = Promise<{
  table?: string;
  action?: string;
  q?: string;
  before?: string; // cursor: created_at iso
}>;

type AuditRow = {
  id: number;
  actor_id: string | null;
  table_name: string;
  row_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
};

const PAGE_SIZE = 30;

const TABLE_LABELS: Record<string, string> = {
  employees: "موظفين",
  payroll_periods: "فترات الرواتب",
  payroll_entries: "قسائم الرواتب",
  leave_requests: "إجازات",
  advance_requests: "سلف",
  permission_requests: "استئذانات",
  contracts: "عقود",
  team_invitations: "دعوات فريق",
};

const ACTION_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  INSERT: { bg: "bg-emerald-50", fg: "text-emerald-700", label: "إضافة" },
  UPDATE: { bg: "bg-amber-50", fg: "text-amber-700", label: "تعديل" },
  DELETE: { bg: "bg-red-50", fg: "text-red-700", label: "حذف" },
};

export const metadata = {
  title: "سجل النشاط | نِظام",
};

// Force the page to revalidate on every request. Without this, Next.js
// caches the row list + counters between requests, so newly-added rows
// from server actions or import flows take minutes to appear.
export const dynamic = "force-dynamic";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const { supabase, profile } = await requireHRPage();

  // Audit log is an Enterprise feature (compliance + forensics value
  // scales with company size; SMBs on basic/pro don't need full
  // before/after diffs).
  if (!(await canUseFeature("audit_log"))) {
    return <UpgradeRequired feature="audit_log" />;
  }
  const params = await searchParams;

  // Scope the audit log to the caller's company — super-admin sessions
  // can otherwise read every tenant's events via the mig 021 policy.
  const callerCompanyId = profile?.company_id ?? "";

  // Build the query
  let q = supabase
    .from("audit_log")
    .select("id, actor_id, table_name, row_id, action, before_data, after_data, created_at")
    .eq("company_id", callerCompanyId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (params.table) {
    q = q.eq("table_name", params.table);
  }
  if (params.action && ["INSERT", "UPDATE", "DELETE"].includes(params.action)) {
    q = q.eq("action", params.action);
  }
  if (params.before) {
    q = q.lt("created_at", params.before);
  }

  const { data: rawRows } = await q.returns<AuditRow[]>();
  const rows = rawRows ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  // Free-text filter applied client-side over the JSON diff so users
  // can search names ("احمد") even though we don't store a denormalised
  // search column. Cheap because PAGE_SIZE is small.
  const filtered = params.q
    ? pageRows.filter((r) => containsText(r, params.q!))
    : pageRows;

  // Resolve actor names in one query
  const actorIds = Array.from(
    new Set(filtered.map((r) => r.actor_id).filter((x): x is string => !!x)),
  );
  const actorMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", actorIds)
      .returns<Profile[]>();
    for (const p of profiles ?? []) {
      actorMap.set(p.id, p.full_name ?? "—");
    }
  }

  // Next-page cursor
  const nextCursor = hasMore
    ? pageRows[pageRows.length - 1]?.created_at
    : null;

  const buildHref = (overrides: Partial<Record<string, string>>) => {
    const out = new URLSearchParams();
    if (params.table) out.set("table", params.table);
    if (params.action) out.set("action", params.action);
    if (params.q) out.set("q", params.q);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) {
        out.delete(k);
      } else if (v === null) {
        out.delete(k);
      } else {
        out.set(k, v);
      }
    }
    const qs = out.toString();
    return qs ? `/dashboard/audit-log?${qs}` : "/dashboard/audit-log";
  };

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-5xl mx-auto">
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
            📋 سجل النشاط
          </h1>
          <p className="text-sm text-slate-500">
            كل تعديل في الموظفين، الرواتب، الطلبات، العقود، والدعوات — متسجّل هنا.
          </p>
        </header>

        {/* Filters */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
          <form className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-slate-600 mb-1 font-cairo">
                بحث (اسم / قيمة / إيميل)
              </label>
              <input
                type="text"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="مثلاً: احمد"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-sm"
              />
            </div>
            <div className="min-w-[150px]">
              <label className="block text-xs font-bold text-slate-600 mb-1 font-cairo">
                الجدول
              </label>
              <select
                name="table"
                defaultValue={params.table ?? ""}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-sm bg-white"
              >
                <option value="">الكل</option>
                {Object.entries(TABLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[120px]">
              <label className="block text-xs font-bold text-slate-600 mb-1 font-cairo">
                نوع العملية
              </label>
              <select
                name="action"
                defaultValue={params.action ?? ""}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-sm bg-white"
              >
                <option value="">الكل</option>
                <option value="INSERT">إضافة</option>
                <option value="UPDATE">تعديل</option>
                <option value="DELETE">حذف</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white font-bold text-sm font-cairo transition"
            >
              تطبيق
            </button>
            {(params.table || params.action || params.q) && (
              <Link
                href="/dashboard/audit-log"
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-sm font-cairo hover:bg-slate-50 transition"
              >
                مسح
              </Link>
            )}
          </form>
        </section>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
            <div className="text-5xl mb-3">📭</div>
            <div className="font-bold font-cairo text-slate-800 mb-1">
              مفيش نتائج
            </div>
            <p className="text-sm text-slate-500 font-cairo">
              جرّب تغيّر الفلاتر فوق.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((row) => {
              const style = ACTION_STYLE[row.action];
              const actor = row.actor_id
                ? actorMap.get(row.actor_id) ?? "—"
                : "النظام";
              const changes = describeChange(row);

              return (
                <details
                  key={row.id}
                  className="bg-white rounded-xl border border-slate-100 shadow-sm group"
                >
                  <summary className="cursor-pointer list-none p-4 flex flex-wrap items-center gap-3 hover:bg-slate-50 transition">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-bold ${style.bg} ${style.fg} font-cairo`}
                    >
                      {style.label}
                    </span>
                    <span className="font-bold text-slate-800 font-cairo text-sm">
                      {TABLE_LABELS[row.table_name] ?? row.table_name}
                    </span>
                    <span className="text-sm text-slate-600 font-cairo flex-1 min-w-[200px]">
                      {changes.summary}
                    </span>
                    <span className="text-xs text-slate-500 font-cairo">
                      {actor}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {formatDateTime(row.created_at)}
                    </span>
                    <span className="text-xs text-brand-cyan-dark group-open:rotate-180 transition">
                      ▾
                    </span>
                  </summary>

                  <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50/50">
                    {changes.fields.length > 0 ? (
                      <table className="w-full text-xs font-cairo">
                        <thead>
                          <tr className="text-slate-500">
                            <th className="text-right pb-2">الحقل</th>
                            <th className="text-right pb-2">قبل</th>
                            <th className="text-right pb-2">بعد</th>
                          </tr>
                        </thead>
                        <tbody>
                          {changes.fields.map((f, i) => (
                            <tr key={i} className="border-t border-slate-200">
                              <td className="py-1.5 font-bold text-slate-700">
                                {f.field}
                              </td>
                              <td className="py-1.5 text-red-700 font-mono break-all">
                                {f.before}
                              </td>
                              <td className="py-1.5 text-emerald-700 font-mono break-all">
                                {f.after}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-xs text-slate-500 font-cairo">
                        مفيش تفاصيل أكتر
                      </div>
                    )}
                    {row.row_id && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        row_id: {row.row_id}
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {nextCursor && (
          <div className="flex justify-center mt-6">
            <Link
              href={buildHref({ before: nextCursor })}
              className="px-5 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold font-cairo text-sm transition"
            >
              تحميل المزيد ←
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

// Skip fields that don't add insight in the diff view -- they're either
// metadata (created_at) or always equal (id, company_id).
const SKIP_FIELDS = new Set([
  "id",
  "company_id",
  "created_at",
  "updated_at",
]);

function describeChange(row: AuditRow): {
  summary: string;
  fields: Array<{ field: string; before: string; after: string }>;
} {
  const before = row.before_data ?? {};
  const after = row.after_data ?? {};

  if (row.action === "INSERT") {
    const name =
      pickReadableLabel(after) ?? `${row.row_id?.slice(0, 8) ?? "row"}`;
    const fields = Object.entries(after)
      .filter(([k, v]) => !SKIP_FIELDS.has(k) && v !== null && v !== undefined && v !== "")
      .map(([k, v]) => ({ field: k, before: "—", after: stringify(v) }));
    return { summary: `إضافة ${name}`, fields };
  }

  if (row.action === "DELETE") {
    const name =
      pickReadableLabel(before) ?? `${row.row_id?.slice(0, 8) ?? "row"}`;
    const fields = Object.entries(before)
      .filter(([k, v]) => !SKIP_FIELDS.has(k) && v !== null && v !== undefined && v !== "")
      .map(([k, v]) => ({ field: k, before: stringify(v), after: "—" }));
    return { summary: `حذف ${name}`, fields };
  }

  // UPDATE: diff before vs after
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs: Array<{ field: string; before: string; after: string }> = [];
  for (const k of allKeys) {
    if (SKIP_FIELDS.has(k)) continue;
    const b = (before as Record<string, unknown>)[k];
    const a = (after as Record<string, unknown>)[k];
    if (deepEqual(b, a)) continue;
    diffs.push({ field: k, before: stringify(b), after: stringify(a) });
  }

  const name = pickReadableLabel(after) ?? pickReadableLabel(before);
  const summary = name
    ? `تعديل ${name} (${diffs.length} حقل)`
    : `تعديل (${diffs.length} حقل)`;
  return { summary, fields: diffs };
}

function pickReadableLabel(obj: Record<string, unknown>): string | null {
  // Order matters: try the most descriptive field first.
  for (const key of ["full_name", "title", "name", "email", "contract_number"]) {
    const v = obj[key];
    if (typeof v === "string" && v.trim().length > 0) return `"${v}"`;
  }
  const status = obj["status"];
  if (typeof status === "string") return `(الحالة: ${status})`;
  return null;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  const s = String(value);
  return s.length > 80 ? s.slice(0, 77) + "..." : s;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

function containsText(row: AuditRow, needle: string): boolean {
  const lower = needle.toLowerCase().trim();
  if (!lower) return true;
  const haystack = JSON.stringify({
    b: row.before_data,
    a: row.after_data,
    t: row.table_name,
    r: row.row_id,
  }).toLowerCase();
  return haystack.includes(lower);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("ar-EG", {
      day: "2-digit",
      month: "short",
    }) +
    " " +
    d.toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
}
