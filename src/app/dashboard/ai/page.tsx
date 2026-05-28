import { createClient } from "@/lib/supabase/server";
import { AIChatWithMemory } from "@/components/ai-chat-with-memory";

export const metadata = {
  title: "المساعد الذكي",
};

export default async function AIPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id, full_name")
    .single();
  if (!profile) return null;

  // Load user's previous conversations
  const { data: conversations } = await supabase
    .from("ai_conversations")
    .select("id, title, turn_count, updated_at")
    .eq("user_id", profile.id)
    .eq("company_id", profile.company_id)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false })
    .limit(30);

  return (
    <AIChatWithMemory
      conversations={conversations ?? []}
      userId={profile.id}
      companyId={profile.company_id}
      userName={profile.full_name ?? ""}
    />
  );
}
