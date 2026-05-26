import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { approveLoan, recordPayment, cancelLoan } from "./actions";

// ============================================================================
// Loans / advances list page (سلف الموظفين)
// ============================================================================
//
// Single-page workflow that handles 90% of HR's loan needs:
//   * Summary stats card (4 numbers) at top
//   * Status filter buttons
//   * Table with inline approve / pay / cancel buttons per row
//   * "New loan" CTA → /dashboard/loans/new
//
// The Egyptian SMB pattern is "اعرض السلف اللي ناقصها دفعة دلوقتي" so the
// default filter is "active" (open balance > 0). HR clicks the status
// chips to switch between pending / paid / all.

export const dynamic = "force-dynamic";

type Loan = {
  id: string;
  employee_id: string;
  amount: number;
  monthly_installment: number;
  remaining_amount: number;
  reason: string | null;
  status: string;
  requested_at: string;
  approved_at: string | null;
  employees: {
    full_name: string;
    employee_code: string | null;
    department: string | null;
  } | null;
};

type SearchParams = Promise<{
  filter?: string;
  saved?: string;
  approved?: string;
  payment?: string;
  cancelled?: string;
  error?: string;
}>;

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: {
    label: "منتظرة موافقة",
    color: "bg-amber-100 text-amber-800 border-amber-200",
  },
  approved: {
    label: "معتمدة",
    color: "bg-cyan-100 text-cyan-800 border-cyan-200",
  },
  active: {
    label: "نشطة — قيد السداد",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  paid: {
    label: "✓ تم السداد",
    color: "bg-slate-100 text-slate-600 border-slate-200",
  },
  cancelled: {
    label: "ملغية",
    color: "bg-rose-100 text-rose-700 border-rose-200",
  },
};

function formatEGP(n: number): string {
  return n.toLocaleString("ar-EG", { maximumFractionDigits: 2 }) + " ج";
}

