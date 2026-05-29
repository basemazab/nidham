import { Plus } from "lucide-react";
import Link from "next/link";
import { listWorkflows } from "./actions";
import { WorkflowList } from "@/components/workflow/workflow-list";

export const metadata = {
  title: "أتمتة سير العمل",
};

export default async function AutomationPage() {
  const workflows = await listWorkflows();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">أتمتة سير العمل</h1>
          <p className="text-slate-500 text-sm mt-1">
            أنشئ قواعد أتمتة ذكية لسير العمل — مثل Zapier لكن لنظام الموارد
            البشرية
          </p>
        </div>
        <Link
          href="/dashboard/automation/new"
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          قاعدة جديدة
        </Link>
      </div>

      <WorkflowList workflows={workflows} />
    </div>
  );
}
