-- Media capture investigation (2026-07-30-media-capture-investigation-design.md):
-- durable, permanent capture of client-side failures that are otherwise
-- invisible (edge function calls, storage uploads, camera capture/record
-- exceptions, and the text-submit close-on-submit discrepancy) so real error
-- detail can be queried instead of guessed at.

create table if not exists public.client_diagnostics (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid references public.events(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  context text not null,
  platform text not null,
  message text not null,
  detail jsonb
);

create index if not exists client_diagnostics_created_at_idx
  on public.client_diagnostics (created_at desc);
create index if not exists client_diagnostics_event_id_idx
  on public.client_diagnostics (event_id);

alter table public.client_diagnostics enable row level security;

-- Anon can only INSERT, scoped to an event they hold a valid join token for
-- (same pattern as `submissions` in 041_event_join_token_scoping.sql). No
-- anon SELECT/UPDATE/DELETE.
drop policy if exists "client_diagnostics_anon_insert" on public.client_diagnostics;
create policy "client_diagnostics_anon_insert"
  on public.client_diagnostics for insert
  to anon
  with check (public.live_join_token_matches_event(event_id));

-- Only super admins can read it from the app; diagnosing this round of bugs
-- happens via direct SQL (service role), not an admin-UI reader.
drop policy if exists "client_diagnostics_super_admin_select" on public.client_diagnostics;
create policy "client_diagnostics_super_admin_select"
  on public.client_diagnostics for select
  to authenticated
  using ((select public.is_super_admin()));

revoke all on public.client_diagnostics from anon, authenticated;
grant insert on public.client_diagnostics to anon;
grant select on public.client_diagnostics to authenticated;
