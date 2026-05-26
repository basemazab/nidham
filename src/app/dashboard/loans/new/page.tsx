import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { createLoan } from "../actions";

// ============================================================================
// /dashboard/loans/new — record a new salary advance / loan
// ============================================================================

export const dynamic = "force-dynamic";

type Employee = {
  id: string;
  full_name: string;
  employee_code: string | null;
  department: string | null;
  basic_salary: number | null;
};

type SearchParams = Promise<{
  error?: string;
  employee_id?: string;
}>;

export default async function NewLoanPage({
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

  // Pull the full employee list (active only) for the dropdown. For
  // tenants with 500+ employees this is still <50KB so we can render
  // a native <select> instead of a fancier searchable combo.
  const { data: empData } = await supabase
    .from("employees")
    .select("id, full_name, employee_code, department, basic_salary")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("full_name")
    .returns<Employee[]>();

  const employees = empData ?? [];
  const preselected = params.employee_id ?? "";

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/loans"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لقائمة السلف
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            سلفة جديدة
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            سجّل قيمة السلفة والقسط الشهري. الحالة الافتراضية "منتظرة موافقة"
            — اعتمدها لما تكون جاهز للخصم.
          </p>
        </header>

        {params.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(params.error)}
          </div>
        )}

        {employees.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 text-center">
            <div className="text-5xl mb-3">👥</div>
            <h2 className="text-lg font-bold font-cairo mb-1 text-slate-700">
              مفيش موظفين نشطين
            </h2>
            <p className="text-slate-500 font-cairo mb-5 text-sm">
              ضيف موظف الأول قبل ما تسجل له سلفة.
            </p>
            <Link
              href="/dashboard/employees/new"
              className="inline-block px-5 py-2.5 rounded-xl bg-brand-cyan-dark text-white font-bold font-cairo"
            >
              ضيف موظف
            </Link>
          </div>
        ) : (
          <form
            action={createLoan}
            className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 space-y-5"
          >
            {/* Employee */}
            <div>
              <label
                htmlFor="employee_id"
                className="block text-sm font-medium text-slate-700 mb-2 font-cairo"
              >
                الموظف *
              </label>
              <select
                id="employee_id"
                name="employee_id"
                defaultValue={preselected}
                required
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-slate-900 font-cairo"
              >
                <option value="">— اختار موظف —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                    {e.employee_code ? ` (${e.employee_code})` : ""}
                    {e.department ? ` — ${e.department}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Amount */}
              <div>
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-slate-700 mb-2 font-cairo"
                >
                  قيمة السلفة (ج.م) *
                </label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  placeholder="مثلاً 5000"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-slate-900 font-mono"
                  dir="ltr"
                />
              </div>

              {/* Monthly installment */}
              <div>
                <label
                  htmlFor="monthly_installment"
                  className="block text-sm font-medium text-slate-700 mb-2 font-cairo"
                >
                  القسط الشهري (ج.م) *
                </label>
                <input
                  id="monthly_installment"
                  name="monthly_installment"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  placeholder="مثلاً 500"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-slate-900 font-mono"
                  dir="ltr"
                />
                <p className="text-[10px] text-slate-400 mt-1 font-cairo">
                  لازم يكون أقل من قيمة السلفة
                </p>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label
                htmlFor="reason"
                className="block text-sm font-medium text-slate-700 mb-2 font-cairo"
              >
                السبب (اختياري)
              </label>
              <textarea
                id="reason"
                name="reason"
                rows={2}
                placeholder="مثلاً: طوارئ طبية، شراء أدوات، مدارس..."
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-slate-900 font-cairo resize-none"
              />
            </div>

            {/* Status */}
            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium text-slate-700 mb-2 font-cairo"
              >
                الحالة
              </label>
              <select
                id="status"
                name="status"
                defaultValue="pending"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-slate-900 font-cairo"
              >
                <option value="pending">منتظرة موافقة (اعتمدها بعدين)</option>
                <option value="active">نشطة فوراً (متاحة للخصم)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Link
                href="/dashboard/loans"
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm font-cairo transition"
              >
                إلغاء
              </Link>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-sm shadow-md font-cairo transition"
              >
                💾 سجّل السلفة
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
