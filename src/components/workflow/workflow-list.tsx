"use client";

import { useRouter } from "next/navigation";
import {
  toggleWorkflow,
  deleteWorkflow,
} from "@/app/dashboard/automation/actions";
import { TRIGGER_LABELS } from "@/lib/workflow";
import type { Workflow } from "@/lib/workflow";
import { Power, Play, Trash2, BarChart3, Pencil } from "lucide-react";
import Link from "next/link";

interface WorkflowListProps {
  workflows: Workflow[];
}

export function WorkflowList({ workflows }: WorkflowListProps) {
  const router = useRouter();

  if (workflows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <Play className="h-6 w-6 text-slate-400" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">لا توجد قواعد أتمتة بعد</h3>
        <p className="mb-6 text-sm text-slate-500">
          أنشئ أول قاعدة أتمتة لتوفير الوقت وتقليل الأخطاء البشرية
        </p>
        <Link
          href="/dashboard/automation/new"
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
        >
          <PlusIcon />
          إنشاء قاعدة أتمتة
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {workflows.map((wf) => (
        <div
          key={wf.id}
          className="group relative rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md dark:bg-slate-900"
        >
          <div className="mb-3 flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold">{wf.name}</h3>
              {wf.description && (
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  {wf.description}
                </p>
              )}
            </div>
            <button
              onClick={async () => {
                await toggleWorkflow(wf.id, !wf.is_active);
                router.refresh();
              }}
              className={`flex-shrink-0 rounded-lg p-2 transition-colors ${
                wf.is_active
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-slate-100 text-slate-400 dark:bg-slate-800"
              }`}
              title={wf.is_active ? "إيقاف" : "تفعيل"}
            >
              <Power className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-3">
            <span className="inline-flex items-center rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-medium text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
              {TRIGGER_LABELS[wf.trigger_type] ?? wf.trigger_type}
            </span>
            <span className="mr-2 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {wf.actions.length} إجراء
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>تشغيل: {wf.run_count}</span>
            {wf.last_run_at && (
              <span>
                آخر تشغيل: {new Date(wf.last_run_at).toLocaleDateString("ar-EG")}
              </span>
            )}
          </div>

          <div className="mt-3 flex gap-1 border-t pt-3 opacity-0 transition-opacity group-hover:opacity-100">
            <Link
              href={`/dashboard/automation/${wf.id}`}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Pencil className="h-3 w-3" /> تعديل
            </Link>
            <Link
              href={`/dashboard/automation/logs?workflow=${wf.id}`}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <BarChart3 className="h-3 w-3" /> سجل
            </Link>
            <button
              onClick={async () => {
                if (confirm("هل أنت متأكد من حذف قاعدة الأتمتة هذه؟")) {
                  await deleteWorkflow(wf.id);
                  router.refresh();
                }
              }}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3 w-3" /> حذف
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
