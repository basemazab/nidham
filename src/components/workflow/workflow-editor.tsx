"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveWorkflowDefinition, toggleWorkflow, deleteWorkflow } from "@/app/dashboard/automation/actions";
import { TRIGGER_LABELS, type Workflow } from "@/lib/workflow";
import {
  Power,
  Trash2,
  Plus,
  GripVertical,
  X,
  Save,
  Zap,
  Bell,
  Mail,
  MessageSquare,
  Database,
  Globe,
  UserCheck,
  UserX,
  Filter,
} from "lucide-react";
import Link from "next/link";

interface WorkflowEditorProps {
  workflow: Workflow;
}

const ACTION_TEMPLATES = [
  { type: "send_notification" as const, label: "إرسال إشعار", icon: <Bell className="h-4 w-4" />, desc: "إرسال إشعار داخل التطبيق للموظف أو المشرف" },
  { type: "send_email" as const, label: "إرسال بريد", icon: <Mail className="h-4 w-4" />, desc: "إرسال بريد إلكتروني" },
  { type: "send_whatsapp" as const, label: "إرسال واتساب", icon: <MessageSquare className="h-4 w-4" />, desc: "إرسال رسالة واتساب" },
  { type: "update_record" as const, label: "تحديث سجل", icon: <Database className="h-4 w-4" />, desc: "تعديل بيانات في قاعدة البيانات" },
  { type: "create_record" as const, label: "إنشاء سجل", icon: <Plus className="h-4 w-4" />, desc: "إضافة سجل جديد" },
  { type: "trigger_webhook" as const, label: "Webhook", icon: <Globe className="h-4 w-4" />, desc: "استدعاء URL خارجي" },
  { type: "set_employee_status" as const, label: "تغيير حالة موظف", icon: <UserCheck className="h-4 w-4" />, desc: "تحديث حالة الموظف" },
];

