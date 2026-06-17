-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE — Phase 2 security: per-event join token scoping
-- ═══════════════════════════════════════════════════════════════════════════
-- Adds join_token to events. Anon live panels bootstrap with event UUID only
-- (existing /join/:id URLs unchanged), receive a token, then send it on the
-- x-join-token header for scoped reads. Quiz correct answers are stripped from
-- live game config until reveal. music_catalog is no longer anon-readable.

-- ─── join_token on events ───────────────────────────────────────────────────

alter table public.events
  add column if not exists join_token text;

update public.events
set join_token = encode(gen_random_bytes(32), 'hex')
where join_token is null;

alter table public.events
  alter column join_token set not null;

create unique index if not exists events_join_token_idx on public.events (join_token);

-- ─── Helpers ──────────────────────────────────────────────────────────────

create or replace function public.current_live_join_token()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(trim((coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-join-token')), ''),
    nullif(trim((coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-rallyhub-join-token')), '')
  );
$$;

create or replace function public.live_join_token_matches_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.join_token = public.current_live_join_token()
  );
$$;

create or replace function public.quiz_question_answers_visible(
  p_quiz_state text,
  p_current_question_index integer,
  p_question_index integer
)
returns boolean
language sql
immutable
as $$
  select case
    when p_quiz_state in ('results', 'ended') then true
    when p_question_index < coalesce(p_current_question_index, 0) then true
    when p_quiz_state = 'revealed'
      and p_question_index = coalesce(p_current_question_index, 0) then true
    else false
  end;
$$;

create or replace function public.redact_game_config_for_live(
  p_config jsonb,
  p_game_type text,
  p_quiz_state text,
  p_current_question_index integer,
  p_bingo_state text
)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb := coalesce(p_config, '{}'::jsonb);
  questions jsonb;
  challenges jsonb;
  out_questions jsonb := '[]'::jsonb;
  out_challenges jsonb := '[]'::jsonb;
  i int;
  elem jsonb;
begin
  if p_game_type = 'quiz' then
    questions := coalesce(result -> 'questions', '[]'::jsonb);
    for i in 0 .. greatest(jsonb_array_length(questions) - 1, 0) loop
      elem := questions -> i;
      if public.quiz_question_answers_visible(
        coalesce(p_quiz_state, 'idle'),
        coalesce(p_current_question_index, 0),
        i
      ) then
        out_questions := out_questions || jsonb_build_array(elem);
      else
        out_questions := out_questions || jsonb_build_array(elem - 'correctAnswerId');
      end if;
    end loop;
    result := jsonb_set(result, '{questions}', out_questions, true);
  elsif p_game_type = 'text' then
    result := result - 'correctAnswerId' - 'correctAnswers';
  elsif p_game_type = 'music_bingo' then
    if coalesce(p_bingo_state, 'waiting') is distinct from 'bonus_revealed' then
      challenges := coalesce(result -> 'bonus_challenges', '[]'::jsonb);
      for i in 0 .. greatest(jsonb_array_length(challenges) - 1, 0) loop
        elem := challenges -> i;
        out_challenges := out_challenges || jsonb_build_array(elem - 'correctAnswerId');
      end loop;
      result := jsonb_set(result, '{bonus_challenges}', out_challenges, true);
    end if;
  end if;
  return result;
end;
$$;

-- Bootstrap: event UUID in URL only (no URL change). Returns token for header.
create or replace function public.bootstrap_live_event_access(p_event_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select e.join_token
  from public.events e
  where e.id = p_event_id
  limit 1;
$$;

-- Live games with redacted config (C3).
-- Explicit return shape (not SETOF games): physical column order differs from the
-- logical API shape once 004/011 columns were added after created_at.
drop function if exists public.get_live_event_games(uuid);

create or replace function public.get_live_event_games(p_event_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  name text,
  type text,
  description text,
  cover_url text,
  points_type text,
  points_static integer,
  points_min integer,
  points_max integer,
  solution_description text,
  solution_image_url text,
  status text,
  config jsonb,
  is_default_for_new_clients boolean,
  is_platform_template boolean,
  source_template_id uuid,
  list_order integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id,
    g.organization_id,
    g.name,
    g.type,
    g.description,
    g.cover_url,
    g.points_type,
    g.points_static,
    g.points_min,
    g.points_max,
    g.solution_description,
    g.solution_image_url,
    g.status,
    public.redact_game_config_for_live(
      g.config,
      g.type,
      es.quiz_state,
      es.current_question_index,
      es.bingo_state
    ) as config,
    g.is_default_for_new_clients,
    g.is_platform_template,
    g.source_template_id,
    g.list_order,
    g.created_at
  from public.event_games eg
  join public.games g on g.id = eg.game_id
  join public.events e on e.id = eg.event_id
  left join public.event_state es on es.event_id = e.id
  where eg.event_id = p_event_id
    and e.join_token = public.current_live_join_token();
$$;

-- Server-side quiz scoring (reads full answers from DB; client config stays redacted).
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
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access denied';
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

-- Tablet event list (org-scoped; not join-token scoped).
drop function if exists public.get_tablet_events_for_org(uuid);

create or replace function public.get_tablet_events_for_org(p_org_id uuid)
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
language sql
stable
security definer
set search_path = public
as $$
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
    and e.status in ('active', 'ready', 'demo')
  order by e.event_date asc nulls last;
$$;

grant execute on function public.bootstrap_live_event_access(uuid) to anon, authenticated;
grant execute on function public.get_live_event_games(uuid) to anon, authenticated;
grant execute on function public.score_current_quiz_question(uuid, uuid, text) to anon, authenticated;
grant execute on function public.get_tablet_events_for_org(uuid) to anon, authenticated;

-- ─── Drop broad anon read policies (H12, C3) ─────────────────────────────

drop policy if exists "events_live_select" on public.events;
drop policy if exists "event_games_live_select" on public.event_games;
drop policy if exists "games_live_select" on public.games;
drop policy if exists "music_catalog_live_select" on public.music_catalog;

revoke select on public.music_catalog from anon;

-- ─── Scoped anon SELECT (join token required) ─────────────────────────────

create policy "events_anon_select_join_token"
on public.events for select to anon
using (join_token = public.current_live_join_token());

create policy "event_games_anon_select_join_token"
on public.event_games for select to anon
using (public.live_join_token_matches_event(event_id));

create policy "games_anon_select_join_token"
on public.games for select to anon
using (
  exists (
    select 1
    from public.event_games eg
    join public.events e on e.id = eg.event_id
    where eg.game_id = games.id
      and e.join_token = public.current_live_join_token()
  )
);

-- ─── Scope live gameplay tables: anon by join token, authenticated by org ───

drop policy if exists "teams_live_all" on public.teams;
create policy "teams_anon_join_token"
on public.teams for all to anon
using (public.live_join_token_matches_event(event_id))
with check (public.live_join_token_matches_event(event_id));
create policy "teams_authenticated_org"
on public.teams for all to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = teams.event_id
      and (
        e.organization_id = public.user_organization_id()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'super_admin'
        )
      )
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = teams.event_id
      and (
        e.organization_id = public.user_organization_id()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'super_admin'
        )
      )
  )
);

drop policy if exists "submissions_live_all" on public.submissions;
create policy "submissions_anon_join_token"
on public.submissions for all to anon
using (public.live_join_token_matches_event(event_id))
with check (public.live_join_token_matches_event(event_id));
create policy "submissions_authenticated_org"
on public.submissions for all to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = submissions.event_id
      and (
        e.organization_id = public.user_organization_id()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'super_admin'
        )
      )
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = submissions.event_id
      and (
        e.organization_id = public.user_organization_id()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'super_admin'
        )
      )
  )
);

