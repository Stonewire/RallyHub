-- Reset live gameplay data for pre-activation events (draft / ready / demo only).

create or replace function public.reset_event_data(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select e.status, e.organization_id
  into v_status, v_org_id
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found';
  end if;

  if v_status not in ('draft', 'ready', 'demo') then
    raise exception 'Reset is only allowed for draft, ready, or demo events';
  end if;

  if v_org_id is distinct from public.user_organization_id()
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  then
    raise exception 'Not authorized to reset this event';
  end if;

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
      updated_at = now()
    where event_id = p_event_id;
  else
    insert into public.event_state (event_id)
    values (p_event_id);
  end if;
end;
$$;

grant execute on function public.reset_event_data(uuid) to authenticated;

comment on function public.reset_event_data(uuid) is
  'Clears teams, submissions, chat, bingo runs/cards, and live state for draft/ready/demo events.';
