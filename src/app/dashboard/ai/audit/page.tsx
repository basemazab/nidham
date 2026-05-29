import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { AuditLogClient } from "./client";
import Link from "next/link";

export const metadata = {
  title: "سجل نشاط AI",
};

export default async function AiAuditPage() {
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
          <h1 className="text-2xl font-bold font-cairo mb-2 text-slate-700">سجل نشاط AI</h1>
          <p className="text-slate-500 font-cairo mb-4">لم يتم العثور على حساب شركة.</p>
          <Link href="/dashboard" className="inline-block px-4 py-2 rounded-xl bg-brand-cyan-dark text-white font-bold text-sm font-cairo">
            ← الرجوع للـ Dashboard
          </Link>
        </div>
      </main>
    );
  }

  let logs: any[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("ai_audit_log")
      .select("*, ai_conversations!left(title)")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(100);
    logs = data ?? [];
  } catch {
    // table might not exist in all environments yet
  }

  return <AuditLogClient logs={logs} />;
}
