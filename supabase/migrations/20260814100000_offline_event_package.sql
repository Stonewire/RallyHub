-- OFFLINE-1 Stage 2: the download-on-join answer package.
--
-- Offline auto-scoring needs, on the device, the answer data that
-- redact_game_config_for_live deliberately strips from the anonymous player
-- payload. This RPC returns EXACTLY that stripped data and nothing else, so the
-- attack surface is the minimum the feature requires:
--   text type_text   -> sha256 hashes of each accepted answer (never plaintext)
--   text choose_answer -> the correct option id (already one of the visible
--                         options; hashing it is pointless over a known set)
--   puzzle wordle/matching/crossword -> the answer fields (plaintext; a puzzle's
--                         score is a function of attempts/time so the answer is
--                         inherently the secret — Rumen accepted this leak for a
--                         low-stakes team-building context, 12 Aug 2026)
--
-- SECURITY: gated on the caller holding a valid PRIVATE TEAM TOKEN for some team
-- on this live event (i.e. they have actually joined it) — the strong per-team
-- credential from SEC-TEAM, not the shared event join token. "Download only
-- after join." An attacker with the event link but no team token gets null.
create or replace function public.get_offline_event_package(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  authed boolean;
  result jsonb := '{}'::jsonb;
  r record;
  cfg jsonb;
  entry jsonb;
  hashes jsonb;
  ans text;
begin
  select exists (
    select 1
    from public.inventory_team_access a
    join public.events e on e.id = a.event_id
    where a.event_id = p_event_id
      and e.status in ('active', 'ready', 'demo')
      and a.token_hash = digest(coalesce(public.current_live_team_token(), ''), 'sha256')
  )
  into authed;

  if not authed then
    return null;
  end if;

  for r in
    select g.id, g.type, g.config
    from public.event_games eg
    join public.games g on g.id = eg.game_id
    where eg.event_id = p_event_id
      and g.type in ('text', 'puzzle')
  loop
    cfg := coalesce(r.config, '{}'::jsonb);
    entry := '{}'::jsonb;

    if r.type = 'text' then
      if (cfg ->> 'text_answer_mode') = 'choose_answer' then
        if cfg ? 'text_correct_answer_id' then
          entry := jsonb_build_object('text_correct_answer_id', cfg -> 'text_correct_answer_id');
        end if;
      else
        -- type_text (the default when unset): hash each accepted answer with the
        -- same btrim the auto_approve_text_submission trigger uses, so the client
        -- hash of a trimmed input matches byte-for-byte.
        hashes := '[]'::jsonb;
        for ans in
          select jsonb_array_elements_text(coalesce(cfg -> 'text_correct_answers', '[]'::jsonb))
        loop
          hashes := hashes || to_jsonb(encode(digest(btrim(ans), 'sha256'), 'hex'));
        end loop;
        if jsonb_array_length(hashes) > 0 then
          entry := jsonb_build_object('text_correct_answer_hashes', hashes);
        end if;
      end if;

    elsif r.type = 'puzzle' then
      if (cfg ->> 'puzzle_type') = 'wordle' then
        entry := jsonb_build_object('puzzle_wordle_answer', cfg -> 'puzzle_wordle_answer');
      elsif (cfg ->> 'puzzle_type') = 'matching' then
        entry := jsonb_build_object(
          'puzzle_matching_pairs', coalesce(cfg -> 'puzzle_matching_pairs', '[]'::jsonb)
        );
      elsif (cfg ->> 'puzzle_type') = 'crossword' then
        entry := jsonb_build_object(
          'puzzle_crossword_words', coalesce(cfg -> 'puzzle_crossword_words', '[]'::jsonb)
        );
      end if;
    end if;

    if entry <> '{}'::jsonb then
      result := jsonb_set(result, array[r.id::text], entry, true);
    end if;
  end loop;

  return jsonb_build_object('answerKeys', result);
end;
$function$;

-- Called from the anonymous participant surface; the team-token gate is the
-- real access control, not the role.
grant execute on function public.get_offline_event_package(uuid) to anon, authenticated;
