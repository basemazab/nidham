"use client";

// ============================================================================
// AI Agent Chat — tool-calling UI
// ============================================================================
//
// This is the V2 of /components/ai-chat.tsx. The original was a pure
// Q&A widget. This one renders tool calls + their results inline so
// the user can SEE what the agent is doing on their behalf:
//
//   🔧 يبحث عن الموظفين... (input-streaming)
//   ✓ لقى ٣ نتائج                       (output-available)
//
// For the destructive tool (`execute_payroll_period`) we render a
// special success card with a deep-link to the new period — that's
// the "wow moment" Basem asked for: type in chat, watch a payroll
// cycle materialize.

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect } from "react";
import type { UIMessage } from "ai";

// Suggested prompts in a fresh chat. Mix of pure-Q&A (left to the
// model's general knowledge) and tool-using requests so the user
// discovers both flavours.
const SUGGESTED: { q: string; cat: "tool" | "law" | "data" }[] = [
  {
    q: "اقفلي مرتبات الموظفين الشهريين من ٢١ أبريل لـ ٢٠ مايو",
    cat: "tool",
  },
  { q: "مين من موظفيني يستحق زيادة دلوقتي؟", cat: "tool" },
  { q: "في حد من موظفيني ممكن يستقيل قريب؟", cat: "tool" },
  { q: "كام موظف عندي شهري وكام أسبوعي؟", cat: "tool" },
  { q: "اعرضلي طلبات الإجازة المعلقة", cat: "tool" },
  { q: "ايه حقوقي في الإجازة الاعتيادية؟", cat: "law" },
  { q: "ضريبة الدخل على ٨٠٠٠ ج كام؟", cat: "law" },
  { q: "اعملي ملخص حضور الشهر ده", cat: "tool" },
];

// Friendly Arabic labels for each tool. Shown next to the spinner
// while the tool is executing so the user knows what's happening.
const TOOL_LABELS: Record<string, { running: string; done: string; icon: string }> = {
  search_employees: {
    running: "بيدور على الموظفين",
    done: "خلص البحث",
    icon: "🔍",
  },
  get_attendance_summary: {
    running: "بيلخص الحضور",
    done: "جهز ملخص الحضور",
    icon: "📊",
  },
  count_employees_by_pay_frequency: {
    running: "بيعد الموظفين",
    done: "عد الموظفين خلص",
    icon: "👥",
  },
  list_pending_requests: {
    running: "بيشوف الطلبات المعلقة",
    done: "جاب الطلبات",
    icon: "📋",
  },
  find_duplicate_employees: {
    running: "بيدور على التكرارات",
    done: "خلص فحص التكرارات",
    icon: "🔁",
  },
  propose_payroll_period: {
    running: "بيحسب المرتبات (محاكاة)",
    done: "جهز اقتراح المرتبات",
    icon: "🧮",
  },
  analyze_retention: {
    running: "بيحلل احتفاظ بالموظفين",
    done: "خلص تحليل الاحتفاظ",
    icon: "🎯",
  },
  bulk_import_employees: {
    running: "بيضيف الموظفين من الملف",
    done: "تم إضافة الموظفين",
    icon: "📥",
  },
  bulk_import_attendance: {
    running: "بيضيف الحضور من الملف",
    done: "تم إضافة الحضور",
    icon: "📥",
  },
  execute_payroll_period: {
    running: "بيقفل المرتبات",
    done: "تم قفل المرتبات",
    icon: "💰",
  },
};

// AI SDK 6.x ToolUIPart — discriminated by `type: 'tool-<name>'` and
// `state` (input-streaming → input-available → output-available |
// output-error). We don't import the SDK type to avoid a heavier
// client bundle; this narrow shape is what we need.
type ToolPart = {
  type: string; // 'tool-search_employees', etc.
  toolCallId?: string;
  state?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
};

function isToolPart(p: unknown): p is ToolPart {
  return (
    !!p &&
    typeof p === "object" &&
    "type" in p &&
    typeof (p as { type: unknown }).type === "string" &&
    (p as { type: string }).type.startsWith("tool-")
  );
}

function getToolName(p: ToolPart): string {
  return p.type.slice("tool-".length);
}

