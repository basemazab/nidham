// Skeleton fallback while a dashboard page streams. The sidebar (which
// is part of layout.tsx, not a child) keeps rendering instantly --
// only the page area shows the skeleton, which feels like a real fast
// product instead of a hard blink.

export default function DashboardLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="space-y-3">
        <div className="h-8 w-64 bg-slate-200 rounded-lg" />
        <div className="h-4 w-96 bg-slate-100 rounded" />
      </div>

      {/* Card grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3"
          >
            <div className="h-4 w-1/3 bg-slate-200 rounded" />
            <div className="h-8 w-2/3 bg-slate-100 rounded" />
            <div className="h-3 w-full bg-slate-50 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
