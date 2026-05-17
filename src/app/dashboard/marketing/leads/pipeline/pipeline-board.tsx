"use client";

// ============================================================================
// PipelineBoard — Kanban with HTML5 native drag-and-drop
// ============================================================================
//
// Why native HTML5 instead of @dnd-kit:
//   - No dep cost (the lib is ~30KB gzipped for one screen)
//   - Native is good enough for a 6-column board with 100s of cards
//   - Built-in browser support for touch on Android (Chrome)
//
// Optimistic UI: we update local state IMMEDIATELY on drop, then call
// the server action. If it fails, we revert + show an error toast. This
// keeps the board feeling instant even on slow networks.

import { useState, useTransition } from "react";
import Link from "next/link";
import { moveLeadOnPipeline } from "../actions";

type PipelineLead = {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp: string | null;
  status: string;
  source: string | null;
  first_utm_source: string | null;
  first_utm_campaign: string | null;
  estimated_value: number | null;
  last_contacted_at: string | null;
  created_at: string;
};

type Status = "lead" | "contacted" | "qualified" | "won" | "lost" | "dormant";

const COLUMNS: { id: Status; label: string; icon: string; color: string }[] = [
  { id: "lead", label: "جديد", icon: "🆕", color: "cyan" },
  { id: "contacted", label: "اتواصل", icon: "📞", color: "amber" },
  { id: "qualified", label: "مهتم", icon: "🎯", color: "violet" },
  { id: "won", label: "عميل", icon: "🏆", color: "emerald" },
  { id: "lost", label: "ضايع", icon: "❌", color: "rose" },
  { id: "dormant", label: "خامد", icon: "💤", color: "slate" },
];

const COLUMN_BG: Record<string, { bg: string; head: string; border: string }> = {
  cyan: { bg: "bg-cyan-50/50", head: "bg-cyan-100 text-cyan-900", border: "border-cyan-200" },
  amber: { bg: "bg-amber-50/50", head: "bg-amber-100 text-amber-900", border: "border-amber-200" },
  violet: {
    bg: "bg-violet-50/50",
    head: "bg-violet-100 text-violet-900",
    border: "border-violet-200",
  },
  emerald: {
    bg: "bg-emerald-50/50",
    head: "bg-emerald-100 text-emerald-900",
    border: "border-emerald-200",
  },
  rose: { bg: "bg-rose-50/50", head: "bg-rose-100 text-rose-900", border: "border-rose-200" },
  slate: { bg: "bg-slate-50", head: "bg-slate-200 text-slate-800", border: "border-slate-300" },
};

