import Link from "next/link";
import { requireHRPage } from "@/lib/permissions";

// ============================================================================
// /dashboard/marketing/inbox — Conversations list
// ============================================================================
//
// Shows all marketing-inbox conversations for the tenant, newest first,
// with filters (channel + status). Each row links to the conversation
// detail page where messages can be read + replied to.

export const dynamic = "force-dynamic";

type ConversationRow = {
  id: string;
  channel: "messenger" | "instagram" | "whatsapp" | "web";
  external_user_id: string;
  external_user_name: string | null;
  external_user_picture: string | null;
  status: string;
  ai_lead_quality: string | null;
  ai_intent: string | null;
  last_message_at: string;
  customer_id: string | null;
};

const CHANNEL_LABEL: Record<string, string> = {
  messenger: "Messenger",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  web: "موقع الويب",
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  open: { text: "مفتوح", cls: "bg-blue-100 text-blue-800" },
  ai_replied: { text: "الـ AI رد", cls: "bg-cyan-100 text-cyan-800" },
  human_replied: { text: "ردّيت", cls: "bg-emerald-100 text-emerald-800" },
  qualified: { text: "مؤهَّل", cls: "bg-amber-100 text-amber-800" },
  closed: { text: "مغلق", cls: "bg-slate-100 text-slate-600" },
  spam: { text: "spam", cls: "bg-rose-100 text-rose-700" },
};

