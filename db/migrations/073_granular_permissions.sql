-- ============================================================
-- Migration 073: Granular Permissions & Security Dashboard
-- ============================================================
-- Enables role-based access control at the individual permission
-- level, supporting custom roles and per-action grants.
-- ============================================================

-- 1. PERMISSION DEFINITIONS (lookup table)
CREATE TABLE public.permission_defs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,   -- e.g. "payroll.approve", "employees.terminate"
  label       TEXT NOT NULL,           -- Arabic label: "اعتماد المرتبات"
  description TEXT,
  module      TEXT NOT NULL,           -- e.g. "payroll", "employees", "attendance"
  is_system   BOOLEAN NOT NULL DEFAULT false -- system-managed (cannot be deleted)
);

-- Seed default permissions
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

-- 2. ROLE-PERMISSION MAPPING
-- Maps custom roles to specific permissions.
-- Each company gets its own roles (tenant-scoped).
CREATE TABLE public.company_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,           -- e.g. "مدير مالي", "مسؤول حضور"
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

-- Add custom_role_id to profiles (nullable — NULL means use system role)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.company_roles(id) ON DELETE SET NULL;

-- 3. USER SESSIONS TABLE (for active session tracking)
CREATE TABLE public.user_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ip_address    TEXT,
  user_agent    TEXT,
  device_type   TEXT,    -- "mobile", "desktop", "tablet"
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

-- 4. SECURITY EVENTS TABLE
CREATE TABLE public.security_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL,  -- "login_success", "login_fail", "2fa_fail", "password_change", "permission_denied", "suspicious_ip"
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

-- 5. FUNCTION: Check if a user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(p_permission_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_role     public.profiles.role%TYPE;
  v_custom_role   UUID;
  v_company_id    UUID;
BEGIN
  SELECT role, custom_role_id, company_id INTO v_user_role, v_custom_role, v_company_id
  FROM public.profiles WHERE id = auth.uid();
  
  -- Admin always has all permissions
  IF v_user_role = 'admin' THEN RETURN TRUE; END IF;
  
  -- Check custom role permissions
  IF v_custom_role IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.company_role_permissions crp
      JOIN public.permission_defs pd ON pd.id = crp.permission_id
      WHERE crp.role_id = v_custom_role
        AND crp.company_id = v_company_id
        AND pd.code = p_permission_code
    );
  END IF;
  
  -- Default role-based mapping
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