// ----------------------------------------------------------------------------
// Tool-output renderers
// ----------------------------------------------------------------------------
//
// Each renderer takes the tool's `output` (already parsed JSON from the
// server) and returns a compact summary card. For execute_payroll_period
// we render a CTA so the user can jump straight to the new period.

function ToolOutputSummary({
  toolName,
  output,
}: {
  toolName: string;
  output: unknown;
}) {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;

  if (toolName === "execute_payroll_period" && o.ok === true) {
    const url = String(o.url ?? "");
    const empCount = Number(o.employee_count ?? 0);
    const totalNet = Number(o.total_net ?? 0);
    const alreadyExisted = o.already_exists === true;
    return (
      <a
        href={url}
        className="block mt-2 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200 hover:shadow-md transition font-cairo"
      >
        <div className="text-[11px] text-emerald-700 font-bold mb-1">
          {alreadyExisted ? "📂 دورة موجودة بالفعل" : "✅ تم قفل المرتبات"}
        </div>
        <div className="text-sm font-bold text-slate-800">
          {empCount} موظف · إجمالي صافي{" "}
          {totalNet.toLocaleString("ar-EG")} ج
        </div>
        <div className="text-[11px] text-slate-600 mt-1">
          اضغط هنا لفتح كشف المرتبات →
        </div>
      </a>
    );
  }

  if (toolName === "propose_payroll_period" && o.ok === true) {
    return (
      <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-cairo">
        <div className="font-bold text-amber-800 mb-1">
          🧮 اقتراح المرتبات (لسه ما اتنفذش)
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-700">
          <span>الموظفين:</span>
          <span className="font-bold" dir="ltr">
            {String(o.employee_count ?? 0)}
          </span>
          <span>إجمالي صافي:</span>
          <span className="font-bold" dir="ltr">
            {Number(o.total_net ?? 0).toLocaleString("ar-EG")} ج
          </span>
          <span>إجمالي خصومات:</span>
          <span className="font-bold" dir="ltr">
            {Number(o.total_deductions ?? 0).toLocaleString("ar-EG")} ج
          </span>
        </div>
      </div>
    );
  }

  if (toolName === "search_employees" && o.ok === true) {
    const results = Array.isArray(o.results) ? o.results : [];
    if (results.length === 0)
      return (
        <div className="mt-1 text-[11px] text-slate-500 font-cairo">
          (ما فيش نتايج)
        </div>
      );
    return (
      <div className="mt-2 text-[11px] text-slate-600 font-cairo">
        لقى {results.length} نتيجة
      </div>
    );
  }

  if (toolName === "count_employees_by_pay_frequency" && o.ok === true) {
    return (
      <div className="mt-2 text-[11px] text-slate-600 font-cairo">
        إجمالي {String(o.total_active ?? 0)} · شهري {String(o.monthly ?? 0)} ·
        أسبوعي {String(o.weekly ?? 0)}
      </div>
    );
  }

  if (toolName === "list_pending_requests" && o.ok === true) {
    const counts = (o.counts ?? {}) as { leaves?: number; advances?: number };
    return (
      <div className="mt-2 text-[11px] text-slate-600 font-cairo">
        إجازات معلقة: {counts.leaves ?? 0} · سلف معلقة: {counts.advances ?? 0}
      </div>
    );
  }

  if (toolName === "find_duplicate_employees" && o.ok === true) {
    return (
      <div className="mt-2 text-[11px] text-slate-600 font-cairo">
        {String(o.groups_count ?? 0)} مجموعة تكرارات
      </div>
    );
  }

  if (toolName === "get_attendance_summary" && o.ok === true) {
    return (
      <div className="mt-2 text-[11px] text-slate-600 font-cairo">
        حضور {String(o.present ?? 0)} · غياب {String(o.absent ?? 0)} · إجازات{" "}
        {String(o.leave ?? 0)}
      </div>
    );
  }

  if (toolName === "bulk_import_employees" && o.ok === true) {
    const inserted = Number(o.inserted_count ?? 0);
    const skipped = Number(o.skipped_count ?? 0);
    return (
      <a
        href={String(o.dashboard_url ?? "/dashboard/employees")}
        className="block mt-2 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200 hover:shadow-md transition font-cairo"
      >
        <div className="text-[11px] text-emerald-700 font-bold mb-1">
          ✅ تم إضافة الموظفين
        </div>
        <div className="text-sm font-bold text-slate-800">
          {inserted} موظف اتضاف{skipped > 0 ? ` · ${skipped} اتجاهل` : ""}
        </div>
        <div className="text-[11px] text-slate-600 mt-1">
          اضغط هنا لفتح صفحة الموظفين →
        </div>
      </a>
    );
  }

  if (toolName === "bulk_import_attendance" && o.ok === true) {
    const inserted = Number(o.inserted_count ?? 0);
    return (
      <a
        href={String(o.review_url ?? "/dashboard/attendance")}
        className="block mt-2 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200 hover:shadow-md transition font-cairo"
      >
        <div className="text-[11px] text-emerald-700 font-bold mb-1">
          ✅ تم إضافة الحضور
        </div>
        <div className="text-sm font-bold text-slate-800">
          {inserted} سجل اتضاف
        </div>
        <div className="text-[11px] text-slate-600 mt-1">
          اضغط هنا لمراجعة الدفعة →
        </div>
      </a>
    );
  }

  if (toolName === "analyze_retention" && o.ok === true) {
    const counts = (o.insight_counts ?? {}) as {
      raise?: number;
      bonus?: number;
      flight_risk?: number;
      anniversary?: number;
    };
    return (
      <a
        href={String(o.dashboard_url ?? "/dashboard/retention")}
        className="block mt-2 p-2 rounded-lg bg-gradient-to-l from-rose-50 via-amber-50 to-emerald-50 border border-amber-200 hover:shadow text-xs font-cairo text-slate-700"
      >
        <div className="font-bold text-amber-800 mb-1">
          🎯 {String(o.analyzed_employees ?? 0)} موظف اتحلل
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {(counts.raise ?? 0) > 0 && (
            <span>💸 {counts.raise} زيادة</span>
          )}
          {(counts.bonus ?? 0) > 0 && (
            <span>🎁 {counts.bonus} مكافأة</span>
          )}
          {(counts.flight_risk ?? 0) > 0 && (
            <span className="text-rose-700">⚠ {counts.flight_risk} إنذار</span>
          )}
          {(counts.anniversary ?? 0) > 0 && (
            <span>🎉 {counts.anniversary} ذكرى</span>
          )}
        </div>
        <div className="text-[10px] text-slate-500 mt-1">
          اضغط لفتح صفحة التوصيات →
        </div>
      </a>
    );
  }

  if (o.ok === false && o.error) {
    return (
      <div className="mt-2 text-[11px] text-red-600 font-cairo">
        ⚠ {String(o.error)}
      </div>
    );
  }

  return null;
}

