import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { WhatsAppTestClient } from "./whatsapp-test-client";

// ============================================================================
// /dashboard/whatsapp-test — preview the employee WhatsApp bot's replies
// ============================================================================
//
// Lets HR test the bot end-to-end (intent routing + data lookups + reply
// formatting) WITHOUT needing the full Meta Business Account setup. The
// route handler runs the exact same routeBotMessage() function that the
// real /api/whatsapp/webhook calls — just without the final sendText().
//
// Two cards on this page:
//   1. Setup status — checks WhatsApp + Service Role env vars
//   2. Simulator    — pick employee + type message + see reply

export const dynamic = "force-dynamic";

type Employee = {
  id: string;
  full_name: string;
  phone: string | null;
  department: string | null;
  job_title: string | null;
};

export default async function WhatsAppTestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getMyProfile();
  const companyId = profile?.company_id ?? "";

  const { data: empData } = await supabase
    .from("employees")
    .select("id, full_name, phone, department, job_title")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("full_name")
    .returns<Employee[]>();

  const employees = empData ?? [];

  // Server-side env-var check — never expose the actual tokens, just
  // their presence/absence so HR knows what setup is still pending.
  const setupStatus = {
    whatsAppToken: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
    phoneNumberId: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
    verifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  const allConfigured =
    setupStatus.whatsAppToken &&
    setupStatus.phoneNumberId &&
    setupStatus.verifyToken &&
    setupStatus.serviceRole;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200 text-emerald-700 text-xs font-bold mb-2 font-cairo">
            🧪 اختبار WhatsApp Bot
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            تجربة بوت الموظفين
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
            اختار موظف، اكتب الرسالة اللي ممكن يبعتها، وشوف رد البوت قبل ما
            تفعّل الـ WhatsApp Cloud API. البوت بيشتغل بنفس المنطق اللي
            هيتشغّل لما رسالة فعلية تيجي.
          </p>
        </header>

        {/* Setup status panel */}
        <section
          className={`bg-white rounded-2xl shadow-sm border-2 p-5 mb-5 ${
            allConfigured ? "border-emerald-200" : "border-amber-200"
          }`}
        >
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-bold text-slate-800 font-cairo">
              📋 حالة الإعداد
            </h2>
            <span
              className={`text-xs font-bold font-cairo px-2 py-1 rounded-full ${
                allConfigured
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {allConfigured
                ? "✓ جاهز للإنتاج"
                : "⏳ ينقص بعض الإعدادات"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            <StatusRow
              label="WHATSAPP_ACCESS_TOKEN"
              ok={setupStatus.whatsAppToken}
              hint="Meta System User token"
            />
            <StatusRow
              label="WHATSAPP_PHONE_NUMBER_ID"
              ok={setupStatus.phoneNumberId}
              hint="من Meta API Setup"
            />
            <StatusRow
              label="WHATSAPP_VERIFY_TOKEN"
              ok={setupStatus.verifyToken}
              hint="أي string عشوائي طويل"
            />
            <StatusRow
              label="SUPABASE_SERVICE_ROLE_KEY"
              ok={setupStatus.serviceRole}
              hint="من Supabase Settings → API"
            />
          </div>

          {!allConfigured && (
            <div className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3 font-cairo leading-relaxed">
              <strong>محتاج تعمل ايه:</strong> ضيف الـ env vars الناقصة في
              Vercel → Settings → Environment Variables. اقرأ خطوات Meta
              Business Account كاملة في{" "}
              <code className="bg-white px-1.5 py-0.5 rounded text-[10px]">
                docs/WHATSAPP_SETUP.md
              </code>
              .
              <br />
              <span className="text-amber-700">
                لكن الـ simulator تحت بيشتغل من غير الـ env vars — بيتيح لك
                تجرب منطق البوت قبل ما تعمل setup كامل.
              </span>
            </div>
          )}

          {allConfigured && (
            <div className="text-xs text-emerald-800 bg-emerald-50 rounded-lg p-3 font-cairo leading-relaxed">
              ✓ كل الإعدادات تمام. الموظف يقدر يبعت لـ رقم البوت رسالة فعلية
              ويتلقى رد فوري.{" "}
              <strong>
                URL الـ webhook اللي تحطّه في Meta:
                <code className="block bg-white px-2 py-1 rounded mt-1 text-[10px]" dir="ltr">
                  https://www.nidhamhr.com/api/whatsapp/webhook
                </code>
              </strong>
            </div>
          )}
        </section>

        {/* Simulator */}
        <WhatsAppTestClient employees={employees} />

        {/* Commands reference */}
        <section className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-bold text-slate-800 font-cairo mb-3">
            📚 الأوامر اللي البوت بيفهمها
          </h2>
          <p className="text-xs text-slate-500 font-cairo mb-3">
            أي كلمة من اللي تحت في رسالة الموظف هتشغّل الـ intent المناسب.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-cairo">
            <CmdRow
              keys={["مساعدة", "ابدأ", "menu", "list"]}
              desc="قائمة كل الأوامر المتاحة"
            />
            <CmdRow
              keys={["رصيد إجازاتي", "إجازة", "leave"]}
              desc="عدد أيام الإجازة الاعتيادية المتبقية للسنة"
            />
            <CmdRow
              keys={["مرتبي", "آخر مرتب", "راتب", "salary"]}
              desc="آخر دورة مرتبات (أساسي / إجمالي / صافي)"
            />
            <CmdRow
              keys={["حضوري", "حضور", "attendance"]}
              desc="آخر 7 أيام مع ساعة الدخول والخروج"
            />
            <CmdRow
              keys={["سلفي", "سلفة", "advance", "loan"]}
              desc="السلف المفتوحة والمتبقي منها"
            />
            <CmdRow
              keys={["شهادة عمل", "شهادة خبرة", "certificate"]}
              desc="يقول للموظف إنه يكلم HR لإصدار الشهادة"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusRow({
  label,
  ok,
  hint,
}: {
  label: string;
  ok: boolean;
  hint: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-lg ${
        ok ? "bg-emerald-50" : "bg-rose-50"
      }`}
    >
      <span className={`text-lg ${ok ? "text-emerald-600" : "text-rose-600"}`}>
        {ok ? "✓" : "✗"}
      </span>
      <div className="flex-1 min-w-0">
        <div
          className={`font-mono text-[10px] truncate ${
            ok ? "text-emerald-800" : "text-rose-800"
          }`}
          dir="ltr"
        >
          {label}
        </div>
        <div className="text-[10px] text-slate-500 font-cairo">{hint}</div>
      </div>
    </div>
  );
}

function CmdRow({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-1 mb-1">
          {keys.map((k) => (
            <code
              key={k}
              className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono"
            >
              {k}
            </code>
          ))}
        </div>
        <div className="text-slate-600 text-[11px]">{desc}</div>
      </div>
    </div>
  );
}
