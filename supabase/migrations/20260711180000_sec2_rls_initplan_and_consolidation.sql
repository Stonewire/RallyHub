-- SEC-2: RLS performance cleanup (behaviour-preserving).
--
-- Two advisor findings addressed:
--   * auth_rls_initplan: wrap row-independent auth.uid()/helper calls in
--     (select ...) so they evaluate once per query, not once per row.
--   * multiple_permissive_policies: merge the own-org + super-admin permissive
--     pairs into a single policy (permissive = OR, so the merge is exact).
--
-- Verified equivalences before writing:
--   is_super_admin()      == exists(select 1 from profiles where id=auth.uid() and role='super_admin')
--   user_organization_id()== (select organization_id from profiles where id=auth.uid())
-- Both STABLE SECURITY DEFINER, so the inline super-admin/org subqueries are
-- swapped for the wrapped helper calls with identical semantics.
-- Anon live-path policies are intentionally left untouched.

-- ── events: merge all-own + super-admin-all (+ drop redundant su select) ─────
drop policy if exists "events_all_own" on public.events;
drop policy if exists "events_super_admin_all" on public.events;
drop policy if exists "events_super_admin_select" on public.events;
create policy "events_all_own" on public.events for all to authenticated
  using ((organization_id = (select user_organization_id())) or (select is_super_admin()))
  with check ((organization_id = (select user_organization_id())) or (select is_super_admin()));

-- ── games ────────────────────────────────────────────────────────────────────
drop policy if exists "games_all_own" on public.games;
drop policy if exists "games_super_admin_all" on public.games;
create policy "games_all_own" on public.games for all to authenticated
  using ((organization_id = (select user_organization_id())) or (select is_super_admin()))
  with check ((organization_id = (select user_organization_id())) or (select is_super_admin()));

-- ── game_groups ──────────────────────────────────────────────────────────────
drop policy if exists "game_groups_all_own" on public.game_groups;
drop policy if exists "game_groups_super_admin_all" on public.game_groups;
create policy "game_groups_all_own" on public.game_groups for all to authenticated
  using ((organization_id = (select user_organization_id())) or (select is_super_admin()))
  with check ((organization_id = (select user_organization_id())) or (select is_super_admin()));

-- ── game_group_items ─────────────────────────────────────────────────────────
drop policy if exists "game_group_items_all_own" on public.game_group_items;
drop policy if exists "game_group_items_super_admin_all" on public.game_group_items;
create policy "game_group_items_all_own" on public.game_group_items for all to authenticated
  using ((exists (select 1 from game_groups g where g.id = game_group_items.group_id and g.organization_id = (select user_organization_id()))) or (select is_super_admin()))
  with check ((exists (select 1 from game_groups g where g.id = game_group_items.group_id and g.organization_id = (select user_organization_id()))) or (select is_super_admin()));

-- ── event_games (anon join-token policy left as-is) ──────────────────────────
drop policy if exists "event_games_all_own" on public.event_games;
drop policy if exists "event_games_super_admin_all" on public.event_games;
create policy "event_games_all_own" on public.event_games for all to authenticated
  using ((exists (select 1 from events e where e.id = event_games.event_id and e.organization_id = (select user_organization_id()))) or (select is_super_admin()))
  with check ((exists (select 1 from events e where e.id = event_games.event_id and e.organization_id = (select user_organization_id()))) or (select is_super_admin()));

-- ── music_catalog ────────────────────────────────────────────────────────────
drop policy if exists "music_catalog_org_member" on public.music_catalog;
drop policy if exists "music_catalog_super_admin_all" on public.music_catalog;
create policy "music_catalog_org_member" on public.music_catalog for all to authenticated
  using ((organization_id = (select user_organization_id())) or (select is_super_admin()))
  with check ((organization_id = (select user_organization_id())) or (select is_super_admin()));

-- ── music_playlists (single policy, wrap helpers) ────────────────────────────
drop policy if exists "music_playlists_org" on public.music_playlists;
create policy "music_playlists_org" on public.music_playlists for all to authenticated
  using ((organization_id = (select user_organization_id())) or (select is_super_admin()))
  with check ((organization_id = (select user_organization_id())) or (select is_super_admin()));

-- ── music_playlist_tracks (single policy, wrap helpers) ──────────────────────
drop policy if exists "music_playlist_tracks_org" on public.music_playlist_tracks;
create policy "music_playlist_tracks_org" on public.music_playlist_tracks for all to authenticated
  using (exists (select 1 from music_playlists pl where pl.id = music_playlist_tracks.playlist_id and ((pl.organization_id = (select user_organization_id())) or (select is_super_admin()))))
  with check (exists (select 1 from music_playlists pl where pl.id = music_playlist_tracks.playlist_id and ((pl.organization_id = (select user_organization_id())) or (select is_super_admin()))));

