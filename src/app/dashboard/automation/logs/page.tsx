import { listExecutionLogs } from "../actions";
import { ExecutionLogList } from "@/components/workflow/execution-log-list";

export const metadata = {
  title: "سجل تشغيل الأتمتة",
};

export default async function AutomationLogsPage(props: {
  searchParams: Promise<{ workflow?: string }>;
}) {
  const { workflow } = await props.searchParams;
  const logs = await listExecutionLogs(workflow);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">سجل تشغيل الأتمتة</h1>
        <p className="text-muted-foreground text-sm mt-1">
          جميع عمليات تشغيل قواعد الأتمتة
        </p>
      </div>
      <ExecutionLogList logs={logs} />
    </div>
  );
}
