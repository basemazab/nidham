"use client";

import type { WorkflowExecutionLog } from "@/lib/workflow";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

interface ExecutionLogListProps {
  logs: any[];
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
  skipped: <Clock className="h-4 w-4 text-slate-400" />,
  pending: <Clock className="h-4 w-4 text-slate-400" />,
};

const STATUS_LABELS: Record<string, string> = {
  success: "نجاح",
  failed: "فشل",
  running: "قيد التشغيل",
  skipped: "تم التجاهل",
  pending: "معلق",
};

export function ExecutionLogList({ logs }: ExecutionLogListProps) {
  if (logs.length === 0) {
    return (
      <div className="rounded-xl border p-12 text-center">
        <p className="text-sm text-slate-500">لا توجد سجلات تشغيل بعد</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-center gap-3 rounded-lg border bg-white p-3 text-sm dark:bg-slate-900"
        >
          <div className="flex-shrink-0">
            {STATUS_ICONS[log.status] ?? <Clock className="h-4 w-4 text-slate-400" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">
              {log.workflows?.name ?? "قاعدة بدون اسم"}
            </div>
            <div className="text-xs text-slate-500">
              {new Date(log.started_at).toLocaleString("ar-EG")}
              {log.execution_ms != null && ` · ${log.execution_ms}ms`}
            </div>
          </div>

          <div className="flex-shrink-0">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                log.status === "success"
                  ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                  : log.status === "failed"
                    ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                    : "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {STATUS_LABELS[log.status] ?? log.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
