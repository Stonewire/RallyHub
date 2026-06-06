-- Count individual unread messages (not distinct tickets) for support nav badges.

create or replace function public.support_unread_ticket_count(p_viewer_role text)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
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
