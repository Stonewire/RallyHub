-- The live bundle redacted every game's answers for everyone, including the
-- signed-in facilitator running the event. That is why the submission review
-- modal could never show the correct answer for a text game: the answer had
-- already been stripped out of `config` before the browser saw it, so the
-- facilitator had to open the game in the admin panel to check an answer
-- mid-event (Rumen, 9 Aug 2026).
--
-- Redaction exists to keep answers out of the players' network payload, and
-- players are anonymous. Reuse the gate that already protects
-- solution_description: org members (and super admins) get the real config,
-- everyone else keeps the redacted one. Participants and the display screen
-- are anonymous, so nothing changes for them.
create or replace function public.get_live_event_games(p_event_id uuid)
returns table(
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
  created_at timestamp with time zone
)
language sql
stable
security definer
set search_path to 'public'
as $function$
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
    case when public.caller_may_see_event_solutions(e.organization_id)
         then g.solution_description else null end,
    case when public.caller_may_see_event_solutions(e.organization_id)
         then g.solution_image_url else null end,
    g.status,
    case
      when public.caller_may_see_event_solutions(e.organization_id) then g.config
      else public.redact_game_config_for_live(
        g.config,
        g.type,
        es.quiz_state,
        es.current_question_index,
        es.bingo_state
      )
    end as config,
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
$function$;

-- create or replace keeps existing grants, but be explicit: this function is
-- called from both the anonymous player path and signed-in staff sessions.
grant execute on function public.get_live_event_games(uuid) to anon, authenticated;
