import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getMyFeatureOverrides } from "@/lib/subscriptions-server";
import type { Plan } from "@/lib/subscriptions";

type Profile = {
  full_name: string | null;
  role: "admin" | "manager" | "employee";
  companies: { name: string } | null;
};

type SubscriptionLite = {
  plan: Plan;
  ends_at: string;
};

// /dashboard is the HR-facing surface (admin + manager). Employees see
// the company data through the mobile app and have no business browsing
// the web UI -- migration 017 also denies them most SELECTs via RLS, so
// pages would render empty anyway. Catching them here gives a clean
// redirect with an Arabic explainer instead of a confusing blank screen.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [profileRes, superAdminRes, companyForSubRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, role, company_id, companies(name)")
      .eq("id", user.id)
      .single<Profile & { company_id: string }>(),
    supabase
      .from("super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    // For super_admin the RLS bypass returns rows from every tenant;
    // explicit company_id filter is the safe way to fetch THE
    // calling tenant's subscription. profile.company_id is fetched
    // alongside so this stays a single round-trip.
    supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle<{ company_id: string }>(),
  ]);

  const profile = profileRes.data;
  const callerCompanyId = companyForSubRes.data?.company_id;

  // Subscription fetched separately so we can scope by company_id
  // (defends against super_admin RLS bypass returning multi-tenant rows).
  const { data: subscription } = callerCompanyId
    ? await supabase
        .from("subscriptions")
        .select("plan, ends_at")
        .eq("company_id", callerCompanyId)
        .maybeSingle<SubscriptionLite>()
    : { data: null };
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const daysLeft = subscription
    ? Math.round(
        (new Date(subscription.ends_at + "T23:59:59").getTime() - nowMs) /
          (1000 * 60 * 60 * 24),
      )
    : undefined;

  // Employee accounts only have access to their own data via the mobile
  // app. Redirect to a dedicated "use the mobile app" page rather than
  // dumping them on /login where they'd just try to sign in again.
  if (profile && profile.role === "employee") {
    redirect("/mobile-only");
  }

  const userName = profile?.full_name ?? user.email?.split("@")[0] ?? "مستخدم";
  const companyName = profile?.companies?.name ?? "—";
  const isSuperAdmin = !!superAdminRes.data;

  // Per-tenant feature overrides (mig 041). When the super-admin has
  // disabled a module for this tenant (e.g. they bought "Marketing-only"
  // and don't need HR), the override map carries enabled=false and the
  // sidebar hides those nav items entirely. Tenants with no overrides
  // see the standard tier-based defaults.
  const featureOverrides = await getMyFeatureOverrides();

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-950">
      <DashboardSidebar
        userName={userName}
        companyName={companyName}
        userEmail={user.email ?? ""}
        isSuperAdmin={isSuperAdmin}
        role={profile?.role}
        plan={subscription?.plan ?? null}
        daysLeft={daysLeft}
        featureOverrides={featureOverrides}
      />
      {/* min-w-0 prevents flex children from forcing horizontal scroll
          when they contain wide content like tables or pre tags. */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
