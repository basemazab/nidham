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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, companies(name)")
    .eq("id", user.id)
    .single<Profile>();

  const userName = profile?.full_name ?? user.email?.split("@")[0] ?? "مستخدم";
  const companyName = profile?.companies?.name ?? "—";

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DashboardSidebar
        userName={userName}
        companyName={companyName}
        userEmail={user.email ?? ""}
      />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
