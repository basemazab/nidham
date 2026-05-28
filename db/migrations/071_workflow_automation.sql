-- ============================================================
-- Migration 071: Workflow Automation Engine
-- ============================================================
-- Tables for the visual workflow automation builder and engine.
-- Supports trigger → condition → action chains similar to
-- Zapier / Monday.com automations.
-- ============================================================

-- 1. WORKFLOW DEFINITIONS
-- Core table. Each row is one automation workflow.
CREATE TABLE public.workflows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,              -- e.g. "تحذير تأخير الموظف"
  description     TEXT,
  trigger_type    TEXT NOT NULL,              -- see trigger_type enum below
  trigger_config  JSONB NOT NULL DEFAULT '{}',-- e.g. { "event": "attendance.created", "filters": {...} }
  conditions      JSONB NOT NULL DEFAULT '[]',-- array of condition nodes
  actions         JSONB NOT NULL DEFAULT '[]',-- array of action nodes
  is_active       BOOLEAN NOT NULL DEFAULT true,
  run_count       INTEGER NOT NULL DEFAULT 0,
  last_run_at     TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for tenant-scoped listing
CREATE INDEX idx_workflows_company ON public.workflows(company_id, created_at DESC);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workflow_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.workflow_updated_at();

-- RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflows_tenant_isolation ON public.workflows
  FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- Allow super-admin read access for support
CREATE POLICY workflows_super_admin_read ON public.workflows
  FOR SELECT
  USING (is_super_admin());

-- 2. WORKFLOW EXECUTION LOGS
-- Every workflow run creates one row. Captures the full execution trace.
CREATE TABLE public.workflow_execution_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  workflow_id     UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  trigger_data    JSONB NOT NULL,            -- snapshot of what triggered this run
  conditions_met  BOOLEAN,                   -- true = conditions passed
  actions_taken   JSONB,                     -- array of action results
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped')),
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  execution_ms    INTEGER                     -- how long the execution took
);

CREATE INDEX idx_workflow_logs_company ON public.workflow_execution_logs(company_id, started_at DESC);
CREATE INDEX idx_workflow_logs_workflow ON public.workflow_execution_logs(workflow_id, started_at DESC);

-- RLS
ALTER TABLE public.workflow_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_logs_tenant_isolation ON public.workflow_execution_logs
  FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY workflow_logs_super_admin_read ON public.workflow_execution_logs
  FOR SELECT
  USING (is_super_admin());

-- 3. WORKFLOW TRIGGER TYPE ENUM (stored as TEXT for flexibility)
COMMENT ON COLUMN public.workflows.trigger_type IS '
Supported trigger types:
- schedule:          Cron-based (e.g. every Monday 9am)
- attendance_created: A new attendance record was created
- attendance_updated: An attendance record was updated
- leave_created:     A leave request was submitted
- leave_approved:    A leave request was approved
- leave_rejected:    A leave request was rejected
- employee_created:  A new employee was added
- employee_updated:  Employee details changed
- payroll_approved:  A payroll period was approved
- payroll_paid:      A payroll period was marked as paid
- advance_created:   An advance request was submitted
- advance_approved:  An advance request was approved
- custom_webhook:    Triggered by an external webhook call
';

-- 4. WORKFLOW ACTION TYPE REFERENCE (stored as TEXT in action nodes)
COMMENT ON COLUMN public.workflows.actions IS '
Each action node has:
  type: one of the action types below
  config: JSONB with action-specific parameters

Supported action types:
- send_notification:   Send in-app notification (config: { title, body, recipients })
- send_email:          Send email (config: { to, subject, body })
- send_whatsapp:       Send WhatsApp message (config: { to, template_id, params })
- update_record:       Update a DB record (config: { table, record_id_field, changes })
- create_record:       Create a DB record (config: { table, data })
- trigger_webhook:     Call an external webhook URL (config: { url, method, body })
- assign_approver:     Assign approval request (config: { approver_field, request_type })
- set_employee_status: Update employee status (config: { status })
';

-- Seed: built-in workflow templates
INSERT INTO public.workflows (company_id, name, description, trigger_type, trigger_config, conditions, actions, is_active, created_by) VALUES
(
  (SELECT id FROM public.companies LIMIT 1),
  'تحذير تأخير الموظف',
  'عند تسجيل تأخير أكثر من 3 مرات في الشهر، يتم إرسال تحذير للموظف وإشعار للمشرف',
  'attendance_created',
  '{"event": "insert", "filters": {"tardiness_minutes_gt": 15}}'::jsonb,
  '[{"id": "c1", "type": "condition", "field": "tardiness_minutes", "operator": "gte", "value": 15}]'::jsonb,
  '[{"id": "a1", "type": "send_notification", "config": {"title": "تحذير تأخير", "body": "تم تسجيل تأخير {{tardiness_minutes}} دقيقة", "recipients": ["employee", "manager"]}}]'::jsonb,
  false,
  NULL
)
ON CONFLICT DO NOTHING;
