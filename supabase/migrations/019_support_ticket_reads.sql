-- Per-user last-viewed markers for support ticket threads (unread badges).

create table if not exists public.support_ticket_reads (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  viewer_role text not null check (viewer_role in ('client', 'support')),
  last_viewed_at timestamptz not null default now(),
  unique (ticket_id, user_id, viewer_role)
);

create index if not exists support_ticket_reads_user_role_idx
  on public.support_ticket_reads (user_id, viewer_role);

alter table public.support_ticket_reads enable row level security;

drop policy if exists "support_ticket_reads_own" on public.support_ticket_reads;
create policy "support_ticket_reads_own"
on public.support_ticket_reads for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant all on public.support_ticket_reads to authenticated;

-- Count tickets with at least one unread message from the other party.
create or replace function public.support_unread_ticket_count(p_viewer_role text)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(distinct m.ticket_id)::integer
  from public.support_ticket_messages m
  inner join public.support_tickets t on t.id = m.ticket_id
  left join public.support_ticket_reads r
    on r.ticket_id = m.ticket_id
   and r.user_id = auth.uid()
   and r.viewer_role = p_viewer_role
  where m.sender_role = case p_viewer_role
    when 'support' then 'client'
    else 'support'
  end
  and m.created_at > coalesce(r.last_viewed_at, '1970-01-01'::timestamptz)
  and (
    (
      p_viewer_role = 'support'
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'super_admin'
      )
    )
    or (
      p_viewer_role = 'client'
      and t.organization_id = public.user_organization_id()
    )
  );
$$;

create or replace function public.mark_support_ticket_read(
  p_ticket_id uuid,
  p_viewer_role text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_viewer_role not in ('client', 'support') then
    raise exception 'invalid viewer_role';
  end if;

  insert into public.support_ticket_reads (ticket_id, user_id, viewer_role, last_viewed_at)
  values (p_ticket_id, auth.uid(), p_viewer_role, now())
  on conflict (ticket_id, user_id, viewer_role)
  do update set last_viewed_at = excluded.last_viewed_at;
end;
$$;

grant execute on function public.support_unread_ticket_count(text) to authenticated;
grant execute on function public.mark_support_ticket_read(uuid, text) to authenticated;
