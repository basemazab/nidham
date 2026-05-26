import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  updateEmployee,
  deleteEmployee,
  generateEmployeeInvitation,
  previewEOSGratuity,
  terminateEmployee,
  uploadEmployeeAvatar,
  removeEmployeeAvatar,
  uploadEmployeeDocument,
  deleteEmployeeDocument,
} from "../actions";
import { TerminateEmployeeModal } from "@/components/terminate-employee-modal";
import { getMyProfile } from "@/lib/permissions";
import { CopyButton } from "@/components/copy-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { InvitationQR } from "@/components/invitation-qr";
import { EmployeeShiftCard } from "@/components/employee-shift-card";
import { AutoSubmitFileForm } from "@/components/auto-submit-file-form";
import { FileInputAutoSubmit } from "@/components/file-input-auto-submit";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    invite_error?: string;
    invite_generated?: string;
    avatar_updated?: string;
    avatar_removed?: string;
    doc_uploaded?: string;
    doc_deleted?: string;
  }>;
};

type EmployeeDocument = {
  id: string;
  doc_type:
    | "contract"
    | "national_id"
    | "cv"
    | "certificate"
    | "photo"
    | "license"
    | "insurance"
    | "bank"
    | "medical"
    | "other";
  name: string;
  file_url: string;
  mime_type: string | null;
  size_bytes: number | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
};

