-- Expand the public demo from a representative subset to the complete platform
-- game library, then add a self-contained CC0 Music Bingo experience.

alter function public.reset_demo_sandbox(uuid, boolean)
  rename to reset_demo_sandbox_base;

revoke all on function public.reset_demo_sandbox_base(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.reset_demo_sandbox_base(uuid, boolean)
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
  v_template public.games%rowtype;
  v_new_game_id uuid;
  v_bingo_game uuid;
  v_quiz_count integer;
  v_event_index integer := 0;
  v_event record;
  v_event_open_game_ids uuid[];
  v_event_quiz_game uuid;
  v_photo_game uuid;
  v_video_game uuid;
  v_text_game uuid;
  v_puzzle_game uuid;
  v_showcase_game_ids uuid[];
  v_stages jsonb;
  v_tracks jsonb;
  v_clip_base_url text :=
    'https://rlnnhgnuprtatmhqxirb.supabase.co/storage/v1/object/public/game-assets/demo-stock-music/holizna-cc0/';
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
  from public.reset_demo_sandbox_base(p_organization_id, p_force);

  -- A normal session call may only be reading the existing reset deadline.
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

  -- The base reset installs its first representative batch. Add every other
  -- active platform template so each reset also picks up image/config changes.
  for v_template in
    select g.*
    from public.games g
    where g.organization_id = v_platform_id
      and g.is_platform_template
      and g.deleted_at is null
      and g.status = 'active'
      and not exists (
        select 1
        from public.games installed
        where installed.organization_id = p_organization_id
          and installed.source_template_id = g.id
      )
    order by g.list_order, g.created_at, g.id
  loop
    insert into public.games (
      organization_id, name, type, description, cover_url, points_type,
      points_static, points_min, points_max, solution_description,
      solution_image_url, status, config, is_default_for_new_clients,
      is_platform_template, source_template_id, list_order
    ) values (
      p_organization_id, v_template.name, v_template.type,
      v_template.description, v_template.cover_url, v_template.points_type,
      v_template.points_static, v_template.points_min, v_template.points_max,
      v_template.solution_description, v_template.solution_image_url,
      'active', v_template.config, false, false, v_template.id,
      v_template.list_order
    )
    returning id into v_new_game_id;

    insert into demo_game_map(source_id, installed_id, game_type, list_order)
    values (v_template.id, v_new_game_id, v_template.type, v_template.list_order);
  end loop;

  -- Twenty-five 30-second clips from HoliznaCC0's Public Domain Lofi album.
  -- Album: https://freemusicarchive.org/music/holiznacc0/public-domain-lofi
  -- License: https://creativecommons.org/publicdomain/zero/1.0/
  insert into public.music_catalog (
    organization_id, artist, title, audio_url, clip_url,
    clip_start_seconds, clip_duration_seconds, duration_seconds,
    source_filename, genre, parse_confidence, license_confirmed_at
  )
  select
    p_organization_id,
    'HoliznaCC0',
    stock.title,
    'https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/' || stock.source_file,
    v_clip_base_url || stock.source_id || '-' || stock.slug || '-30s.mp3',
    0,
    30,
    null,
    'fma-cc0:' || stock.source_id,
    'Lo-fi',
    1,
    clock_timestamp()
  from (values
    ('242429', 'One Night In France', 'one-night-in-france', 'hgY8pG5KicULRbUJjUVavqs1h53lNSHdLptPoCwS.mp3'),
    ('243304', 'Tranquil Mindscape', 'tranquil-mindscape', 'uxGaqYrlWHy1w4jA6fJki0NlNx6xkkFG5BMwI8JN.mp3'),
    ('238387', 'When Time Called Me Darling', 'when-time-called-me-darling', '3Jox99wj2ur7YR7O1ug3fdP8NdOOpmHfVPFBRhq5.mp3'),
    ('243029', 'Canon Event', 'canon-event', 'GLpVlXSJolOAOZSAMyf5ONpjKXfnnKbugQhR7GxD.mp3'),
    ('265871', 'Fractured', 'fractured', 'OKTeJladHnsapUepN68pWvlah2q7hLd7FlDHO15U.mp3'),
    ('245667', 'Still Life', 'still-life', 'X2xAunfMENT4KSm1XpnQC2qUUC4hcMVbDXBMw9GI.mp3'),
    ('265835', 'Calm Currents', 'calm-currents', '4rKapZUMNnNSPAOvpjlfSH6B5Ib8rgEWdvjnM7C6.mp3'),
    ('243511', 'Bubbles', 'bubbles', 'zh5usndkyEfVvKOz8dvsrCd1Ga0jfz4xIcLUendD.mp3'),
    ('243030', 'Moon Unit', 'moon-unit', 'CbNZO1QUuJq1f50RHzZ5kykNj1hdqT04UaWOYSNf.mp3'),
    ('265877', 'Ghost Town', 'ghost-town', 'cR9QozfFah1QF4bmIg150gJsibgGDA3EX4m7Iova.mp3'),
    ('243512', 'Lucid', 'lucid', 'je7RethXWuduCoRV6Gq3w25yDXvxYnnOWt5OGlgv.mp3'),
    ('243305', 'Tokyo Sunset', 'tokyo-sunset', 'Xnd9Hr5AVzB68IlWcImKtXPlwCePD2G2m8ZFSVj4.mp3'),
    ('265836', 'Peaceful Drift', 'peaceful-drift', 'SQvtLguk6S1VSthv0oXWycoB6ipUS0pt8jzAxxPq.mp3'),
    ('238388', 'Waiting Around', 'waiting-around', 'aVNvUkfJVw1NI9zHSC3I8d760YbwCt31a3Wi6Ydl.mp3'),
    ('245668', 'Theta Frequency', 'theta-frequency', 'rSIDyunfJfiKNelwFuwbGKoLj5TO8eHFbdSa1zAb.mp3'),
    ('265878', 'Going Home', 'going-home', 'QdFLnSYEYDIThwBrSukcnPloklLuCyXGkkwYclJE.mp3'),
    ('238389', 'Shimmer', 'shimmer', 'JX8dB2Y2tCty4tibXtqqd04m1IVgPegvzOeLOSzP.mp3'),
    ('265837', 'Reminders', 'reminders', 'r7Y9jjWggY2LIKonpPhkYrAQNJgm2daRHr5Kcc0I.mp3'),
    ('265838', 'Walking Away', 'walking-away', 'WOtcP3GhbgTD8CuC6sEgpQOEXMyNeXYbTNmHjgN6.mp3'),
    ('265874', 'Nine To Death', 'nine-to-death', 'NeWWEvcW3OV64fNtbkF0wOElg3SMeTW7Hv1Lutzq.mp3'),
    ('238390', 'Warm Fuzz', 'warm-fuzz', 'Qrd0JkjTC7XXJwtS6LvCHIJ9K1FLXewdrYOQHhc5.mp3'),
    ('238391', 'When I Was Human', 'when-i-was-human', 'ChrX4PnONgrlvh9m2tgYBpK7mwnbfpLJoo36OOFW.mp3'),
    ('265880', 'One Good Day', 'one-good-day', 'AQCAheI92mWqsSgQeYLB6CZ3J1hiaGZgtmA9VCes.mp3'),
    ('265839', 'Color Of A Soul', 'color-of-a-soul', 'xRID4LBzd558K0DI9fjemJnZrxLueiba0GTOxUwL.mp3'),
    ('265840', 'Ode To Forgetting', 'ode-to-forgetting', 'PLQGg8DdEVSSXOKsRcI8y1yqEzOVoPA6yIdI7OLR.mp3')
  ) as stock(source_id, title, slug, source_file);

  select jsonb_agg(
    jsonb_build_object(
      'id', mc.id,
      'title', mc.title,
      'artist', mc.artist,
      'audioUrl', mc.audio_url,
      'clipUrl', mc.clip_url,
      'clipStartSeconds', 0,
      'clipDurationSeconds', 30
    )
    order by mc.created_at, mc.title
  )
  into v_tracks
  from public.music_catalog mc
  where mc.organization_id = p_organization_id
    and mc.source_filename like 'fma-cc0:%';

  insert into public.games (
    organization_id, name, type, description, points_type, points_static,
    points_min, points_max, status, config, is_default_for_new_clients,
    is_platform_template, source_template_id, list_order
  )
  values (
    p_organization_id,
    'Public Domain Lo-fi Bingo',
    'music_bingo',
    '<p>Identify 25 CC0 lo-fi tracks and complete a bingo line before the other teams.</p>',
    'static',
    500,
    0,
    500,
    'active',
    jsonb_build_object(
      'tracks', coalesce(v_tracks, '[]'::jsonb),
      'bingo_clip_length', 30,
      'bingo_win_mode', 'lines',
      'bingo_lines_required', 1,
      'bingo_include_diagonals', true,
      'bingo_line_points', 500,
      'bingo_points_per_correct', 25
    ),
    false,
    false,
    null,
    100000
  )
  returning id into v_bingo_game;

  select count(*)
  into v_quiz_count
  from demo_game_map m
  where m.game_type = 'quiz';

  select m.installed_id into v_photo_game
  from demo_game_map m where m.game_type = 'photo'
  order by m.list_order, m.source_id limit 1;
  select m.installed_id into v_video_game
  from demo_game_map m where m.game_type = 'video'
  order by m.list_order, m.source_id limit 1;
  select m.installed_id into v_text_game
  from demo_game_map m where m.game_type = 'text'
  order by m.list_order, m.source_id limit 1;
  select m.installed_id into v_puzzle_game
  from demo_game_map m where m.game_type = 'puzzle'
  order by m.list_order, m.source_id limit 1;

  v_showcase_game_ids := array_remove(
    array[v_photo_game, v_video_game, v_text_game, v_puzzle_game],
    null
  );

  for v_event in
    select e.id, e.name
    from public.events e
    where e.organization_id = p_organization_id
    order by e.list_order, e.created_at, e.id
  loop
    v_event_index := v_event_index + 1;

    if v_event.name = 'RallyHub Product Showcase' then
      v_event_open_game_ids := v_showcase_game_ids;
    else
      select array_agg(pick.installed_id order by pick.list_order, pick.source_id)
      into v_event_open_game_ids
      from (
        select m.installed_id, m.list_order, m.source_id
        from demo_game_map m
        where m.game_type not in ('quiz', 'music_bingo')
        order by m.list_order, m.source_id
        offset ((v_event_index - 1) * 4)
        limit 4
      ) pick;
    end if;

    select m.installed_id
    into v_event_quiz_game
    from demo_game_map m
    where m.game_type = 'quiz'
    order by m.list_order, m.source_id
    offset mod(v_event_index - 1, greatest(v_quiz_count, 1))
    limit 1;

    if v_event_quiz_game is null then
      raise exception 'The platform library needs at least one active quiz game';
    end if;

    v_stages := jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'name', case when v_event.name = 'RallyHub Product Showcase'
          then 'RallyHub Quest' else 'Team Quest' end,
        'type', 'open',
        'gameId', v_event_open_game_ids[1],
        'gameIds', to_jsonb(v_event_open_game_ids)
      ),
      jsonb_build_object(
        'id', gen_random_uuid(),
        'name', 'Quiz Challenge',
        'type', 'quiz',
        'gameId', v_event_quiz_game,
        'gameIds', jsonb_build_array(v_event_quiz_game)
      ),
      jsonb_build_object(
        'id', gen_random_uuid(),
        'name', 'Refreshment Break',
        'type', 'break',
        'message', 'Take five — Music Bingo is next.',
        'durationMinutes', 5
      ),
      jsonb_build_object(
        'id', gen_random_uuid(),
        'name', 'Music Bingo Finale',
        'type', 'bingo',
        'gameId', v_bingo_game,
        'gameIds', jsonb_build_array(v_bingo_game)
      )
    );

    update public.events e
    set stages_config = v_stages
    where e.id = v_event.id;

    delete from public.event_games eg where eg.event_id = v_event.id;
    insert into public.event_games(event_id, game_id)
    select v_event.id, selected.game_id
    from unnest(
      v_event_open_game_ids || array[v_event_quiz_game, v_bingo_game]
    ) as selected(game_id)
    where selected.game_id is not null
    on conflict do nothing;
  end loop;

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
  'Resets the public demo, installs every active platform game, and creates a four-stage showcase with CC0 Music Bingo.';
