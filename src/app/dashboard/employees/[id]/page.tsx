import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateEmployee, deleteEmployee, generateEmployeeInvitation } from "../actions";
import { CopyButton } from "@/components/copy-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { InvitationQR } from "@/components/invitation-qr";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    invite_error?: string;
    invite_generated?: string;
  }>;
};

type Employee = {
  id: string;
  full_name: string;
  employee_code: string | null;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  hire_date: string | null;
  basic_salary: number | null;
  housing_allowance: number | null;
  transport_allowance: number | null;
  other_allowances: number | null;
  national_id: string | null;
  social_insurance_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  status: "active" | "on_leave" | "terminated";
  notes: string | null;
  created_at: string;
  user_id: string | null;
  invitation_token: string | null;
  invitation_token_created_at: string | null;
};

export default async function EditEmployeePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { error, invite_error, invite_generated } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .single<Employee>();

  if (!employee) notFound();

  const updateAction = updateEmployee.bind(null, id);
  const deleteAction = async () => {
    "use server";
    await deleteEmployee(id);
    redirect("/dashboard/employees?deleted=1");
  };
  const generateInviteAction = async () => {
    "use server";
    await generateEmployeeInvitation(id);
  };

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/employees"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لليستة الموظفين
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            تعديل بيانات الموظف
          </h1>
          <p className="text-sm text-slate-500">
            {employee.full_name} · تم إضافته في {new Date(employee.created_at).toLocaleDateString("ar-EG")}
          </p>
        </header>

        {/* Mobile invitation section -- shown above the form because HR
            usually needs it more than the employee's basic details. */}
        <div className="mb-6 bg-gradient-to-br from-cyan-50 via-white to-cyan-50/50 border-2 border-brand-cyan/30 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-black font-cairo text-slate-800 flex items-center gap-2">
                📱 تطبيق الموبايل
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-cairo">
                {employee.user_id
                  ? "الموظف ده متربط بحساب تطبيق الموبايل"
                  : "اعمل كود دعوة وابعته للموظف عشان يقدر يستخدم تطبيق الموبايل"}
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border font-cairo whitespace-nowrap ${
                employee.user_id
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {employee.user_id ? "متربط ✓" : "غير متربط"}
            </span>
          </div>

          {invite_error && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
              ⚠ {decodeURIComponent(invite_error)}
            </div>
          )}

          {invite_generated && employee.invitation_token && (
            <div className="mb-3">
              <InvitationQR
                token={employee.invitation_token}
                employeeName={employee.full_name}
                whatsappPhone={employee.phone}
              />
            </div>
          )}

          {/* If a token already exists (e.g. user revisited the page), also
              surface the QR so they can re-display it without regenerating. */}
          {!invite_generated && employee.invitation_token && !employee.user_id && (
            <div className="mb-3">
              <InvitationQR
                token={employee.invitation_token}
                employeeName={employee.full_name}
                whatsappPhone={employee.phone}
              />
            </div>
          )}

          {!employee.user_id && (
            <form action={generateInviteAction}>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-sm shadow-md hover:shadow-lg transition font-cairo"
              >
                {employee.invitation_token ? "إنشاء كود جديد" : "إنشاء كود دعوة"}
              </button>
            </form>
          )}
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
              ⚠ {decodeURIComponent(error)}
            </div>
          )}

          <form action={updateAction} className="space-y-5">
            <div>
              <label htmlFor="full_name" className="block text-sm font-bold text-slate-700 mb-2 font-cairo">
                الاسم الكامل <span className="text-red-500">*</span>
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                defaultValue={employee.full_name}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="employee_code" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                كود الموظف (لربط البصمة)
                <span className="text-slate-400 text-xs mr-2">— نفس الكود اللي في جهاز ZKTeco</span>
              </label>
              <input
                id="employee_code"
                name="employee_code"
                type="text"
                dir="ltr"
                defaultValue={employee.employee_code ?? ""}
                placeholder="مثلًا: 100 أو EMP-042"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-right font-mono"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="job_title" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">المسمى الوظيفي</label>
                <input
                  id="job_title"
                  name="job_title"
                  type="text"
                  defaultValue={employee.job_title ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">القسم</label>
                <input
                  id="department"
                  name="department"
                  type="text"
                  defaultValue={employee.department ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">الموبايل</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  dir="ltr"
                  defaultValue={employee.phone ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-right"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">الإيميل</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={employee.email ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="hire_date" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">تاريخ التعيين</label>
              <input
                id="hire_date"
                name="hire_date"
                type="date"
                defaultValue={employee.hire_date ?? ""}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              />
            </div>

            {/* Salary structure — feeds the payroll module */}
            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-800 mb-1 font-cairo">💰 هيكل الراتب</h3>
              <p className="text-xs text-slate-500 mb-3 font-cairo">
                دي القيم اللي السيستم هيستخدمها لما تحسب المرتب الشهري.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="basic_salary" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">الراتب الأساسي (جنيه)</label>
                  <input
                    id="basic_salary"
                    name="basic_salary"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={employee.basic_salary ?? ""}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="housing_allowance" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">بدل سكن</label>
                  <input
                    id="housing_allowance"
                    name="housing_allowance"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={employee.housing_allowance ?? ""}
                    placeholder="0"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="transport_allowance" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">بدل انتقال</label>
                  <input
                    id="transport_allowance"
                    name="transport_allowance"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={employee.transport_allowance ?? ""}
                    placeholder="0"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="other_allowances" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">بدلات أخرى</label>
                  <input
                    id="other_allowances"
                    name="other_allowances"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={employee.other_allowances ?? ""}
                    placeholder="0"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Identity & compliance */}
            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-800 mb-1 font-cairo">🪪 بيانات قانونية</h3>
              <p className="text-xs text-slate-500 mb-3 font-cairo">
                مهمة للقسائم والتأمينات والضريبة.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="national_id" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">الرقم القومي</label>
                  <input
                    id="national_id"
                    name="national_id"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    defaultValue={employee.national_id ?? ""}
                    placeholder="14 رقم"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-right font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="social_insurance_number" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">رقم التأمينات</label>
                  <input
                    id="social_insurance_number"
                    name="social_insurance_number"
                    type="text"
                    dir="ltr"
                    defaultValue={employee.social_insurance_number ?? ""}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-right font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="bank_name" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">البنك</label>
                  <input
                    id="bank_name"
                    name="bank_name"
                    type="text"
                    defaultValue={employee.bank_name ?? ""}
                    placeholder="مثلًا: CIB"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="bank_account_number" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">رقم الحساب البنكي / IBAN</label>
                  <input
                    id="bank_account_number"
                    name="bank_account_number"
                    type="text"
                    dir="ltr"
                    defaultValue={employee.bank_account_number ?? ""}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-right font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">الحالة</label>
              <select
                id="status"
                name="status"
                defaultValue={employee.status}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
              >
                <option value="active">نشط</option>
                <option value="on_leave">في إجازة</option>
                <option value="terminated">منتهي العمل</option>
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">ملاحظات</label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={employee.notes ?? ""}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo"
              >
                حفظ التعديلات
              </button>
              <Link
                href="/dashboard/employees"
                className="px-6 py-3 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo"
              >
                إلغاء
              </Link>
            </div>
          </form>

          {/* Delete in separate form to avoid double-action collision */}
          <div className="mt-8 pt-6 border-t border-red-100">
            <form action={deleteAction}>
              <ConfirmSubmitButton
                label="🗑 حذف الموظف نهائيًا"
                message={`هتمسح "${employee.full_name}" وكل بيانات الحضور والرواتب والطلبات المرتبطة بيه. مفيش رجوع بعد التأكيد.`}
                confirmLabel="نعم احذف"
                className="text-sm text-red-600 hover:text-red-800 font-cairo cursor-pointer"
              />
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
