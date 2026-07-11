-- SEC-3 + part of SEC-5: FK indexes, hot live-query index, org-insert lockdown,
-- and search_path pinning. All additive/idempotent; safe to re-run.

-- ─── Missing foreign-key indexes (advisor: unindexed_foreign_keys) ───────────
-- Each FK-side column below had no covering index, so cascade
-- deletes/updates and joins on the referenced parent do sequential scans.

create index if not exists bingo_run_secrets_winner_team_id_idx
  on public.bingo_run_secrets (winner_team_id);
create index if not exists bingo_runs_game_id_idx
  on public.bingo_runs (game_id);
create index if not exists chat_messages_team_id_idx
  on public.chat_messages (team_id);
create index if not exists event_activity_log_organization_id_idx
  on public.event_activity_log (organization_id);
create index if not exists event_games_game_id_idx
  on public.event_games (game_id);
create index if not exists game_group_items_game_id_idx
  on public.game_group_items (game_id);
create index if not exists game_groups_organization_id_idx
  on public.game_groups (organization_id);
create index if not exists games_organization_id_idx
  on public.games (organization_id);
create index if not exists games_source_template_id_idx
  on public.games (source_template_id);
create index if not exists invoices_promo_code_id_idx
  on public.invoices (promo_code_id);
create index if not exists music_catalog_license_confirmed_by_idx
  on public.music_catalog (license_confirmed_by);
create index if not exists music_playlist_tracks_track_id_idx
  on public.music_playlist_tracks (track_id);
create index if not exists profiles_organization_id_idx
  on public.profiles (organization_id);
create index if not exists promo_code_redemptions_applied_event_id_idx
  on public.promo_code_redemptions (applied_event_id);
create index if not exists promo_codes_created_by_idx
  on public.promo_codes (created_by);
create index if not exists submissions_game_id_idx
  on public.submissions (game_id);
create index if not exists submissions_team_id_idx
  on public.submissions (team_id);
create index if not exists support_ticket_replies_ticket_id_idx
  on public.support_ticket_replies (ticket_id);
create index if not exists tablet_sessions_organization_id_idx
  on public.tablet_sessions (organization_id);

-- ─── Hot live query: submissions for an event, newest first ──────────────────
-- Supersedes the plain (event_id) index for the ordered live-bundle read.
-- The old submissions_event_id_idx is left in place for now (drop only after a
-- real usage window confirms it is redundant, per SEC-3).
create index if not exists submissions_event_created_at_idx
  on public.submissions (event_id, created_at desc);

-- ─── Org creation is super-admin / service-role only (advisor: rls_policy_always_true)
-- The old policy had WITH CHECK (true), letting any authenticated user insert an
-- organization. The only in-app authenticated insert is the platform-library
-- fallback, which runs solely for super_admin; the signup Edge Functions use the
-- service role and bypass RLS entirely, so neither path is affected.
drop policy if exists "organizations_insert_authenticated" on public.organizations;
create policy "organizations_insert_authenticated"
  on public.organizations for insert
  to authenticated
  with check ((select public.is_super_admin()));

-- ─── Pin search_path on flagged functions (advisor: function_search_path_mutable)
-- All 14 reference cross-schema/public objects fully-qualified (storage.foldername,
-- public.*) or use only built-ins, so a fixed public search_path is behaviour-safe.
alter function public.set_updated_at() set search_path = public;
alter function public.set_profiles_updated_at() set search_path = public;
alter function public.set_event_slug() set search_path = public;
alter function public.touch_support_ticket_on_message() set search_path = public;
alter function public.trg_event_status_lifecycle_guard() set search_path = public;
alter function public.current_live_join_token() set search_path = public;
alter function public.storage_path_is_uuid(text) set search_path = public;
alter function public.storage_game_assets_live_upload_path_allowed(text) set search_path = public;
alter function public.next_event_slug(uuid, text, uuid) set search_path = public;
alter function public.plan_per_event_price_eur(text) set search_path = public;
alter function public.quiz_question_answers_visible(text, integer, integer) set search_path = public;
alter function public.redact_game_config_for_live(jsonb, text, text, integer, text) set search_path = public;
alter function public.slugify(text) set search_path = public;
alter function public.slugify_org_name(text) set search_path = public;
