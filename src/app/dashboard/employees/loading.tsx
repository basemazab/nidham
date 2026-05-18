import { SkeletonHeader, SkeletonList } from "@/components/skeleton";

// Employees list is the most-trafficked HR page. List-shaped skeleton
// matches the actual employees table density better than the default
// dashboard card grid.
export default function EmployeesLoading() {
  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <SkeletonHeader />
      <SkeletonList count={10} />
    </main>
  );
}
