import { createClient } from "@/lib/supabase/server";
import { SessionsClient } from "./client";

export const metadata = {
  title: "الجلسات النشطة",
};

export default async function SessionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get all sessions for this user
  const { data: sessions } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("last_active_at", { ascending: false });

  return <SessionsClient sessions={sessions ?? []} />;
}
