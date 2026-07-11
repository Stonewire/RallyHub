-- SEC-4 round 2: shrink the anon attack surface on SECURITY DEFINER functions.
--
-- Method: for each function, revoke all inherited/direct execute, then re-grant
-- only the role(s) that legitimately need it. anon is removed everywhere below.
-- Verified before writing:
--   * the five RLS helpers are referenced ONLY in `authenticated` policies, so
--     anon never evaluates them (anon live policies use the join-token helpers,
--     which are deliberately left anon-executable).
--   * the three admin RPCs are called only from authenticated admin pages
--     (use-rallyhub, use-organization-settings, use-music-library-install).
--   * the three internal functions are not called by any client code; they run
--     from Edge Functions / cron / triggers under service_role or postgres.
-- Left intentionally anon-executable (real anonymous surfaces): the live-event
-- bootstrap/lookup RPCs, tenant/login resolution, tablet PIN/session RPCs, the
-- join-token RLS helpers, and the storage path-check helpers.

-- ─── Group 1: keep authenticated + service_role, drop anon ───────────────────
-- RLS helpers (needed when authenticated users query their org's live tables):
revoke execute on function public.is_super_admin()
  from public, anon, authenticated, service_role;
grant execute on function public.is_super_admin() to authenticated, service_role;

revoke execute on function public.user_organization_id()
  from public, anon, authenticated, service_role;
grant execute on function public.user_organization_id() to authenticated, service_role;

revoke execute on function public.is_facilitator_for_event(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.is_facilitator_for_event(uuid) to authenticated, service_role;

revoke execute on function public.is_org_member_for_event(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.is_org_member_for_event(uuid) to authenticated, service_role;

revoke execute on function public.is_org_staff_for_event(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.is_org_staff_for_event(uuid) to authenticated, service_role;

-- Admin RPCs (called from authenticated admin pages only):
revoke execute on function public.expire_overdue_trials()
  from public, anon, authenticated, service_role;
grant execute on function public.expire_overdue_trials() to authenticated, service_role;

revoke execute on function public.get_organization_users(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_organization_users(uuid) to authenticated, service_role;

revoke execute on function public.install_music_library(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.install_music_library(uuid) to authenticated, service_role;

-- Scoring RPC: invoked by trusted Edge Functions (service_role); keep
-- authenticated too in case a facilitator path calls it, but never anon.
revoke execute on function public.award_bingo_line_bonus(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.award_bingo_line_bonus(uuid, uuid, integer) to authenticated, service_role;

-- ─── Group 2: service_role only (cron / seed workers; no client caller) ──────
revoke execute on function public.archive_stale_active_events()
  from public, anon, authenticated, service_role;
grant execute on function public.archive_stale_active_events() to service_role;

revoke execute on function public.seed_organization_defaults(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.seed_organization_defaults(uuid) to service_role;