export function PipelineBoard({
  initialLeads,
}: {
  initialLeads: PipelineLead[];
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<Status | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [, startTransition] = useTransition();

  // Snapshot "now" once on mount so child cards can derive isStale without
  // each one calling Date.now() in render (trips react-hooks/purity). The
  // staleness threshold is "older than 24h" so a per-mount value is fine.
  const [nowMs] = useState(() => Date.now());

  // Map "active" to "qualified" for display — both go in the same column.
  function normalizeStatus(s: string): Status {
    if (s === "active") return "qualified";
    return (COLUMNS.find((c) => c.id === s)?.id ?? "lead") as Status;
  }

  function leadsInColumn(col: Status): PipelineLead[] {
    return leads.filter((l) => normalizeStatus(l.status) === col);
  }

  function showToast(kind: "ok" | "err", text: string) {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 2500);
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function handleDragOver(e: React.DragEvent, col: Status) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTarget !== col) setDropTarget(col);
  }

  function handleDragLeave(col: Status) {
    if (dropTarget === col) setDropTarget(null);
  }

  function handleDrop(e: React.DragEvent, targetCol: Status) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    if (!id) return;
    setDropTarget(null);
    setDraggingId(null);

    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    if (normalizeStatus(lead.status) === targetCol) return; // no-op

    // Optimistic update
    const previousStatus = lead.status;
    setLeads((cur) =>
      cur.map((l) => (l.id === id ? { ...l, status: targetCol } : l)),
    );

    startTransition(async () => {
      const res = await moveLeadOnPipeline(id, targetCol);
      if (!res.ok) {
        // Revert
        setLeads((cur) =>
          cur.map((l) => (l.id === id ? { ...l, status: previousStatus } : l)),
        );
        showToast("err", res.error);
      } else {
        showToast(
          "ok",
          `${lead.full_name} → ${COLUMNS.find((c) => c.id === targetCol)?.label}`,
        );
      }
    });
  }

  return (
    <>
      {toast && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-bold font-cairo ${
            toast.kind === "ok"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          {toast.kind === "ok" ? "✅ " : "⚠ "}
          {toast.text}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {COLUMNS.map((col) => {
          const items = leadsInColumn(col.id);
          const colCls = COLUMN_BG[col.color];
          const isOver = dropTarget === col.id;
          const colValue = items.reduce(
            (sum, l) => sum + (Number(l.estimated_value) || 0),
            0,
          );

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => handleDragLeave(col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`rounded-2xl border-2 transition ${colCls.bg} ${colCls.border} ${
                isOver ? "ring-4 ring-violet-300 ring-opacity-60 scale-[1.02]" : ""
              }`}
            >
              <div
                className={`px-3 py-2 rounded-t-xl ${colCls.head} flex items-center justify-between sticky top-0 z-10`}
              >
                <div className="font-black text-sm font-cairo flex items-center gap-1.5">
                  <span>{col.icon}</span>
                  <span>{col.label}</span>
                </div>
                <span className="text-xs font-bold bg-white/60 px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>

              {colValue > 0 && (
                <div className="px-3 py-1 text-[10px] text-slate-600 font-cairo border-b border-current/10">
                  💰 {colValue.toLocaleString("ar-EG")} ج
                </div>
              )}

              <div className="p-2 space-y-2 min-h-[200px] max-h-[70vh] overflow-y-auto">
                {items.length === 0 && (
                  <div className="text-center text-[11px] text-slate-400 font-cairo py-8">
                    اسحب lead هنا
                  </div>
                )}
                {items.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    nowMs={nowMs}
                    isDragging={draggingId === lead.id}
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-slate-400 font-cairo">
        💡 اسحب الكروت بين الأعمدة عشان تحدّث الحالة · كل تغيير بيتحفظ تلقائياً
      </div>
    </>
  );
}

// ----------------------------------------------------------------------------
// LeadCard — draggable card. Click navigates to the lead detail page.
// ----------------------------------------------------------------------------
function LeadCard({
  lead,
  nowMs,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  lead: PipelineLead;
  nowMs: number;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const ageHours = (nowMs - new Date(lead.created_at).getTime()) / 3600000;
  const isStale =
    lead.last_contacted_at === null &&
    ageHours > 24 &&
    (lead.status === "lead" || lead.status === "contacted");

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`bg-white border rounded-xl p-2.5 cursor-move shadow-sm hover:shadow-md transition relative ${
        isDragging ? "opacity-40 scale-95" : ""
      } ${isStale ? "border-rose-300" : "border-slate-200"}`}
    >
      {isStale && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full ring-2 ring-white" />
      )}
      <Link
        href={`/dashboard/marketing/leads/${lead.id}`}
        className="text-xs font-black text-slate-800 font-cairo block hover:text-violet-700 truncate"
        onClick={(e) => {
          // Don't navigate while dragging
          if (isDragging) e.preventDefault();
        }}
      >
        {lead.full_name}
      </Link>
      <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate" dir="ltr">
        {lead.phone ?? lead.whatsapp ?? "—"}
      </div>

      {lead.first_utm_source && (
        <div className="text-[10px] text-violet-700 font-cairo mt-1 truncate">
          ↗ {lead.first_utm_source}
          {lead.first_utm_campaign && ` · ${lead.first_utm_campaign}`}
        </div>
      )}

      {lead.estimated_value && Number(lead.estimated_value) > 0 && (
        <div className="text-[10px] font-bold text-emerald-700 font-cairo mt-1">
          💰 {Number(lead.estimated_value).toLocaleString("ar-EG")} ج
        </div>
      )}
    </div>
  );
}
