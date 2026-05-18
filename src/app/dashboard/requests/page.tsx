import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import {
  STATUS_LABELS_AR,
  STATUS_CLASSES,
  LEAVE_TYPE_LABELS_AR,
  PERMISSION_TYPE_LABELS_AR,
  REQUEST_KIND_ICONS,
  type RequestStatus,
  type LeaveType,
  type PermissionType,
} from "@/lib/requests";
import { formatEGP, formatDateShort, formatDateRange } from "@/lib/format";

type EmployeeMini = { id: string; full_name: string; job_title: string | null };

type LeaveRow = {
  id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: RequestStatus;
  created_at: string;
  employees: EmployeeMini | null;
};

type AdvanceRow = {
  id: string;
  amount: number;
  installments: number;
  reason: string | null;
  status: RequestStatus;
  created_at: string;
  employees: EmployeeMini | null;
};

type PermissionRow = {
  id: string;
  permission_type: PermissionType;
  permission_date: string;
  from_time: string | null;
  to_time: string | null;
  reason: string | null;
  status: RequestStatus;
  created_at: string;
  employees: EmployeeMini | null;
};

// Force the page to revalidate on every request. Without this, Next.js
// caches the row list + counters between requests, so newly-added rows
// from server actions or import flows take minutes to appear.
export const dynamic = "force-dynamic";

