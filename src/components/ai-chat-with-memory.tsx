"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  createConversation,
  updateConversationMeta,
  saveMessage,
  archiveConversation,
} from "@/lib/ai/memory";
import {
  MessageSquare,
  Plus,
  Trash2,
  Send,
  Sparkles,
  History,
  Loader2,
  PanelLeftClose,
  PanelLeft,
  Bot,
  User,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  turn_count: number;
  updated_at: string;
}

interface Props {
  conversations: Conversation[];
  userId: string;
  companyId: string;
  userName: string;
}

const SUGGESTED_ACTIONS = [
  { label: "كام موظف نشط عندي؟", icon: "👥", desc: "عدد الموظفين حسب القسم" },
  { label: "مين يستحق زيادة؟", icon: "💰", desc: "تحليل الاحتفاظ والتوصيات" },
  { label: "طلب إجازة معلقة؟", icon: "📋", desc: "طلبات الإجازات والسلف" },
  { label: "إحصائيات الحضور", icon: "📊", desc: "نسبة الحضور والغياب" },
  { label: "اقفل مرتبات الشهر", icon: "💳", desc: "احسب ونفذ دورة المرتبات" },
  { label: "حلل أداء الفريق", icon: "⭐", desc: "التقييمات والاحتفاظ" },
];

const WELCOME_MESSAGE = {
  role: "assistant" as const,
  id: "welcome",
  parts: [
    {
      type: "text" as const,
      text: "👋 مرحباً! أنا المساعد الذكي.\n\nأقدر أساعدك في:\n• **الموظفين** — بحث، إضافة، تعديل\n• **الحضور** — تقارير، تسجيل، استيراد\n• **المرتبات** — حساب، تنفيذ الدورات\n• **الإجازات** — عرض الطلبات، موافقة\n• **التحليلات** — أداء الفريق، الاحتفاظ\n\nإيه اللي عايز تعمله النهاردة؟",
    },
  ],
};

function formatMessageText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n");
}

function ToolCallIndicator({ text }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
          {text || "ببحث في البيانات..."}
        </span>
      </div>
    </div>
  );
}

