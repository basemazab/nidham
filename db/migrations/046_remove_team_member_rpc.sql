-- ============================================================================
-- Migration 046 — remove_team_member RPC (SECURITY DEFINER, app-validated)
-- ============================================================================
--
-- BUG this fixes:
--   The /dashboard/team "🗑 حذف" button rendered a confirmation dialog,
--   submitted the form, the action's redirect ran successfully — but the
--   target member STAYED in the team list. Root cause: `public.profiles`
--   has SELECT + UPDATE policies (mig 001 + mig 008) but NO DELETE policy,
--   so the user-scoped DELETE was silently filtered out by RLS. Supabase
--   doesn't error in that case — it just returns 0 rows affected. The
--   action thought it succeeded and redirected with ?deleted=1.
--
-- FIX:
--   This migration adds a SECURITY DEFINER RPC that performs the DELETE
--   bypassing RLS, with application-layer checks that mirror the same
--   safety rules the action enforces:
--     1) Caller must be an admin (role='admin' in profiles).
--     2) Caller must not be deleting themselves (self-removal would lock
--        them out of their own tenant with no recovery path).
--     3) Target must live in the SAME company as the caller — defends
--        against a crafted target id pointing at another tenant.
--
-- The route layer (removeMember in src/app/dashboard/team/actions.ts)
-- already re-validates 1-3 before calling this RPC, but doubling the
-- checks here keeps the function safe for callers we don't control yet.
-- ============================================================================

create or replace function public.remove_team_member(
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id      uuid := auth.uid();
  v_caller_company uuid;
  v_caller_role    text;
  v_target_company uuid;
begin
  -- Guard 1: caller must be authenticated.
  if v_caller_id is null then
    raise exception 'must be authenticated';
  end if;

  -- Guard 2: caller must not be removing themselves. Even an admin who
  -- "really really wants to" needs to ask another admin to do it for
  -- them — otherwise we end up with tenants that have zero admins.
  if v_caller_id = p_target_id then
    raise exception 'cannot remove yourself';
  end if;

  -- Load caller's role + company in one trip.
  select role, company_id
    into v_caller_role, v_caller_company
    from public.profiles
   where id = v_caller_id;

  if v_caller_role is distinct from 'admin' then
    raise exception 'only admins can remove team members';
  end if;

  -- Verify target exists AND lives in caller's tenant. Reading the
  -- target inside this SECURITY DEFINER function bypasses RLS, but
  -- the company-match check below restores the per-tenant scoping
  -- that RLS would normally give us.
  select company_id into v_target_company
    from public.profiles where id = p_target_id;

  if v_target_company is null then
    raise exception 'member not found';
  end if;

  if v_target_company is distinct from v_caller_company then
    raise exception 'member does not belong to your company';
  end if;

  -- All checks passed — wipe the profile row. auth.users is left
  -- intact so HR can re-invite the same email later without manually
  -- recreating an auth account.
  delete from public.profiles where id = p_target_id;
end;
$$;

-- Lock the function down — anon cannot call it, only authenticated.
revoke all on function public.remove_team_member(uuid) from public;
grant execute on function public.remove_team_member(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- Reload PostgREST cache so the new RPC shows up in the API surface
-- immediately, no Supabase restart required.
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
