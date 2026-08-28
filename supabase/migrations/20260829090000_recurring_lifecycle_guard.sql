-- FIX: "Start next run" always failed with "has been activated and billed.
-- Only archiving is allowed." The BEFORE UPDATE guard
-- event_status_lifecycle_guard (billed events may only archive) predates
-- recurring events and blocked both the restart RPC's flip to 'ready' AND the
-- later re-activation of a re-armed run. The Phase 6 scoping missed it.
--
-- Fix in two halves:
--   1. The guard learns the ONE sanctioned recurring shape: a recurring event
--      whose activated_at was already null BEFORE this write and whose
--      invoices are all superseded may change status again. That combination
--      only exists after restart_recurring_event ran (it supersedes every
--      invoice and nulls activated_at); manually nulling activated_at leaves
--      a non-superseded invoice behind, so free reruns stay blocked.
--   2. restart_recurring_event splits its final write: first clear
--      activated_at (no status change, guard does not engage), then set
--      status = 'ready' (guard sees the sanctioned shape and allows it).
--      The later ready -> active activation passes the same exemption, and
--      the AFTER billing trigger then raises the fresh invoice and re-stamps
--      activated_at, closing the shape again.

create or replace function public.trg_event_status_lifecycle_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.invoiced_at is not null
     and new.status is distinct from old.status
     and new.status <> 'archived' then
    -- P6.4: re-armed recurring events move again (see file header).
    if new.recurring
       and old.activated_at is null
       and not exists (
         select 1 from public.invoices i
         where i.event_id = old.id and i.superseded = false
       ) then
      return new;
    end if;
    raise exception
      'Event % has been activated and billed. Only archiving is allowed. Duplicate the event to run it again.',
      old.id
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- restart_recurring_event, re-created from 20260827180000 with ONE change:
-- the final events update is split so the lifecycle guard can verify the
-- sanctioned shape (see header). Everything else is byte-identical.
create or replace function public.restart_recurring_event(p_event_id uuid)
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
    invoice_paid = false
  where id = p_event_id;

  update public.events
  set status = 'ready'
  where id = p_event_id;
end;
$$;

revoke execute on function public.restart_recurring_event(uuid) from public, anon;
grant execute on function public.restart_recurring_event(uuid) to authenticated;

notify pgrst, 'reload schema';
