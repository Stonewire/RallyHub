-- Starting a new run can now set the event's date.
--
-- The restart cleared activated_at and invoice_paid and flipped the status back
-- to ready, but never touched event_date, so run 2 kept run 1's date. That is
-- not cosmetic: event_date sorts the events list (use-events.ts), drives its
-- date filter (EventsPage.tsx), decides what the staff panel counts as an
-- upcoming event (use-rallyhub.ts), and is printed on the invoice
-- (EventInvoiceList.tsx). A re-armed event therefore sat among last month's
-- events, fell out of a "this month" filter, and billed run 2 under run 1's
-- date, until somebody noticed and edited it by hand.
--
-- p_set_event_date is a separate flag rather than treating null as "clear", so
-- a browser still running the old one-argument build keeps the previous
-- behaviour (date untouched) instead of silently wiping the date. With the flag
-- set, a null p_event_date deliberately clears the date to "not set", which is
-- honest about not knowing yet; the stale value is never kept silently.
--
-- The body below is the 20260829090000 definition unchanged apart from the
-- signature and that one column.

-- Adding defaulted parameters creates a SECOND function rather than replacing
-- the first, and PostgREST would then have two candidates for a one-argument
-- call. Drop the old signature so exactly one remains; a browser still running
-- the old build keeps working, because its single named argument resolves to
-- this function through the defaults.
drop function if exists public.restart_recurring_event(uuid);

create or replace function public.restart_recurring_event(
  p_event_id uuid,
  p_event_date timestamptz default null,
  p_set_event_date boolean default false
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_invoice public.invoices%rowtype;
  v_unpaid_count integer;
  v_occurrence_number integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select e.* into v_event
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found';
  end if;

  if v_event.organization_id is distinct from public.user_organization_id()
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  then
    raise exception 'Not authorized to restart this event';
  end if;

  if not v_event.recurring then
    raise exception 'Only recurring events can be restarted';
  end if;

  if v_event.status = 'active' then
    raise exception 'This event is live. End the current run before starting the next one.';
  end if;

  if v_event.activated_at is null then
    raise exception 'This event has not run yet. Activate it as usual.';
  end if;

  select i.* into v_invoice
  from public.invoices i
  where i.event_id = p_event_id
    and i.superseded = false
    and i.kind = 'activation';

  select count(*) into v_unpaid_count
  from public.invoices i
  where i.event_id = p_event_id
    and i.superseded = false
    and i.status = 'unpaid';

  if v_unpaid_count > 0 then
    raise exception 'UNPAID_INVOICE: Settle this event''s invoice before starting the next run.'
      using errcode = 'check_violation';
  end if;

  select count(*) + 1 into v_occurrence_number
  from public.event_occurrences
  where event_id = p_event_id;

  insert into public.event_occurrences (
    event_id,
    organization_id,
    occurrence_number,
    activated_at,
    invoice_id
  ) values (
    p_event_id,
    v_event.organization_id,
    v_occurrence_number,
    v_event.activated_at,
    v_invoice.id
  );

  update public.invoices
  set superseded = true
  where event_id = p_event_id
    and superseded = false;

  delete from public.chat_messages where event_id = p_event_id;
  delete from public.submissions where event_id = p_event_id;

  delete from public.bingo_team_cards
  where run_id in (
    select id from public.bingo_runs where event_id = p_event_id
  );

  delete from public.bingo_runs where event_id = p_event_id;
  delete from public.teams where event_id = p_event_id;

  if exists (select 1 from public.event_state where event_id = p_event_id) then
    update public.event_state
    set
      current_stage_index = 0,
      current_question_index = 0,
      timer_seconds = 7200,
      timer_running = false,
      quiz_timer_seconds = null,
      quiz_timer_running = false,
      show_scores = true,
      show_timer_on_display = true,
      hide_team_points = false,
      quiz_state = 'idle',
      bingo_state = 'waiting',
      bingo_revealed_track_ids = '[]'::jsonb,
      bingo_winner_team_id = null,
      bingo_announced_winner_ids = '[]'::jsonb,
      bingo_bonus_id = null,
      announcement = null,
      announcement_target = null,
      winner_reveal_stage = 0,
      break_timer_seconds = null,
      break_timer_running = false,
      submissions_open = true,
      store_open = true,
      updated_at = now()
    where event_id = p_event_id;
  else
    insert into public.event_state (event_id)
    values (p_event_id);
  end if;

  -- Split write: clear activated_at first (no status change, the lifecycle
  -- guard does not engage), then flip the status so the guard can verify the
  -- sanctioned re-armed shape. invoiced_at deliberately stays (delete-history
  -- safety, 20260827180000).
  update public.events
  set
    activated_at = null,
    invoice_paid = false,
    event_date = case when p_set_event_date then p_event_date else event_date end
  where id = p_event_id;

  update public.events
  set status = 'ready'
  where id = p_event_id;
end;
$$;

revoke execute on function public.restart_recurring_event(uuid, timestamptz, boolean)
  from public, anon;
grant execute on function public.restart_recurring_event(uuid, timestamptz, boolean)
  to authenticated;

comment on function public.restart_recurring_event(uuid, timestamptz, boolean) is
  'Re-arms a recurring event for its next run: snapshots the finished run into event_occurrences, supersedes its invoices, wipes teams/submissions/chat/bingo, resets event_state, clears activated_at and invoice_paid, and sets status back to ready. Pass p_set_event_date true to write p_event_date (null clears the date to "not set"); left false the date is untouched.';