// ----------------------------------------------------------------------------
// Main component
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Parsed file payload returned by /api/ai/parse-file
// ----------------------------------------------------------------------------
type ParsedFile = {
  ok: true;
  filename: string;
  size: number;
  sheet_name: string;
  headers: string[];
  row_count: number;
  truncated: boolean;
  rows: Record<string, string | number | null>[];
  hint: "employees" | "attendance" | "unknown";
  notes: string;
  // PDF-only fields
  is_pdf?: boolean;
  pdf_type?: "employees" | "attendance" | "other";
  text_summary?: string | null;
};

export function AIAgentChat() {
  const [input, setInput] = useState("");
  const [attached, setAttached] = useState<ParsedFile | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/agent" }),
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // Upload + parse file in the background. We don't add anything to the
  // chat yet — we just hold the parsed payload until the user types
  // their actual prompt and hits "ابعت". Then we embed the data block
  // in the message text so the AI sees it.
  const handleFilePick = async (file: File | null | undefined) => {
    if (!file) return;
    setFileError(null);
    setFileBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/ai/parse-file", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "فشل قراءة الملف" }));
        throw new Error(err?.error ?? `فشل (${res.status})`);
      }
      const data = (await res.json()) as ParsedFile;
      setAttached(data);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "حصل خطأ غير متوقع");
    } finally {
      setFileBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Build the actual message text that goes to the AI. When a file is
  // attached, we prepend a structured ATTACHMENT block before the user's
  // prose. Three flavours:
  //
  //   1) Excel / structured PDF (employees | attendance): embed JSON rows
  //      so the agent can call bulk_import_* tools.
  //   2) Free-form PDF (contracts, memos, etc): embed the text summary
  //      so the agent can answer questions about it.
  //
  // The system prompt instructs the agent how to use each shape.
  const buildMessageText = (userText: string): string => {
    if (!attached) return userText;

    const fileKind = attached.is_pdf ? "PDF" : "Excel/CSV";
    const hintLine =
      attached.hint === "employees"
        ? "هذا كشف موظفين"
        : attached.hint === "attendance"
          ? "هذا كشف حضور"
          : attached.pdf_type === "other"
            ? "هذا ملف غير منظم (عقد / مذكرة / تقرير...)"
            : "نوع الملف غير محدد — استنتج من المحتوى";

    const lines: string[] = [
      `📎 [ملف ${fileKind} مرفق]`,
      `اسم الملف: ${attached.filename}`,
    ];

    if (attached.pdf_type === "other" && attached.text_summary) {
      // Free-form PDF — surface the summary; no rows
      lines.push(hintLine);
      lines.push("");
      lines.push("ملخص المحتوى:");
      lines.push(attached.text_summary);
    } else {
      // Structured data (Excel OR structured PDF)
      lines.push(
        `${hintLine} — اتقرى ${attached.row_count} صف${attached.truncated ? " (المتبقي اتجاهل)" : ""}`,
      );
      if (attached.headers.length > 0) {
        lines.push(`العناوين: ${attached.headers.join(" | ")}`);
      }
      if (attached.rows.length > 0) {
        lines.push("البيانات الكاملة (JSON):");
        lines.push("```json");
        lines.push(JSON.stringify(attached.rows, null, 0));
        lines.push("```");
      }
    }

    lines.push("");
    lines.push(userText);
    return lines.join("\n");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== "ready") return;
    if (!input.trim() && !attached) return;

    const finalText = buildMessageText(input.trim() || "حلل الملف ده وقولي ممكن أعمل بيه إيه");
    sendMessage({ text: finalText });
    setInput("");
    setAttached(null);
    setFileError(null);
  };

  const handleSuggestionClick = (q: string) => {
    if (status !== "ready") return;
    sendMessage({ text: q });
  };

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] md:h-[calc(100vh-160px)] bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
      {/* Header tag */}
      <div className="px-4 py-2 bg-gradient-to-r from-amber-50 to-cyan-50 border-b border-amber-100">
        <div className="flex items-center gap-2 text-[11px] font-cairo text-slate-600">
          <span className="px-2 py-0.5 rounded-full bg-amber-200/50 text-amber-800 font-bold">
            ✦ Agent Mode
          </span>
          <span>المساعد ممكن ينفذ مهام (مرتبات، حضور، طلبات...) بأمرك</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="text-5xl mb-3">🤖</div>
            <h2 className="text-2xl font-black font-cairo text-slate-800 mb-1">
              مرحبًا، أنا نِظام AI
            </h2>
            <p className="text-sm text-slate-500 mb-2 font-cairo max-w-lg leading-relaxed">
              <strong className="text-amber-700">دلوقتي بقدرات خارقة</strong> —
              قولي اقفل المرتبات، ابحث عن موظف، اعرض الطلبات المعلقة، أو
              ارفعلي ملف Excel أو PDF وأضيف الموظفين/الحضور لوحدي.
            </p>
            <p className="text-[11px] text-emerald-600 mb-2 font-cairo">
              📎 اضغط على المشبك تحت لرفع ملف Excel أو PDF
            </p>
            <p className="text-[11px] text-slate-400 mb-6 font-cairo">
              متخصص في قانون العمل المصري 12/2003 + التأمينات 148/2019.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl w-full">
              {SUGGESTED.map(({ q, cat }, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSuggestionClick(q)}
                  className={`text-right px-4 py-3 rounded-xl border transition text-sm font-cairo ${
                    cat === "tool"
                      ? "border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700"
                      : cat === "law"
                        ? "border-amber-200 hover:border-amber-300 hover:bg-amber-50 text-slate-700"
                        : "border-cyan-200 hover:border-brand-cyan/40 hover:bg-cyan-50/50 text-slate-700"
                  }`}
                >
                  <span className="text-xs opacity-60">
                    {cat === "tool"
                      ? "⚡ تنفيذ"
                      : cat === "law"
                        ? "⚖ قانون"
                        : "📊 بياناتك"}
                  </span>{" "}
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m: UIMessage) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-sm">
                  🤖
                </div>
                <div className="px-4 py-3 rounded-2xl bg-slate-50">
                  <div className="flex gap-1">
                    <span
                      className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
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

      {/* Attached file preview — sits above the input */}
      {attached && (
        <div className="px-3 pt-3 bg-slate-50/50 border-t border-slate-100">
          <div className="p-3 rounded-xl bg-white border border-emerald-200 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-lg flex-shrink-0">
              {attached.is_pdf
                ? attached.pdf_type === "employees"
                  ? "📄"
                  : attached.pdf_type === "attendance"
                    ? "📄"
                    : "📕"
                : attached.hint === "employees"
                  ? "👥"
                  : attached.hint === "attendance"
                    ? "⏰"
                    : "📎"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-800 font-cairo truncate flex items-center gap-2">
                <span className="truncate">{attached.filename}</span>
                {attached.is_pdf && (
                  <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    PDF
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 font-cairo mt-0.5 line-clamp-2">
                {attached.notes}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAttached(null)}
              className="text-slate-400 hover:text-red-500 transition text-lg"
              aria-label="إزالة المرفق"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* File error chip */}
      {fileError && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-xs font-cairo">
          ⚠ {fileError}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-3 border-t border-slate-100 bg-slate-50/50"
      >
        {/* Hidden file input — clicked via the 📎 button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.pdf,application/pdf"
          onChange={(e) => handleFilePick(e.target.files?.[0])}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || fileBusy}
          title="ارفع ملف Excel أو PDF"
          className="flex-shrink-0 w-12 h-12 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-brand-cyan hover:text-brand-cyan-dark disabled:opacity-50 transition flex items-center justify-center text-lg"
        >
          {fileBusy ? (
            <span className="inline-flex gap-0.5">
              <span
                className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </span>
          ) : (
            "📎"
          )}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            attached
              ? "اطلب من الـ AI يعمل بالملف ده إيه..."
              : "اطلب أي حاجة... مثلاً: 'اقفل المرتبات الشهرية من 21 أبريل لـ 20 مايو'"
          }
          disabled={isLoading}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isLoading || (!input.trim() && !attached)}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold font-cairo disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition shadow-md"
        >
          {isLoading ? "..." : "ابعت"}
        </button>
      </form>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Message bubble (one user OR assistant message, with mixed text/tool parts)
// ----------------------------------------------------------------------------

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
          isUser
            ? "bg-gradient-to-br from-brand-cyan to-brand-cyan-dark text-white"
            : "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
        }`}
      >
        {isUser ? "أ" : "🤖"}
      </div>
      <div className={`max-w-[85%] flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
        {message.parts.map((part, idx) => {
          // Text part
          if (part.type === "text" && "text" in part) {
            return (
              <div
                key={idx}
                className={`px-4 py-3 rounded-2xl font-cairo text-sm leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? "bg-brand-cyan/10 text-slate-800 rounded-tr-sm"
                    : "bg-slate-50 text-slate-800 rounded-tl-sm"
                }`}
              >
                {part.text}
              </div>
            );
          }

          // Tool part
          if (isToolPart(part)) {
            const toolName = getToolName(part);
            const label = TOOL_LABELS[toolName] ?? {
              running: toolName,
              done: toolName,
              icon: "⚙",
            };
            const isRunning =
              part.state === "input-streaming" ||
              part.state === "input-available";
            const hasOutput = part.state === "output-available";
            const hasError = part.state === "output-error";

            return (
              <div
                key={idx}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white shadow-sm text-xs font-cairo max-w-md"
              >
                <div className="flex items-center gap-2 text-slate-700">
                  <span>{label.icon}</span>
                  <span className="font-bold">
                    {isRunning ? label.running + "..." : label.done}
                  </span>
                  {isRunning && (
                    <span className="ml-auto inline-flex gap-0.5">
                      <span
                        className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </span>
                  )}
                </div>
                {hasOutput && (
                  <ToolOutputSummary toolName={toolName} output={part.output} />
                )}
                {hasError && (
                  <div className="mt-1 text-[11px] text-red-600">
                    ⚠ {part.errorText ?? "حصل خطأ في تنفيذ الأداة"}
                  </div>
                )}
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
