// ============================================================================
// /dashboard/org-chart — Interactive organisation tree
// ============================================================================
//
// Renders the company's reporting structure as a top-down tree:
//
//   • Roots = anyone whose reports_to is NULL (CEO / department heads)
//   • Each manager is followed by their direct reports, indented one level
//   • Avatar + name + job title + report count on every card
//
// Built deliberately without an interactive zoom / pan library — for
// the 50-500 employee SMB range a static, scroll-able tree is plenty
// and works in print + email screenshots. A future commit can wrap it
// in react-flow once a tenant grows past that.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Employee = {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  avatar_url: string | null;
  reports_to: string | null;
  status: string;
};

type TreeNode = Employee & { reports: TreeNode[] };

export default async function OrgChartPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name, job_title, department, avatar_url, reports_to, status")
    .eq("company_id", callerCompanyId)
    .eq("status", "active")
    .order("full_name")
    .returns<Employee[]>();

  const list = employees ?? [];
  const roots = buildTree(list);

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            🌳 الهيكل التنظيمي
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            خريطة الموظفين النشطين حسب علاقات الإدارة — اضغط "تعيين مدير"
            على كرت أي موظف عشان تربطه بمدير مباشر.
          </p>
        </header>

        {list.length === 0 ? (
          <EmptyState />
        ) : roots.length === 0 ? (
          <UnconnectedState />
        ) : (
          <div className="space-y-8">
            {roots.map((root) => (
              <NodeView key={root.id} node={root} depth={0} />
            ))}
          </div>
        )}

        {/* Stragglers — employees whose reports_to is set to someone
            who isn't on the list (shouldn't happen normally, but the
            schema allows it after a terminated-manager cascade) */}
        {list.length > 0 && roots.length > 0 && (
          <UnreachableNodes employees={list} roots={roots} />
        )}
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Tree-building helpers
// ----------------------------------------------------------------------------
function buildTree(employees: Employee[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(
    employees.map((e) => [e.id, { ...e, reports: [] }]),
  );
  const roots: TreeNode[] = [];
  for (const e of employees) {
    const node = byId.get(e.id)!;
    if (e.reports_to && byId.has(e.reports_to)) {
      byId.get(e.reports_to)!.reports.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------
function NodeView({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <div
      style={{ paddingInlineStart: depth === 0 ? 0 : 24 }}
      className="space-y-2"
    >
      <Link
        href={`/dashboard/employees/${node.id}`}
        className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-cyan transition group max-w-md"
      >
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center text-white font-black text-base shrink-0 overflow-hidden">
          {node.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={node.avatar_url}
              alt={node.full_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{node.full_name[0] ?? "?"}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800 font-cairo truncate group-hover:text-brand-cyan-dark">
            {node.full_name}
          </div>
          <div className="text-xs text-slate-500 font-cairo truncate">
            {node.job_title ?? "—"}
            {node.department && (
              <span className="mx-1">· {node.department}</span>
            )}
          </div>
        </div>
        {node.reports.length > 0 && (
          <div className="text-[10px] text-brand-cyan-dark bg-cyan-50 border border-cyan-200 rounded-full px-2 py-0.5 font-bold font-cairo shrink-0">
            👥 {node.reports.length}
          </div>
        )}
      </Link>

      {node.reports.length > 0 && (
        <div className="border-r-2 border-dashed border-slate-300 pr-6 ms-6 space-y-2">
          {node.reports.map((child) => (
            <NodeView key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
      <div className="text-6xl mb-4">🌱</div>
      <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">
        مفيش موظفين بعد
      </h2>
      <p className="text-slate-500 font-cairo mb-6">
        ضيف أول موظف عشان يظهر الهيكل التنظيمي
      </p>
      <Link
        href="/dashboard/employees/new"
        className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo"
      >
        ضيف موظف
      </Link>
    </div>
  );
}

function UnconnectedState() {
  return (
    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-8 text-center font-cairo">
      <div className="text-4xl mb-3">🔗</div>
      <h2 className="text-lg font-bold mb-2 text-amber-900">
        مفيش روابط إدارية بعد
      </h2>
      <p className="text-sm text-amber-800 mb-4 leading-relaxed">
        موظفينك موجودين بس مفيش "مدير مباشر" متعين على أي حد. ادخل على
        أي كرت موظف وحدد له المدير عشان يظهر التسلسل.
      </p>
      <Link
        href="/dashboard/employees"
        className="inline-block px-5 py-2 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 transition text-sm"
      >
        روح لقائمة الموظفين
      </Link>
    </div>
  );
}

function UnreachableNodes({
  employees,
  roots,
}: {
  employees: Employee[];
  roots: TreeNode[];
}) {
  // Find employees not present in the rendered tree (their reports_to
  // points to someone who isn't on the active list).
  const inTree = new Set<string>();
  const visit = (n: TreeNode) => {
    inTree.add(n.id);
    n.reports.forEach(visit);
  };
  roots.forEach(visit);

  const orphans = employees.filter((e) => !inTree.has(e.id));
  if (orphans.length === 0) return null;

  return (
    <section className="mt-10 p-5 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl">
      <h3 className="text-sm font-bold text-slate-700 font-cairo mb-3">
        ⚠ {orphans.length} موظف مدير المباشر بتاعهم مش في الشركة
      </h3>
      <p className="text-xs text-slate-500 font-cairo mb-3">
        المدير المباشر متعين على حد اتفصل أو حد مش نشط. عيد تعيين مدير
        لهم عشان يدخلوا الهيكل.
      </p>
      <div className="flex flex-wrap gap-2">
        {orphans.map((e) => (
          <Link
            key={e.id}
            href={`/dashboard/employees/${e.id}`}
            className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:border-amber-400 font-cairo"
          >
            {e.full_name}
          </Link>
        ))}
      </div>
    </section>
  );
}
