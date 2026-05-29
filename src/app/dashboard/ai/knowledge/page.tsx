import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { KnowledgeBaseClient } from "./client";
import Link from "next/link";

export const metadata = {
  title: "قاعدة المعرفة (AI)",
};

export default async function KnowledgePage() {
  let profile;
  try {
    const result = await getMyProfile();
    profile = result.profile;
  } catch {
    // fall through to profile check below
  }

  if (!profile) {
    return (
      <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
        <div className="max-w-lg mx-auto text-center pt-16">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold font-cairo mb-2 text-slate-700">قاعدة المعرفة (AI)</h1>
          <p className="text-slate-500 font-cairo mb-4">لم يتم العثور على حساب شركة.</p>
          <Link href="/dashboard" className="inline-block px-4 py-2 rounded-xl bg-brand-cyan-dark text-white font-bold text-sm font-cairo">
            ← الرجوع للـ Dashboard
          </Link>
        </div>
      </main>
    );
  }

  let docs: any[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("ai_knowledge_base")
      .select("id, title, source_type, created_at, chunk_index")
      .eq("company_id", profile.company_id)
      .is("parent_id", null)
      .order("created_at", { ascending: false });
    docs = data ?? [];
  } catch {
    // table might not exist in all environments yet
  }

  return (
    <KnowledgeBaseClient
      docs={docs}
      companyId={profile.company_id}
      userId={profile.id}
    />
  );
}
