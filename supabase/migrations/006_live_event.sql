-- Live event: teams, submissions, event_state, chat_messages, display_layout

create table if not exists public.teams (
  id uuid default gen_random_uuid() primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  name text,
  color text,
  photo_url text,
  score integer not null default 0,
  status text not null default 'idle',
  slot_number integer not null,
  created_at timestamptz not null default now(),
  unique (event_id, slot_number)
);

create table if not exists public.submissions (
  id uuid default gen_random_uuid() primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  media_url text,
  media_type text,
  status text not null default 'pending',
  points_awarded integer,
  created_at timestamptz not null default now()
);

create table if not exists public.event_state (
  id uuid default gen_random_uuid() primary key,
  event_id uuid not null references public.events (id) on delete cascade unique,
  current_stage_index integer not null default 0,
  current_question_index integer not null default 0,
  timer_seconds integer not null default 7200,
  timer_running boolean not null default false,
  show_scores boolean not null default true,
  show_timer_on_display boolean not null default true,
  quiz_state text not null default 'waiting',
  bingo_state text not null default 'waiting',
  announcement text,
  announcement_target text,
  winner_reveal_stage integer not null default 0,
  break_timer_seconds integer,
  break_timer_running boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  sender text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.events
  add column if not exists display_layout text not null default 'rank_list';

create index if not exists teams_event_id_idx on public.teams (event_id);
create index if not exists submissions_event_id_idx on public.submissions (event_id);
create index if not exists chat_messages_event_id_idx on public.chat_messages (event_id);

-- RLS
alter table public.teams enable row level security;
alter table public.submissions enable row level security;
alter table public.event_state enable row level security;
alter table public.chat_messages enable row level security;

-- Live panels (anon + authenticated)
drop policy if exists "teams_live_all" on public.teams;
create policy "teams_live_all"
on public.teams for all to anon, authenticated
using (true) with check (true);

drop policy if exists "submissions_live_all" on public.submissions;
create policy "submissions_live_all"
on public.submissions for all to anon, authenticated
using (true) with check (true);

drop policy if exists "event_state_live_all" on public.event_state;
create policy "event_state_live_all"
on public.event_state for all to anon, authenticated
using (true) with check (true);

drop policy if exists "chat_messages_live_all" on public.chat_messages;
create policy "chat_messages_live_all"
on public.chat_messages for all to anon, authenticated
using (true) with check (true);

drop policy if exists "events_live_select" on public.events;
create policy "events_live_select"
on public.events for select to anon, authenticated
using (true);

drop policy if exists "event_games_live_select" on public.event_games;
create policy "event_games_live_select"
on public.event_games for select to anon, authenticated
using (true);

drop policy if exists "games_live_select" on public.games;
create policy "games_live_select"
on public.games for select to anon, authenticated
using (true);

drop policy if exists "organizations_live_select" on public.organizations;
create policy "organizations_live_select"
on public.organizations for select to anon, authenticated
using (true);

grant select on public.events to anon;
grant select on public.event_games to anon;
grant select on public.games to anon;
grant select on public.organizations to anon;
grant all on public.teams to anon, authenticated;
grant all on public.submissions to anon, authenticated;
grant all on public.event_state to anon, authenticated;
grant all on public.chat_messages to anon, authenticated;

-- Realtime (run each; ignore errors if already added)
do $$ begin
  alter publication supabase_realtime add table public.teams;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.submissions;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.event_state;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null;
end $$;
