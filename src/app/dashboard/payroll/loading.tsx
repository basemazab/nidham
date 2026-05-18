import { SkeletonHeader, SkeletonList } from "@/components/skeleton";

export default function PayrollLoading() {
  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <SkeletonHeader />
      <SkeletonList count={6} />
    </main>
  );
}
