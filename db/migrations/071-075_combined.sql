-- ============================================================
-- Combined Migration 071-075
-- Run this entire file in Supabase SQL Editor.
-- Must enable pgvector extension first if not already enabled:
--   Dashboard → Database → Extensions → enable "vector"
-- ============================================================

-- ============================================================
-- 071: Workflow Automation Engine
-- ============================================================

CREATE TABLE public.workflows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  trigger_type    TEXT NOT NULL,
  trigger_config  JSONB NOT NULL DEFAULT '{}',
  conditions      JSONB NOT NULL DEFAULT '[]',
  actions         JSONB NOT NULL DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  run_count       INTEGER NOT NULL DEFAULT 0,
  last_run_at     TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflows_company ON public.workflows(company_id, created_at DESC);

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

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflows_tenant_isolation ON public.workflows
  FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY workflows_super_admin_read ON public.workflows
  FOR SELECT
  USING (is_super_admin());

CREATE TABLE public.workflow_execution_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  workflow_id     UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  trigger_data    JSONB NOT NULL,
  conditions_met  BOOLEAN,
  actions_taken   JSONB,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped')),
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  execution_ms    INTEGER
);

CREATE INDEX idx_workflow_logs_company ON public.workflow_execution_logs(company_id, started_at DESC);
CREATE INDEX idx_workflow_logs_workflow ON public.workflow_execution_logs(workflow_id, started_at DESC);

ALTER TABLE public.workflow_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_logs_tenant_isolation ON public.workflow_execution_logs
  FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE POLICY workflow_logs_super_admin_read ON public.workflow_execution_logs
  FOR SELECT
  USING (is_super_admin());

-- ============================================================
-- 072: API Keys & Developer Portal
-- ============================================================

CREATE TABLE public.api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  key_hash        TEXT NOT NULL UNIQUE,
  key_prefix      TEXT NOT NULL,
  scopes          TEXT[] NOT NULL DEFAULT '{}',
  rate_limit_rps  INTEGER NOT NULL DEFAULT 10,
  allowed_ips     TEXT[] DEFAULT '{}',
  expires_at      TIMESTAMPTZ,
  last_used_at    TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_company ON public.api_keys(company_id);
CREATE INDEX idx_api_keys_prefix ON public.api_keys(key_prefix);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_keys_tenant_isolation ON public.api_keys
  FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE TABLE public.api_usage_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key_id          UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  endpoint        TEXT NOT NULL,
  method          TEXT NOT NULL,
  status_code     INTEGER NOT NULL,
  ip_address      TEXT,
  response_ms     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_usage_company ON public.api_usage_logs(company_id, created_at DESC);
CREATE INDEX idx_api_usage_key ON public.api_usage_logs(key_id, created_at DESC);

ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_usage_tenant_isolation ON public.api_usage_logs
  FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- ============================================================
-- 073: Granular Permissions & Security Dashboard
-- ============================================================

CREATE TABLE public.permission_defs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  description TEXT,
  module      TEXT NOT NULL,
  is_system   BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO public.permission_defs (code, label, description, module, is_system) VALUES
  ('employees.view',       'عرض الموظفين',       'مشاهدة بيانات جميع الموظفين',       'employees', true),
  ('employees.create',     'إضافة موظف',         'إنشاء سجلات موظفين جدد',            'employees', true),
  ('employees.edit',       'تعديل موظف',         'تعديل بيانات الموظفين',              'employees', true),
  ('employees.terminate',  'إنهاء خدمة',         'إنهاء خدمة موظف',                    'employees', true),
  ('payroll.view',         'عرض المرتبات',       'مشاهدة بيانات المرتبات',             'payroll', true),
  ('payroll.create',       'إنشاء فترة',         'إنشاء دورة مرتبات جديدة',            'payroll', true),
  ('payroll.approve',      'اعتماد المرتبات',    'اعتماد دورة مرتبات',                 'payroll', true),
  ('payroll.pay',          'صرف المرتبات',       'تأكيد صرف المرتبات',                 'payroll', true),
  ('attendance.view',      'عرض الحضور',         'مشاهدة سجلات الحضور',                'attendance', true),
  ('attendance.edit',      'تعديل الحضور',       'تعديل سجلات الحضور والانصراف',       'attendance', true),
  ('leaves.approve',       'اعتماد الإجازات',     'الموافقة على طلبات الإجازات',        'leaves', true),
  ('advances.approve',     'اعتماد السلف',        'الموافقة على طلبات السلف',           'advances', true),
  ('reports.view',         'عرض التقارير',        'مشاهدة التقارير والتحليلات',         'reports', true),
  ('settings.manage',      'إدارة الإعدادات',     'تعديل إعدادات النظام',               'settings', true),
  ('api.manage',           'إدارة API',           'إنشاء وإدارة مفاتيح API',            'api', true),
  ('team.manage',          'إدارة الفريق',        'دعوة وإدارة أعضاء الفريق',           'team', true),
  ('audit.view',           'عرض سجل النشاطات',    'مشاهدة سجل التدقيق',                 'audit', true),
  ('workflow.manage',      'إدارة الأتمتة',       'إنشاء وتعديل قواعد الأتمتة',         'workflow', true),
  ('crm.view',             'عرض العملاء',         'مشاهدة بيانات العملاء',              'crm', true),
  ('crm.edit',             'تعديل العملاء',        'إنشاء وتعديل العملاء',               'crm', true)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE public.company_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

