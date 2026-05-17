-- ============================================================================
-- Migration 043 — Social Media Growth Suite (super-admin EXCLUSIVE)
-- ============================================================================
--
-- This is Basem's PERSONAL marketing operator — an AI-powered tool that
-- generates posts about Nidham, publishes them across Facebook, Instagram,
-- X (Twitter), LinkedIn, and TikTok, watches the comments that come in,
-- and drafts replies for human approval. The goal: drive Nidham SaaS
-- signups without paying a human social media manager.
--
-- IMPORTANT — visibility constraint:
--   This entire feature surface is super-admin EXCLUSIVE. No tenant
--   should ever see /admin/social or any of these tables. Every row
--   created here belongs to the SaaS owner (basemazab), not to any
--   tenant's company_id. RLS therefore gates on is_super_admin() only,
--   NOT on current_company_id() — there's no company_id column on any
--   of these tables.
--
-- Schema overview:
--   social_accounts          One row per connected platform handle.
--                            Token stored encrypted via pgp_sym_encrypt.
--   social_posts             Content the operator drafted / scheduled /
--                            published. AI-generated or hand-written.
--   social_post_targets      Many-to-many: each post can go to multiple
--                            accounts. Each target tracks its own
--                            publish status (queued / published / failed)
--                            because cross-platform partial failures are
--                            common.
--   social_comments          Comments observed on published posts. Pulled
--                            from each platform's API periodically.
--   social_replies           AI-drafted replies that wait for human
--                            approval before going live.
-- ============================================================================

create extension if not exists pgcrypto;


-- ----------------------------------------------------------------------------
-- 1) social_accounts — connected handles
-- ----------------------------------------------------------------------------
create table if not exists public.social_accounts (
  id                    uuid primary key default gen_random_uuid(),

  -- Platform identifier. Kept as text not enum so we can ship new
  -- platforms (Snapchat, Threads, YouTube) without a migration.
  platform              text not null
                        check (platform in (
                          'facebook',       -- Facebook Page
                          'instagram',      -- IG Business account
                          'twitter',        -- X
                          'linkedin',       -- LI Page or personal
                          'tiktok',         -- TikTok Business
                          'youtube',        -- YouTube channel
                          'threads',        -- Meta Threads
                          'telegram'        -- Telegram channel (bot token)
                        )),

  -- Platform-side identifier (Page ID for FB, user ID for X, etc.)
  external_id           text not null,

  -- Display label the operator picked ("Nidham Official EN", "نظام مصر")
  display_label         text not null,

  -- Token + secret are encrypted at rest with pgp_sym_encrypt using
  -- META_ENCRYPTION_KEY (reuse the same env var). Decryption only
  -- happens inside SECURITY DEFINER helpers when a publish runs.
  access_token_encrypted    bytea,
  refresh_token_encrypted   bytea,
  token_expires_at          timestamptz,

  -- Optional: a few platform-specific bits we need for posting
  --   facebook  → page_id (same as external_id), token type
  --   instagram → ig_user_id, fb_page_id
  --   twitter   → bearer token, refresh token, user_id
  --   linkedin  → urn (urn:li:organization:123 or urn:li:person:...)
  --   tiktok    → open_id, advertiser_id
  --   telegram  → chat_id (channel @handle resolved to numeric id)
  -- Flexible jsonb so we don't add columns per platform.
  platform_metadata     jsonb not null default '{}'::jsonb,

  -- Connection lifecycle
  is_active             boolean not null default true,
  last_used_at          timestamptz,
  last_error            text,

  -- Audit
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references public.profiles(id) on delete set null,

  unique (platform, external_id)
);

create index if not exists idx_social_accounts_platform
  on public.social_accounts(platform);

drop trigger if exists social_accounts_set_updated_at on public.social_accounts;
create trigger social_accounts_set_updated_at
  before update on public.social_accounts
  for each row execute function public.tg_set_updated_at();