export default async function RequestsInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; decided?: string }>;
}) {
  const { filter, decided } = await searchParams;
  const showAll = filter === "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pull the three kinds in parallel. Scope every one to the caller's
  // company explicitly — super-admin sessions can otherwise pull pending
  // requests from every tenant into this inbox.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";
  const statusFilter = showAll ? null : "pending";

  const [leaveRes, advanceRes, permRes] = await Promise.all([
    (statusFilter
      ? supabase
          .from("leave_requests")
          .select(
            "id, leave_type, start_date, end_date, days_count, reason, status, created_at, employees(id, full_name, job_title)",
          )
          .eq("company_id", callerCompanyId)
          .eq("status", statusFilter)
          .order("created_at", { ascending: false })
      : supabase
          .from("leave_requests")
          .select(
            "id, leave_type, start_date, end_date, days_count, reason, status, created_at, employees(id, full_name, job_title)",
          )
          .eq("company_id", callerCompanyId)
          .order("created_at", { ascending: false })
          .limit(50)
    ).returns<LeaveRow[]>(),
    (statusFilter
      ? supabase
          .from("advance_requests")
          .select(
            "id, amount, installments, reason, status, created_at, employees(id, full_name, job_title)",
          )
          .eq("company_id", callerCompanyId)
          .eq("status", statusFilter)
          .order("created_at", { ascending: false })
      : supabase
          .from("advance_requests")
          .select(
            "id, amount, installments, reason, status, created_at, employees(id, full_name, job_title)",
          )
          .eq("company_id", callerCompanyId)
          .order("created_at", { ascending: false })
          .limit(50)
    ).returns<AdvanceRow[]>(),
    (statusFilter
      ? supabase
          .from("permission_requests")
          .select(
            "id, permission_type, permission_date, from_time, to_time, reason, status, created_at, employees(id, full_name, job_title)",
          )
          .eq("company_id", callerCompanyId)
          .eq("status", statusFilter)
          .order("created_at", { ascending: false })
      : supabase
          .from("permission_requests")
          .select(
            "id, permission_type, permission_date, from_time, to_time, reason, status, created_at, employees(id, full_name, job_title)",
          )
          .eq("company_id", callerCompanyId)
          .order("created_at", { ascending: false })
          .limit(50)
    ).returns<PermissionRow[]>(),
  ]);

  const leaves = leaveRes.data ?? [];
  const advances = advanceRes.data ?? [];
  const permissions = permRes.data ?? [];
  const totalPending = leaves.length + advances.length + permissions.length;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              طلبات الموظفين
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              {showAll
                ? `آخر 50 طلب (كل الحالات)`
                : `${totalPending} طلب تحت المراجعة`}
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/dashboard/requests"
              className={`px-4 py-2 rounded-lg text-sm font-bold transition font-cairo ${
                !showAll
                  ? "bg-brand-cyan-dark text-white"
                  : "border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              تحت المراجعة فقط
            </Link>
            <Link
              href="/dashboard/requests?filter=all"
              className={`px-4 py-2 rounded-lg text-sm font-bold transition font-cairo ${
                showAll
                  ? "bg-brand-cyan-dark text-white"
                  : "border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              كل الطلبات
            </Link>
          </div>
        </header>

        {decided && (
          <div className="mb-6 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-cairo">
            ✓ تم حفظ القرار وأبلغنا الموظف
          </div>
        )}

        {totalPending === 0 && !showAll ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
            <div className="text-5xl mb-3">✨</div>
            <h2 className="text-lg font-bold font-cairo text-slate-700 mb-2">
              مفيش طلبات تحت المراجعة
            </h2>
            <p className="text-sm text-slate-500 font-cairo">
              لما الموظفين يقدّموا طلبات من تطبيق الموبايل، هتلاقيها هنا
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Leave requests */}
            <section>
              <h2 className="text-lg font-bold font-cairo text-slate-800 mb-3 flex items-center gap-2">
                <span>{REQUEST_KIND_ICONS.leave}</span>
                <span>طلبات الإجازة ({leaves.length})</span>
              </h2>
              {leaves.length === 0 ? (
                <p className="text-sm text-slate-400 font-cairo">مفيش</p>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <ul className="divide-y divide-slate-100">
                    {leaves.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/dashboard/requests/leave/${r.id}`}
                          className="flex items-center gap-4 p-4 hover:bg-slate-50 transition"
                        >
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_CLASSES[r.status]} font-cairo whitespace-nowrap`}
                          >
                            {STATUS_LABELS_AR[r.status]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-800 font-cairo">
                              {r.employees?.full_name ?? "—"}
                              <span className="text-xs font-normal text-slate-500 mr-2">
                                · {LEAVE_TYPE_LABELS_AR[r.leave_type]}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-cairo">
                              {r.days_count} يوم · {formatDateRange(r.start_date, r.end_date)}
                              {r.reason && ` · ${r.reason.slice(0, 60)}`}
                            </div>
                          </div>
                          <span className="text-xs text-slate-400 font-cairo whitespace-nowrap">
                            {new Date(r.created_at).toLocaleDateString("ar-EG", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Advance requests */}
            <section>
              <h2 className="text-lg font-bold font-cairo text-slate-800 mb-3 flex items-center gap-2">
                <span>{REQUEST_KIND_ICONS.advance}</span>
                <span>طلبات السلف ({advances.length})</span>
              </h2>
              {advances.length === 0 ? (
                <p className="text-sm text-slate-400 font-cairo">مفيش</p>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <ul className="divide-y divide-slate-100">
                    {advances.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/dashboard/requests/advance/${r.id}`}
                          className="flex items-center gap-4 p-4 hover:bg-slate-50 transition"
                        >
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_CLASSES[r.status]} font-cairo whitespace-nowrap`}
                          >
                            {STATUS_LABELS_AR[r.status]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-800 font-cairo">
                              {r.employees?.full_name ?? "—"}
                              <span className="text-xs font-normal text-emerald-700 mr-2 font-bold">
                                · {formatEGP(Number(r.amount))}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-cairo">
                              {r.installments} قسط
                              {r.reason && ` · ${r.reason.slice(0, 60)}`}
                            </div>
                          </div>
                          <span className="text-xs text-slate-400 font-cairo whitespace-nowrap">
                            {new Date(r.created_at).toLocaleDateString("ar-EG", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Permission requests */}
            <section>
              <h2 className="text-lg font-bold font-cairo text-slate-800 mb-3 flex items-center gap-2">
                <span>{REQUEST_KIND_ICONS.permission}</span>
                <span>طلبات الاستئذان ({permissions.length})</span>
              </h2>
              {permissions.length === 0 ? (
                <p className="text-sm text-slate-400 font-cairo">مفيش</p>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <ul className="divide-y divide-slate-100">
                    {permissions.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/dashboard/requests/permission/${r.id}`}
                          className="flex items-center gap-4 p-4 hover:bg-slate-50 transition"
                        >
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_CLASSES[r.status]} font-cairo whitespace-nowrap`}
                          >
                            {STATUS_LABELS_AR[r.status]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-800 font-cairo">
                              {r.employees?.full_name ?? "—"}
                              <span className="text-xs font-normal text-slate-500 mr-2">
                                · {PERMISSION_TYPE_LABELS_AR[r.permission_type]}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-cairo">
                              {formatDateShort(r.permission_date)}
                              {r.from_time && r.to_time && ` · من ${r.from_time} إلى ${r.to_time}`}
                              {r.reason && ` · ${r.reason.slice(0, 60)}`}
                            </div>
                          </div>
                          <span className="text-xs text-slate-400 font-cairo whitespace-nowrap">
                            {new Date(r.created_at).toLocaleDateString("ar-EG", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
