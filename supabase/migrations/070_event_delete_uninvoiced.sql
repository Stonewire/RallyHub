-- Fix "delete event didn't work":
--   1. Old wipe_event_data only accepted status='archived' → deleting a
--      draft/ready/demo/active event threw "Only archived events can be deleted".
--   2. It always kept the event row, so even archived events that were never
--      billed lingered in the DB.
--
-- New behaviour (same RPC name; frontend unchanged):
--   - Never-invoiced events (invoiced_at IS NULL): fully delete the event row.
--   - Invoiced events: wipe live data, keep the row for payment history
--     (drops out of the list via the wiped_at filter).
-- Status no longer gates deletion — the UI confirm dialog is the guard.

create or replace function public.wipe_event_data(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoiced_at timestamptz;
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select e.invoiced_at, e.organization_id
  into v_invoiced_at, v_org_id
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found';
  end if;

  -- super_admin can delete any org's event; client_admin only their own.
  if v_org_id is distinct from public.user_organization_id()
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  then
    raise exception 'Not authorized to delete this event';
  end if;

  -- Remove all live/child data explicitly (don't rely on cascade ordering).
  delete from public.event_activity_log where event_id = p_event_id;
  delete from public.chat_messages       where event_id = p_event_id;
  delete from public.submissions         where event_id = p_event_id;
  delete from public.bingo_team_cards
    where run_id in (select id from public.bingo_runs where event_id = p_event_id);
  delete from public.bingo_runs  where event_id = p_event_id;
  delete from public.teams       where event_id = p_event_id;
  delete from public.event_state where event_id = p_event_id;
  delete from public.event_games where event_id = p_event_id;

  if v_invoiced_at is not null then
    -- Billing record: keep the event row (leaves the list via wiped_at).
    update public.events set wiped_at = now() where id = p_event_id;
  else
    -- Never invoiced: fully delete. invoices cascade, promo redemptions set null.
    delete from public.events where id = p_event_id;
  end if;
end;
$$;

grant execute on function public.wipe_event_data(uuid) to authenticated;

comment on function public.wipe_event_data(uuid) is
  'Deletes an event: hard-deletes never-invoiced events; wipes live data but keeps the row for invoiced events (payment history).';
