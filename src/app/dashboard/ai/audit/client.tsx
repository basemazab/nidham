"use client";

import { Shield, CheckCircle, XCircle, Clock } from "lucide-react";

interface AuditEntry {
  id: string;
  action_type: string;
  action_input: Record<string, unknown> | null;
  action_result: Record<string, unknown> | null;
  success: boolean;
  error_message: string | null;
  latency_ms: number | null;
  created_at: string;
  ai_conversations: { title: string } | null;
}

interface Props {
  logs: AuditEntry[];
}

export function AuditLogClient({ logs }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">سجل نشاط AI</h1>
        <p className="text-muted-foreground text-sm mt-1">
          جميع الإجراءات التي نفذها المساعد الذكي
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Shield className="mx-auto mb-4 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">لا توجد عمليات AI بعد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border bg-white p-4 dark:bg-slate-900"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {entry.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {entry.action_type}
                    </span>
                    {entry.ai_conversations?.title && (
                      <span className="text-xs text-slate-400 truncate">
                        · {entry.ai_conversations.title}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>
                      <Clock className="inline h-3 w-3 ml-1" />
                      {new Date(entry.created_at).toLocaleString("ar-EG")}
                    </span>
                    {entry.latency_ms != null && (
                      <span>{entry.latency_ms}ms</span>
                    )}
                  </div>
                  {entry.error_message && (
                    <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
                      {entry.error_message}
                    </div>
                  )}
                  {entry.action_input && (
                    <details className="mt-2">
                      <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                        عرض المدخلات
                      </summary>
                      <pre className="mt-1 rounded bg-slate-50 p-2 text-[10px] overflow-auto max-h-32 dark:bg-slate-800">
                        {JSON.stringify(entry.action_input, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