-- ----------------------------------------------------------------------------
-- 2) social_posts — drafted/scheduled/published content
-- ----------------------------------------------------------------------------
create table if not exists public.social_posts (
  id                    uuid primary key default gen_random_uuid(),

  -- The content itself. Stored ONCE as the canonical body; per-platform
  -- variations (truncated for X, hashtag-enriched for IG, etc.) live in
  -- social_post_targets.body_override.
  title                 text,            -- internal label / theme
  body                  text not null,   -- canonical text
  media_urls            text[] default '{}',   -- image / video URLs (uploaded elsewhere)

  -- Source of the content — useful for analytics
  source                text not null default 'manual'
                        check (source in (
                          'manual',        -- typed by Basem
                          'ai_generated',  -- pure AI output
                          'ai_edited'      -- AI draft then human-edited
                        )),

  -- What prompt/intent the AI ran on (when ai_generated). Lets us
  -- re-generate similar posts and learn what tones work.
  ai_intent             text,
  ai_model              text,            -- e.g. "groq:openai/gpt-oss-120b"

  -- Lifecycle
  status                text not null default 'draft'
                        check (status in (
                          'draft',
                          'scheduled',
                          'publishing',
                          'published',
                          'partially_failed',
                          'failed',
                          'archived'
                        )),
  scheduled_for         timestamptz,
  published_at          timestamptz,

  -- Free-form tags so we can filter by campaign theme later
  -- ("payroll-feature", "case-study", "egyptian-labor-law", etc.)
  tags                  text[] default '{}',

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references public.profiles(id) on delete set null
);

create index if not exists idx_social_posts_status_scheduled
  on public.social_posts(status, scheduled_for);
create index if not exists idx_social_posts_created_at
  on public.social_posts(created_at desc);

drop trigger if exists social_posts_set_updated_at on public.social_posts;
create trigger social_posts_set_updated_at
  before update on public.social_posts
  for each row execute function public.tg_set_updated_at();


-- ----------------------------------------------------------------------------
-- 3) social_post_targets — fanout from a post to N accounts
-- ----------------------------------------------------------------------------
create table if not exists public.social_post_targets (
  id                    uuid primary key default gen_random_uuid(),
  post_id               uuid not null references public.social_posts(id) on delete cascade,
  account_id            uuid not null references public.social_accounts(id) on delete cascade,

  -- Per-platform tweaked body. Falls back to social_posts.body when null.
  body_override         text,

  -- Per-target status — one target may succeed while another fails.
  status                text not null default 'queued'
                        check (status in (
                          'queued',
                          'publishing',
                          'published',
                          'failed',
                          'skipped'
                        )),
  attempted_at          timestamptz,
  published_at          timestamptz,
  external_post_id      text,           -- platform's permalink ID
  external_url          text,           -- shareable link the post lives at
  last_error            text,

  -- Per-target metrics (refreshed by sync job)
  likes_count           integer default 0,
  comments_count        integer default 0,
  shares_count          integer default 0,
  impressions_count     integer default 0,
  last_metrics_at       timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (post_id, account_id)
);

create index if not exists idx_social_post_targets_post
  on public.social_post_targets(post_id);
create index if not exists idx_social_post_targets_account
  on public.social_post_targets(account_id);
create index if not exists idx_social_post_targets_status
  on public.social_post_targets(status);

drop trigger if exists social_post_targets_set_updated_at on public.social_post_targets;
create trigger social_post_targets_set_updated_at
  before update on public.social_post_targets
  for each row execute function public.tg_set_updated_at();


-- ----------------------------------------------------------------------------
-- 4) social_comments — comments on published posts
-- ----------------------------------------------------------------------------
create table if not exists public.social_comments (
  id                    uuid primary key default gen_random_uuid(),
  target_id             uuid not null references public.social_post_targets(id) on delete cascade,

  -- Platform-side comment ID + parent (for thread tracking)
  external_id           text not null,
  parent_external_id    text,           -- null for top-level, set for replies

  author_name           text,
  author_external_id    text,           -- the commenter's user id
  author_avatar_url     text,

  body                  text not null,

  -- AI assessment, populated by classify_comment()
  sentiment             text check (sentiment in ('positive', 'neutral', 'negative', 'question', 'spam')),
  urgency               text check (urgency in ('low', 'medium', 'high', 'critical')),
  ai_summary            text,

  -- Human review state — even auto-reply mode requires explicit opt-in
  -- per comment so a bad AI reply can't go live unsupervised.
  review_state          text not null default 'pending'
                        check (review_state in (
                          'pending',       -- needs human attention
                          'replied',       -- we sent a reply
                          'ignored',       -- not worth responding to (e.g. spam)
                          'escalated'      -- human will reply personally
                        )),

  observed_at           timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (target_id, external_id)
);

create index if not exists idx_social_comments_target
  on public.social_comments(target_id);
