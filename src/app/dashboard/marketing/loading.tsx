import { SkeletonHeader, SkeletonGrid } from "@/components/skeleton";

// Marketing Studio cards-heavy layout — matches the campaign grid +
// CTA cards on the studio home.
export default function MarketingLoading() {
  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <SkeletonHeader />
      <SkeletonGrid count={6} columns="sm:grid-cols-2 lg:grid-cols-3" />
    </main>
  );
}
