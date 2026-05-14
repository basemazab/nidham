import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
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

  const [profileRes, superAdminRes, subRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, role, companies(name)")
      .eq("id", user.id)
      .single<Profile>(),
    supabase
      .from("super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("plan, ends_at")
      .single<SubscriptionLite>(),
  ]);

  const profile = profileRes.data;
  const subscription = subRes.data;
  const daysLeft = subscription
    ? Math.round(
        (new Date(subscription.ends_at + "T23:59:59").getTime() - Date.now()) /
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

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
      <DashboardSidebar
        userName={userName}
        companyName={companyName}
        userEmail={user.email ?? ""}
        isSuperAdmin={isSuperAdmin}
        role={profile?.role}
        plan={subscription?.plan ?? null}
        daysLeft={daysLeft}
      />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
