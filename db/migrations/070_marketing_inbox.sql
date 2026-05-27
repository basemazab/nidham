-- ============================================================================
-- Migration 070 — Marketing Inbox (unified ads/messages inbox + AI reply)
-- ============================================================================
--
-- Egyptian SMB pain: marketing teams run Facebook/Instagram ads, get DMs
-- as the lead-gen mechanism, but inboxes are messy:
--   * مدير المبيعات يضيع 4 ساعات/يوم في الرد على رسائل تكرارية
--   * 30% من الـ leads تضيع لأن الرد جاء بعد ساعات (Meta penalizes slow replies)
--   * مفيش طريقة منظمة لتحويل الـ DM لـ lead في الـ CRM
--
-- This module is a "lightweight ManyChat replacement" inside Nidham — but
-- multi-tenant + integrated with the existing CRM (customers table). One
-- product to buy + one place to manage.
--
-- Architecture:
--
--   1. Meta sends webhook → /api/webhooks/meta-messages
--   2. We resolve which tenant by `meta_page_id` (set in settings)
--   3. Upsert conversation + insert message
--   4. If AI is enabled, generate auto-reply (Claude/Groq) and send back via
--      Meta Graph API
--   5. If the AI judges the lead as "Hot", insert/upsert into customers
--      with status='lead' and notes prefilled
--
-- Tables:
--   marketing_inbox_settings        — per-tenant Meta config + AI toggle
--   marketing_inbox_conversations   — one row per (channel, external_id)
--   marketing_inbox_messages        — message log (inbound + outbound)
--   marketing_inbox_templates       — optional reply templates (future use)
--
-- All RLS-scoped via company_id and current_company_id() function.
-- ============================================================================

-- ── 1. Per-tenant settings ──
-- One row per company. Stores the Meta Page ID we map webhooks to + the
-- Page Access Token used to send replies + the AI behavior.
create table if not exists public.marketing_inbox_settings (
  company_id              uuid primary key references public.companies(id) on delete cascade,

  -- Channel toggles
  channel_messenger       boolean not null default true,
  channel_instagram       boolean not null default false,
  channel_whatsapp        boolean not null default false,

  -- Meta config
  meta_page_id            text,           -- e.g., "1034426136430979"
  meta_page_token         text,           -- Page Access Token (encrypted in app layer)
  meta_app_secret         text,           -- For webhook signature verification
  meta_verify_token       text,           -- Random string used during Meta webhook setup
  meta_instagram_id       text,           -- Linked IG business ID (optional)

  -- AI auto-reply config
  ai_enabled              boolean not null default false,
  ai_system_prompt        text,           -- Custom persona override; null = default
  ai_business_context     text,           -- "Nidham is HR SaaS, prices in EGP, ..."
  ai_handoff_keywords     text[] default array[]::text[],  -- words that pause AI ("سعر", "demo")
  ai_handoff_notify_phone text,           -- WhatsApp # to ping when handoff fires

  -- Lead pipeline
  auto_push_to_crm        boolean not null default true,
  lead_default_assignee   uuid references auth.users(id) on delete set null,

  created_at              timestamp with time zone default now() not null,
  updated_at              timestamp with time zone default now() not null
);

comment on table public.marketing_inbox_settings is
  'Per-tenant config for the unified Marketing Inbox: Meta tokens + AI behavior.';

-- ── 2. Conversations (a "thread" with one user across one channel) ──
create table if not exists public.marketing_inbox_conversations (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.companies(id) on delete cascade,

  -- Which channel + external ID
  channel                 text not null
                          check (channel in ('messenger', 'instagram', 'whatsapp', 'web')),
  external_user_id        text not null,    -- Meta PSID / IG user id / WA number
  external_user_name      text,             -- "Ahmed Ali"
  external_user_picture   text,             -- profile pic URL

  -- Status — kanban
  status                  text not null default 'open'
                          check (status in ('open', 'ai_replied', 'human_replied', 'qualified', 'closed', 'spam')),

  -- AI verdict (filled in after each AI run)
  ai_lead_quality         text check (ai_lead_quality in ('hot', 'warm', 'cold', 'spam', null)),
  ai_intent               text,             -- "pricing_inquiry", "demo_request", "support", "complaint"
  ai_last_run_at          timestamp with time zone,

  -- Linkage to CRM
  customer_id             uuid references public.customers(id) on delete set null,

  -- Timestamps
  last_message_at         timestamp with time zone default now() not null,
  created_at              timestamp with time zone default now() not null,
  updated_at              timestamp with time zone default now() not null,

  -- One conversation per (company, channel, external_user) to enforce upsert idempotency
  unique (company_id, channel, external_user_id)
);

create index if not exists idx_mi_conv_company_status
  on public.marketing_inbox_conversations (company_id, status, last_message_at desc);

create index if not exists idx_mi_conv_customer
  on public.marketing_inbox_conversations (customer_id)
  where customer_id is not null;

