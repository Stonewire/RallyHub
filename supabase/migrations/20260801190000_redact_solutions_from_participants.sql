-- SEC: solution fields were returned to anyone holding a join token.
--
-- get_live_event_games is gated on the event's join token, which every
-- participant has. It returned games.solution_description and
-- games.solution_image_url verbatim. Nothing in the player UI renders them
-- (only the facilitator's SubmissionDetailModal reads them), so this was
-- obscured rather than exposed, but the bytes reached every participant's
-- browser and were readable from devtools. 86 games carried a solution at the
-- time this was found.
--
-- The facilitator loads games through this same RPC and genuinely needs the
-- solutions, so the columns cannot simply be dropped. They are now returned
-- only when the caller is an authenticated member of the event's organisation,
-- or platform staff. Participants join anonymously, so auth.uid() is null for
-- them and they receive nulls.
--
-- Verified after applying, by impersonating each case via request.jwt.claims:
--   anonymous participant  -> false
--   member of that org     -> true
--   member of another org  -> false
create or replace function public.caller_may_see_event_solutions(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and (p.organization_id = p_org_id or p.role = 'super_admin')
  );
$$;

revoke execute on function public.caller_may_see_event_solutions(uuid) from public;
grant execute on function public.caller_may_see_event_solutions(uuid) to authenticated, anon;

create or replace function public.get_live_event_games(p_event_id uuid)
returns table(
  id uuid, organization_id uuid, name text, type text, description text,
  cover_url text, points_type text, points_static integer, points_min integer,
  points_max integer, solution_description text, solution_image_url text,
  status text, config jsonb, is_default_for_new_clients boolean,
  is_platform_template boolean, source_template_id uuid, list_order integer,
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
$function$;