create index if not exists idx_social_comments_review_state
  on public.social_comments(review_state, observed_at desc);
create index if not exists idx_social_comments_urgency
  on public.social_comments(urgency, observed_at desc);


-- ----------------------------------------------------------------------------
-- 5) social_replies — AI-drafted replies awaiting / past approval
-- ----------------------------------------------------------------------------
create table if not exists public.social_replies (
  id                    uuid primary key default gen_random_uuid(),
  comment_id            uuid not null references public.social_comments(id) on delete cascade,

  draft_body            text not null,
  ai_model              text,
  ai_intent             text,     -- e.g. "answer-pricing-question"

  -- Approval workflow
  approved_by           uuid references public.profiles(id) on delete set null,
  approved_at           timestamptz,
  rejected_reason       text,

  -- Publish result
  status                text not null default 'pending_approval'
                        check (status in (
                          'pending_approval',
                          'approved',
                          'publishing',
                          'published',
                          'rejected',
                          'failed'
                        )),
  published_at          timestamptz,
  external_reply_id     text,
  last_error            text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_social_replies_comment
  on public.social_replies(comment_id);
create index if not exists idx_social_replies_status
  on public.social_replies(status);


-- ----------------------------------------------------------------------------
-- 6) social_settings — operator-level prefs (one row, key/value style)
-- ----------------------------------------------------------------------------
create table if not exists public.social_settings (
  id                    uuid primary key default gen_random_uuid(),
  key                   text not null unique,
  value                 jsonb not null default '{}'::jsonb,
  updated_at            timestamptz not null default now()
);

-- Seed a few defaults the dashboard will read
insert into public.social_settings (key, value) values
  ('brand_voice',       '"Egyptian Arabic, conversational, confident but not pushy. Mix of formal Arabic for B2B credibility + Egyptian dialect for warmth. Avoid clichés. Show specific numbers when possible."'::jsonb),
  ('target_audience',   '"Egyptian SMB owners (5-500 employees) tired of paper HR, missed payroll deductions, and chaotic CRM in Excel. Plus marketing managers struggling to get leads from FB ads."'::jsonb),
  ('cta_style',         '"Soft CTAs preferred (link in bio / تواصل واتساب) over hard sells. Always end posts with one concrete next step."'::jsonb),
  ('post_themes',       '["payroll automation", "Egyptian labor law tips", "marketing AI", "lead capture", "case studies", "feature spotlights", "HR pain points"]'::jsonb),
  ('auto_reply_enabled', 'false'::jsonb),
  ('daily_post_limit',   '3'::jsonb)
on conflict (key) do nothing;


-- ----------------------------------------------------------------------------
-- 7) RLS — super-admin EXCLUSIVE on every table
-- ----------------------------------------------------------------------------
-- These tables hold Nidham's MARKETING data (Basem's posts, his Facebook
-- tokens, his AI replies). They MUST NEVER be visible to a tenant. The
-- only way to access them is through the super_admins membership.

alter table public.social_accounts      enable row level security;
alter table public.social_posts          enable row level security;
alter table public.social_post_targets   enable row level security;
alter table public.social_comments       enable row level security;
alter table public.social_replies        enable row level security;
alter table public.social_settings       enable row level security;

-- Single ALL policy per table — super-admins see + write everything,
-- tenants see + write nothing. Simpler than separate SELECT/INSERT/etc.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'social_accounts',
      'social_posts',
      'social_post_targets',
      'social_comments',
      'social_replies',
      'social_settings'
    ])
  loop
    execute format(
      $f$drop policy if exists "super_admin_only_%I" on public.%I$f$,
      t, t
    );
    execute format(
      $f$
      create policy "super_admin_only_%I"
        on public.%I
        for all
        using (public.is_super_admin())
        with check (public.is_super_admin())
      $f$,
      t, t
    );
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 8) RPCs — encrypted token helpers
-- ----------------------------------------------------------------------------

