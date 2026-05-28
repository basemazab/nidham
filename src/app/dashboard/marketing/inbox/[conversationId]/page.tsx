import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHRPage } from "@/lib/permissions";
import { ReplyComposer } from "./reply-composer";
import { AiPreviewButton } from "./ai-preview";

// ============================================================================
// /dashboard/marketing/inbox/[conversationId] — single thread view
// ============================================================================

export const dynamic = "force-dynamic";

type Params = { conversationId: string };

const CHANNEL_LABEL: Record<string, string> = {
  messenger: "Messenger",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  web: "Web",
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { conversationId } = await params;
  const { supabase, profile } = await requireHRPage();

  // Fetch conversation
  const { data: conv } = await supabase
    .from("marketing_inbox_conversations")
    .select(
      "id, company_id, channel, external_user_id, external_user_name, external_user_picture, status, ai_lead_quality, ai_intent, customer_id, last_message_at, created_at",
    )
    .eq("id", conversationId)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (!conv) notFound();

  // Fetch all messages
  const { data: messages } = await supabase
    .from("marketing_inbox_messages")
    .select(
      "id, direction, sender, body, sent_at, delivery_error, created_at",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col h-screen max-h-screen p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-200">
        <Link
          href="/dashboard/marketing/inbox"
          className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
        >
          ← الكل
        </Link>

        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold overflow-hidden">
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

        <div className="flex-1">
          <div className="font-black text-slate-900">
            {conv.external_user_name || `مستخدم ${conv.external_user_id.slice(-6)}`}
          </div>
          <div className="text-xs text-slate-500">
            {CHANNEL_LABEL[conv.channel] || conv.channel}
            {conv.ai_lead_quality && ` · ${conv.ai_lead_quality.toUpperCase()}`}
            {conv.ai_intent && ` · ${conv.ai_intent}`}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conv.customer_id && (
            <Link
              href={`/dashboard/customers/${conv.customer_id}`}
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              ✓ ملف العميل ↗
            </Link>
          )}
          <AiPreviewButton conversationId={conversationId} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 px-1">
        {(messages || []).map((m) => {
          const isInbound = m.direction === "inbound";
          const isAI = m.sender === "ai";
          return (
            <div
              key={m.id}
              className={`flex ${isInbound ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  isInbound
                    ? "bg-slate-100 text-slate-900"
                    : isAI
                      ? "bg-cyan-100 text-cyan-900 border border-cyan-200"
                      : "bg-brand-cyan text-white"
                }`}
              >
                {!isInbound && (
                  <div className="text-[10px] font-bold opacity-70 mb-0.5">
                    {isAI ? "🤖 AI" : "👤 إنت"}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className="text-[10px] opacity-60 mt-1 text-end">
                  {new Date(m.created_at).toLocaleString("ar-EG", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {m.delivery_error && (
                    <span className="text-rose-600 ml-2">
                      ⚠️ {m.delivery_error}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {(!messages || messages.length === 0) && (
          <div className="text-center text-sm text-slate-500 py-8">
            مفيش رسائل في الـ thread ده.
          </div>
        )}
      </div>

      {/* Reply composer */}
      <div className="border-t border-slate-200 pt-4">
        <ReplyComposer conversationId={conversationId} />
      </div>
    </div>
  );
}
