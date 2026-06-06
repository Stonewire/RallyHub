-- Threaded support ticket messages (replaces flat body + replies for conversation UI)

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_role text not null check (sender_role in ('client', 'support')),
  sender_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_messages_ticket_idx
  on public.support_ticket_messages (ticket_id, created_at);

-- Original ticket descriptions become the first client message in the thread.
insert into public.support_ticket_messages (ticket_id, sender_role, sender_name, body, created_at)
select
  t.id,
  'client',
  'Client',
  t.body,
  t.created_at
from public.support_tickets t
where t.body is not null
  and trim(t.body) <> ''
  and not exists (
    select 1 from public.support_ticket_messages m where m.ticket_id = t.id
  );

-- Migrate legacy staff replies into the thread.
insert into public.support_ticket_messages (ticket_id, sender_role, sender_name, body, created_at)
select
  r.ticket_id,
  case when r.is_staff then 'support' else 'client' end,
  case when r.is_staff then 'RallyHub Support' else 'Client' end,
  r.body,
  r.created_at
from public.support_ticket_replies r
where not exists (
  select 1
  from public.support_ticket_messages m
  where m.ticket_id = r.ticket_id
    and m.body = r.body
    and m.created_at = r.created_at
);

create or replace function public.touch_support_ticket_on_message()
returns trigger
language plpgsql
as $$
begin
  update public.support_tickets
  set updated_at = now()
  where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists support_ticket_messages_touch_ticket on public.support_ticket_messages;
create trigger support_ticket_messages_touch_ticket
after insert on public.support_ticket_messages
for each row execute function public.touch_support_ticket_on_message();

alter table public.support_ticket_messages enable row level security;

drop policy if exists "support_messages_select" on public.support_ticket_messages;
create policy "support_messages_select"
on public.support_ticket_messages for select to authenticated
using (
  exists (
    select 1
    from public.support_tickets t
    where t.id = ticket_id
      and (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'super_admin'
        )
        or t.organization_id = public.user_organization_id()
      )
  )
);

drop policy if exists "support_messages_insert" on public.support_ticket_messages;
create policy "support_messages_insert"
on public.support_ticket_messages for insert to authenticated
with check (
  exists (
    select 1
    from public.support_tickets t
    where t.id = ticket_id
      and (
        (
          sender_role = 'support'
          and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'super_admin'
          )
        )
        or (
          sender_role = 'client'
          and t.organization_id = public.user_organization_id()
        )
      )
  )
);

grant all on public.support_ticket_messages to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_ticket_messages'
  ) then
    alter publication supabase_realtime add table public.support_ticket_messages;
  end if;
end
$$;
