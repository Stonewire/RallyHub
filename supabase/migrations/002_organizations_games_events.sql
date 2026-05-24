-- Organizations, games, events, and membership for RallyHub admin.

create table public.organizations (
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

create unique index organizations_tablet_slug_idx on public.organizations (tablet_slug);

alter table public.profiles
  add column if not exists organization_id uuid references public.organizations (id) on delete set null;

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create index organization_members_org_idx on public.organization_members (organization_id);

create table public.game_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create type public.game_type as enum ('photo', 'video', 'quiz', 'music_bingo');
create type public.game_status as enum ('active', 'draft', 'archived');

create table public.games (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  group_id uuid references public.game_groups (id) on delete set null,
  name text not null,
  game_type public.game_type not null default 'quiz',
  status public.game_status not null default 'draft',
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_organization_id_idx on public.games (organization_id);

create type public.event_status as enum ('active', 'ready', 'draft', 'archived');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  event_date timestamptz,
  status public.event_status not null default 'draft',
  team_count integer not null default 0 check (team_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_organization_id_idx on public.events (organization_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger games_set_updated_at
before update on public.games
for each row execute function public.set_updated_at();

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create or replace function public.user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.game_groups enable row level security;
alter table public.games enable row level security;
alter table public.events enable row level security;

create policy "organizations_select_own"
on public.organizations for select to authenticated
using (id = public.user_organization_id());

create policy "organizations_update_own"
on public.organizations for update to authenticated
using (id = public.user_organization_id())
with check (id = public.user_organization_id());

create policy "organization_members_select_own"
on public.organization_members for select to authenticated
using (organization_id = public.user_organization_id());

create policy "organization_members_insert_own"
on public.organization_members for insert to authenticated
with check (organization_id = public.user_organization_id());

create policy "organization_members_delete_own"
on public.organization_members for delete to authenticated
using (organization_id = public.user_organization_id());

create policy "game_groups_all_own"
on public.game_groups for all to authenticated
using (organization_id = public.user_organization_id())
with check (organization_id = public.user_organization_id());

create policy "games_all_own"
on public.games for all to authenticated
using (organization_id = public.user_organization_id())
with check (organization_id = public.user_organization_id());

create policy "events_all_own"
on public.events for all to authenticated
using (organization_id = public.user_organization_id())
with check (organization_id = public.user_organization_id());

grant select, update on public.organizations to authenticated;
grant select, insert, delete on public.organization_members to authenticated;
grant all on public.game_groups to authenticated;
grant all on public.games to authenticated;
grant all on public.events to authenticated;

insert into storage.buckets (id, name, public)
values ('organization-logos', 'organization-logos', true)
on conflict (id) do nothing;

create policy "org_logos_public_read"
on storage.objects for select
using (bucket_id = 'organization-logos');

create policy "org_logos_authenticated_upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'organization-logos');

create policy "org_logos_authenticated_update"
on storage.objects for update to authenticated
using (bucket_id = 'organization-logos');
