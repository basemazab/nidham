import { createClient } from "@/lib/supabase/server";
import { AuditLogClient } from "./client";

export const metadata = {
  title: "سجل نشاط AI",
};

export default async function AiAuditPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .single();
  if (!profile) return null;

  const { data: logs } = await supabase
    .from("ai_audit_log")
    .select("*, ai_conversations!left(title)")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false })
    .limit(100);

  return <AuditLogClient logs={logs ?? []} />;
}