ALTER TABLE public.company_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_roles_tenant ON public.company_roles
  FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE TABLE public.company_role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role_id       UUID NOT NULL REFERENCES public.company_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permission_defs(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

ALTER TABLE public.company_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permissions_tenant ON public.company_role_permissions
  FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.company_roles(id) ON DELETE SET NULL;

CREATE TABLE public.user_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ip_address    TEXT,
  user_agent    TEXT,
  device_type   TEXT,
  browser       TEXT,
  os            TEXT,
  country       TEXT,
  city          TEXT,
  is_current    BOOLEAN NOT NULL DEFAULT false,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id, last_active_at DESC);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_sessions_own ON public.user_sessions
  FOR ALL
  USING (user_id = auth.uid());
CREATE POLICY user_sessions_company ON public.user_sessions
  FOR SELECT
  USING (company_id = current_company_id());

CREATE TABLE public.security_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL,
  ip_address    TEXT,
  user_agent    TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_events_company ON public.security_events(company_id, created_at DESC);
CREATE INDEX idx_security_events_type ON public.security_events(event_type, created_at DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY security_events_company ON public.security_events
  FOR SELECT
  USING (company_id = current_company_id());

CREATE OR REPLACE FUNCTION public.has_permission(p_permission_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_role     public.profiles.role%TYPE;
  v_custom_role   UUID;
  v_company_id    UUID;
BEGIN
  SELECT role, custom_role_id, company_id INTO v_user_role, v_custom_role, v_company_id
  FROM public.profiles WHERE id = auth.uid();

  IF v_user_role = 'admin' THEN RETURN TRUE; END IF;

  IF v_custom_role IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.company_role_permissions crp
      JOIN public.permission_defs pd ON pd.id = crp.permission_id
      WHERE crp.role_id = v_custom_role
        AND crp.company_id = v_company_id
        AND pd.code = p_permission_code
    );
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.permission_defs
    WHERE code = p_permission_code
      AND (
        (v_user_role = 'manager' AND code IN (
          'employees.view', 'attendance.view', 'attendance.edit',
          'leaves.approve', 'reports.view', 'workflow.manage'
        ))
        OR
        (v_user_role = 'employee' AND code IN (
          'attendance.view'
        ))
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 074: AI Memory, RAG, Embeddings & Audit Trail
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE public.ai_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'محادثة جديدة',
  summary         TEXT,
  turn_count      INTEGER NOT NULL DEFAULT 0,
  token_count     INTEGER NOT NULL DEFAULT 0,
  is_archived     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_conversations_user ON public.ai_conversations(company_id, user_id, updated_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_conversations_tenant ON public.ai_conversations
  FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE TABLE public.ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content         TEXT,
  tool_calls      JSONB,
  tokens          INTEGER NOT NULL DEFAULT 0,
  model           TEXT,
  latency_ms      INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_messages_conv ON public.ai_messages(conversation_id, created_at);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_messages_tenant ON public.ai_messages
  FOR ALL
  USING (conversation_id IN (SELECT id FROM public.ai_conversations WHERE company_id = current_company_id()))
  WITH CHECK (conversation_id IN (SELECT id FROM public.ai_conversations WHERE company_id = current_company_id()));

CREATE TABLE public.ai_knowledge_base (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  source_type     TEXT NOT NULL DEFAULT 'manual'
                  CHECK (source_type IN ('manual', 'policy', 'law_article', 'contract', 'faq', 'uploaded')),
  source_url      TEXT,
  embedding       extensions.vector(768),
  chunk_index     INTEGER,
  parent_id       UUID REFERENCES public.ai_knowledge_base(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_kb_company ON public.ai_knowledge_base(company_id, source_type);
CREATE INDEX idx_ai_kb_embedding ON public.ai_knowledge_base
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 100);

ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_kb_tenant ON public.ai_knowledge_base
  FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE TABLE public.ai_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  action_type     TEXT NOT NULL,
  action_input    JSONB,
  action_result   JSONB,
  success         BOOLEAN NOT NULL DEFAULT true,
  error_message   TEXT,
  latency_ms      INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_audit_company ON public.ai_audit_log(company_id, created_at DESC);
CREATE INDEX idx_ai_audit_user ON public.ai_audit_log(user_id, created_at DESC);

ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_audit_tenant ON public.ai_audit_log
  FOR SELECT
  USING (company_id = current_company_id());

INSERT INTO public.ai_knowledge_base (company_id, title, content, source_type)
SELECT c.id, 'المادة 1-12: قانون العمل المصري 12/2003',
  'قانون العمل المصري رقم 12 لسنة 2003 يهدف إلى تنظيم علاقات العمل الفردية والجماعية بين أصحاب العمل والعمال. ينص القانون على أن عقد العمل يُبرم لمدة محددة أو غير محددة، ويكتب باللغة العربية. مدة الاختبار لا تتجاوز 3 أشهر. للعامل الحق في إجازة سنوية مدفوعة الأجر لا تقل عن 21 يوماً خلال السنة الأولى للخدمة، وتزداد إلى 30 يوماً لمن أمضى 10 سنوات في الخدمة أو لمن تجاوز سن 50 عاماً.',
  'law_article'
FROM public.companies c ON CONFLICT DO NOTHING;

INSERT INTO public.ai_knowledge_base (company_id, title, content, source_type)
SELECT c.id, 'المادة 80-85: قانون العمل — ساعات العمل والإضافي',
  'ساعات العمل القصوى 8 ساعات يومياً أو 48 ساعة أسبوعياً بواقع 6 أيام عمل. لا يجوز تشغيل العامل أكثر من 5 ساعات متصلة بدون فترة راحة لا تقل عن ساعة. ساعات العمل خلال رمضان تخفض إلى 7 ساعات يومياً أو 36 ساعة أسبوعياً. حساب الأجر الإضافي: 35% زيادة للساعات الإضافية نهاراً، 70% زيادة للساعات الإضافية ليلاً، 100% زيادة عن العمل في أيام الراحة الأسبوعية والعطلات الرسمية. الليل يبدأ من 8 مساءً حتى 6 صباحاً.',
  'law_article'
FROM public.companies c ON CONFLICT DO NOTHING;

INSERT INTO public.ai_knowledge_base (company_id, title, content, source_type)
SELECT c.id, 'المادة 148/2019: قانون التأمينات الاجتماعية والمعاشات',
  'قانون التأمينات الاجتماعية رقم 148 لسنة 2019. اشتراك العامل: 11% من الأجر الاشتراكي. اشتراك صاحب العمل: 18.75% من الأجر الاشتراكي. الحد الأدنى لأجر الاشتراك التأميني: 2,700 جنيه شهرياً (2026). الحد الأقصى لأجر الاشتراك التأميني: 16,700 جنيه شهرياً (2026). الأجر الاشتراكي = الأجر الأساسي + الوظيفي + بدل السكن + بدل النقل + بدلات أخرى. استمارة 1: تسجيل العامل لدى التأمينات. استمارة 6: إنهاء خدمة العامل. شريحة 1-3 تأمين صحي: 1.5% من إجمالي الأجر.',
  'law_article'
FROM public.companies c ON CONFLICT DO NOTHING;

INSERT INTO public.ai_knowledge_base (company_id, title, content, source_type)
SELECT c.id, 'المادة 126-133: مكافأة نهاية الخدمة وإنهاء العلاقة',
  'تنتهي علاقة العمل بانتهاء مدة العقد، أو باستقالة العامل، أو بإنهاء صاحب العمل، أو بوفاة العامل، أو ببلوغ سن التقاعد (60 عاماً للرجال). للعامل الحق في مكافأة نهاية الخدمة إذا أنهي عقده بدون مبرر قانوني. مكافأة نهاية الخدمة حسب قانون العمل: أجر 15 يوم عن كل سنة من أول 5 سنوات خدمة، وأجر شهر عن كل سنة بعد أول 5 سنوات. حد أقصى للمكافأة: 18 شهراً. العامل يستحق تعويض إجازة عن الأيام المتبقية من إجازته السنوية عند إنهاء الخدمة.',
  'law_article'
FROM public.companies c ON CONFLICT DO NOTHING;

INSERT INTO public.ai_knowledge_base (company_id, title, content, source_type)
SELECT c.id, 'شرائح ضريبة الدخل 2026 — مصر',
  'شريحة ضريبة الدخل للأفراد للعام 2026: الإعفاء الشخصي 20,000 جنيه سنوياً. الشريحة الأولى (حتى 40,000): 0%. الشريحة الثانية (40,001-60,000): 10% (بعد خصم 4,000). الشريحة الثالثة (60,001-200,000): 15% (بعد خصم 7,000). الشريحة الرابعة (200,001-400,000): 20% (بعد خصم 17,000). الشريحة الخامسة (400,001-600,000): 25% (بعد خصم 37,000). الشريحة السادسة (600,001-900,000): 30% (بعد خصم 67,000). الشريحة السابعة (أكثر من 900,000): 27.5% (خصم 55,000). حساب الضريبة: إجمالي الدخل السنوي - الإعفاء - التكاليف المهنية (10%) × الشريحة.',
  'law_article'
FROM public.companies c ON CONFLICT DO NOTHING;

-- ============================================================
-- 075: In-app notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'general',
  link_url      TEXT,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX idx_notifications_user_all
  ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS push_subscription JSONB,
  ADD COLUMN IF NOT EXISTS push_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS device_name    TEXT;