comment on table public.marketing_inbox_conversations is
  'One row per ongoing chat thread with a marketing lead, across all channels.';

-- ── 3. Messages (every inbound + outbound message) ──
create table if not exists public.marketing_inbox_messages (
  id                      uuid primary key default gen_random_uuid(),
  conversation_id         uuid not null references public.marketing_inbox_conversations(id) on delete cascade,

  -- Direction
  direction               text not null check (direction in ('inbound', 'outbound')),
  -- Sender — for outbound: 'ai' or 'human' (with author user_id)
  sender                  text not null check (sender in ('user', 'ai', 'human')),
  author_user_id          uuid references auth.users(id) on delete set null,

  -- Content
  body                    text not null,
  attachments             jsonb default '[]'::jsonb,   -- list of {type, url} for images/videos
  meta_message_id         text,                        -- Meta's external ID (for de-dup)

  -- Delivery state (for outbound)
  sent_at                 timestamp with time zone,
  delivery_error          text,

  created_at              timestamp with time zone default now() not null,

  -- De-dup: same Meta message must never be inserted twice
  unique (conversation_id, meta_message_id)
);

create index if not exists idx_mi_msg_conversation_time
  on public.marketing_inbox_messages (conversation_id, created_at);

comment on table public.marketing_inbox_messages is
  'Append-only log of every message exchanged on the Marketing Inbox.';

-- ── 4. Templates (canned replies — future, but ship the table now) ──
create table if not exists public.marketing_inbox_templates (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.companies(id) on delete cascade,
  name                    text not null,                 -- "Pricing inquiry"
  trigger_keywords        text[] default array[]::text[],-- ["سعر", "كم", "تكلفة"]
  reply_text              text not null,                 -- the canned response
  order_index             integer default 0,
  enabled                 boolean not null default true,
  created_at              timestamp with time zone default now() not null,
  updated_at              timestamp with time zone default now() not null
);

create index if not exists idx_mi_template_company
  on public.marketing_inbox_templates (company_id, enabled);

-- ── 5. Updated-at triggers (matches convention in other tables) ──
create or replace function public.tg_marketing_inbox_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_mi_settings_touch       on public.marketing_inbox_settings;
drop trigger if exists trg_mi_conversations_touch  on public.marketing_inbox_conversations;
drop trigger if exists trg_mi_templates_touch      on public.marketing_inbox_templates;

create trigger trg_mi_settings_touch
  before update on public.marketing_inbox_settings
  for each row execute function public.tg_marketing_inbox_touch_updated_at();

create trigger trg_mi_conversations_touch
  before update on public.marketing_inbox_conversations
  for each row execute function public.tg_marketing_inbox_touch_updated_at();

create trigger trg_mi_templates_touch
  before update on public.marketing_inbox_templates
  for each row execute function public.tg_marketing_inbox_touch_updated_at();

-- ── 6. Bump last_message_at on conversation when a new message lands ──
create or replace function public.tg_marketing_inbox_bump_conv()
returns trigger language plpgsql as $$
begin
  update public.marketing_inbox_conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end
$$;

drop trigger if exists trg_mi_msg_bump_conv on public.marketing_inbox_messages;
create trigger trg_mi_msg_bump_conv
  after insert on public.marketing_inbox_messages
  for each row execute function public.tg_marketing_inbox_bump_conv();

-- ── 7. RLS ──
alter table public.marketing_inbox_settings      enable row level security;
alter table public.marketing_inbox_conversations enable row level security;
alter table public.marketing_inbox_messages      enable row level security;
alter table public.marketing_inbox_templates     enable row level security;

-- Settings — only company members read/write
create policy "view_mi_settings_in_own_company"
  on public.marketing_inbox_settings for select
  using (company_id = public.current_company_id());

create policy "manage_mi_settings_in_own_company"
  on public.marketing_inbox_settings for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- Conversations
create policy "view_mi_convs_in_own_company"
  on public.marketing_inbox_conversations for select
  using (company_id = public.current_company_id());

create policy "manage_mi_convs_in_own_company"
  on public.marketing_inbox_conversations for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- Messages — inherit via conversation
create policy "view_mi_msgs_in_own_company"
  on public.marketing_inbox_messages for select
  using (
    conversation_id in (
      select id from public.marketing_inbox_conversations
       where company_id = public.current_company_id()
    )
  );

create policy "manage_mi_msgs_in_own_company"
  on public.marketing_inbox_messages for all
  using (
    conversation_id in (
      select id from public.marketing_inbox_conversations
       where company_id = public.current_company_id()
    )
  )
  with check (
    conversation_id in (
      select id from public.marketing_inbox_conversations
       where company_id = public.current_company_id()
    )
  );

-- Templates
create policy "view_mi_templates_in_own_company"
  on public.marketing_inbox_templates for select
  using (company_id = public.current_company_id());

create policy "manage_mi_templates_in_own_company"
  on public.marketing_inbox_templates for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

notify pgrst, 'reload schema';
