"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendHumanReply } from "../actions";

export function ReplyComposer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSend() {
    if (!text.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await sendHumanReply({ conversationId, text });
      if (res.ok) {
        setText("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div>
      {error && (
        <div className="mb-2 flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          <span>⚠️ {error}</span>
          <button
            onClick={handleSend}
            disabled={pending}
            className="px-2 py-1 rounded-md bg-rose-200 text-rose-800 font-bold hover:bg-rose-300 disabled:opacity-50"
          >
            إعادة المحاولة
          </button>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="اكتب ردّك… (Ctrl+Enter للإرسال)"
          rows={2}
          className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 outline-none resize-none text-sm"
          disabled={pending}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || pending}
          className="px-5 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold text-sm hover:bg-brand-cyan disabled:opacity-50 disabled:cursor-not-allowed transition flex-shrink-0"
        >
          {pending ? "..." : "إرسال"}
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-1">
        ⚠️ تنبيه Meta: ينفع ترد فقط خلال 24 ساعة من آخر رسالة من العميل.
      </p>
    </div>
  );
}
