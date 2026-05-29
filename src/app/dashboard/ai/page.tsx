import { getMyProfile } from "@/lib/permissions";
import { listConversations } from "@/lib/ai/memory";
import { AIChatWithMemory } from "@/components/ai-chat-with-memory";
import { ChatErrorBoundary } from "@/components/chat-error-boundary";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "المساعد الذكي",
};

export default async function AIPage() {
  try {
    const { profile } = await getMyProfile();

    if (!profile) {
      return (
        <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
          <div className="max-w-lg mx-auto text-center pt-16">
            <div className="text-6xl mb-4">🤖</div>
            <h1 className="text-2xl font-bold font-cairo mb-2 text-slate-700">المساعد الذكي</h1>
            <p className="text-slate-500 font-cairo">لم يتم العثور على حساب شركة. يرجى تسجيل الخروج وإعادة التسجيل.</p>
            <Link href="/dashboard" className="mt-4 inline-block px-4 py-2 rounded-xl bg-brand-cyan-dark text-white font-bold text-sm font-cairo">
              ← الرجوع للـ Dashboard
            </Link>
          </div>
        </main>
      );
    }

    let conversations: Awaited<ReturnType<typeof listConversations>> = [];
    try {
      conversations = await listConversations(profile.id, profile.company_id);
    } catch {
      // table might not exist in all environments yet
    }

    return (
      <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
        <div className="max-w-6xl mx-auto mb-4">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="flex items-start justify-between gap-3 flex-wrap mb-6 max-w-6xl mx-auto">
          <div>
            <div className="inline-block px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-[11px] font-bold mb-2 font-cairo">
              🤖 الذكاء الاصطناعي
            </div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">المساعد الذكي</h1>
            <p className="text-sm text-slate-500 font-cairo">اسأل عن قانون العمل، المرتبات، الضرائب، أو بيانات شركتك</p>
          </div>
        </header>

        <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
          <ChatErrorBoundary>
            <AIChatWithMemory
              conversations={conversations}
              userId={profile.id}
              companyId={profile.company_id}
              userName={profile.full_name ?? ""}
            />
          </ChatErrorBoundary>
        </div>
      </main>
    );
  } catch (e) {
    return (
      <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
        <div className="max-w-6xl mx-auto text-center pt-16">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold font-cairo mb-2 text-slate-700">حدث خطأ في تحميل الصفحة</h1>
          <p className="text-slate-500 font-cairo mb-4">{e instanceof Error ? e.message : "خطأ غير معروف"}</p>
          <Link href="/dashboard" className="inline-block px-4 py-2 rounded-xl bg-brand-cyan-dark text-white font-bold text-sm font-cairo">
            ← الرجوع للـ Dashboard
          </Link>
        </div>
      </main>
    );
  }
}
