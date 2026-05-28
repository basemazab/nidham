-- ============================================================
-- Migration 074: AI Memory, RAG, Embeddings & Audit Trail
-- ============================================================
-- Enables persistent conversation memory, vector search over
-- company documents, and full audit logging of AI agent actions.
-- ============================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. AI CONVERSATIONS — persists full chat history per user
CREATE TABLE public.ai_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'محادثة جديدة',
  summary         TEXT,               -- auto-generated summary after N turns
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

-- 3. AI MESSAGES — individual turns within a conversation
CREATE TABLE public.ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content         TEXT,
  tool_calls      JSONB,              -- tool name + arguments + results
  tokens          INTEGER NOT NULL DEFAULT 0,
  model           TEXT,               -- which model generated this response
  latency_ms      INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_messages_conv ON public.ai_messages(conversation_id, created_at);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_messages_tenant ON public.ai_messages
  FOR ALL
  USING (conversation_id IN (SELECT id FROM public.ai_conversations WHERE company_id = current_company_id()))
  WITH CHECK (conversation_id IN (SELECT id FROM public.ai_conversations WHERE company_id = current_company_id()));

-- 4. AI KNOWLEDGE BASE — company documents for RAG
CREATE TABLE public.ai_knowledge_base (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  source_type     TEXT NOT NULL DEFAULT 'manual'
                  CHECK (source_type IN ('manual', 'policy', 'law_article', 'contract', 'faq', 'uploaded')),
  source_url      TEXT,
  embedding       extensions.vector(768),  -- embedding vector (768 dim for Gemini)
  chunk_index     INTEGER,                 -- for split documents, which chunk
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

-- 5. AI AUDIT LOG — every agent action
CREATE TABLE public.ai_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  action_type     TEXT NOT NULL,       -- tool name or action category
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

-- 6. SEED: Egyptian Labor Law articles for RAG
INSERT INTO public.ai_knowledge_base (company_id, title, content, source_type) 
SELECT 
  c.id,
  'المادة 1-12: قانون العمل المصري 12/2003',
  'قانون العمل المصري رقم 12 لسنة 2003 يهدف إلى تنظيم علاقات العمل الفردية والجماعية بين أصحاب العمل والعمال. ينص القانون على أن عقد العمل يُبرم لمدة محددة أو غير محددة، ويكتب باللغة العربية. مدة الاختبار لا تتجاوز 3 أشهر. للعامل الحق في إجازة سنوية مدفوعة الأجر لا تقل عن 21 يوماً خلال السنة الأولى للخدمة، وتزداد إلى 30 يوماً لمن أمضى 10 سنوات في الخدمة أو لمن تجاوز سن 50 عاماً.',
  'law_article'
FROM public.companies c
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_knowledge_base (company_id, title, content, source_type)
SELECT 
  c.id,
  'المادة 80-85: قانون العمل — ساعات العمل والإضافي',
  'ساعات العمل القصوى 8 ساعات يومياً أو 48 ساعة أسبوعياً بواقع 6 أيام عمل. لا يجوز تشغيل العامل أكثر من 5 ساعات متصلة بدون فترة راحة لا تقل عن ساعة. ساعات العمل خلال رمضان تخفض إلى 7 ساعات يومياً أو 36 ساعة أسبوعياً. حساب الأجر الإضافي: 35% زيادة للساعات الإضافية نهاراً، 70% زيادة للساعات الإضافية ليلاً، 100% زيادة عن العمل في أيام الراحة الأسبوعية والعطلات الرسمية. الليل يبدأ من 8 مساءً حتى 6 صباحاً.',
  'law_article'
FROM public.companies c
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_knowledge_base (company_id, title, content, source_type)
SELECT 
  c.id,
  'المادة 148/2019: قانون التأمينات الاجتماعية والمعاشات',
  'قانون التأمينات الاجتماعية رقم 148 لسنة 2019. اشتراك العامل: 11% من الأجر الاشتراكي. اشتراك صاحب العمل: 18.75% من الأجر الاشتراكي. الحد الأدنى لأجر الاشتراك التأميني: 2,700 جنيه شهرياً (2026). الحد الأقصى لأجر الاشتراك التأميني: 16,700 جنيه شهرياً (2026). الأجر الاشتراكي = الأجر الأساسي + الوظيفي + بدل السكن + بدل النقل + بدلات أخرى. استمارة 1: تسجيل العامل لدى التأمينات. استمارة 6: إنهاء خدمة العامل. شريحة 1-3 تأمين صحي: 1.5% من إجمالي الأجر.',
  'law_article'
FROM public.companies c
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_knowledge_base (company_id, title, content, source_type)
SELECT 
  c.id,
  'المادة 126-133: مكافأة نهاية الخدمة وإنهاء العلاقة',
  'تنتهي علاقة العمل بانتهاء مدة العقد، أو باستقالة العامل، أو بإنهاء صاحب العمل، أو بوفاة العامل، أو ببلوغ سن التقاعد (60 عاماً للرجال). للعامل الحق في مكافأة نهاية الخدمة إذا أنهي عقده بدون مبرر قانوني. مكافأة نهاية الخدمة حسب قانون العمل: أجر 15 يوم عن كل سنة من أول 5 سنوات خدمة، وأجر شهر عن كل سنة بعد أول 5 سنوات. حد أقصى للمكافأة: 18 شهراً. العامل يستحق تعويض إجازة عن الأيام المتبقية من إجازته السنوية عند إنهاء الخدمة.',
  'law_article'
FROM public.companies c
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_knowledge_base (company_id, title, content, source_type)
SELECT 
  c.id,
  'شرائح ضريبة الدخل 2026 — مصر',
  'شريحة ضريبة الدخل للأفراد للعام 2026: الإعفاء الشخصي 20,000 جنيه سنوياً. الشريحة الأولى (حتى 40,000): 0%. الشريحة الثانية (40,001-60,000): 10% (بعد خصم 4,000). الشريحة الثالثة (60,001-200,000): 15% (بعد خصم 7,000). الشريحة الرابعة (200,001-400,000): 20% (بعد خصم 17,000). الشريحة الخامسة (400,001-600,000): 25% (بعد خصم 37,000). الشريحة السادسة (600,001-900,000): 30% (بعد خصم 67,000). الشريحة السابعة (أكثر من 900,000): 27.5% (خصم 55,000). حساب الضريبة: إجمالي الدخل السنوي - الإعفاء - التكاليف المهنية (10%) × الشريحة.',
  'law_article'
FROM public.companies c
ON CONFLICT DO NOTHING;
