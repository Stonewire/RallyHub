-- Organization members (invitations) and structured address fields

-- Structured address on organizations
alter table public.organizations
  add column if not exists address_street text,
  add column if not exists address_city text,
  add column if not exists address_state text,
  add column if not exists address_postal text,
  add column if not exists address_country text;

-- Recreate organization_members per product schema
drop table if exists public.organization_members cascade;

create table public.organization_members (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'event_manager',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index organization_members_org_idx on public.organization_members (organization_id);

alter table public.organization_members enable row level security;

drop policy if exists "organization_members_select_own" on public.organization_members;
create policy "organization_members_select_own"
on public.organization_members for select to authenticated
using (organization_id = public.user_organization_id());

drop policy if exists "organization_members_insert_own" on public.organization_members;
create policy "organization_members_insert_own"
on public.organization_members for insert to authenticated
with check (organization_id = public.user_organization_id());

drop policy if exists "organization_members_delete_own" on public.organization_members;
create policy "organization_members_delete_own"
on public.organization_members for delete to authenticated
using (organization_id = public.user_organization_id());

grant select, insert, delete on public.organization_members to authenticated;