export function AIChatWithMemory({
  conversations: initialConversations,
  userId,
  companyId,
}: Props) {
  const [localConvs, setLocalConvs] = useState(initialConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [convTitle, setConvTitle] = useState("محادثة جديدة");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [turnCount, setTurnCount] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/agent" }),
  });

  const allMessages = messages.length === 0 ? [WELCOME_MESSAGE] : messages;

  useEffect(() => {
    if (status === "ready") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, status]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = () => {
      setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const isLoading = status === "submitted" || status === "streaming";

  const lastAssistantMsg = messages[messages.length - 1];
  const hasToolCalls = lastAssistantMsg?.parts?.some(
    (p: any) => p.type === "tool-call" || p.type === "tool-result",
  );
  const showToolIndicator =
    isLoading && messages.length > 0 && hasToolCalls;

  async function handleNewChat() {
    setMessages([] as any);
    setActiveConvId(null);
    setConvTitle("محادثة جديدة");
    setTurnCount(0);
    inputRef.current?.focus();
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    let convId = activeConvId;
    const text = input;
    setInput("");

    if (!convId) {
      const newConv = await createConversation(
        userId,
        companyId,
        text.slice(0, 60) + (text.length > 60 ? "..." : ""),
      );
      convId = newConv.id;
      setActiveConvId(convId);
      setConvTitle(newConv.title);
      setLocalConvs((prev) => [newConv, ...prev]);
    }

    const cId = convId!;
    await saveMessage({
      conversationId: cId,
      role: "user",
      content: text,
    });
    await updateConversationMeta(cId, {
      turn_count: turnCount + 1,
    });

    sendMessage({ text });
  }

  async function handleArchive(id: string) {
    await archiveConversation(id);
    setLocalConvs((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) {
      setMessages([] as any);
      setActiveConvId(null);
      setConvTitle("محادثة جديدة");
    }
  }

  const fetchMessages = useCallback(
    async (convId: string) => {
      try {
        const res = await fetch(`/api/ai/conversations/${convId}`);
        const data = await res.json();
        if (data.messages?.length > 0) {
          setMessages(
            data.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              parts: [{ type: "text" as const, text: m.content || "" }],
            })),
          );
        } else {
          setMessages([] as any);
        }
      } catch {
        setMessages([] as any);
      }
    },
    [setMessages],
  );

  function loadConversation(conv: Conversation) {
    setActiveConvId(conv.id);
    setConvTitle(conv.title);
    setTurnCount(conv.turn_count);
    fetchMessages(conv.id);
  }

  function getMessageText(m: any): string {
    if (m.parts) {
      const textParts = m.parts.filter((p: any) => p.type === "text");
      return textParts
        .map((p: any) => (typeof p.text === "string" ? p.text : ""))
        .join("");
    }
    return m.content || "";
  }

  async function copyMessage(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[500px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {/* Sidebar */}
      <div
        className={`flex-shrink-0 border-l bg-slate-50/50 transition-all duration-200 dark:bg-slate-800/50 ${
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b bg-white px-3 py-3 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
              <History className="h-4 w-4" />
              المحادثات
            </h2>
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:from-cyan-600 hover:to-cyan-700"
            >
              <Plus className="h-3.5 w-3.5" />
              جديد
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {localConvs.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center justify-between rounded-xl p-2.5 text-sm cursor-pointer transition-all ${
                  activeConvId === conv.id
                    ? "bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-200 dark:bg-slate-800 dark:text-cyan-400 dark:ring-cyan-800"
                    : "text-slate-600 hover:bg-white hover:shadow-sm dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
                onClick={() => loadConversation(conv)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                    <span className="truncate text-xs font-medium">
                      {conv.title}
                    </span>
                  </div>
                  <div className="mr-5 text-[10px] text-slate-400">
                    {conv.turn_count} رسالة
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchive(conv.id);
                  }}
                  className="hidden shrink-0 rounded-lg p-1 text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {localConvs.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <MessageSquare className="h-8 w-8 text-slate-300" />
                <p className="text-xs text-slate-400">لا توجد محادثات سابقة</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-white px-4 py-2.5 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </button>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
                <Bot className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {convTitle}
                </h1>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      isLoading
                        ? "animate-pulse bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                  />
                  <span className="text-[10px] text-slate-400">
                    {isLoading
                      ? "بيشتغل..."
                      : "جاهز"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-all hover:border-cyan-300 hover:text-cyan-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-cyan-700 dark:hover:text-cyan-400"
          >
            <Plus className="h-3.5 w-3.5" />
            محادثة جديدة
          </button>
        </div>

        {/* Messages */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto bg-gradient-to-b from-white via-slate-50/30 to-white p-4 dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-900"
        >
          <div className="mx-auto max-w-3xl space-y-4">
            {allMessages.map((m, i) => {
              const text = getMessageText(m);
              const isWelcome = m.id === "welcome";
              const isLastAssistant =
                m.role === "assistant" &&
                i === allMessages.length - 1 &&
                !isWelcome;

              if (isWelcome) {
                return (
                  <div key="welcome" className="py-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200/50">
                      <Bot className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="mb-1 text-xl font-black text-slate-800 dark:text-slate-100">
                      المساعد الذكي
                    </h2>
                    <p className="mb-6 text-sm text-slate-500">
                      اسأل عن الموظفين، الحضور، المرتبات، وتحليلات الشركة
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 max-w-xl mx-auto">
                      {SUGGESTED_ACTIONS.map((q) => (
                        <button
                          key={q.label}
                          onClick={() => setInput(q.label)}
                          className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-right text-xs transition-all hover:border-cyan-200 hover:bg-cyan-50 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:hover:border-cyan-700 dark:hover:bg-cyan-900/20"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-base transition-colors group-hover:bg-cyan-100 dark:bg-slate-700 dark:group-hover:bg-cyan-900/40">
                            {q.icon}
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-700 dark:text-slate-300">
                              {q.label}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {q.desc}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={m.id || i}
                  className={`flex ${
                    m.role === "user" ? "justify-start" : "justify-end"
                  }`}
                >
                  <div
                    className={`flex items-start gap-2.5 max-w-[85%] group ${
                      m.role === "user" ? "flex-row" : "flex-row-reverse"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ${
                        m.role === "user"
                          ? "bg-gradient-to-br from-cyan-500 to-blue-600"
                          : "bg-gradient-to-br from-amber-400 to-orange-500"
                      }`}
                    >
                      {m.role === "user" ? (
                        <User className="h-4 w-4 text-white" />
                      ) : (
                        <Bot className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{text}</div>
                      {m.role === "assistant" && !isLoading && (
                        <button
                          onClick={() => copyMessage(text, m.id || "")}
                          className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400 opacity-0 transition-opacity hover:text-slate-600 group-hover:opacity-100"
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {showToolIndicator && (
              <div className="flex justify-end">
                <div className="flex items-start gap-2.5 flex-row-reverse">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <ToolCallIndicator />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 shadow-sm dark:bg-red-900/20 dark:text-red-400">
                  <span>⚠️</span>
                  <span>{error.message || "حدث خطأ في الاتصال"}</span>
                  <button
                    onClick={() => setMessages(messages)}
                    className="mr-2 rounded-lg bg-red-100 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-800 dark:text-red-300 dark:hover:bg-red-700"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Scroll to bottom */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white p-2 shadow-lg ring-1 ring-slate-200 transition-all hover:bg-slate-50 dark:bg-slate-800 dark:ring-slate-700"
          >
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </button>
        )}

        {/* Input */}
        <div className="border-t bg-white px-4 py-3 dark:bg-slate-900">
          <form onSubmit={handleSend} className="mx-auto flex max-w-3xl items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اسأل عن الموظفين، الحضور، المرتبات..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-all placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-cyan-600 dark:focus:ring-cyan-900"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-sm transition-all hover:from-cyan-600 hover:to-cyan-700 hover:shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </form>
          <p className="mx-auto mt-1.5 max-w-3xl text-right text-[10px] text-slate-400">
            المساعد الذكي يستخدم AI وقد يخطئ — راجع البيانات المهمة
          </p>
        </div>
      </div>
    </div>
  );
}
