import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AIChat } from "@/components/ai-chat";

export default async function AIPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-5">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-amber-50 to-cyan-50 border border-amber-200 text-amber-700 text-xs font-bold mb-2 font-cairo">
            ✦ AI Assistant
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            المساعد الذكي للموارد البشرية
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed">
            اسأل بالعربي عن قانون العمل المصري، التأمينات، الضرائب،
            مكافأة نهاية الخدمة، الإجازات — أو عن بيانات شركتك وموظفينك
            مباشرة. الـ AI متدرّب على قانون العمل 12/2003 وقانون التأمينات
            148/2019.
          </p>
        </header>

        <AIChat />

        <p className="text-center text-xs text-slate-400 mt-4 font-cairo">
          مدعوم بـ Google Gemini · بيانات شركتك مش بتطلع لـ Google كـ training data ·
          مفيش حد تاني بيشوف أسئلتك
        </p>
      </div>
    </main>
  );
}
