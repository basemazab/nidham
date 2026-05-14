import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { DuplicatesReview } from "./duplicates-review";
import { deleteDuplicateEmployees } from "./actions";

// Duplicate-employees admin page. Calls find_duplicate_employees()
// (migration 033) which returns one row per (group, employee) pair
// and we re-group in JS for rendering. Admin reviews each group,
// picks which row to KEEP, and the rest are deleted on confirm.

export const metadata = {
  title: "كشف الموظفين المكررين | نِظام",
};

type DuplicateRow = {
  group_id: string;
  match_type: "national_id" | "employee_code" | "email" | "phone";
  match_value: string;
  confidence: "high" | "medium";
  employee_id: string;
  full_name: string;
  employee_code: string | null;
  national_id: string | null;
  email: string | null;
  phone: string | null;
  hire_date: string | null;
  created_at: string;
  has_user: boolean;
  status: "active" | "on_leave" | "terminated";
};

export type DuplicateGroup = {
  group_id: string;
  match_type: DuplicateRow["match_type"];
  match_value: string;
  confidence: DuplicateRow["confidence"];
  employees: DuplicateRow[];
};

type Params = Promise<{ deleted?: string; error?: string }>;

export default async function DuplicateEmployeesPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;

  const { data: rows } = await supabase.rpc("find_duplicate_employees");
  const list = (Array.isArray(rows) ? rows : []) as DuplicateRow[];

  // Re-group: map<group_id, DuplicateGroup>
  const groupMap = new Map<string, DuplicateGroup>();
  for (const r of list) {
    let g = groupMap.get(r.group_id);
    if (!g) {
      g = {
        group_id: r.group_id,
        match_type: r.match_type,
        match_value: r.match_value,
        confidence: r.confidence,
        employees: [],
      };
      groupMap.set(r.group_id, g);
    }
    g.employees.push(r);
  }
  // Sort: high-confidence groups first, then by match type, then by value
  const groups = Array.from(groupMap.values()).sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === "high" ? -1 : 1;
    }
    return a.group_id.localeCompare(b.group_id);
  });

  const deleted = sp.deleted ? parseInt(decodeURIComponent(sp.deleted), 10) : null;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-amber-50/30 min-h-screen">
      <div className="max-w-5xl mx-auto">
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
            🔍 الموظفين المكررين
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
            النظام بيكتشف لو فيه أكتر من موظف بنفس <b>الرقم القومي</b> أو{" "}
            <b>كود الموظف</b> أو <b>الإيميل</b> أو <b>التليفون</b>. اختار
            موظف واحد تخليه (الأصلي)، الباقي يتم حذفه مع كل بياناته
            (حضور، مرتبات، طلبات).
          </p>
        </header>

        {deleted !== null && (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 font-cairo text-emerald-900">
            <div className="font-bold mb-1">✓ تم الحذف</div>
            <p className="text-sm">
              اتمسح <b>{deleted.toLocaleString("ar-EG")}</b> موظف مكرر مع كل
              البيانات المرتبطة.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 font-cairo text-sm">
            ⚠ {errorMsg}
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <SummaryCard
            label="مجموعات تكرار"
            value={groups.length}
            tone="amber"
          />
          <SummaryCard
            label="بثقة عالية"
            value={groups.filter((g) => g.confidence === "high").length}
            tone="red"
          />
          <SummaryCard
            label="موظفين معنيين"
            value={
              new Set(list.map((r) => r.employee_id)).size
            }
            tone="slate"
          />
        </div>

        {groups.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-emerald-200 p-16 text-center">
            <div className="text-6xl mb-4">✓</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-emerald-700">
              مفيش تكرارات
            </h2>
            <p className="text-sm text-slate-500 font-cairo">
              كل موظف بـ رقم قومي / كود / إيميل / تليفون منفصل. النظام نضيف.
            </p>
          </div>
        ) : (
          <DuplicatesReview groups={groups} action={deleteDuplicateEmployees} />
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "amber" | "red";
}) {
  const classes = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    red: "bg-red-50 border-red-200 text-red-700",
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1 font-cairo">
        {label}
      </div>
      <div className="text-3xl font-black font-display">
        {value.toLocaleString("ar-EG")}
      </div>
    </div>
  );
}
