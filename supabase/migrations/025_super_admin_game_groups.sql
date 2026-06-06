-- Super admin: manage game groups for the platform library organization

drop policy if exists "game_groups_super_admin_all" on public.game_groups;
create policy "game_groups_super_admin_all"
on public.game_groups for all to authenticated
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

drop policy if exists "game_group_items_super_admin_all" on public.game_group_items;
create policy "game_group_items_super_admin_all"
on public.game_group_items for all to authenticated
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
