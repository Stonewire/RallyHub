-- RallyHub: profiles linked to Supabase Auth users with application roles.
-- Run this in the Supabase SQL editor or via supabase db push.

create extension if not exists "pgcrypto";

create type public.app_role as enum (
  'super_admin',
  'client_admin',
  'event_manager'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.app_role not null default 'event_manager',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

-- Keep updated_at in sync (optional but handy).
create or replace function public.set_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

-- New Auth user → profile row (default role: event_manager).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'event_manager'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;

-- Authenticated users can read their own profile.
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- Role changes should be applied in the Supabase SQL editor (service role) or a trusted
-- Edge Function — not by end users from the anon/authenticated client.

grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;

comment on table public.profiles is 'Application user profile and role for RallyHub.';
comment on column public.profiles.role is 'super_admin > client_admin > event_manager (enforce in app logic as needed).';
