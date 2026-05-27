-- Org music catalog + per-activation bingo runs (winner stored separately)

create table if not exists public.music_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  artist text not null default '',
  title text not null default '',
  audio_url text not null,
  clip_url text,
  clip_start_seconds numeric not null default 30,
  clip_duration_seconds integer not null default 30,
  duration_seconds numeric,
  source_filename text,
  parse_confidence numeric,
  license_confirmed_at timestamptz,
  license_confirmed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists music_catalog_org_idx on public.music_catalog (organization_id);

create table if not exists public.bingo_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  stage_index integer not null,
  play_order jsonb not null default '[]'::jsonb,
  current_play_index integer not null default 0,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  unique (event_id, stage_index)
);

create index if not exists bingo_runs_event_idx on public.bingo_runs (event_id);

-- Service-role only (no grants to authenticated/anon)
create table if not exists public.bingo_run_secrets (
  run_id uuid primary key references public.bingo_runs (id) on delete cascade,
  winner_team_id uuid not null references public.teams (id) on delete cascade
);

revoke all on public.bingo_run_secrets from anon, authenticated;
revoke all on public.bingo_run_secrets from public;

create table if not exists public.bingo_team_cards (
  run_id uuid not null references public.bingo_runs (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  cells jsonb not null,
  primary key (run_id, team_id)
);

create index if not exists bingo_team_cards_team_idx on public.bingo_team_cards (team_id);

alter table public.music_catalog enable row level security;
alter table public.bingo_runs enable row level security;
alter table public.bingo_team_cards enable row level security;

-- Catalog: org members manage; live read for games in events (broad select for anon live)
drop policy if exists "music_catalog_org_member" on public.music_catalog;
create policy "music_catalog_org_member"
on public.music_catalog for all to authenticated
using (organization_id = public.user_organization_id())
with check (organization_id = public.user_organization_id());

drop policy if exists "music_catalog_live_select" on public.music_catalog;
create policy "music_catalog_live_select"
on public.music_catalog for select to anon, authenticated
using (true);

drop policy if exists "bingo_runs_live_select" on public.bingo_runs;
create policy "bingo_runs_live_select"
on public.bingo_runs for select to anon, authenticated
using (true);

drop policy if exists "bingo_runs_live_update" on public.bingo_runs;
create policy "bingo_runs_live_update"
on public.bingo_runs for update to anon, authenticated
using (true)
with check (true);

drop policy if exists "bingo_team_cards_live_select" on public.bingo_team_cards;
create policy "bingo_team_cards_live_select"
on public.bingo_team_cards for select to anon, authenticated
using (true);

grant select, insert, update, delete on public.music_catalog to authenticated;
grant select on public.music_catalog to anon;
drop policy if exists "bingo_runs_live_insert" on public.bingo_runs;
create policy "bingo_runs_live_insert"
on public.bingo_runs for insert to anon, authenticated
with check (true);

drop policy if exists "bingo_runs_live_delete" on public.bingo_runs;
create policy "bingo_runs_live_delete"
on public.bingo_runs for delete to anon, authenticated
using (true);

drop policy if exists "bingo_team_cards_live_insert" on public.bingo_team_cards;
create policy "bingo_team_cards_live_insert"
on public.bingo_team_cards for insert to anon, authenticated
with check (true);

grant select, insert, update, delete on public.bingo_runs to anon, authenticated;
grant select, insert on public.bingo_team_cards to anon, authenticated;
