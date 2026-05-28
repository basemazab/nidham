-- ============================================================
-- Migration 072: API Keys & Developer Portal
-- ============================================================
-- Enables third-party API access with API keys, rate limiting,
-- and usage tracking.
-- ============================================================

CREATE TABLE public.api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,               -- e.g. "Production Key", "Test Key"
  key_hash        TEXT NOT NULL UNIQUE,         -- SHA-256 hash of the actual key
  key_prefix      TEXT NOT NULL,                -- first 8 chars for identification (e.g. "nidham_pr_")
  scopes          TEXT[] NOT NULL DEFAULT '{}', -- e.g. {"employees:read", "payroll:write"}
  rate_limit_rps  INTEGER NOT NULL DEFAULT 10,  -- requests per second
  allowed_ips     TEXT[] DEFAULT '{}',           -- IP whitelist (empty = all)
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