export function WorkflowEditor({ workflow }: WorkflowEditorProps) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(workflow.is_active);
  const [conditions, setConditions] = useState<any[]>(workflow.conditions || []);
  const [actions, setActions] = useState<any[]>(workflow.actions || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await saveWorkflowDefinition(workflow.id, {
        trigger_config: workflow.trigger_config || {},
        conditions,
        actions,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    const next = !isActive;
    await toggleWorkflow(workflow.id, next);
    setIsActive(next);
    router.refresh();
  }

  async function handleDelete() {
    if (confirm("هل أنت متأكد من حذف قاعدة الأتمتة هذه؟")) {
      await deleteWorkflow(workflow.id);
      router.push("/dashboard/automation");
    }
  }

  function addAction(template: typeof ACTION_TEMPLATES[number]) {
    setActions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: template.type,
        config: {},
        label: template.label,
      },
    ]);
  }

  function removeAction(id: string) {
    setActions((prev) => prev.filter((a) => a.id !== id));
  }

  function updateActionConfig(id: string, key: string, value: any) {
    setActions((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, config: { ...a.config, [key]: value } } : a,
      ),
    );
  }

  function addCondition() {
    setConditions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "condition",
        field: "",
        operator: "eq",
        value: "",
      },
    ]);
  }

  function removeCondition(id: string) {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  }

  function updateCondition(id: string, key: string, value: any) {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)),
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/automation"
            className="text-sm text-cyan-600 hover:underline"
          >
            → العودة للأتمتة
          </Link>
          <h1 className="text-2xl font-bold mt-1">{workflow.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            المشغل: {TRIGGER_LABELS[workflow.trigger_type] ?? workflow.trigger_type}
            {" · "}
            تشغيل: {workflow.run_count}
            {workflow.last_run_at && (
              <> · آخر تشغيل: {new Date(workflow.last_run_at).toLocaleDateString("ar-EG")}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggle}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800"
            }`}
          >
            <Power className="h-4 w-4" />
            {isActive ? "مفعّل" : "متوقف"}
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" />
            حذف
          </button>
        </div>
      </div>

      {/* Workflow Diagram */}
      <div className="space-y-4">
        {/* Trigger */}
        <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-800 dark:bg-cyan-900/20">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-600 p-2 text-white">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-cyan-800 dark:text-cyan-300">المشغل</div>
              <div className="text-sm text-cyan-600 dark:text-cyan-400">
                {TRIGGER_LABELS[workflow.trigger_type]}
              </div>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-600" />
        </div>

        {/* Conditions */}
        <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-slate-500" />
              <h3 className="font-semibold">الشروط</h3>
              <span className="text-xs text-slate-400">
                (اختياري — إذا تركت فارغة، سيتم التنفيذ دائماً)
              </span>
            </div>
            <button
              onClick={addCondition}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
            >
              <Plus className="h-3 w-3" /> إضافة شرط
            </button>
          </div>

          <div className="space-y-2">
            {conditions.map((cond) => (
              <div
                key={cond.id}
                className="flex items-center gap-2 rounded-lg border bg-slate-50 p-3 dark:bg-slate-800/50"
              >
                <GripVertical className="h-4 w-4 text-slate-300" />
                <select
                  value={cond.field}
                  onChange={(e) => updateCondition(cond.id, "field", e.target.value)}
                  className="rounded border px-2 py-1 text-sm dark:bg-slate-800"
                >
                  <option value="">اختر حقل</option>
                  <option value="tardiness_minutes">دقائق التأخير</option>
                  <option value="absent_days">أيام الغياب</option>
                  <option value="leave_days">أيام الإجازة</option>
                  <option value="overtime_hours">ساعات إضافية</option>
                </select>
                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(cond.id, "operator", e.target.value)}
                  className="rounded border px-2 py-1 text-sm dark:bg-slate-800"
                >
                  <option value="eq">يساوي</option>
                  <option value="neq">لا يساوي</option>
                  <option value="gt">أكبر من</option>
                  <option value="gte">أكبر من أو يساوي</option>
                  <option value="lt">أصغر من</option>
                  <option value="lte">أصغر من أو يساوي</option>
                </select>
                <input
                  type="text"
                  value={cond.value as string}
                  onChange={(e) => updateCondition(cond.id, "value", e.target.value)}
                  placeholder="القيمة"
                  className="w-20 rounded border px-2 py-1 text-sm dark:bg-slate-800"
                />
                <button
                  onClick={() => removeCondition(cond.id)}
                  className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {conditions.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">
                لا توجد شروط — سيتم تنفيذ الإجراءات فور حدوث المشغل
              </p>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-600" />
        </div>

        {/* Actions */}
        <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-slate-500" />
              <h3 className="font-semibold">الإجراءات</h3>
            </div>
          </div>

          {/* Action templates */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ACTION_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.type}
                onClick={() => addAction(tmpl)}
                className="flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors hover:border-cyan-300 hover:bg-cyan-50 dark:hover:border-cyan-700 dark:hover:bg-cyan-900/20"
              >
                <div className="text-cyan-600 dark:text-cyan-400">{tmpl.icon}</div>
                <span className="font-medium">{tmpl.label}</span>
                <span className="text-[10px] text-slate-400 text-center leading-tight">
                  {tmpl.desc}
                </span>
              </button>
            ))}
          </div>

          {/* Added actions */}
          <div className="space-y-2">
            {actions.map((action) => (
              <div
                key={action.id}
                className="rounded-lg border bg-slate-50 p-3 dark:bg-slate-800/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {ACTION_TEMPLATES.find((t) => t.type === action.type)?.icon}
                    <span className="font-medium text-sm">
                      {ACTION_TEMPLATES.find((t) => t.type === action.type)?.label ?? action.type}
                    </span>
                  </div>
                  <button
                    onClick={() => removeAction(action.id)}
                    className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {action.type === "send_notification" && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <input
                      placeholder="عنوان الإشعار"
                      value={action.config.title || ""}
                      onChange={(e) => updateActionConfig(action.id, "title", e.target.value)}
                      className="rounded border px-2 py-1 dark:bg-slate-800"
                    />
                    <input
                      placeholder="نص الإشعار"
                      value={action.config.body || ""}
                      onChange={(e) => updateActionConfig(action.id, "body", e.target.value)}
                      className="rounded border px-2 py-1 dark:bg-slate-800"
                    />
                    <select
                      value={action.config.recipients?.[0] || "employee"}
                      onChange={(e) => updateActionConfig(action.id, "recipients", [e.target.value])}
                      className="rounded border px-2 py-1 dark:bg-slate-800"
                    >
                      <option value="employee">الموظف</option>
                      <option value="manager">المشرف</option>
                      <option value="hr">إدارة الموارد البشرية</option>
                    </select>
                  </div>
                )}
                {action.type === "trigger_webhook" && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <input
                      placeholder="URL"
                      value={action.config.url || ""}
                      onChange={(e) => updateActionConfig(action.id, "url", e.target.value)}
                      className="col-span-2 rounded border px-2 py-1 dark:bg-slate-800"
                    />
                    <select
                      value={action.config.method || "POST"}
                      onChange={(e) => updateActionConfig(action.id, "method", e.target.value)}
                      className="rounded border px-2 py-1 dark:bg-slate-800"
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>
                )}
                {action.type === "set_employee_status" && (
                  <div className="text-xs">
                    <select
                      value={action.config.status || ""}
                      onChange={(e) => updateActionConfig(action.id, "status", e.target.value)}
                      className="rounded border px-2 py-1 dark:bg-slate-800"
                    >
                      <option value="">اختر الحالة</option>
                      <option value="active">نشط</option>
                      <option value="inactive">غير نشط</option>
                      <option value="suspended">موقوف</option>
                      <option value="terminated">منتهي</option>
                    </select>
                  </div>
                )}
              </div>
            ))}
            {actions.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">
                أضف إجراءات لتنفيذها عند تفعيل قاعدة الأتمتة
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end gap-3">
        <Link
          href="/dashboard/automation"
          className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          إلغاء
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-cyan-600 px-6 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50 transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? "جارٍ الحفظ..." : "حفظ"}
        </button>
      </div>
    </div>
  );
}
