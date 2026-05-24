-- Super admin: org metadata, support tickets, platform game flags

alter table public.organizations
  add column if not exists contact_email text,
  add column if not exists account_status text not null default 'active',
  add column if not exists internal_notes text;

alter table public.games
  add column if not exists is_default_for_new_clients boolean not null default false,
  add column if not exists is_platform_template boolean not null default false,
  add column if not exists source_template_id uuid references public.games (id) on delete set null;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  subject text not null,
  body text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  body text not null,
  is_staff boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_org_idx on public.support_tickets (organization_id);

-- Super admins can read all organizations
drop policy if exists "organizations_super_admin_select" on public.organizations;
create policy "organizations_super_admin_select"
on public.organizations for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
);

drop policy if exists "organizations_super_admin_update" on public.organizations;
create policy "organizations_super_admin_update"
on public.organizations for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
);

drop policy if exists "events_super_admin_select" on public.events;
create policy "events_super_admin_select"
on public.events for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
);

drop policy if exists "games_super_admin_all" on public.games;
create policy "games_super_admin_all"
on public.games for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_replies enable row level security;

drop policy if exists "support_tickets_super_admin" on public.support_tickets;
create policy "support_tickets_super_admin"
on public.support_tickets for all to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
  or organization_id = public.user_organization_id()
);

drop policy if exists "support_replies_super_admin" on public.support_ticket_replies;
create policy "support_replies_super_admin"
on public.support_ticket_replies for all to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
);

grant all on public.support_tickets to authenticated;
grant all on public.support_ticket_replies to authenticated;
