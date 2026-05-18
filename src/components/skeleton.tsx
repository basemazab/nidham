// ============================================================================
// Skeleton primitives — placeholder shapes for route-level loading.tsx
// ============================================================================
//
// Pure CSS, no client interactivity needed. The animate-pulse class is
// Tailwind's built-in opacity oscillation so we don't need a custom
// keyframe. Each variant is a thin wrapper that just preconfigures
// width / height / shape for a common UI element (card, row, header,
// avatar).
//
// USAGE in a loading.tsx file:
//
//   export default function Loading() {
//     return (
//       <main className="p-6 space-y-4">
//         <SkeletonHeader />
//         <SkeletonGrid count={6} />
//       </main>
//     );
//   }
//
// All variants accept className so callers can tweak spacing without
// forking the primitive.

import type { ReactNode } from "react";

/**
 * Base skeleton block. Light/dark backgrounds match our color tokens
 * so the placeholder doesn't fight the theme.
 */
export function Skeleton({
  className = "",
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg ${className}`}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

/**
 * Page header placeholder — title bar + subtitle + optional action button.
 * Matches the visual rhythm most of our dashboard pages use.
 */
export function SkeletonHeader({
  withAction = true,
}: {
  withAction?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
      <div className="flex-1 min-w-[200px] space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full opacity-70" />
      </div>
      {withAction && <Skeleton className="h-10 w-32 rounded-xl" />}
    </div>
  );
}

/**
 * Single card placeholder — title + body lines + footer chip.
 * Defaults match the small card aesthetic used in dashboards / KPI tiles.
 */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 ${className}`}
    >
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32 opacity-70" />
    </div>
  );
}

/**
 * Grid of card skeletons — matches our common 2 → 4 columns responsive
 * grid pattern. count controls how many placeholders to render.
 */
export function SkeletonGrid({
  count = 6,
  columns = "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
}: {
  count?: number;
  columns?: string;
}) {
  return (
    <div className={`grid grid-cols-1 ${columns} gap-3`}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/**
 * Single list row — for tables / inbox / employees list. Avatar +
 * two-line text + trailing chip approximates most of our data rows.
 */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-2/3 opacity-70" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full shrink-0" />
    </div>
  );
}

/**
 * Stacked list of row skeletons. count controls density.
 */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