export default async function LoansPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getMyProfile();
  const companyId = profile?.company_id ?? "";

  const params = await searchParams;
  const filter = params.filter ?? "active"; // default: open loans

  let query = supabase
    .from("employee_loans")
    .select(
      "id, employee_id, amount, monthly_installment, remaining_amount, reason, status, requested_at, approved_at, employees!inner(full_name, employee_code, department)",
    )
    .eq("company_id", companyId)
    .order("requested_at", { ascending: false });

  if (filter === "pending") {
    query = query.eq("status", "pending");
  } else if (filter === "active") {
    query = query.in("status", ["approved", "active"]);
  } else if (filter === "paid") {
    query = query.eq("status", "paid");
  } else if (filter === "cancelled") {
    query = query.eq("status", "cancelled");
  }
  // filter === "all" → no extra clause

  const { data: loans } = await query.returns<Loan[]>();
  const rows = loans ?? [];

  // Summary stats — always over ALL loans, not the filtered subset, so
  // the cards stay consistent regardless of which chip the HR clicked.
  const { data: allLoans } = await supabase
    .from("employee_loans")
    .select("status, amount, remaining_amount")
    .eq("company_id", companyId)
    .returns<Array<{ status: string; amount: number; remaining_amount: number }>>();

  let pendingCount = 0;
  let activeCount = 0;
  let paidCount = 0;
  let totalOutstanding = 0;
  for (const l of allLoans ?? []) {
    if (l.status === "pending") pendingCount += 1;
    else if (l.status === "approved" || l.status === "active") {
      activeCount += 1;
      totalOutstanding += Number(l.remaining_amount);
    } else if (l.status === "paid") paidCount += 1;
  }

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
            <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200 text-emerald-700 text-xs font-bold mb-2 font-cairo">
              💰 سلف ومرتجعات
            </div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              سلف الموظفين
            </h1>
            <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
              تتبّع كل السلف والـ advances اللي بتديها للموظفين — المبلغ
              الأصلي، القسط الشهري، والمتبقي. الدفعات بتتحسب تلقائياً
              وحالة السلفة بتتحوّل لـ "تم السداد" لما الرصيد يخلص.
            </p>
          </div>
          <Link
            href="/dashboard/loans/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-sm shadow-md font-cairo transition"
          >
            <span>+</span>
            <span>سلفة جديدة</span>
          </Link>
        </header>

        {/* Summary stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="منتظرة موافقة"
            value={pendingCount.toLocaleString("ar-EG")}
            emoji="⏳"
            tone="amber"
          />
          <StatCard
            label="نشطة الآن"
            value={activeCount.toLocaleString("ar-EG")}
            emoji="🔄"
            tone="emerald"
          />
          <StatCard
            label="إجمالي المتبقي"
            value={formatEGP(totalOutstanding)}
            emoji="💵"
            tone="cyan"
          />
          <StatCard
            label="تم سدادها"
            value={paidCount.toLocaleString("ar-EG")}
            emoji="✓"
            tone="slate"
          />
        </section>

        {/* Status filter chips */}
        <nav className="flex flex-wrap gap-2 mb-4">
          {[
            { key: "active", label: "نشطة (قيد السداد)" },
            { key: "pending", label: "منتظرة موافقة" },
            { key: "paid", label: "تم سدادها" },
            { key: "cancelled", label: "ملغية" },
            { key: "all", label: "الكل" },
          ].map((chip) => (
            <Link
              key={chip.key}
              href={`/dashboard/loans?filter=${chip.key}`}
              className={`px-4 py-1.5 rounded-full text-xs font-bold font-cairo border-2 transition ${
                filter === chip.key
                  ? "bg-brand-cyan-dark text-white border-brand-cyan-dark"
                  : "bg-white text-slate-700 border-slate-200 hover:border-brand-cyan"
              }`}
            >
              {chip.label}
            </Link>
          ))}
        </nav>

        {/* Status messages */}
        {params.saved && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-cairo">
            ✓ السلفة اتسجّلت
          </div>
        )}
        {params.approved && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-cairo">
            ✓ السلفة اتعتمدت — تقدر تبدأ تخصم الأقساط
          </div>
        )}
        {params.payment && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-cairo">
            ✓ الدفعة اتسجّلت
          </div>
        )}
        {params.cancelled && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-cairo">
            ✓ السلفة اتلغت
          </div>
        )}
        {params.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(params.error)}
          </div>
        )}

        {/* Loans list */}
        {rows.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">💰</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">
              مفيش سلف{" "}
              {filter === "active"
                ? "نشطة"
                : filter === "pending"
                  ? "منتظرة"
                  : ""}{" "}
              دلوقتي
            </h2>
            <p className="text-slate-500 font-cairo mb-6">
              ابدأ بتسجيل أول سلفة لموظف.
            </p>
            <Link
              href="/dashboard/loans/new"
              className="inline-block px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold font-cairo transition"
            >
              + سلفة جديدة
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                    الموظف
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                    المبلغ
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                    القسط
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-emerald-700 uppercase tracking-wider font-cairo">
                    المتبقي
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                    الحالة
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((loan) => {
                  const statusInfo = STATUS_LABEL[loan.status] ?? {
                    label: loan.status,
                    color: "bg-slate-100 text-slate-700",
                  };
                  const progressPct =
                    loan.amount > 0
                      ? Math.round(
                          ((loan.amount - loan.remaining_amount) / loan.amount) *
                            100,
                        )
                      : 0;
                  const isActive =
                    loan.status === "approved" || loan.status === "active";
                  const isPending = loan.status === "pending";
                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 font-cairo">
                          {loan.employees?.full_name ?? "—"}
                        </div>
                        {loan.employees?.department && (
                          <div className="text-xs text-slate-500">
                            {loan.employees.department}
                          </div>
                        )}
                        {loan.reason && (
                          <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                            {loan.reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-mono text-sm">
                        {formatEGP(loan.amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-mono text-sm">
                        {formatEGP(loan.monthly_installment)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-emerald-700 font-mono font-bold text-sm mb-1">
                          {formatEGP(loan.remaining_amount)}
                        </div>
                        {isActive && (
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${progressPct}%` }}
                              title={`اتسدّد ${progressPct}%`}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-[10px] font-bold border ${statusInfo.color} font-cairo whitespace-nowrap`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {isPending && (
                            <form action={approveLoan}>
                              <input
                                type="hidden"
                                name="loan_id"
                                value={loan.id}
                              />
                              <button
                                type="submit"
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold font-cairo transition"
                              >
                                ✓ اعتمد
                              </button>
                            </form>
                          )}
                          {isActive && loan.remaining_amount > 0 && (
                            <details className="relative">
                              <summary className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold font-cairo transition cursor-pointer list-none">
                                💵 سجّل دفعة
                              </summary>
                              <form
                                action={recordPayment}
                                className="absolute z-50 left-0 mt-1 bg-white border-2 border-cyan-200 rounded-xl shadow-xl p-3 w-72 font-cairo"
                              >
                                <input
                                  type="hidden"
                                  name="loan_id"
                                  value={loan.id}
                                />
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  قيمة الدفعة (متبقي{" "}
                                  {formatEGP(loan.remaining_amount)})
                                </label>
                                <input
                                  type="number"
                                  name="amount"
                                  defaultValue={Math.min(
                                    loan.monthly_installment,
                                    loan.remaining_amount,
                                  )}
                                  min="1"
                                  max={loan.remaining_amount}
                                  step="0.01"
                                  required
                                  className="w-full px-3 py-2 mb-2 rounded-lg border border-slate-200 focus:border-cyan-500 outline-none text-sm"
                                />
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  تاريخ الدفع
                                </label>
                                <input
                                  type="date"
                                  name="paid_at"
                                  defaultValue={
                                    new Date().toISOString().split("T")[0]
                                  }
                                  required
                                  className="w-full px-3 py-2 mb-2 rounded-lg border border-slate-200 focus:border-cyan-500 outline-none text-sm"
                                />
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  ملاحظة (اختياري)
                                </label>
                                <input
                                  type="text"
                                  name="notes"
                                  placeholder="مثلاً: خصم من راتب مايو"
                                  className="w-full px-3 py-2 mb-3 rounded-lg border border-slate-200 focus:border-cyan-500 outline-none text-sm"
                                />
                                <button
                                  type="submit"
                                  className="w-full px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition"
                                >
                                  سجّل الدفعة
                                </button>
                              </form>
                            </details>
                          )}
                          {(isPending ||
                            (isActive && loan.remaining_amount === loan.amount)) && (
                            <form action={cancelLoan}>
                              <input
                                type="hidden"
                                name="loan_id"
                                value={loan.id}
                              />
                              <button
                                type="submit"
                                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold font-cairo border border-rose-200 transition"
                              >
                                ✕ إلغاء
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  emoji,
  tone,
}: {
  label: string;
  value: string;
  emoji: string;
  tone: "amber" | "emerald" | "cyan" | "slate";
}) {
  const palette: Record<typeof tone, string> = {
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
    cyan: "bg-cyan-50 border-cyan-200 text-cyan-900",
    slate: "bg-slate-50 border-slate-200 text-slate-900",
  };
  return (
    <div className={`p-4 rounded-2xl border-2 ${palette[tone]}`}>
      <div className="flex items-center gap-2 mb-1 opacity-70">
        <span className="text-lg">{emoji}</span>
        <span className="text-xs font-bold font-cairo">{label}</span>
      </div>
      <div className="text-2xl font-black font-display">{value}</div>
    </div>
  );
}
