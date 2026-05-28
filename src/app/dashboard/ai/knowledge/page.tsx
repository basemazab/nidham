import { createClient } from "@/lib/supabase/server";
import { KnowledgeBaseClient } from "./client";

export const metadata = {
  title: "قاعدة المعرفة (AI)",
};

export default async function KnowledgePage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id")
    .single();
  if (!profile) return null;

  const { data: docs } = await supabase
    .from("ai_knowledge_base")
    .select("id, title, source_type, created_at, chunk_index")
    .eq("company_id", profile.company_id)
    .is("parent_id", null)
    .order("created_at", { ascending: false });

  return (
    <KnowledgeBaseClient
      docs={docs ?? []}
      companyId={profile.company_id}
      userId={profile.id}
    />
  );
}
