-- R2.13: scope the tablet kiosk event list.
--
-- The previous definition (20260709165744) returned every event in status
-- active/ready/demo, including soft-deleted (bin) and wiped rows, because the
-- status filter predates events.deleted_at (085) and never checked wiped_at
-- (060). The kiosk is a join surface: a team can only join an event that is
-- actually running, so the list is now active + demo only, minus binned and
-- wiped rows, ordered by event date. Signature and return shape are unchanged,
-- so grants carry over via create or replace (restated below for clarity).

create or replace function public.get_tablet_events_for_org(
  p_org_id uuid,
  p_token text
)
returns table (
  id uuid,
  organization_id uuid,
  name text,
  event_date timestamptz,
  status text,
  team_count integer,
  branding_enabled boolean,
  logo_url text,
  brand_colors jsonb,
  teams_config jsonb,
  stages_config jsonb,
  display_layout text,
  display_text_color text,
  list_order integer,
  invoice_paid boolean,
  invoiced_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_org_id is null or nullif(trim(coalesce(p_token, '')), '') is null then
    raise exception 'Tablet session required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.tablet_sessions ts
    where ts.organization_id = p_org_id
      and ts.token = p_token
      and ts.expires_at > now()
  ) then
    raise exception 'Tablet session required' using errcode = '42501';
  end if;

  return query
  select
    e.id,
    e.organization_id,
    e.name,
    e.event_date,
    e.status,
    e.team_count,
    e.branding_enabled,
    e.logo_url,
    e.brand_colors,
    e.teams_config,
    e.stages_config,
    e.display_layout,
    e.display_text_color,
    e.list_order,
    e.invoice_paid,
    e.invoiced_at,
    e.created_at
  from public.events e
  where e.organization_id = p_org_id
    and e.status in ('active', 'demo')
    and e.deleted_at is null
    and e.wiped_at is null
  order by e.event_date asc nulls last, e.created_at asc;
end;
$$;

revoke execute on function public.get_tablet_events_for_org(uuid, text)
  from PUBLIC, anon, authenticated;
grant execute on function public.get_tablet_events_for_org(uuid, text)
  to anon, authenticated;

comment on function public.get_tablet_events_for_org(uuid, text) is
  'Tablet kiosk event list for an org. Requires a valid tablet_sessions token; active + demo events only, excludes binned (deleted_at) and wiped (wiped_at) rows; omits join_token.';
