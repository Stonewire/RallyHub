-- HOTFIX for 20260719130000_team_owned_participant_writes.sql.
--
-- submissions_guard_participant_write() runs as the invoking role ('anon' for
-- participant writes), NOT security definer. SECURITY DEFINER on
-- team_has_private_token/live_team_token_matches only controls what THEIR
-- bodies run as once called -- it does not grant anon permission to call them
-- in the first place. The prior migration revoked all and never re-granted,
-- so every anonymous submission insert/update started failing with
-- "permission denied for function team_has_private_token" immediately after
-- deploy. Caught and fixed within minutes via a live curl test against
-- production (real join token, real team-claim RPC, real submission insert)
-- before any real participant hit it.
--
-- current_live_team_token() does not need its own grant: it is only ever
-- called from inside live_team_token_matches's already-definer context.
grant execute on function public.team_has_private_token(uuid, uuid) to anon;
grant execute on function public.live_team_token_matches(uuid, uuid) to anon;