const DOC_TYPE_LABEL: Record<EmployeeDocument["doc_type"], { ar: string; icon: string }> = {
  contract: { ar: "عقد عمل", icon: "📜" },
  national_id: { ar: "بطاقة رقم قومي", icon: "🪪" },
  cv: { ar: "السيرة الذاتية", icon: "📄" },
  certificate: { ar: "شهادة", icon: "🎓" },
  photo: { ar: "صورة شخصية", icon: "🖼" },
  license: { ar: "رخصة / تصريح", icon: "🪪" },
  insurance: { ar: "استمارة تأمينات", icon: "🏥" },
  bank: { ar: "مستند بنكي", icon: "🏦" },
  medical: { ar: "تقرير طبي", icon: "🩺" },
  other: { ar: "مستند آخر", icon: "📎" },
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
  date_of_birth: string | null;
  basic_salary: number | null;
  housing_allowance: number | null;
  transport_allowance: number | null;
  other_allowances: number | null;
  incentive_allowance: number | null;
  pay_frequency: "monthly" | "weekly" | null;
  termination_date: string | null;
  termination_reason: string | null;
  eos_gratuity: number | null;
  shift_id: string | null;
  rotation_id: string | null;
  rotation_anchor_date: string | null;
  rotation_anchor_position: number | null;
  // Decrypted PII columns from the `employees_with_pii` view (mig 050).
  // The underlying employees table stores these as encrypted bytea in
  // *_encrypted columns; the view exposes the cleartext as `*_dec`. We
  // read from the view so the form pre-fills with the real value.
  national_id_dec: string | null;
  social_insurance_number_dec: string | null;
  bank_name_dec: string | null;
  bank_account_number_dec: string | null;
  status: "active" | "on_leave" | "terminated";
  notes: string | null;
  avatar_url: string | null;
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

  // We pull the main row from the `employees` TABLE (RLS on the table is
  // proven to pass through PostgREST). Reading from employees_with_pii
  // directly returned 404 in production — Supabase's PostgREST appears
  // to drop the RLS context for SELECT-from-view in some configs (we
  // verified the view works as the postgres role, but not as
  // authenticated). Keeping the heavy SELECT on the table sidesteps
  // that quirk entirely.
  // J4: Single-step read from employees_with_pii. The previous two-step
  // workaround was a band-aid for the pii_decrypt REVOKE issue (migration
  // 050) which was properly fixed in migration 067. Reading from the view
  // directly means the form is guaranteed to either get all decrypted PII
  // columns OR notFound() if the row doesn't exist — never the half-empty
  // state that confused HR into thinking saves didn't work.
  const { data: employeeRow } = await supabase
    .from("employees_with_pii")
    .select("*")
    .eq("id", id)
    .single<Employee>();

  if (!employeeRow) notFound();

  const employee: Employee = employeeRow;

  // The "إنهاء التوظيف" modal is admin-only because terminating an
  // employee snapshots an EOS gratuity and locks them out of the system.
  const { profile: currentProfile } = await getMyProfile();
  const isAdmin = currentProfile?.role === "admin";
  const callerCompanyId = currentProfile?.company_id ?? "";

  // Fetch shifts + rotations for the assignment card + resolve today's
  // shift for the badge. Doing this here keeps the card a pure client
  // component without its own DB call. Scope each list to the caller's
  // company so the picker can't accidentally surface cross-tenant rows.
  const [
    { data: shifts },
    { data: rotations },
    { data: todaysShiftId },
    { data: documents },
  ] =
    await Promise.all([
      supabase
        .from("shifts")
        .select("id, name, start_time, end_time")
        .eq("company_id", callerCompanyId)
        .eq("is_active", true)
        .order("start_time")
        .returns<{ id: string; name: string; start_time: string; end_time: string }[]>(),
      supabase
        .from("shift_rotations")
        .select("id, name, cycle_days")
        .eq("company_id", callerCompanyId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .returns<{ id: string; name: string; cycle_days: number }[]>(),
      supabase.rpc("get_shift_for_employee_on_date", {
        p_employee_id: id,
        p_date: new Date().toISOString().split("T")[0],
      }),
      supabase
        .from("employee_documents")
        .select(
          "id, doc_type, name, file_url, mime_type, size_bytes, expires_at, notes, created_at",
        )
        .eq("employee_id", id)
        .eq("company_id", callerCompanyId)
        .order("created_at", { ascending: false })
        .returns<EmployeeDocument[]>(),
    ]);
  const employeeDocs = documents ?? [];

  let todaysShiftName: string | null = null;
  if (todaysShiftId && shifts) {
    const matched = shifts.find((s) => s.id === todaysShiftId);
    if (matched) todaysShiftName = matched.name;
  }

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

        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Avatar — clickable to reveal upload + remove controls in
                the section below. Falls back to a circular initial-letter
                tile when avatar_url is null. */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center text-white text-2xl font-black shrink-0 shadow-md overflow-hidden">
              {employee.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={employee.avatar_url}
                  alt={employee.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{employee.full_name[0]}</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-black font-cairo text-slate-800 mb-1 truncate">
                {employee.full_name}
              </h1>
              <p className="text-xs text-slate-500 font-cairo">
                {employee.job_title ?? "—"}
                {employee.department ? ` · ${employee.department}` : ""}
                {" · "}تم إضافته في{" "}
                {new Date(employee.created_at).toLocaleDateString("ar-EG")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* HR forms shortcut — opens the forms hub pre-filled for
                this employee. The hub then forwards employeeId to each
                individual form. */}
            <Link
              href={`/dashboard/forms?employeeId=${employee.id}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 font-bold text-sm hover:bg-amber-100 transition font-cairo"
            >
              <span>📄</span>
              <span>نماذج HR للموظف</span>
            </Link>
            {isAdmin && employee.status === "active" && (
              <TerminateEmployeeModal
                employeeId={employee.id}
                employeeName={employee.full_name}
                isActive={employee.status === "active"}
                previewAction={previewEOSGratuity}
                terminateAction={terminateEmployee}
              />
            )}
          </div>
        </header>

        {/* If the employee was already terminated, show a banner with
            the EOS snapshot so HR sees the final settlement. */}
        {employee.status === "terminated" && employee.termination_date && (
          <div className="mb-6 bg-gradient-to-br from-slate-100 to-slate-50 border-2 border-slate-300 rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500 font-cairo mb-1">
                  🏁 منتهي الخدمة في{" "}
                  <strong className="text-slate-700">
                    {new Date(employee.termination_date).toLocaleDateString("ar-EG")}
                  </strong>
                </div>
                {employee.termination_reason && (
                  <div className="text-sm text-slate-700 font-cairo">
                    السبب: <strong>{terminationReasonLabel(employee.termination_reason)}</strong>
                  </div>
                )}
              </div>
              {employee.eos_gratuity !== null && (
                <div className="text-left">
                  <div className="text-[10px] text-slate-500 font-cairo">
                    مكافأة نهاية الخدمة
                  </div>
                  <div className="text-2xl font-black text-emerald-700 font-mono" dir="ltr">
                    {Math.round(employee.eos_gratuity).toLocaleString("ar-EG")} ج
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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

        {/* Shift assignment -- fixed shift OR rotation pattern. */}
        <div className="mb-6">
          <EmployeeShiftCard
            employeeId={id}
            shifts={shifts ?? []}
            rotations={rotations ?? []}
            current={{
              shift_id: employee.shift_id,
              rotation_id: employee.rotation_id,
              rotation_anchor_date: employee.rotation_anchor_date,
              rotation_anchor_position: employee.rotation_anchor_position,
            }}
            todaysShiftName={todaysShiftName}
          />
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div>
                <label htmlFor="date_of_birth" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  تاريخ الميلاد 🎂
                  <span className="text-xs text-slate-400 font-normal mr-1">(لصفحة الاحتفالات)</span>
                </label>
                <input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                  defaultValue={employee.date_of_birth ?? ""}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900"
                />
              </div>
            </div>

            {/* Salary structure — feeds the payroll module */}
            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-800 mb-1 font-cairo">💰 هيكل الراتب</h3>
              <p className="text-xs text-slate-500 mb-3 font-cairo">
                دي القيم اللي السيستم هيستخدمها لما تحسب المرتب الشهري.
              </p>

              <div className="mb-4">
                <label htmlFor="pay_frequency" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                  دورة الصرف
                  <span className="text-xs text-slate-400 mr-2 font-normal">
                    (شهري لموظفين الإدارة / أسبوعي لعمال الإنتاج)
                  </span>
                </label>
                <select
                  id="pay_frequency"
                  name="pay_frequency"
                  defaultValue={employee.pay_frequency ?? "monthly"}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo"
                >
                  <option value="monthly">شهري</option>
                  <option value="weekly">أسبوعي</option>
                </select>
              </div>

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
                <div>
                  <label htmlFor="incentive_allowance" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">
                    حافز شهري
                    <span className="text-xs text-slate-400 mr-2 font-normal">
                      (Hafiz)
                    </span>
                  </label>
                  <input
                    id="incentive_allowance"
                    name="incentive_allowance"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={employee.incentive_allowance ?? ""}
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
                    defaultValue={employee.national_id_dec ?? ""}
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
                    defaultValue={employee.social_insurance_number_dec ?? ""}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 text-right font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="bank_name" className="block text-sm font-medium text-slate-700 mb-2 font-cairo">البنك</label>
                  <input
                    id="bank_name"
                    name="bank_name"
                    type="text"
                    defaultValue={employee.bank_name_dec ?? ""}
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
                    defaultValue={employee.bank_account_number_dec ?? ""}
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

          {/* ============================================================
              Photo + Documents (mig 047). Splits into 2 sections inside
              one card so they share visual rhythm:
                - Avatar uploader (replace existing photo / remove it)
                - Documents vault (list + upload form)
              ============================================================ */}
          <section className="mt-8 pt-6 border-t border-slate-200 space-y-6">
            <h2 className="text-xl font-black font-cairo text-slate-800 mb-1">
              🖼 الصورة والمستندات
            </h2>

            {/* Avatar uploader */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 flex-wrap">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                {employee.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={employee.avatar_url}
                    alt={employee.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-black text-slate-400">
                    {employee.full_name[0]}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="text-sm font-bold text-slate-800 font-cairo mb-0.5">
                  صورة شخصية
                </div>
                <p className="text-xs text-slate-500 font-cairo mb-3">
                  PNG / JPEG / WebP · حد أقصى 10 MB · بتظهر في الكروت + التقارير
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <AutoSubmitFileForm
                    action={uploadEmployeeAvatar}
                    hiddenFields={{ employee_id: employee.id }}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    label={
                      <>
                        <span>📤</span>
                        <span>
                          {employee.avatar_url ? "غيّر الصورة" : "ارفع صورة"}
                        </span>
                      </>
                    }
                  />
                  {employee.avatar_url && (
                    <form action={removeEmployeeAvatar}>
                      <input
                        type="hidden"
                        name="employee_id"
                        value={employee.id}
                      />
                      <ConfirmSubmitButton
                        label="🗑 حذف"
                        message="هتشيل الصورة الحالية؟ مفيش بطل لها."
                        confirmLabel="احذفها"
                        className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold font-cairo cursor-pointer border border-red-200"
                      />
                    </form>
                  )}
                </div>
              </div>
            </div>

            {/* Documents vault */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-black text-slate-800 font-cairo">
                    📎 المستندات ({employeeDocs.length})
                  </h3>
                  <p className="text-[11px] text-slate-500 font-cairo">
                    عقد العمل، صور البطاقة، الشهادات، الـ CV، إلخ
                  </p>
                </div>
              </div>

              {/* Upload form */}
              <form
                action={uploadEmployeeDocument}
                encType="multipart/form-data"
                className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200 grid sm:grid-cols-2 gap-2"
              >
                <input type="hidden" name="employee_id" value={employee.id} />
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 font-cairo">
                    اسم المستند
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="مثلاً: عقد العمل سنة 2026"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:border-brand-cyan outline-none text-sm font-cairo"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 font-cairo">
                    النوع
                  </label>
                  <select
                    name="doc_type"
                    defaultValue="other"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:border-brand-cyan outline-none text-sm font-cairo"
                  >
                    {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.icon} {v.ar}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 font-cairo">
                    تاريخ الانتهاء (اختياري)
                  </label>
                  <input
                    type="date"
                    name="expires_at"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:border-brand-cyan outline-none text-sm font-cairo"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2 mt-1">
                  <FileInputAutoSubmit
                    accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    label={
                      <>
                        <span>📎</span>
                        <span>اختار ملف وارفعه</span>
                      </>
                    }
                  />
                  <span className="text-[10px] text-slate-500 font-cairo">
                    حد أقصى 10 MB · PDF / Word / Excel / صور
                  </span>
                </div>
              </form>

              {/* Documents list */}
              {employeeDocs.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400 font-cairo">
                  مفيش مستندات لسه. ارفع أول مستند من فوق ↑
                </div>
              ) : (
                <ul className="space-y-2">
                  {employeeDocs.map((doc) => {
                    const meta = DOC_TYPE_LABEL[doc.doc_type];
                    const sizeKB = doc.size_bytes
                      ? Math.round(doc.size_bytes / 1024)
                      : null;
                    const isExpired =
                      doc.expires_at &&
                      new Date(doc.expires_at) < new Date();
                    return (
                      <li
                        key={doc.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition flex-wrap ${
                          isExpired
                            ? "bg-rose-50 border-rose-200"
                            : "bg-white border-slate-200 hover:border-brand-cyan/40"
                        }`}
                      >
                        <span className="text-2xl shrink-0">{meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-800 text-sm font-cairo truncate">
                            {doc.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-cairo flex items-center gap-2 flex-wrap">
                            <span>{meta.ar}</span>
                            {sizeKB !== null && (
                              <span>
                                · {sizeKB.toLocaleString("en")} KB
                              </span>
                            )}
                            <span>
                              · رفع في{" "}
                              {new Date(doc.created_at).toLocaleDateString(
                                "ar-EG",
                                { dateStyle: "short" },
                              )}
                            </span>
                            {doc.expires_at && (
                              <span
                                className={
                                  isExpired
                                    ? "text-rose-600 font-bold"
                                    : "text-amber-700"
                                }
                              >
                                · {isExpired ? "🚨 انتهت" : "⏰ تنتهي"} في{" "}
                                {new Date(
                                  doc.expires_at,
                                ).toLocaleDateString("ar-EG", {
                                  dateStyle: "short",
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-xs font-bold font-cairo border border-cyan-200"
                        >
                          ⤓ افتح
                        </a>
                        <form action={deleteEmployeeDocument}>
                          <input
                            type="hidden"
                            name="document_id"
                            value={doc.id}
                          />
                          <input
                            type="hidden"
                            name="employee_id"
                            value={employee.id}
                          />
                          <ConfirmSubmitButton
                            label="🗑"
                            message={`هتمسح "${doc.name}". مفيش رجوع.`}
                            confirmLabel="نعم احذف"
                            className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold cursor-pointer border border-red-200"
                          />
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

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

function terminationReasonLabel(reason: string): string {
  return (
    {
      resignation: "استقالة",
      termination_by_employer: "فصل من العمل",
      mutual_agreement: "اتفاق ودي",
      end_of_contract: "انتهاء عقد محدد المدة",
      retirement: "تقاعد",
      death: "وفاة",
    }[reason] ?? reason
  );
}
