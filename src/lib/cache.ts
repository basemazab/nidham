// Centralised cache-invalidation helpers.
//
// Every server action that mutates business data needs to bust the
// dashboard cache so the user sees fresh data on the next navigation.
// Individual revalidatePath() calls drift -- one action remembers to
// revalidate /dashboard/employees, another forgets /dashboard/reports/
// bridge, the result is the "I updated X but Y still shows the old
// value" class of bug.
//
// bustDashboardCache() revalidates the /dashboard layout, which
// transitively busts every /dashboard/* page using it. Targeted
// revalidatePath calls for the specific page being edited are still
// fine on top of this -- they handle the page's own immediate
// re-render -- but every mutation should call this helper as a
// catch-all for cross-cutting consumers (home counts, reports,
// /admin tables, etc).

import { revalidatePath } from "next/cache";

/**
 * Revalidate the whole /dashboard subtree. Use after any mutation
 * that modifies employees / customers / payroll / attendance /
 * requests / contracts / jobs / interactions.
 */
export function bustDashboardCache(): void {
  // revalidatePath(path, "layout") revalidates the layout PLUS every
  // page under it. So this single call refreshes /dashboard,
  // /dashboard/employees, /dashboard/customers, /dashboard/payroll,
  // /dashboard/reports/* and so on.
  revalidatePath("/dashboard", "layout");
}

/**
 * Bust both the company-facing dashboard AND the super-admin panel.
 * Use after subscription / billing changes that affect both sides.
 */
export function bustAllSurfaces(): void {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin", "layout");
}
