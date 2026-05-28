import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProviderStatus } from "@/lib/ai-models";

export const dynamic = "force-dynamic";

export default async function AiToolsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1) AI provider status
  const providerStatus = getProviderStatus();

  // 2) Count AI usage from marketing inbox
  const { count: aiRepliesCount } = await supabase
    .from("marketing_inbox_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender", "ai");

  // 3) Count screening results
  const { count: screenedCount } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .not("ai_score", "is", null);

  // 4) Count AI retention runs
  const { count: retentionCount } = await supabase
    .from("employee_retention_insights")
    .select("id", { count: "exact", head: true });

  const aiTools = [
    {
      name: "المساعد الذكي (AI Agent)",
      href: "/dashboard/ai",
      desc: "يساعدك في الموظفين، الحضور، المرتبات، ومتصل بـ 10 أدوات تنفيذية",
      status: providerStatus.primary !== "none" ? "available" : "missing_key",
      key: "GROQ_API_KEY / GEMINI_API_KEY",
      usage: "—",
    },
    {
      name: "فرز السير الذاتية (AI Screening)",
      href: "/dashboard/jobs",
      desc: "يصنّف المرشحين ويسجلهم تلقائياً باستخدام Gemini + Groq",
      status: providerStatus.primary !== "none" ? "available" : "missing_key",
      key: "GEMINI_API_KEY",
      usage: `${screenedCount ?? 0} سيرة ذاتية`,
    },
    {
      name: "الرد التلقائي (Marketing Inbox)",
      href: "/dashboard/marketing/inbox",
      desc: "يرد على رسائل Facebook/Instagram تلقائياً بالعامية المصرية",
      status: providerStatus.primary !== "none" ? "available" : "missing_key",
      key: "GROQ_API_KEY / GEMINI_API_KEY",
      usage: `${aiRepliesCount ?? 0} رد`,
    },
    {
      name: "احتفاظ بالموظفين (Retention)",
      href: "/dashboard/retention",
      desc: "يحلّل مخاطر ترك الموظفين ويقترح مكافآت وعلاوات",
      status: providerStatus.primary !== "none" ? "available" : "missing_key",
      key: "GROQ_API_KEY / GEMINI_API_KEY",
      usage: `${retentionCount ?? 0} تقرير`,
    },
    {
      name: "تحليل الملفات (PDF/Excel)",
      href: null,
      desc: "يستخرج بيانات الموظفين والحضور من ملفات PDF و Excel",
      status: providerStatus.gemini ? "available" : "missing_key",
      key: "GEMINI_API_KEY",
      usage: "مدمج في المساعد الذكي",
    },
    {
      name: "التوظيف الذكي (Boolean Search)",
      href: "/dashboard/jobs",
      desc: "يبحث عن المرشحين على LinkedIn باستخدام Boolean queries",
      status: providerStatus.primary !== "none" ? "available" : "missing_key",
      key: "GROQ_API_KEY / GEMINI_API_KEY",
      usage: "مدمج في التوظيف",
    },
    {
      name: "بوت الواتساب (WhatsApp Bot)",
      href: "/dashboard/whatsapp-test",
      desc: "بوت للموظفين — حضور، إجازات، كشف مرتب عن طريق واتساب",
      status: "available",
      key: "—",
      usage: "يتطلب إعداد Twilio",
    },
  ];

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-5xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard/ai"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← المساعد الذكي
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-purple-50 to-cyan-50 border border-purple-200 text-purple-700 text-xs font-bold mb-2">
            🤖 تقارير الذكاء الاصطناعي
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-1">
            أدوات الذكاء الاصطناعي
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
            كل أدوات AI اللي في نِظام — حالتها، مفاتيح API، وعدد مرات الاستخدام.
          </p>
        </header>

        {/* Provider status cards */}
        <section className="mb-8">
          <h2 className="text-lg font-black text-slate-800 mb-3">🔌 مزودي الخدمة</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatusCard
              name="Groq"
              available={providerStatus.groq}
              desc="سريع، مجاني، يدعم JSON"
              keyName="GROQ_API_KEY"
            />
            <StatusCard
              name="Google Gemini"
              available={providerStatus.gemini}
              desc="يدعم الصور والـ PDF"
              keyName="GEMINI_API_KEY"
            />
            <StatusCard
              name="الخدمة الأساسية"
              available={providerStatus.primary !== "none"}
              desc={providerStatus.primary === "none" ? "غير متاح" : providerStatus.primary}
              keyName="أحد المفاتيح أعلاه"
            />
          </div>
        </section>

        {/* AI tools table */}
        <section>
          <h2 className="text-lg font-black text-slate-800 mb-3">🛠 الأدوات المتاحة</h2>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wide">
                <tr>
                  <th className="text-right px-4 py-3">الأداة</th>
                  <th className="text-right px-4 py-3">الوصف</th>
                  <th className="text-center px-4 py-3">الحالة</th>
                  <th className="text-center px-4 py-3">الاستخدام</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aiTools.map((tool) => (
                  <tr key={tool.name} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      {tool.href ? (
                        <Link href={tool.href} className="font-bold text-brand-cyan-dark hover:underline">
                          {tool.name}
                        </Link>
                      ) : (
                        <span className="font-bold text-slate-800">{tool.name}</span>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5">{tool.key}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs max-w-xs">{tool.desc}</td>
                    <td className="px-4 py-3 text-center">
                      {tool.status === "available" ? (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">✓ شغال</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">⚠️ ناقص مفتاح</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 text-xs">{tool.usage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* API keys guide */}
        <section className="mt-8 p-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          <div className="font-bold mb-2">🔑 عايز تشغل AI؟</div>
          <p className="mb-2">
            لو مفيش مفتاح API، بعض الأدوات مش هتشتغل. فيه حلّين:
          </p>
          <ul className="space-y-1 list-disc pr-5">
            <li>
              <strong>Groq:</strong> افتح{" "}
              <a href="https://console.groq.com" target="_blank" rel="noopener" className="underline font-bold">console.groq.com</a>
              {" "}→ سجل → انسخ API key → حطه في <code className="bg-amber-100 px-1 rounded">GROQ_API_KEY</code>
            </li>
            <li>
              <strong>Gemini:</strong> افتح{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="underline font-bold">aistudio.google.com</a>
              {" "}→ سجل → انسخ API key → حطه في <code className="bg-amber-100 px-1 rounded">GEMINI_API_KEY</code>
            </li>
          </ul>
          <p className="mt-2 text-xs text-amber-700">
            كلهم مجانيين — Groq يعطيك 30 RPM و Gemini يعطيك 1500 RPD (يكفي لشركة صغيرة).
          </p>
        </section>
      </div>
    </main>
  );
}

function StatusCard({ name, available, desc, keyName }: { name: string; available: boolean; desc: string; keyName: string }) {
  return (
    <div className={`p-4 rounded-xl border ${available ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"} text-sm`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2.5 h-2.5 rounded-full ${available ? "bg-emerald-500" : "bg-slate-300"}`} />
        <span className="font-bold text-slate-800">{name}</span>
      </div>
      <p className="text-xs text-slate-600 mb-1">{desc}</p>
      <code className="text-[10px] bg-slate-200/50 px-1 rounded text-slate-500">{keyName}</code>
    </div>
  );
}
