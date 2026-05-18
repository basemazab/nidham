import Link from "next/link";
import { requireHRPage } from "@/lib/permissions";
import { issueHRAdvance, getEmployeeAccruedNet } from "../actions";
import { NewAdvanceForm } from "./form";

// "صرف سلفة لموظف" — single-employee advance issuance with a live
// eligibility checker. The HR types the employee, then the amount,
// and the page shows in real time:
//   - The employee's accrued net based on attendance this cycle
//   - Existing open advances
//   - Available headroom (accrued_net - open advances)
//   - 50% / 70% quick-pick values
// Plus a visual indicator on the amount input (green / amber / red)
// based on whether the requested amount is within the headroom.

export const metadata = {
  title: "صرف سلفة لموظف | نِظام",
};

type EmployeeLite = {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
};

type SearchParams = Promise<{ error?: string }>;

export default async function NewAdvancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase, profile } = await requireHRPage();
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  // Scope picker to the caller's company — super-admin sessions can
  // otherwise read employees across every tenant via mig 038.
  const callerCompanyId = profile?.company_id ?? "";

  // All active employees -- the picker autocompletes from this list.
  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name, job_title, department")
    .eq("company_id", callerCompanyId)
    .eq("status", "active")
    .order("full_name")
    .returns<EmployeeLite[]>();

  const list = employees ?? [];

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/payroll/advances"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لقائمة صرف السلف
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            💵 صرف سلفة لموظف
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
            اختار الموظف والمبلغ، النظام يحسبلك كام مستحق فعليًا بناءً على
            حضوره والسلف المفتوحة، ويقولك لو المبلغ في الحد المسموح ولا لأ.
          </p>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {error}
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
          <NewAdvanceForm
            employees={list}
            getEligibilityAction={getEmployeeAccruedNet}
            issueAction={issueHRAdvance}
          />
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/dashboard/payroll/advances"
            className="text-xs text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← أو شوف لائحة كل الموظفين المستحقين دلوقتي
          </Link>
        </div>
      </div>
    </main>
  );
}
