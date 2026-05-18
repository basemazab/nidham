// ============================================================================
// Dashboard loading fallback — cascades to ALL /dashboard/* subroutes that
// don't have their own loading.tsx
// ============================================================================
//
// Streamed in BEFORE the page's RSC hits, so the sidebar (from layout.tsx)
// stays interactive while the main area shows a placeholder. The
// skeleton primitives match the visual rhythm of every dashboard page
// (header + KPI strip + card/list area).

import {
  SkeletonHeader,
  SkeletonGrid,
  SkeletonList,
} from "@/components/skeleton";

export default function DashboardLoading() {
  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <SkeletonHeader />

      {/* KPI strip placeholder — 4 small tiles matching most dashboards */}
      <SkeletonGrid count={4} columns="sm:grid-cols-2 md:grid-cols-4" />

      {/* Content area placeholder — 2/3 split is the most common page
          layout on dashboard (main list + side panel). */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SkeletonList count={5} />
        </div>
        <div className="space-y-3">
          <SkeletonGrid count={3} columns="grid-cols-1" />
        </div>
      </div>
    </main>
  );
}
