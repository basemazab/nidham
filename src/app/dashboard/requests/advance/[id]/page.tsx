import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { decideRequest, markAdvancePaid } from "../../actions";
import {
  STATUS_LABELS_AR,
  STATUS_CLASSES,
  type RequestStatus,
} from "@/lib/requests";

type Row = {
  id: string;
  amount: number;
  installments: number;
  reason: string | null;
  status: RequestStatus;
  hr_notes: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  employees: {
    full_name: string;
    job_title: string | null;
    department: string | null;
    basic_salary: number | null;
    email: string | null;
    phone: string | null;
  } | null;
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

function formatEGP(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("ar-EG", { maximumFractionDigits: 2 }) + " ج";
}

export default async function AdvanceRequestPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("advance_requests")
    .select(
      "*, employees(full_name, job_title, department, basic_salary, email, phone)",
    )
    .eq("id", id)
    .single<Row>();

  if (!row) notFound();

  const isPending = row.status === "pending";
  const isApprovedAndUnpaid = row.status === "approved";
  const approveAction = decideRequest.bind(null, "advance", id, "approved");
  const rejectAction = decideRequest.bind(null, "advance", id, "rejected");
  const payAction = markAdvancePaid.bind(null, id);

  const monthlyInstallment = Number(row.amount) / row.installments;

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
              <div className="text-xs text-slate-500 font-cairo mb-1">طلب سلفة</div>
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

          <div className="grid grid-cols-3 gap-3 mt-4">
            <Stat label="المبلغ" value={formatEGP(Number(row.amount))} accent="emerald" />
            <Stat label="عدد الأقساط" value={`${row.installments} قسط`} />
            <Stat
              label="قسط شهري"
              value={formatEGP(monthlyInstallment)}
              accent="cyan"
            />
          </div>

          {row.employees?.basic_salary && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs font-cairo">
              <strong className="text-amber-800">📊 للمراجعة:</strong> راتب
              الموظف الأساسي:{" "}
              <strong>{formatEGP(Number(row.employees.basic_salary))}</strong> —
              نسبة القسط الشهري للراتب:{" "}
              <strong>
                {Math.round(
                  (monthlyInstallment / Number(row.employees.basic_salary)) * 100,
                )}
                %
              </strong>
            </div>
          )}

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
              <a href={`mailto:${row.employees.email}`} className="hover:text-brand-cyan-dark">
                📧 {row.employees.email}
              </a>
            )}
            {row.employees?.phone && (
              <a href={`tel:${row.employees.phone}`} className="hover:text-brand-cyan-dark">
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
                {row.paid_at && ` · صُرف: ${new Date(row.paid_at).toLocaleString("ar-EG")}`}
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
                  placeholder="مثلًا: موافق وسيُخصم على 3 شهور..."
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

        {isApprovedAndUnpaid && (
          <div className="bg-emerald-50 p-6 rounded-2xl border-2 border-emerald-200">
            <h2 className="text-lg font-bold font-cairo text-emerald-900 mb-1">
              💰 جاهز للصرف
            </h2>
            <p className="text-sm text-emerald-800 font-cairo mb-4">
              المراجعة تمت بالموافقة. اضغط الزرار لما تصرف المبلغ فعلًا.
            </p>
            <form action={payAction}>
              <button
                type="submit"
                className="px-6 py-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold font-cairo shadow-md hover:shadow-lg transition"
              >
                تم الصرف ✓
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "cyan";
}) {
  const tone =
    accent === "emerald"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : accent === "cyan"
        ? "bg-cyan-50 border-cyan-200 text-cyan-800"
        : "bg-slate-50 border-slate-200 text-slate-800";
  return (
    <div className={`p-3 rounded-lg border ${tone}`}>
      <div className="text-[10px] font-cairo opacity-70 mb-0.5">{label}</div>
      <div className="text-sm font-black font-cairo">{value}</div>
    </div>
  );
}