-- ── event_activity_log (single select policy, wrap helpers) ──────────────────
drop policy if exists "event_log_select_org" on public.event_activity_log;
create policy "event_log_select_org" on public.event_activity_log for select to authenticated
  using ((organization_id = (select user_organization_id())) or (select is_super_admin()));

-- ── invoices (wrap helpers; keep the two commands separate) ──────────────────
drop policy if exists "invoices_super_admin_all" on public.invoices;
create policy "invoices_super_admin_all" on public.invoices for all to authenticated
  using ((select is_super_admin()));
drop policy if exists "invoices_select_own" on public.invoices;
create policy "invoices_select_own" on public.invoices for select to authenticated
  using (organization_id = (select user_organization_id()));

-- ── organizations: merge select pair + merge update pair (insert left as-is) ─
drop policy if exists "organizations_select_own" on public.organizations;
drop policy if exists "organizations_super_admin_select" on public.organizations;
create policy "organizations_select_own" on public.organizations for select to authenticated
  using ((id = (select user_organization_id())) or (select is_super_admin()));
drop policy if exists "organizations_super_admin_update" on public.organizations;
drop policy if exists "organizations_update_client_admin" on public.organizations;
create policy "organizations_update_own" on public.organizations for update to authenticated
  using ((select is_super_admin()) or ((id = (select user_organization_id())) and exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'client_admin'::app_role and p.organization_id = organizations.id)))
  with check ((select is_super_admin()) or ((id = (select user_organization_id())) and exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'client_admin'::app_role and p.organization_id = organizations.id)));

-- ── profiles: merge select pair ──────────────────────────────────────────────
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_super_admin_select" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
  using (((select auth.uid()) = id) or (select is_super_admin()));

-- ── organization_members: merge select pair; wrap delete/insert ──────────────
drop policy if exists "organization_members_select_own" on public.organization_members;
drop policy if exists "organization_members_super_admin_select" on public.organization_members;
create policy "organization_members_select_own" on public.organization_members for select to authenticated
  using ((organization_id = (select user_organization_id())) or (select is_super_admin()));
drop policy if exists "organization_members_delete_own" on public.organization_members;
create policy "organization_members_delete_own" on public.organization_members for delete to authenticated
  using (organization_id = (select user_organization_id()));
drop policy if exists "organization_members_insert_own" on public.organization_members;
create policy "organization_members_insert_own" on public.organization_members for insert to authenticated
  with check (organization_id = (select user_organization_id()));

-- ── promo_code_redemptions (single select policy, wrap helpers) ──────────────
drop policy if exists "promo_redemptions_select_own" on public.promo_code_redemptions;
create policy "promo_redemptions_select_own" on public.promo_code_redemptions for select to authenticated
  using ((select is_super_admin()) or (organization_id = (select user_organization_id())));

-- ── support_ticket_messages (insert + select, wrap helpers) ──────────────────
drop policy if exists "support_messages_insert" on public.support_ticket_messages;
create policy "support_messages_insert" on public.support_ticket_messages for insert to authenticated
  with check (exists (select 1 from support_tickets t where t.id = support_ticket_messages.ticket_id and (((support_ticket_messages.sender_role = 'support'::text) and (select is_super_admin())) or ((support_ticket_messages.sender_role = 'client'::text) and (t.organization_id = (select user_organization_id()))))));
drop policy if exists "support_messages_select" on public.support_ticket_messages;
create policy "support_messages_select" on public.support_ticket_messages for select to authenticated
  using (exists (select 1 from support_tickets t where t.id = support_ticket_messages.ticket_id and ((select is_super_admin()) or (t.organization_id = (select user_organization_id())))));

-- ── support_ticket_replies (single policy, wrap helper) ──────────────────────
drop policy if exists "support_replies_super_admin" on public.support_ticket_replies;
create policy "support_replies_super_admin" on public.support_ticket_replies for all to authenticated
  using ((select is_super_admin()));

-- ── support_ticket_reads (single policy, wrap auth.uid) ──────────────────────
drop policy if exists "support_ticket_reads_own" on public.support_ticket_reads;
create policy "support_ticket_reads_own" on public.support_ticket_reads for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── support_tickets (single policy, wrap helpers) ────────────────────────────
drop policy if exists "support_tickets_super_admin" on public.support_tickets;
create policy "support_tickets_super_admin" on public.support_tickets for all to authenticated
  using ((select is_super_admin()) or (organization_id = (select user_organization_id())));
