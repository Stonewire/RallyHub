-- RallyHub: games, events, game_groups, game_group_items (run in Supabase SQL editor)
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS where possible.

create extension if not exists "pgcrypto";

-- ─── Organizations (required for organization_id on profiles) ───
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Organization',
  logo_url text,
  primary_color text not null default '#3E3D3E',
  secondary_color text not null default '#6f6f6f',
  accent_color text not null default '#FFCB03',
  vat_number text,
  address text,
  tablet_password text,
  tablet_slug text not null default encode(gen_random_bytes(6), 'hex'),
  billing_plan text not null default 'starter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists organization_id uuid references public.organizations (id) on delete set null;

-- ─── game_groups ───
create table if not exists public.game_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- ─── games ───
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  type text not null check (type in ('photo', 'video', 'quiz', 'music_bingo')),
  description text,
  cover_url text,
  points_type text not null default 'static' check (points_type in ('static', 'range')),
  points_static integer default 50,
  points_min integer,
  points_max integer,
  solution_description text,
  solution_image_url text,
  status text not null default 'draft',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Migrate legacy column names if an older games table exists
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'game_type'
  ) then
    alter table public.games rename column game_type to type;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'cover_image_url'
  ) then
    alter table public.games rename column cover_image_url to cover_url;
  end if;
exception when others then null;
end $$;

alter table public.games add column if not exists description text;
alter table public.games add column if not exists type text;
alter table public.games add column if not exists cover_url text;
alter table public.games add column if not exists points_type text default 'static';
alter table public.games add column if not exists points_static integer default 50;
alter table public.games add column if not exists points_min integer;
alter table public.games add column if not exists points_max integer;
alter table public.games add column if not exists solution_description text;
alter table public.games add column if not exists solution_image_url text;
alter table public.games add column if not exists config jsonb not null default '{}'::jsonb;

-- ─── game_group_items ───
create table if not exists public.game_group_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.game_groups (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  unique (group_id, game_id)
);

-- ─── events ───
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  event_date timestamptz,
  status text not null default 'draft',
  team_count integer not null default 4,
  branding_enabled boolean not null default true,
  logo_url text,
  brand_colors jsonb default '[]'::jsonb,
  teams_config jsonb not null default '[]'::jsonb,
  stages_config jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.events add column if not exists branding_enabled boolean default true;
alter table public.events add column if not exists logo_url text;
alter table public.events add column if not exists brand_colors jsonb default '[]'::jsonb;
alter table public.events add column if not exists teams_config jsonb default '[]'::jsonb;
alter table public.events add column if not exists stages_config jsonb default '[]'::jsonb;

-- ─── event_games (games attached to an event) ───
create table if not exists public.event_games (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  unique (event_id, game_id)
);

-- ─── RLS helper ───
create or replace function public.user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

-- ─── RLS policies ───
alter table public.organizations enable row level security;
alter table public.game_groups enable row level security;
alter table public.games enable row level security;
alter table public.game_group_items enable row level security;
alter table public.events enable row level security;
alter table public.event_games enable row level security;

drop policy if exists "organizations_select_own" on public.organizations;
create policy "organizations_select_own" on public.organizations for select to authenticated
  using (id = public.user_organization_id());
drop policy if exists "organizations_update_own" on public.organizations;
create policy "organizations_update_own" on public.organizations for update to authenticated
  using (id = public.user_organization_id()) with check (id = public.user_organization_id());
drop policy if exists "organizations_insert_authenticated" on public.organizations;
create policy "organizations_insert_authenticated" on public.organizations for insert to authenticated
  with check (true);

drop policy if exists "game_groups_all_own" on public.game_groups;
create policy "game_groups_all_own" on public.game_groups for all to authenticated
  using (organization_id = public.user_organization_id())
  with check (organization_id = public.user_organization_id());

drop policy if exists "games_all_own" on public.games;
create policy "games_all_own" on public.games for all to authenticated
  using (organization_id = public.user_organization_id())
  with check (organization_id = public.user_organization_id());

drop policy if exists "game_group_items_all_own" on public.game_group_items;
create policy "game_group_items_all_own" on public.game_group_items for all to authenticated
  using (
    exists (
      select 1 from public.game_groups g
      where g.id = group_id and g.organization_id = public.user_organization_id()
    )
  )
  with check (
    exists (
      select 1 from public.game_groups g
      where g.id = group_id and g.organization_id = public.user_organization_id()
    )
  );

drop policy if exists "events_all_own" on public.events;
create policy "events_all_own" on public.events for all to authenticated
  using (organization_id = public.user_organization_id())
  with check (organization_id = public.user_organization_id());

drop policy if exists "event_games_all_own" on public.event_games;
create policy "event_games_all_own" on public.event_games for all to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.organization_id = public.user_organization_id()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.organization_id = public.user_organization_id()
    )
  );

grant select, insert, update on public.organizations to authenticated;
grant all on public.game_groups to authenticated;
grant all on public.games to authenticated;
grant all on public.game_group_items to authenticated;
grant all on public.events to authenticated;
grant all on public.event_games to authenticated;

-- Storage buckets for uploads
insert into storage.buckets (id, name, public)
values ('game-assets', 'game-assets', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('organization-logos', 'organization-logos', true)
on conflict (id) do nothing;
