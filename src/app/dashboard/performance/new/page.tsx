// ============================================================================
// /dashboard/performance/new — New performance review form
// ============================================================================
//
// The kpis_json hidden input is populated by the client KpiEditor below
// — that's why this page is a server component wrapping a "use client"
// child. Keeps the data fetch (employees list, default period) on the
// server while the dynamic KPI rows stay interactive.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { createReview } from "../actions";
import { ReviewForm } from "./review-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string; employee_id?: string }>;

export default async function NewReviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name, job_title, department")
    .eq("company_id", callerCompanyId)
    .eq("status", "active")
    .order("full_name")
    .returns<
      Array<{
        id: string;
        full_name: string;
        job_title: string | null;
        department: string | null;
      }>
    >();

  // Sensible defaults for the period — most users review the last full month
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const defaultPeriodLabel = lastMonth.toLocaleDateString("ar-EG", {
    month: "long",
    year: "numeric",
  });
  const defaultPeriodStart = lastMonth.toISOString().slice(0, 10);
  const defaultPeriodEnd = lastMonthEnd.toISOString().slice(0, 10);

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-amber-50/30 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard/performance"
          className="text-sm text-slate-500 hover:text-amber-700 font-cairo"
        >
          ← الرجوع للتقييمات
        </Link>

        <header className="mt-3 mb-6">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            📊 تقييم أداء جديد
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            حدّد الموظف، الفترة، تقييم 1-5، KPIs بأرقامها، وملاحظاتك. التقييم
            بيتحفظ كمسودة وتقدر ترسله للموظف بعدها.
          </p>
        </header>

        {sp.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(sp.error)}
          </div>
        )}

        <ReviewForm
          action={createReview}
          employees={employees ?? []}
          defaultEmployeeId={sp.employee_id ?? null}
          defaultPeriodLabel={defaultPeriodLabel}
          defaultPeriodStart={defaultPeriodStart}
          defaultPeriodEnd={defaultPeriodEnd}
        />
      </div>
    </main>
  );
}