-- 8.a) save_social_account: upsert with token encryption
create or replace function public.save_social_account(
  p_platform           text,
  p_external_id        text,
  p_display_label      text,
  p_access_token       text,
  p_refresh_token      text,
  p_expires_at         timestamptz,
  p_platform_metadata  jsonb,
  p_encryption_key     text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_is_super   boolean;
  v_id         uuid;
begin
  if v_profile_id is null then raise exception 'must be authenticated'; end if;
  select public.is_super_admin() into v_is_super;
  if not v_is_super then raise exception 'super-admin only'; end if;

  insert into public.social_accounts (
    platform, external_id, display_label,
    access_token_encrypted, refresh_token_encrypted, token_expires_at,
    platform_metadata, is_active, last_error, created_by
  )
  values (
    p_platform, p_external_id, p_display_label,
    case when nullif(p_access_token, '') is not null
         then pgp_sym_encrypt(p_access_token, p_encryption_key) else null end,
    case when nullif(p_refresh_token, '') is not null
         then pgp_sym_encrypt(p_refresh_token, p_encryption_key) else null end,
    p_expires_at,
    coalesce(p_platform_metadata, '{}'::jsonb),
    true, null, v_profile_id
  )
  on conflict (platform, external_id) do update set
    display_label = excluded.display_label,
    access_token_encrypted  = coalesce(excluded.access_token_encrypted,  social_accounts.access_token_encrypted),
    refresh_token_encrypted = coalesce(excluded.refresh_token_encrypted, social_accounts.refresh_token_encrypted),
    token_expires_at        = coalesce(excluded.token_expires_at,        social_accounts.token_expires_at),
    platform_metadata       = excluded.platform_metadata,
    is_active               = true,
    last_error              = null,
    updated_at              = now()
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.save_social_account(
  text, text, text, text, text, timestamptz, jsonb, text
) to authenticated;


-- 8.b) decrypt_social_token: definer helper — only callable by authed
-- caller because RLS on social_accounts already gates to super-admin.
-- Returns null when no token is stored (so callers can degrade gracefully).
create or replace function public.decrypt_social_token(
  p_account_id     uuid,
  p_encryption_key text
)
returns table (
  access_token         text,
  refresh_token        text,
  token_expires_at     timestamptz,
  platform_metadata    jsonb,
  platform             text,
  external_id          text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_super boolean;
begin
  select public.is_super_admin() into v_is_super;
  if not coalesce(v_is_super, false) then
    raise exception 'super-admin only';
  end if;

  return query
  select
    pgp_sym_decrypt(sa.access_token_encrypted, p_encryption_key)::text,
    case when sa.refresh_token_encrypted is not null
         then pgp_sym_decrypt(sa.refresh_token_encrypted, p_encryption_key)::text
         else null end,
    sa.token_expires_at,
    sa.platform_metadata,
    sa.platform,
    sa.external_id
  from public.social_accounts sa
  where sa.id = p_account_id
    and sa.is_active = true
  limit 1;
end;
$$;

revoke all on function public.decrypt_social_token(uuid, text) from public;
grant execute on function public.decrypt_social_token(uuid, text) to authenticated;


-- 8.c) record_target_publish_result: marks a target row published/failed
-- and updates the parent post status (all-published / partial / all-failed)
create or replace function public.record_target_publish_result(
  p_target_id        uuid,
  p_status           text,      -- 'published' | 'failed'
  p_external_post_id text,
  p_external_url     text,
  p_error            text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_post_id uuid;
  v_total   integer;
  v_done    integer;
  v_failed  integer;
  v_new_post_status text;
begin
  if p_status not in ('published', 'failed') then
    raise exception 'invalid status %', p_status;
  end if;

  update public.social_post_targets set
    status            = p_status,
    attempted_at      = now(),
    published_at      = case when p_status = 'published' then now() else null end,
    external_post_id  = p_external_post_id,
    external_url      = p_external_url,
    last_error        = p_error,
    updated_at        = now()
  where id = p_target_id
  returning post_id into v_post_id;

  if v_post_id is null then return; end if;

  -- Rollup status onto the parent post
  select count(*), count(*) filter (where status = 'published'),
         count(*) filter (where status = 'failed')
    into v_total, v_done, v_failed
  from public.social_post_targets
  where post_id = v_post_id;

  v_new_post_status :=
    case
      when v_done = v_total then 'published'
      when v_done > 0       then 'partially_failed'
      when v_failed = v_total then 'failed'
      else 'publishing'
    end;

  update public.social_posts set
    status        = v_new_post_status,
    published_at  = case when v_new_post_status = 'published' then now()
                         else published_at end,
    updated_at    = now()
  where id = v_post_id;
end;
$$;

grant execute on function public.record_target_publish_result(uuid, text, text, text, text)
  to authenticated;


-- ----------------------------------------------------------------------------
-- 9) Reload PostgREST cache
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
