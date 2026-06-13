-- Super admins can update any event and event_games row (WITH CHECK was missing on
-- events_super_admin policies; only SELECT existed). Mirrors 023_super_admin_org_update.

drop policy if exists "events_super_admin_all" on public.events;
create policy "events_super_admin_all"
on public.events for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
);

drop policy if exists "event_games_super_admin_all" on public.event_games;
create policy "event_games_super_admin_all"
on public.event_games for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
);