drop policy if exists "event_state_live_all" on public.event_state;
create policy "event_state_anon_join_token"
on public.event_state for all to anon
using (public.live_join_token_matches_event(event_id))
with check (public.live_join_token_matches_event(event_id));
create policy "event_state_authenticated_org"
on public.event_state for all to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = event_state.event_id
      and (
        e.organization_id = public.user_organization_id()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'super_admin'
        )
      )
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = event_state.event_id
      and (
        e.organization_id = public.user_organization_id()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'super_admin'
        )
      )
  )
);

drop policy if exists "chat_messages_live_all" on public.chat_messages;
create policy "chat_messages_anon_join_token"
on public.chat_messages for all to anon
using (public.live_join_token_matches_event(event_id))
with check (public.live_join_token_matches_event(event_id));
create policy "chat_messages_authenticated_org"
on public.chat_messages for all to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = chat_messages.event_id
      and (
        e.organization_id = public.user_organization_id()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'super_admin'
        )
      )
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = chat_messages.event_id
      and (
        e.organization_id = public.user_organization_id()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'super_admin'
        )
      )
  )
);

comment on column public.events.join_token is
  'Secret scoped to event link; sent on x-join-token after bootstrap_live_event_access.';
comment on function public.bootstrap_live_event_access(uuid) is
  'Returns join_token for a known event id (preserves /join/:uuid URLs).';
comment on function public.get_live_event_games(uuid) is
  'Live panel games with quiz/bonus answers redacted until reveal (C3).';
