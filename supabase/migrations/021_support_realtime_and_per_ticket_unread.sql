-- Per-ticket unread message counts for support ticket cards.

create or replace function public.support_unread_counts_by_ticket(p_viewer_role text)
returns table(ticket_id uuid, unread_count integer)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.ticket_id,
    count(*)::integer as unread_count
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
  )
  group by m.ticket_id;
$$;

grant execute on function public.support_unread_counts_by_ticket(text) to authenticated;

-- Ensure support_ticket_messages is in the realtime publication.
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
