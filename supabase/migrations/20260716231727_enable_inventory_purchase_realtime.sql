-- Facilitators load purchase history through authenticated RLS and receive new
-- rows instantly while an event is running. Only INSERT events are consumed by
-- the client; the purchase log itself remains immutable.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory_purchases'
  ) then
    alter publication supabase_realtime add table public.inventory_purchases;
  end if;
end;
$$;
