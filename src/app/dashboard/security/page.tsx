import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { SecurityDashboardClient } from "./client";

export const metadata = {
  title: "الأمان والحماية",
};

export default async function SecurityPage() {
  const { supabase, profile } = await getMyProfile() ?? await (async () => {
    const s = await createClient();
    const { data: p } = await s.from("profiles").select("*").single();
    return { supabase: s, profile: p };
  })();
  if (!profile) return null;

  // Active sessions count
  const { count: activeSessions } = await supabase
    .from("user_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .gte("expires_at", new Date().toISOString());

  // Security events (last 30 days)
  const { data: recentEvents } = await supabase
    .from("security_events")
    .select("*")
    .eq("company_id", profile.company_id)
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(20);

  // Failed login count
  const failedLogins = recentEvents?.filter((e) => e.event_type === "login_fail").length ?? 0;

  // 2FA status
  const twoFactorEnabled = (profile as any).two_factor_enabled ?? false;

  // Custom roles count
  const { count: customRoles } = await supabase
    .from("company_roles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", profile.company_id);

  return (
    <SecurityDashboardClient
      activeSessions={activeSessions ?? 0}
      failedLogins={failedLogins}
      twoFactorEnabled={twoFactorEnabled}
      customRoles={customRoles ?? 0}
      recentEvents={recentEvents ?? []}
      userName={profile.full_name ?? ""}
    />
  );
}
