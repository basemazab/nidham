import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

type Profile = {
  full_name: string | null;
  companies: { name: string } | null;
};

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
      .select("full_name, companies(name)")
      .eq("id", user.id)
      .single<Profile>(),
    supabase
      .from("super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
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
      />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
