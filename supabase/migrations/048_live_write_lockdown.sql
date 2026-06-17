-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE — Phase 3 security: lock down live table writes (C1/C2)
-- ═══════════════════════════════════════════════════════════════════════════
-- Anon + join token: participant reads + own actions only.
-- Authenticated facilitator (facilitator / client_admin / super_admin): privileged writes.
-- Authenticated org staff (incl. event_manager): event setup (team slots, event_state bootstrap).

-- ─── Helpers ───────────────────────────────────────────────────────────────

create or replace function public.is_org_member_for_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    join public.profiles p on p.id = auth.uid()
    where e.id = p_event_id
      and (
        p.role = 'super_admin'
        or p.organization_id = e.organization_id
      )
  );
$$;

create or replace function public.is_facilitator_for_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    join public.profiles p on p.id = auth.uid()
    where e.id = p_event_id
      and (
        p.role = 'super_admin'
        or (
          p.organization_id = e.organization_id
          and p.role in ('facilitator', 'client_admin')
        )
      )
  );
$$;

create or replace function public.is_org_staff_for_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    join public.profiles p on p.id = auth.uid()
    where e.id = p_event_id
      and (
        p.role = 'super_admin'
        or (
          p.organization_id = e.organization_id
          and p.role in ('client_admin', 'event_manager')
        )
      )
  );
$$;

create or replace function public.live_bingo_run_matches_token(p_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bingo_runs r
    where r.id = p_run_id
      and public.live_join_token_matches_event(r.event_id)
  );
$$;

-- ─── Triggers: column-level guard for anon participant writes ─────────────

create or replace function public.teams_guard_participant_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() = 'anon' then
    if NEW.score is distinct from OLD.score
       or NEW.color is distinct from OLD.color
       or NEW.slot_number is distinct from OLD.slot_number
       or NEW.event_id is distinct from OLD.event_id
    then
      raise exception 'Participants cannot modify protected team fields';
    end if;

    if NEW.status is distinct from OLD.status then
      if not (OLD.status = 'idle' and NEW.status = 'active') then
        raise exception 'Participants can only activate their team slot';
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists teams_guard_participant_update on public.teams;
create trigger teams_guard_participant_update
before update on public.teams
for each row
execute function public.teams_guard_participant_update();

create or replace function public.submissions_guard_participant_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() = 'anon' then
    if TG_OP = 'INSERT' then
      if NEW.status is distinct from 'pending' then
        raise exception 'Submissions must start as pending';
      end if;
      if NEW.points_awarded is not null then
        raise exception 'Participants cannot set points';
      end if;
      return NEW;
    end if;

    if NEW.status is distinct from OLD.status then
      if not (OLD.status = 'pending' and NEW.status = 'cancelled') then
        raise exception 'Participants can only cancel pending submissions';
      end if;
    end if;

    if NEW.points_awarded is distinct from OLD.points_awarded then
      raise exception 'Participants cannot set points';
    end if;

    if NEW.team_id is distinct from OLD.team_id
       or NEW.event_id is distinct from OLD.event_id
       or NEW.game_id is distinct from OLD.game_id
    then
      raise exception 'Participants cannot reassign submissions';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists submissions_guard_participant_write on public.submissions;
create trigger submissions_guard_participant_write
before insert or update on public.submissions
for each row
execute function public.submissions_guard_participant_write();

-- ─── Privileged RPCs ───────────────────────────────────────────────────────

