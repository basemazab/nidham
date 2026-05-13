import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { decideRequest } from "../../actions";
import {
  STATUS_LABELS_AR,
  STATUS_CLASSES,
  PERMISSION_TYPE_LABELS_AR,
  type RequestStatus,
  type PermissionType,
} from "@/lib/requests";

type Row = {
  id: string;
  permission_type: PermissionType;
  permission_date: string;
  from_time: string | null;
  to_time: string | null;
  reason: string | null;
  status: RequestStatus;
  hr_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  employees: {
    full_name: string;
    job_title: string | null;
    department: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function PermissionRequestPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("permission_requests")
    .select(
      "*, employees(full_name, job_title, department, email, phone)",
    )
    .eq("id", id)
    .single<Row>();

  if (!row) notFound();

  const isPending = row.status === "pending";
  const approveAction = decideRequest.bind(null, "permission", id, "approved");
  const rejectAction = decideRequest.bind(null, "permission", id, "rejected");

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/requests"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لكل الطلبات
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(error)}
          </div>
        )}

        <header className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-xs text-slate-500 font-cairo mb-1">طلب استئذان</div>
              <h1 className="text-2xl font-black font-cairo text-slate-800">
                {row.employees?.full_name ?? "—"}
              </h1>
              <p className="text-sm text-slate-500 font-cairo">
                {row.employees?.job_title ?? "—"}
                {row.employees?.department && ` · ${row.employees.department}`}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${STATUS_CLASSES[row.status]} font-cairo whitespace-nowrap`}
            >
              {STATUS_LABELS_AR[row.status]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 text-sm font-cairo">
            <Field
              label="نوع الاستئذان"
              value={PERMISSION_TYPE_LABELS_AR[row.permission_type]}
            />
            <Field label="التاريخ" value={row.permission_date} />
            {row.from_time && <Field label="من الساعة" value={row.from_time} />}
            {row.to_time && <Field label="إلى الساعة" value={row.to_time} />}
          </div>

          {row.reason && (
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-xs text-slate-500 font-cairo mb-1">السبب</div>
              <p className="text-sm text-slate-800 font-cairo whitespace-pre-line">
                {row.reason}
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500 font-cairo">
            {row.employees?.email && (
              <a
                href={`mailto:${row.employees.email}`}
                className="hover:text-brand-cyan-dark"
              >
                📧 {row.employees.email}
              </a>
            )}
            {row.employees?.phone && (
              <a
                href={`tel:${row.employees.phone}`}
                className="hover:text-brand-cyan-dark"
              >
                📱 {row.employees.phone}
              </a>
            )}
            <span>قُدّم: {new Date(row.created_at).toLocaleString("ar-EG")}</span>
          </div>
        </header>

        {row.hr_notes && (
          <div className="mb-6 p-4 rounded-xl bg-cyan-50 border border-cyan-200">
            <div className="text-xs font-bold text-cyan-800 mb-1 font-cairo">
              ملاحظات HR
            </div>
            <p className="text-sm text-slate-800 font-cairo whitespace-pre-line">
              {row.hr_notes}
            </p>
            {row.reviewed_at && (
              <div className="text-[10px] text-slate-500 mt-2 font-cairo">
                تم: {new Date(row.reviewed_at).toLocaleString("ar-EG")}
              </div>
            )}
          </div>
        )}

        {isPending && (
          <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100">
            <h2 className="text-lg font-bold font-cairo text-slate-800 mb-3">
              قرار المراجعة
            </h2>

            <form className="space-y-4">
              <div>
                <label
                  htmlFor="hr_notes"
                  className="block text-sm font-medium text-slate-700 mb-2 font-cairo"
                >
                  ملاحظات (اختياري)
                </label>
                <textarea
                  id="hr_notes"
                  rows={3}
                  name="hr_notes"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition text-slate-900 font-cairo resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="submit"
                  formAction={approveAction}
                  className="w-full px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold font-cairo shadow-md hover:shadow-lg transition"
                >
                  ✓ موافقة
                </button>
                <button
                  type="submit"
                  formAction={rejectAction}
                  className="w-full px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold font-cairo shadow-md hover:shadow-lg transition"
                >
                  ✗ رفض
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-slate-400 font-cairo mb-0.5">{label}</div>
      <div className="text-slate-800 font-bold">{value}</div>
    </div>
  );
}
