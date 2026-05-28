// ──────────────────────────────────────────────────
// TRIGGER TYPES
// ──────────────────────────────────────────────────

export type TriggerType =
  | "schedule"
  | "attendance_created"
  | "attendance_updated"
  | "leave_created"
  | "leave_approved"
  | "leave_rejected"
  | "employee_created"
  | "employee_updated"
  | "payroll_approved"
  | "payroll_paid"
  | "advance_created"
  | "advance_approved"
  | "custom_webhook";

export interface TriggerConfig extends Record<string, unknown> {
  event?: string;
  filters?: Record<string, unknown>;
  cron?: string;
  webhook_secret?: string;
}

// ──────────────────────────────────────────────────
// CONDITION NODES
// ──────────────────────────────────────────────────

export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "not_contains"
  | "in"
  | "not_in"
  | "between";

export interface ConditionNode {
  id: string;
  type: "condition" | "group";
  field?: string;
  operator?: ConditionOperator;
  value?: unknown;
  conditions?: ConditionNode[];
  logical_op?: "and" | "or";
}

// ──────────────────────────────────────────────────
// ACTION NODES
// ──────────────────────────────────────────────────

export type ActionType =
  | "send_notification"
  | "send_email"
  | "send_whatsapp"
  | "update_record"
  | "create_record"
  | "trigger_webhook"
  | "assign_approver"
  | "set_employee_status";

export interface ActionConfig {
  title?: string;
  body?: string;
  recipients?: string[];
  to?: string;
  subject?: string;
  template_id?: string;
  params?: Record<string, string>;
  table?: string;
  record_id_field?: string;
  changes?: Record<string, unknown>;
  data?: Record<string, unknown>;
  url?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH";
  approver_field?: string;
  request_type?: string;
  status?: string;
}

export interface ActionNode {
  id: string;
  type: ActionType;
  config: ActionConfig;
  label?: string;
}

// ──────────────────────────────────────────────────
// WORKFLOW DEFINITION
// ──────────────────────────────────────────────────

export interface Workflow {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  conditions: ConditionNode[];
  actions: ActionNode[];
  is_active: boolean;
  run_count: number;
  last_run_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────────
// EXECUTION LOG
// ──────────────────────────────────────────────────

export interface WorkflowExecutionLog {
  id: string;
  company_id: string;
  workflow_id: string;
  trigger_data: Record<string, unknown>;
  conditions_met: boolean | null;
  actions_taken: Record<string, unknown> | null;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  execution_ms: number | null;
}

// ──────────────────────────────────────────────────
// EXECUTION CONTEXT (runtime)
// ──────────────────────────────────────────────────

export interface ExecutionContext {
  companyId: string;
  triggerData: Record<string, unknown>;
  employeeId?: string;
  userId?: string;
  timestamp: Date;
}

// ──────────────────────────────────────────────────
// TRIGGER NAMING (Arabic-friendly display)
// ──────────────────────────────────────────────────

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  schedule: "جدول زمني",
  attendance_created: "تسجيل حضور جديد",
  attendance_updated: "تحديث حضور",
  leave_created: "طلب إجازة جديد",
  leave_approved: "تم الموافقة على إجازة",
  leave_rejected: "تم رفض إجازة",
  employee_created: "إضافة موظف جديد",
  employee_updated: "تحديث بيانات موظف",
  payroll_approved: "اعتماد مرتبات",
  payroll_paid: "صرف مرتبات",
  advance_created: "طلب سلفة جديد",
  advance_approved: "تم الموافقة على سلفة",
  custom_webhook: "Webhook خارجي",
};

export const ACTION_LABELS: Record<ActionType, string> = {
  send_notification: "إرسال إشعار",
  send_email: "إرسال بريد إلكتروني",
  send_whatsapp: "إرسال واتساب",
  update_record: "تحديث سجل",
  create_record: "إنشاء سجل",
  trigger_webhook: "استدعاء Webhook",
  assign_approver: "تعيين معتمد",
  set_employee_status: "تغيير حالة الموظف",
};