create or replace function public.increment_team_score(p_team_id uuid, p_delta int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select t.event_id into v_event_id
  from public.teams t
  where t.id = p_team_id;

  if v_event_id is null then
    raise exception 'Team not found';
  end if;

  if not public.is_facilitator_for_event(v_event_id) then
    raise exception 'Facilitator access required';
  end if;

  update public.teams
  set score = score + p_delta
  where id = p_team_id;
end;
$$;

create or replace function public.score_current_quiz_question(
  p_event_id uuid,
  p_game_id uuid,
  p_question_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config jsonb;
  v_points integer;
  v_correct text;
  v_media_type text;
  rec record;
  v_awarded integer;
begin
  if not public.is_facilitator_for_event(p_event_id) then
    raise exception 'Facilitator access required';
  end if;

  select g.config, coalesce(g.points_static, 10)
  into v_config, v_points
  from public.games g
  where g.id = p_game_id;

  select elem ->> 'correctAnswerId'
  into v_correct
  from jsonb_array_elements(coalesce(v_config -> 'questions', '[]'::jsonb)) elem
  where elem ->> 'id' = p_question_id
  limit 1;

  v_media_type := 'quiz:' || p_question_id;

  for rec in
    select s.id, s.team_id, s.media_url
    from public.submissions s
    where s.event_id = p_event_id
      and s.game_id = p_game_id
      and s.media_type = v_media_type
      and s.status = 'pending'
  loop
    v_awarded := case when rec.media_url is not distinct from v_correct then v_points else 0 end;
    update public.submissions
    set status = 'approved', points_awarded = v_awarded
    where id = rec.id and status = 'pending';

    if found and v_awarded > 0 then
      perform public.increment_team_score(rec.team_id, v_awarded);
    end if;
  end loop;
end;
$$;

-- ─── Drop Phase 2 broad live policies ──────────────────────────────────────

drop policy if exists "teams_anon_join_token" on public.teams;
drop policy if exists "teams_authenticated_org" on public.teams;
drop policy if exists "submissions_anon_join_token" on public.submissions;
drop policy if exists "submissions_authenticated_org" on public.submissions;
drop policy if exists "event_state_anon_join_token" on public.event_state;
drop policy if exists "event_state_authenticated_org" on public.event_state;
drop policy if exists "chat_messages_anon_join_token" on public.chat_messages;
drop policy if exists "chat_messages_authenticated_org" on public.chat_messages;
drop policy if exists "bingo_runs_live_select" on public.bingo_runs;
drop policy if exists "bingo_runs_live_update" on public.bingo_runs;
drop policy if exists "bingo_runs_live_insert" on public.bingo_runs;
drop policy if exists "bingo_runs_live_delete" on public.bingo_runs;
drop policy if exists "bingo_team_cards_live_select" on public.bingo_team_cards;
drop policy if exists "bingo_team_cards_live_insert" on public.bingo_team_cards;

-- ─── teams ─────────────────────────────────────────────────────────────────

create policy "teams_anon_select_join_token"
on public.teams for select to anon
using (public.live_join_token_matches_event(event_id));

create policy "teams_anon_update_claim"
on public.teams for update to anon
using (public.live_join_token_matches_event(event_id))
with check (public.live_join_token_matches_event(event_id));

create policy "teams_authenticated_select_org"
on public.teams for select to authenticated
using (public.is_org_member_for_event(event_id));

create policy "teams_authenticated_insert_setup"
on public.teams for insert to authenticated
with check (public.is_org_staff_for_event(event_id));

create policy "teams_authenticated_delete_setup"
on public.teams for delete to authenticated
using (public.is_org_staff_for_event(event_id));

create policy "teams_authenticated_update_facilitator"
on public.teams for update to authenticated
using (public.is_facilitator_for_event(event_id))
with check (public.is_facilitator_for_event(event_id));

-- ─── event_state ───────────────────────────────────────────────────────────

create policy "event_state_anon_select_join_token"
on public.event_state for select to anon
using (public.live_join_token_matches_event(event_id));

create policy "event_state_authenticated_select_org"
on public.event_state for select to authenticated
using (public.is_org_member_for_event(event_id));

create policy "event_state_authenticated_insert_setup"
on public.event_state for insert to authenticated
with check (
  public.is_org_staff_for_event(event_id)
  or public.is_facilitator_for_event(event_id)
);

create policy "event_state_authenticated_update_facilitator"
on public.event_state for update to authenticated
using (public.is_facilitator_for_event(event_id))
with check (public.is_facilitator_for_event(event_id));

-- ─── submissions ───────────────────────────────────────────────────────────

create policy "submissions_anon_select_join_token"
on public.submissions for select to anon
using (public.live_join_token_matches_event(event_id));

create policy "submissions_anon_insert_own"
on public.submissions for insert to anon
with check (public.live_join_token_matches_event(event_id));

create policy "submissions_anon_update_own"
on public.submissions for update to anon
using (public.live_join_token_matches_event(event_id))
with check (public.live_join_token_matches_event(event_id));

create policy "submissions_authenticated_select_org"
on public.submissions for select to authenticated
using (public.is_org_member_for_event(event_id));

create policy "submissions_authenticated_update_facilitator"
on public.submissions for update to authenticated
using (public.is_facilitator_for_event(event_id))
with check (public.is_facilitator_for_event(event_id));

create policy "submissions_authenticated_delete_facilitator"
on public.submissions for delete to authenticated
using (public.is_facilitator_for_event(event_id));

-- ─── chat_messages ─────────────────────────────────────────────────────────

create policy "chat_messages_anon_select_join_token"
on public.chat_messages for select to anon
using (public.live_join_token_matches_event(event_id));

create policy "chat_messages_anon_insert_join_token"
on public.chat_messages for insert to anon
with check (public.live_join_token_matches_event(event_id));

create policy "chat_messages_authenticated_select_org"
on public.chat_messages for select to authenticated
using (public.is_org_member_for_event(event_id));

create policy "chat_messages_authenticated_insert_facilitator"
on public.chat_messages for insert to authenticated
with check (public.is_facilitator_for_event(event_id));

-- ─── bingo_runs ────────────────────────────────────────────────────────────

create policy "bingo_runs_anon_select_join_token"
on public.bingo_runs for select to anon
using (public.live_join_token_matches_event(event_id));

create policy "bingo_runs_authenticated_select_org"
on public.bingo_runs for select to authenticated
using (public.is_org_member_for_event(event_id));

create policy "bingo_runs_authenticated_insert_facilitator"
on public.bingo_runs for insert to authenticated
with check (public.is_facilitator_for_event(event_id));

create policy "bingo_runs_authenticated_update_facilitator"
on public.bingo_runs for update to authenticated
using (public.is_facilitator_for_event(event_id))
with check (public.is_facilitator_for_event(event_id));

create policy "bingo_runs_authenticated_delete_facilitator"
on public.bingo_runs for delete to authenticated
using (public.is_facilitator_for_event(event_id));

-- ─── bingo_team_cards ──────────────────────────────────────────────────────

create policy "bingo_team_cards_anon_select_join_token"
on public.bingo_team_cards for select to anon
using (public.live_bingo_run_matches_token(run_id));

create policy "bingo_team_cards_authenticated_select_org"
on public.bingo_team_cards for select to authenticated
using (
  exists (
    select 1
    from public.bingo_runs r
    where r.id = bingo_team_cards.run_id
      and public.is_org_member_for_event(r.event_id)
  )
);

create policy "bingo_team_cards_authenticated_insert_facilitator"
on public.bingo_team_cards for insert to authenticated
with check (
  exists (
    select 1
    from public.bingo_runs r
    where r.id = bingo_team_cards.run_id
      and public.is_facilitator_for_event(r.event_id)
  )
);

-- ─── Table grants (match RLS intent) ───────────────────────────────────────

revoke all on public.teams from anon;
grant select, update on public.teams to anon;

revoke all on public.submissions from anon;
grant select, insert, update on public.submissions to anon;

revoke all on public.event_state from anon;
grant select on public.event_state to anon;

revoke all on public.chat_messages from anon;
grant select, insert on public.chat_messages to anon;

revoke all on public.bingo_runs from anon;
grant select on public.bingo_runs to anon;

revoke all on public.bingo_team_cards from anon;
grant select on public.bingo_team_cards to anon;

revoke execute on function public.increment_team_score(uuid, int) from anon;
revoke execute on function public.score_current_quiz_question(uuid, uuid, text) from anon;
grant execute on function public.score_current_quiz_question(uuid, uuid, text) to authenticated;

comment on function public.is_facilitator_for_event(uuid) is
  'Authenticated facilitator, client_admin of org, or super_admin for live privileged writes.';
comment on function public.is_org_staff_for_event(uuid) is
  'Org client_admin or event_manager (or super_admin) for event setup writes (team slots, event_state bootstrap).';
