import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AIAgentChat } from "@/components/ai-agent-chat";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";

export default async function AIPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // AI Assistant + AI CV Screening run on Gemini and cost money per
  // request -- gated to Pro+ so we can scale economics with the tier.
  if (!(await canUseFeature("ai_assistant"))) {
    return <UpgradeRequired feature="ai_assistant" />;
  }

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-5">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-amber-50 to-cyan-50 border border-amber-200 text-amber-700 text-xs font-bold mb-2 font-cairo">
            ✦ AI Agent — موظف بقدرات خارقة
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            المساعد الذكي للموارد البشرية
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed">
            خلاص بقى موظف فعلي جوه نظامك — بيبحث في الموظفين، بيلخص الحضور،
            بيقفل المرتبات بأمرك. اطلب أي مهمة بالعربي ووفر وقتك. متخصص في
            قانون العمل المصري 12/2003 + التأمينات 148/2019 + شرائح الضريبة 2024.
          </p>
        </header>

        <AIAgentChat />

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] font-cairo">
          <div className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600">
            🔧 <strong>١٠ أدوات تنفيذية</strong> — بحث، حضور، طلبات، مرتبات، احتفاظ بالموظفين، رفع ملفات...
          </div>
          <div className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600">
            🛡 <strong>حماية مزدوجة</strong> — أي تنفيذ بيطلب موافقتك الصريحة
          </div>
          <div className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600">
            🔒 <strong>خصوصية كاملة</strong> — بياناتك مش بتطلع كـ training data
          </div>
        </div>
      </div>
    </main>
  );
}
