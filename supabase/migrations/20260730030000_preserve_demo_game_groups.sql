-- Preserve the platform library's game groups in the resettable demo tenant.

alter function public.reset_demo_sandbox(uuid, boolean)
  rename to reset_demo_sandbox_without_groups;

revoke all on function public.reset_demo_sandbox_without_groups(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.reset_demo_sandbox_without_groups(uuid, boolean)
  to service_role;

create function public.reset_demo_sandbox(
  p_organization_id uuid,
  p_force boolean default false
)
returns table (
  organization_id uuid,
  last_reset_at timestamptz,
  next_reset_at timestamptz,
  reset_interval_minutes integer,
  generation integer
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_result record;
  v_generation_before integer;
  v_platform_id uuid;
  v_source_group public.game_groups%rowtype;
  v_demo_group_id uuid;
  v_bingo_group_id uuid;
  v_bingo_game_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select o.demo_generation
  into v_generation_before
  from public.organizations o
  where o.id = p_organization_id and o.is_demo;

  select *
  into v_result
  from public.reset_demo_sandbox_without_groups(p_organization_id, p_force);

  -- A session check before the deadline returns the existing generation and
  -- must not overwrite changes made while somebody is actively using the demo.
  if not p_force and v_result.generation = v_generation_before then
    return query select
      v_result.organization_id,
      v_result.last_reset_at,
      v_result.next_reset_at,
      v_result.reset_interval_minutes,
      v_result.generation;
    return;
  end if;

  select o.id
  into v_platform_id
  from public.organizations o
  where o.subdomain = 'rallyhub-library'
  limit 1;

  -- The inner reset already removed the demo's groups. Recreate the source
  -- groups in their original creation order and map memberships through each
  -- installed game's source_template_id.
  for v_source_group in
    select gg.*
    from public.game_groups gg
    where gg.organization_id = v_platform_id
    order by gg.created_at, gg.id
  loop
    insert into public.game_groups(organization_id, name, created_at)
    values (p_organization_id, v_source_group.name, v_source_group.created_at)
    returning id into v_demo_group_id;

    insert into public.game_group_items(group_id, game_id)
    select v_demo_group_id, installed.id
    from public.game_group_items source_item
    join public.games installed
      on installed.organization_id = p_organization_id
      and installed.source_template_id = source_item.game_id
      and installed.deleted_at is null
    where source_item.group_id = v_source_group.id
    on conflict do nothing;
  end loop;

  select g.id
  into v_bingo_game_id
  from public.games g
  where g.organization_id = p_organization_id
    and g.type = 'music_bingo'
    and g.source_template_id is null
    and g.deleted_at is null
  order by g.created_at desc, g.id
  limit 1;

  if v_bingo_game_id is not null then
    select gg.id
    into v_bingo_group_id
    from public.game_groups gg
    where gg.organization_id = p_organization_id
      and lower(gg.name) = 'music bingo'
    order by gg.created_at, gg.id
    limit 1;

    if v_bingo_group_id is null then
      insert into public.game_groups(organization_id, name)
      values (p_organization_id, 'Music Bingo')
      returning id into v_bingo_group_id;
    end if;

    insert into public.game_group_items(group_id, game_id)
    values (v_bingo_group_id, v_bingo_game_id)
    on conflict do nothing;
  end if;

  return query select
    v_result.organization_id,
    v_result.last_reset_at,
    v_result.next_reset_at,
    v_result.reset_interval_minutes,
    v_result.generation;
end;
$$;

revoke all on function public.reset_demo_sandbox(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.reset_demo_sandbox(uuid, boolean)
  to service_role;

comment on function public.reset_demo_sandbox(uuid, boolean) is
  'Resets the public demo, including platform game groups and the demo-only Music Bingo group.';
