"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWorkflow } from "@/app/dashboard/automation/actions";
import { TRIGGER_LABELS, type TriggerType } from "@/lib/workflow";
import {
  Zap,
  ArrowRight,
  Settings2,
  Bell,
  Mail,
  MessageSquare,
  Database,
  Globe,
  UserCheck,
  UserX,
} from "lucide-react";

const TRIGGER_OPTIONS: { value: TriggerType; icon: React.ReactNode; desc: string }[] = [
  {
    value: "attendance_created",
    icon: <Zap className="h-5 w-5" />,
    desc: "عند تسجيل حضور أو انصراف",
  },
  {
    value: "leave_created",
    icon: <Bell className="h-5 w-5" />,
    desc: "عند تقديم طلب إجازة جديد",
  },
  {
    value: "leave_approved",
    icon: <UserCheck className="h-5 w-5" />,
    desc: "عند الموافقة على طلب إجازة",
  },
  {
    value: "employee_created",
    icon: <UserX className="h-5 w-5" />,
    desc: "عند إضافة موظف جديد",
  },
  {
    value: "employee_updated",
    icon: <Settings2 className="h-5 w-5" />,
    desc: "عند تحديث بيانات موظف",
  },
  {
    value: "payroll_approved",
    icon: <Database className="h-5 w-5" />,
    desc: "عند اعتماد دورة مرتبات",
  },
  {
    value: "advance_created",
    icon: <MessageSquare className="h-5 w-5" />,
    desc: "عند طلب سلفة جديدة",
  },
  {
    value: "custom_webhook",
    icon: <Globe className="h-5 w-5" />,
    desc: "Webhook خارجي",
  },
];

export function WorkflowBuilder() {
  const router = useRouter();
  const [step, setStep] = useState<"trigger" | "details">("trigger");
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerType | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTrigger || !name.trim()) {
      setError("يرجى اختيار مشغل وإدخال اسم");
      return;
    }

    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);
    formData.set("trigger_type", selectedTrigger);

    const workflow = await createWorkflow(formData);
    router.push(`/dashboard/automation/${workflow.id}`);
  }

  if (step === "trigger") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">قاعدة أتمتة جديدة</h1>
          <p className="text-muted-foreground text-sm mt-1">
            اختر المشغل (الحدث) الذي سيبدأ قاعدة الأتمتة
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {TRIGGER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setSelectedTrigger(opt.value);
                setStep("details");
              }}
              className={`flex items-start gap-4 rounded-xl border p-4 text-right transition-all hover:border-cyan-300 hover:shadow-sm ${
                selectedTrigger === opt.value
                  ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20"
                  : "bg-white dark:bg-slate-900"
              }`}
            >
              <div className="flex-shrink-0 rounded-lg bg-cyan-100 p-2 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                {opt.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium">{TRIGGER_LABELS[opt.value]}</div>
                <div className="mt-0.5 text-xs text-slate-500">{opt.desc}</div>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-slate-300" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <button
          onClick={() => setStep("trigger")}
          className="text-sm text-cyan-600 hover:underline"
        >
          → تغيير المشغل
        </button>
        <h1 className="text-2xl font-bold mt-2">تفاصيل قاعدة الأتمتة</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">المشغل</label>
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
            {selectedTrigger && TRIGGER_LABELS[selectedTrigger]}
          </div>
        </div>

        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">
            اسم القاعدة
          </label>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: تحذير تأخير الموظف"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none dark:bg-slate-900"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium">
            وصف (اختياري)
          </label>
          <textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="وصف مختصر لما تفعله هذه القاعدة"
            rows={3}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none dark:bg-slate-900"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-cyan-600 py-2.5 text-sm font-medium text-white hover:bg-cyan-700 transition-colors"
        >
          إنشاء قاعدة الأتمتة
        </button>
      </form>
    </div>
  );
}
