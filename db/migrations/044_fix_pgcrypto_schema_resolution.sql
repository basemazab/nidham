-- ============================================================================
-- Migration 044 — Fix pgcrypto schema resolution in encryption RPCs
-- ============================================================================
--
-- BUG this fixes:
--   "function pgp_sym_encrypt(text, text) does not exist"
--
--   Supabase Cloud installs the pgcrypto extension into the `extensions`
--   schema (not `public`). Our SECURITY DEFINER RPCs from migrations 040
--   and 043 call pgp_sym_encrypt() / pgp_sym_decrypt() unqualified, which
--   resolves against search_path. The functions set
--     search_path = public
--   to lock down injection vectors — but that hides the extensions schema
--   too, so the bare-name lookup fails.
--
--   This migration recreates the four affected RPCs with FULLY-QUALIFIED
--   calls to `extensions.pgp_sym_encrypt(...)` and
--   `extensions.pgp_sym_decrypt(...)`. Schema-qualified calls don't depend
--   on search_path, so they work even with the locked-down setting.
--
-- Tables affected: none (no data migration needed)
-- Functions replaced (4):
--   - upsert_meta_integration       (mig 040)
--   - lookup_meta_integration_by_page (mig 040)
--   - save_social_account            (mig 043)
--   - decrypt_social_token           (mig 043)
-- ============================================================================

-- Defensive: make sure the extension exists. CREATE EXTENSION IF NOT EXISTS
-- is idempotent and lands the extension into the `extensions` schema on
-- Supabase Cloud (the default).
create extension if not exists pgcrypto with schema extensions;


-- ----------------------------------------------------------------------------
-- 040: upsert_meta_integration — was using pgp_sym_encrypt unqualified
-- ----------------------------------------------------------------------------
create or replace function public.upsert_meta_integration(
  p_page_id             text,
  p_page_name           text,
  p_page_access_token   text,
  p_encryption_key      text,
  p_app_id              text,
  p_display_label       text,
  p_default_landing_page_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_company_id uuid;
  v_existing_id uuid;
  v_existing_company uuid;
  v_result_id  uuid;
begin
  if v_profile_id is null then raise exception 'must be authenticated'; end if;
  select company_id into v_company_id from public.profiles where id = v_profile_id;
  if v_company_id is null then raise exception 'no company for caller'; end if;

  select id, company_id into v_existing_id, v_existing_company
    from public.meta_integrations where page_id = p_page_id;

  if v_existing_id is not null and v_existing_company <> v_company_id then
    raise exception 'page % already connected to a different tenant', p_page_id;
  end if;

  if v_existing_id is not null then
    update public.meta_integrations set
      page_name = p_page_name,
      page_access_token_encrypted = extensions.pgp_sym_encrypt(p_page_access_token, p_encryption_key),
      app_id = p_app_id,
      display_label = p_display_label,
      default_landing_page_id = p_default_landing_page_id,
      is_active = true,
      last_error = null,
      updated_at = now()
    where id = v_existing_id;
    v_result_id := v_existing_id;
  else
    insert into public.meta_integrations (
      company_id, page_id, page_name,
      page_access_token_encrypted, app_id,
      display_label, default_landing_page_id, created_by
    )
    values (
      v_company_id, p_page_id, p_page_name,
      extensions.pgp_sym_encrypt(p_page_access_token, p_encryption_key),
      p_app_id, p_display_label, p_default_landing_page_id, v_profile_id
    )
    returning id into v_result_id;
  end if;

  return v_result_id;
end;
$$;

grant execute on function public.upsert_meta_integration(
  text, text, text, text, text, text, uuid
) to authenticated;


-- ----------------------------------------------------------------------------
-- 040: lookup_meta_integration_by_page — was using pgp_sym_decrypt unqualified
-- ----------------------------------------------------------------------------
create or replace function public.lookup_meta_integration_by_page(
  p_page_id        text,
  p_encryption_key text
)
returns table (
  integration_id           uuid,
  company_id               uuid,
  page_access_token        text,
  default_landing_page_id  uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    mi.id,
    mi.company_id,
    extensions.pgp_sym_decrypt(mi.page_access_token_encrypted, p_encryption_key)::text,
    mi.default_landing_page_id
  from public.meta_integrations mi
  where mi.page_id = p_page_id
    and mi.is_active = true
    and mi.page_access_token_encrypted is not null
  limit 1;
end;
$$;

revoke all on function public.lookup_meta_integration_by_page(text, text) from public;
grant execute on function public.lookup_meta_integration_by_page(text, text)
  to service_role, authenticated;


-- ----------------------------------------------------------------------------
-- 043: save_social_account — was using pgp_sym_encrypt unqualified
-- ----------------------------------------------------------------------------
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
         then extensions.pgp_sym_encrypt(p_access_token, p_encryption_key) else null end,
    case when nullif(p_refresh_token, '') is not null
         then extensions.pgp_sym_encrypt(p_refresh_token, p_encryption_key) else null end,
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


-- ----------------------------------------------------------------------------
-- 043: decrypt_social_token — was using pgp_sym_decrypt unqualified
-- ----------------------------------------------------------------------------
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
    extensions.pgp_sym_decrypt(sa.access_token_encrypted, p_encryption_key)::text,
    case when sa.refresh_token_encrypted is not null
         then extensions.pgp_sym_decrypt(sa.refresh_token_encrypted, p_encryption_key)::text
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


-- ----------------------------------------------------------------------------
-- Reload PostgREST cache so the rewritten functions are immediately callable
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
