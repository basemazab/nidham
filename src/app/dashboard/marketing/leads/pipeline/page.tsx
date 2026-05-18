// ============================================================================
// /dashboard/marketing/leads/pipeline — Drag-and-drop Kanban
// ============================================================================
//
// Server component loads every (non-archived) lead, buckets by status, then
// hands the buckets to a client component that renders the Kanban board
// + handles HTML5 drag-and-drop. Native HTML5 was chosen over @dnd-kit so
// we don't add a 30KB dep for one screen.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";
import { PipelineBoard } from "./pipeline-board";

type PipelineLead = {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp: string | null;
  status: string;
  source: string | null;
  first_utm_source: string | null;
  first_utm_campaign: string | null;
  estimated_value: number | null;
  last_contacted_at: string | null;
  created_at: string;
};

// Force the page to revalidate on every request. Without this, Next.js
// caches the row list + counters between requests, so newly-added rows
// from server actions or import flows take minutes to appear.
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await canUseFeature("marketing_studio"))) {
    return <UpgradeRequired feature="marketing_studio" />;
  }

  // Scope to caller's company so super-admin sessions don't see leads
  // across every tenant in the kanban view.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const { data: leadsData } = await supabase
    .from("customers")
    .select(
      "id, full_name, phone, whatsapp, status, source, first_utm_source, first_utm_campaign, estimated_value, last_contacted_at, created_at",
    )
    .eq("company_id", callerCompanyId)
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<PipelineLead[]>();

  const leads = leadsData ?? [];

  // Pipeline value (won + active deals)
  const wonValue = leads
    .filter((l) => l.status === "won")
    .reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0);
  const pipelineValue = leads
    .filter((l) => l.status === "qualified" || l.status === "active")
    .reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0);

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard/marketing/leads"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الـ Inbox العادي
          </Link>
        </div>

        <header className="mb-5 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-violet-100 to-fuchsia-100 border border-violet-300 text-violet-800 text-xs font-bold mb-2 font-cairo">
              🎯 Pipeline View
            </div>
            <h1 className="text-2xl md:text-3xl font-black font-cairo text-slate-800 mb-1">
              خط الإنتاج (Pipeline)
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              اسحب الـ lead من عمود لعمود عشان تحدّث حالته. {leads.length} lead
              في الـ view.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 font-cairo">قيمة الـ Pipeline النشط</div>
            <div className="text-xl font-black text-violet-700 font-display">
              {pipelineValue.toLocaleString("ar-EG")} ج
            </div>
            <div className="text-[10px] text-emerald-700 font-cairo mt-1">
              + {wonValue.toLocaleString("ar-EG")} ج محقّقين فعلاً
            </div>
          </div>
        </header>

        <PipelineBoard initialLeads={leads} />
      </div>
    </main>
  );
}
