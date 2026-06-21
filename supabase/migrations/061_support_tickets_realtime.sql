-- #21: clients must see ticket status changes without a manual refresh.
-- support_ticket_messages was already published for realtime (021); the tickets
-- table itself was not, so status updates never reached the client.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_tickets'
  ) then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
end $$;
