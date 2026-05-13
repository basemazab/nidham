import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

type Profile = {
  full_name: string | null;
  role: "admin" | "manager" | "employee";
  companies: { name: string } | null;
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

  const [profileRes, superAdminRes] = await Promise.all([
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
  ]);

  const profile = profileRes.data;

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
      />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
