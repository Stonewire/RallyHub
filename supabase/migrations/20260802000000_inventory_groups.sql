-- Inventory groups, mirroring game_groups: an org-scoped name plus a
-- many-to-many join to items, so one item can sit in several groups.

create table if not exists public.inventory_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_group_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.inventory_groups(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  unique (group_id, item_id)
);

create index if not exists inventory_groups_org_idx
  on public.inventory_groups (organization_id);
create index if not exists inventory_group_items_group_idx
  on public.inventory_group_items (group_id);
create index if not exists inventory_group_items_item_idx
  on public.inventory_group_items (item_id);

alter table public.inventory_groups enable row level security;
alter table public.inventory_group_items enable row level security;

create policy inventory_groups_all_own on public.inventory_groups
  for all
  using (
    organization_id = (select user_organization_id())
    or (select is_super_admin())
  )
  with check (
    organization_id = (select user_organization_id())
    or (select is_super_admin())
  );

-- Membership is reachable only through a group the caller can already see, so
-- the item side needs no separate check.
create policy inventory_group_items_all_own on public.inventory_group_items
  for all
  using (
    exists (
      select 1
      from public.inventory_groups g
      where g.id = inventory_group_items.group_id
        and g.organization_id = (select user_organization_id())
    )
    or (select is_super_admin())
  )
  with check (
    exists (
      select 1
      from public.inventory_groups g
      where g.id = inventory_group_items.group_id
        and g.organization_id = (select user_organization_id())
    )
    or (select is_super_admin())
  );
