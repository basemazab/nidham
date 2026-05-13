"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect } from "react";

// Two flavours of question on purpose: half about Egyptian labor law
// (which the system prompt now teaches the model), half about the
// company's actual data. Users learn that the AI handles both worlds.
const SUGGESTED_QUESTIONS: { q: string; cat: "law" | "data" }[] = [
  { q: "كام يوم إجازة سنوية بقانون العمل المصري؟", cat: "law" },
  { q: "مين أحسن موظف عندي الشهر ده؟", cat: "data" },
  { q: "ازاي أحسب مكافأة نهاية الخدمة؟", cat: "law" },
  { q: "كام عميل في الـ Pipeline دلوقتي؟", cat: "data" },
  { q: "ضريبة الدخل على مرتب 8000 ج كام؟", cat: "law" },
  { q: "في موظف ملتزم بس مش منتج؟", cat: "data" },
  { q: "إيه حقوق الموظف في إجازة الوضع؟", cat: "law" },
  { q: "اعملي ملخص سريع للشركة", cat: "data" },
];

export function AIChat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/chat" }),
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== "ready") return;
    sendMessage({ text: input });
    setInput("");
  };

  const handleSuggestionClick = (q: string) => {
    if (status !== "ready") return;
    sendMessage({ text: q });
  };

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] md:h-[calc(100vh-160px)] bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="text-5xl mb-3">🤖</div>
            <h2 className="text-2xl font-black font-cairo text-slate-800 mb-1">
              مرحبًا، أنا نِظام AI
            </h2>
            <p className="text-sm text-slate-500 mb-6 font-cairo max-w-lg leading-relaxed">
              مساعد موارد بشرية متخصص في السوق المصري. اسألني عن قانون العمل،
              الإجازات، الضرائب، التأمينات، نهاية الخدمة، أو عن بيانات
              شركتك وموظفيك مباشرة.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl w-full">
              {SUGGESTED_QUESTIONS.map(({ q, cat }, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSuggestionClick(q)}
                  className={`text-right px-4 py-3 rounded-xl border transition text-sm font-cairo ${
                    cat === "law"
                      ? "border-amber-200 hover:border-amber-300 hover:bg-amber-50 text-slate-700"
                      : "border-cyan-200 hover:border-brand-cyan/40 hover:bg-cyan-50/50 text-slate-700"
                  }`}
                >
                  <span className="text-xs opacity-60">
                    {cat === "law" ? "⚖ قانون" : "📊 بياناتك"}
                  </span>{" "}
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => {
              const textParts = m.parts.filter((p) => p.type === "text");
              const content = textParts.map((p) => ("text" in p ? p.text : "")).join("");
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                      m.role === "user"
                        ? "bg-gradient-to-br from-brand-cyan to-brand-cyan-dark text-white"
                        : "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
                    }`}
                  >
                    {m.role === "user" ? "أ" : "🤖"}
                  </div>
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl font-cairo text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-brand-cyan/10 text-slate-800 rounded-tr-sm"
                        : "bg-slate-50 text-slate-800 rounded-tl-sm"
                    }`}
                  >
                    {content}
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-sm">
                  🤖
                </div>
                <div className="px-4 py-3 rounded-2xl bg-slate-50">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-xs font-cairo">
          ⚠ {error.message}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-3 border-t border-slate-100 bg-slate-50/50"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اسأل عن قانون العمل، الضرائب، الإجازات، أو بيانات شركتك..."
          disabled={isLoading}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold font-cairo disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition shadow-md"
        >
          {isLoading ? "..." : "ابعت"}
        </button>
      </form>
    </div>
  );
}