const LEAD_LABEL: Record<string, { text: string; cls: string }> = {
  hot: { text: "🔥 Hot", cls: "bg-rose-100 text-rose-700 border-rose-200" },
  warm: { text: "☀️ Warm", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  cold: { text: "❄️ Cold", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  spam: { text: "🚫 Spam", cls: "bg-slate-200 text-slate-500 border-slate-300" },
};

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "حالاً";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${days} ي`;
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export default async function MarketingInboxPage() {
  const { supabase, profile } = await requireHRPage();

  const { data: settings } = await supabase
    .from("marketing_inbox_settings")
    .select("ai_enabled, meta_page_id, channel_messenger, channel_instagram, meta_page_token, meta_verify_token")
    .eq("company_id", profile.company_id)
    .maybeSingle();

  const { data: conversations } = await supabase
    .from("marketing_inbox_conversations")
    .select(
      "id, channel, external_user_id, external_user_name, external_user_picture, status, ai_lead_quality, ai_intent, last_message_at, customer_id",
    )
    .eq("company_id", profile.company_id)
    .order("last_message_at", { ascending: false })
    .limit(50);

  const rows = (conversations || []) as ConversationRow[];
  const isConfigured = !!settings?.meta_page_id;
  const hasWebhookEverFired = rows.length > 0;
  const hasToken = !!settings?.meta_page_token;
  const hasVerifyToken = !!settings?.meta_verify_token;
  const isAiEnabled = !!settings?.ai_enabled;

  // Counts for the small dashboard at the top
  const counts = rows.reduce(
    (acc, c) => {
      acc.total += 1;
      if (c.status === "open") acc.open += 1;
      if (c.ai_lead_quality === "hot") acc.hot += 1;
      return acc;
    },
    { total: 0, open: 0, hot: 0 },
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">
            📥 صندوق وارد التسويق
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            رسائل من Facebook Ads + Instagram DMs في مكان واحد، مع رد تلقائي
            بالـ AI وتحويل العملاء المؤهلين لـ CRM.
          </p>
        </div>
        <Link
          href="/dashboard/marketing/inbox/settings"
          className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition"
        >
          ⚙️ الإعدادات
        </Link>
      </div>

      {/* Webhook status banner */}
      {isConfigured && !hasWebhookEverFired && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <div className="font-bold mb-1">في انتظار أول رسالة</div>
              <p className="text-sm mb-2">
                الإعدادات مكتملة بس لسه مفيش رسائل وصلت. تأكد من:
              </p>
              <ul className="text-sm space-y-1 list-disc pr-5">
                {!hasToken && <li className="font-bold">Page Access Token ناقص — روح للإعدادات</li>}
                {!hasVerifyToken && <li className="font-bold">Verify Token ناقص — روح للإعدادات</li>}
                {hasToken && hasVerifyToken && (
                  <>
                    <li>إن الـ Webhook URL مضبوط في <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener" className="underline font-bold">Meta Developer Portal</a></li>
                    <li>إن الـ App <strong>Live mode</strong> (مش Test mode)</li>
                    <li>إن الصفحة مشتركة في Webhook events: <code>messages</code> و <code>messaging_postbacks</code></li>
                    <li>إن الـ <strong>Verify Token</strong> مطابق لللي في الإعدادات</li>
                    <li>إن الـ <strong>Page ID</strong> مطابق للصفحة الحقيقية</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {isConfigured && hasWebhookEverFired && !isAiEnabled && (
        <div className="mb-6 p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
          <div className="flex items-center gap-2">
            <span>ℹ️</span>
            <span className="text-sm">
              الـ AI التلقائي <strong>متوقف</strong>. الرسائل بتوصل بس مفيش رد تلقائي.
            </span>
            <a href="/dashboard/marketing/inbox/settings" className="text-sm font-bold underline mr-auto">فعّل AI</a>
          </div>
        </div>
      )}

      {/* Configuration warning */}
      {!isConfigured && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="font-bold mb-1">لازم تكمل الإعدادات الأول</div>
              <p className="text-sm mb-3">
                Marketing Inbox محتاج Meta Page Token + Verify Token عشان يستقبل
                الرسائل. مفيش رسائل هتظهر هنا لحد ما تكمل.
              </p>
              <Link
                href="/dashboard/marketing/inbox/settings"
                className="inline-block px-4 py-2 rounded-lg bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 transition"
              >
                ابدأ الإعداد →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <div className="text-xs text-slate-500">إجمالي</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {counts.total}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
          <div className="text-xs text-blue-600">محادثات مفتوحة</div>
          <div className="text-2xl font-black text-blue-900 mt-1">
            {counts.open}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
          <div className="text-xs text-rose-600">🔥 Hot leads</div>
          <div className="text-2xl font-black text-rose-900 mt-1">
            {counts.hot}
          </div>
        </div>
      </div>

      {/* Conversations table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <div className="text-4xl mb-3">💬</div>
            <p className="font-bold text-slate-700 mb-1">
              مفيش رسائل لسه
            </p>
            <p className="text-sm">
              {isConfigured
                ? "لما حد يبعتلك رسالة من Facebook أو Instagram، هتظهر هنا."
                : "اكمل الإعدادات الأول."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((conv) => (
              <Link
                key={conv.id}
                href={`/dashboard/marketing/inbox/${conv.id}`}
                className="block p-4 hover:bg-slate-50 transition"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-600 flex-shrink-0 overflow-hidden">
                    {conv.external_user_picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={conv.external_user_picture}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (conv.external_user_name || "?").charAt(0)
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-slate-900">
                        {conv.external_user_name || `مستخدم ${conv.external_user_id.slice(-6)}`}
                      </span>
                      <span className="text-xs text-slate-500">
                        · {CHANNEL_LABEL[conv.channel] || conv.channel}
                      </span>
                      {conv.ai_lead_quality && LEAD_LABEL[conv.ai_lead_quality] && (
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md border ${LEAD_LABEL[conv.ai_lead_quality].cls}`}
                        >
                          {LEAD_LABEL[conv.ai_lead_quality].text}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {STATUS_LABEL[conv.status] && (
                        <span
                          className={`px-2 py-0.5 rounded-md ${STATUS_LABEL[conv.status].cls}`}
                        >
                          {STATUS_LABEL[conv.status].text}
                        </span>
                      )}
                      {conv.ai_intent && (
                        <span className="text-slate-500">
                          · {conv.ai_intent}
                        </span>
                      )}
                      {conv.customer_id && (
                        <span className="text-emerald-600 font-bold">
                          · ✓ في CRM
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Time */}
                  <div className="text-xs text-slate-500 flex-shrink-0 whitespace-nowrap">
                    {formatRelative(conv.last_message_at)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
