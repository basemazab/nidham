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

const SUGGESTED_QUESTIONS = [
  "كام يوم إجازة سنوية بقانون العمل المصري؟",
  "ازاي أحسب مكافأة نهاية الخدمة؟",
  "ضريبة الدخل على مرتب 8000 ج كام؟",
  "مين أحسن موظف عندي الشهر ده؟",
  "كام عميل في Pipeline دلوقتي؟",
  "اعملي ملخص سريع للشركة",
  "إيه حقوق الموظف في إجازة الوضع؟",
  "عندي موظفين بدون مرتبات — هاتهم",
];

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/chat" }),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const isLoading = status === "submitted" || status === "streaming";

  async function handleNewChat() {
    setMessages([] as any);
    setActiveConvId(null);
    setConvTitle("محادثة جديدة");
    setTurnCount(0);
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
      return textParts.map((p: any) => (typeof p.text === "string" ? p.text : "")).join("");
    }
    return m.content || "";
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* Sidebar */}
      <div
        className={`flex-shrink-0 border-l bg-white transition-all duration-200 dark:bg-slate-900 ${
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b p-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <History className="h-4 w-4" />
              المحادثات
            </h2>
            <button
              onClick={handleNewChat}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {localConvs.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center justify-between rounded-lg p-2 text-sm cursor-pointer transition-colors ${
                  activeConvId === conv.id
                    ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
                onClick={() => loadConversation(conv)}
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate text-xs">{conv.title}</div>
                  <div className="text-[10px] text-slate-400">
                    {conv.turn_count} رسالة
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchive(conv.id);
                  }}
                  className="hidden group-hover:block rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {localConvs.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">
                لا توجد محادثات سابقة
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </button>
            <Sparkles className="h-5 w-5 text-amber-500" />
            <div>
              <h1 className="text-sm font-semibold">{convTitle}</h1>
              <p className="text-[10px] text-slate-400">
                {isLoading ? "يكتب..." : "جاهز"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Sparkles className="mb-4 h-12 w-12 text-amber-200" />
              <h2 className="mb-2 text-lg font-semibold">
                المساعد الذكي لنظام HR
              </h2>
              <p className="mb-6 max-w-md text-sm text-slate-500">
                اسأل عن قانون العمل، المرتبات، الضرائب، أو بيانات شركتك
              </p>
              <div className="grid max-w-lg grid-cols-2 gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="rounded-lg border p-2 text-xs text-slate-600 transition-colors hover:border-cyan-300 hover:text-cyan-700 dark:text-slate-400 dark:hover:border-cyan-700 dark:hover:text-cyan-400"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => {
              const text = getMessageText(m);
              return (
                <div
                  key={m.id || i}
                  className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.role === "user"
                        ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                        : "bg-amber-50 text-slate-800 dark:bg-amber-900/20 dark:text-slate-200"
                    }`}
                  >
                    {text}
                  </div>
                </div>
              );
            })
          )}
          {isLoading && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl bg-amber-50 px-4 py-2.5 dark:bg-amber-900/20">
                <span className="inline-flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-amber-400" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-amber-400 [animation-delay:0.1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-amber-400 [animation-delay:0.2s]" />
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error.message || "حدث خطأ في الاتصال"}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t p-4">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اسأل عن قانون العمل، المرتبات، أو بيانات الموظفين..."
              className="flex-1 rounded-xl border px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none dark:bg-slate-800"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="rounded-xl bg-cyan-600 p-2.5 text-white hover:bg-cyan-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
