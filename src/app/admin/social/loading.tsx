import {
  SkeletonHeader,
  SkeletonGrid,
  SkeletonList,
} from "@/components/skeleton";

// Social dashboard mixes KPI tiles, action cards, and a post grid.
// The skeleton mirrors that shape so the page doesn't visually
// "jump" once the real data lands.
export default function SocialLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 min-h-screen bg-slate-50 dark:bg-slate-950">
      <SkeletonHeader />
      {/* KPI strip */}
      <SkeletonGrid count={4} columns="grid-cols-2 md:grid-cols-4" />
      {/* Action cards */}
      <SkeletonGrid count={4} columns="sm:grid-cols-2 lg:grid-cols-4" />
      {/* Recent posts */}
      <SkeletonList count={6} />
    </div>
  );
}
