"use client";

import { useState } from "react";
import { previewAiReply } from "../actions";

export function AiPreviewButton({ conversationId }: { conversationId: string }) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "success"; reply: string; intent: string; leadQuality: string; shouldHandoff: boolean }
    | { status: "error"; error: string }
  >({ status: "idle" });

  function handlePreview() {
    setState({ status: "loading" });
    previewAiReply({ conversationId }).then((res) => {
      if (res.ok) {
        setState({ status: "success", reply: res.reply, intent: res.intent, leadQuality: res.leadQuality, shouldHandoff: res.shouldHandoff });
      } else {
        setState({ status: "error", error: res.error });
      }
    });
  }

  return (
    <div>
      <button
        onClick={handlePreview}
        disabled={state.status === "loading"}
        className="text-xs px-3 py-1.5 rounded-lg bg-cyan-100 text-cyan-800 font-bold hover:bg-cyan-200 disabled:opacity-50 transition"
      >
        {state.status === "loading" ? "..." : "🤖 اختبر الرد التلقائي"}
      </button>

      {state.status === "success" && (
        <div className="mt-2 p-3 rounded-lg bg-cyan-50 border border-cyan-200 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-cyan-700">🤖 رد AI مقترح</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${state.leadQuality === "hot" ? "bg-rose-100 text-rose-700" : state.leadQuality === "warm" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
              {state.leadQuality}
            </span>
            <span className="text-[10px] text-slate-500">{state.intent}</span>
            {state.shouldHandoff && <span className="text-[10px] text-rose-600 font-bold">⚡ handoff</span>}
          </div>
          <p className="text-slate-800 whitespace-pre-wrap">{state.reply}</p>
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          ❌ {state.error}
        </div>
      )}
    </div>
  );
}
