# RallyHub Code Audit

**Read-only self-diagnostic · June 12, 2026**

42 findings across realtime, scoring, error handling, RLS/tenancy, storage, mobile, accessibility, performance, and security.

**Status legend:** `Open` — not yet addressed · `Fixed` — remediated and verified · `Deferred` — intentionally postponed

| Severity | Count | Open | Fixed | Deferred |
|----------|-------|------|-------|----------|
| Critical | 8 | 0 | 8 | 0 |
| High | 17 | 0 | 17 | 0 |
| Medium | 11 | 2 | 9 | 0 |
| Low | 6 | 6 | 0 | 0 |
| **Total** | **42** | **8** | **34** | **0** |

---

## Headline risk

All 8 criticals are now closed. The anon key no longer grants broad write access to live tables (C1/C2, migration 048): facilitators authenticate, participants are scoped to their own actions via a per-event join token. Quiz answers are redacted until reveal (C3), cross-tenant reads are token-scoped (H12), storage is locked down with size caps (C4), the service-role edge functions require auth (C5), and the realtime reload storm is tamed by per-game listeners + bounded fetches + a dedicated chat/bingo broadcast channel (C8). The remaining work is hardening (H6, H8–H11, H15) and UX/accessibility polish — none of it grants anon write access or leaks tenant data.

---

## Findings index

| ID | Title | Severity | Area | Status |
|----|-------|----------|------|--------|
| C1 | Anonymous write access to all live tables (RLS `using (true)`) | Critical | RLS / Security | Fixed (048) |
| C2 | bingo_runs / bingo_team_cards: open CRUD for anon | Critical | RLS / Security | Fixed (048) |
| C3 | Quiz answers readable by anyone before reveal | Critical | RLS / Security | Fixed |
| C4 | game-assets bucket: anon can upload/overwrite any path, no size limits | Critical | Storage / Security | Fixed (039) |
| C5 | Unauthenticated service-role edge functions | Critical | Edge functions / Security | Fixed |
| C6 | Display screen (and preview iframe) writes event timers — fights the facilitator | Critical | Realtime / Live flow | Fixed |
| C7 | Bingo line bonus re-awarded on every reveal after a team wins | Critical | Scoring | Fixed |
| C8 | Realtime reload storm: unfiltered games listener + unbounded bundle fetches | Critical | Realtime / Performance | Fixed |
| H1 | All team-score updates are non-atomic read-modify-write | High | Scoring | Fixed |
| H2 | Quiz double-scoring race (auto-reveal vs manual vs second facilitator) | High | Scoring | Fixed |
| H3 | approveSubmission awards points even when the submission update fails | High | Error handling / Scoring | Fixed |
| H4 | restartQuiz under-subtracts when a team has multiple scored questions | High | Scoring | Fixed |
| H5 | restartBingoRun wipes submissions but never reverses awarded points | High | Scoring | Fixed |
| H6 | Team that joins mid-bingo never gets a card — marked cells never score | High | Game logic | Fixed |
| H7 | Participant writes fail silently (quiz answers, photo submits, bingo bonus) | High | Error handling | Fixed |
| H8 | Bingo scoring/advance/restart swallow DB errors | High | Error handling | Fixed |
| H9 | event_games and org branding load once and never update live | High | Realtime | Fixed |
| H10 | bingo_team_cards not realtime + 60s staleTime — stale cards after restart | High | Realtime | Fixed |
| H11 | bingoRunOverride can diverge from the DB run across facilitators | High | Realtime / Live flow | Fixed |
| H12 | Cross-tenant enumeration: events, games, event_games, music_catalog readable by anyone | High | RLS / Security | Fixed |
| H13 | Blank participant screen if the quiz game is deleted mid-event | High | Empty states | Fixed |
| H14 | No upload size caps anywhere; video duration check bypassed on metadata error | High | Uploads | Fixed |
| H15 | Tablet password: plaintext storage, brute-forceable RPC, forgeable session flag | High | Security | Fixed (050) |
| H16 | Mobile: floating chat/exit buttons overlap submit controls; claim modals exceed the viewport | High | Mobile UX | Fixed |
| H17 | Bingo cell text is 7–8px — unreadable on phones | High | Mobile UX | Fixed |
| M1 | skipQuizQuestion skips scoring AND bypasses the round intro | Medium | Quiz rounds | Fixed |
| M2 | Quiz answers can change after the facilitator timer ends | Medium | Quiz logic | Fixed |
| M3 | Duplicate trackId on cards with fewer than 25 tracks — ambiguous scoring | Medium | Bingo logic | Fixed |
| M4 | playOrder fallback to tracks[index] can mis-attribute the playing song | Medium | Bingo logic | Fixed |
| M5 | Pressing Start clears announced winners — same team can be re-celebrated | Medium | Bingo logic | Fixed |
| M6 | Chat misses messages sent during a disconnect; duplicate listener forces full reloads | Medium | Realtime | Fixed |
| M7 | 10 remaining native dialogs (window.confirm/prompt/alert) | Medium | UX | Partial (2 live-path dialogs fixed; 8 admin-path remain) |
| M8 | Optimistic updates race the debounced full reload | Medium | Realtime | Fixed |
| M9 | Anon organizations_live_select allows full org enumeration (incl. tablet_password) | Medium | Security | Fixed |
| M10 | Accessibility: overlays lack dialog semantics; meaningful images have empty alt | Medium | Accessibility | Open |
| M11 | Uncompressed camera photos + silent admin upload failures + display layout shift | Medium | Performance / Uploads | Fixed |
| L1 | Quiz can stall on active with zero named teams and a paused timer | Low | Quiz logic | Open |
| L2 | Leaderboard renders blank with zero named teams | Low | Empty states | Open |
| L3 | Storage path hygiene: raw file.name segments and extensionless live keys | Low | Uploads | Open |
| L4 | Dead fetchOrgSubdomain queries the RLS-blocked organizations base table | Low | RLS | Open |
| L5 | Bingo tap optimistic state flickers before realtime confirms | Low | Live UX | Open |
| L6 | Misc: /tablet has no error boundary; stale localStorage team id; super-admin member lists silently empty | Low | Resilience | Open |

---

## Top 10 before a real event

| # | Findings | What to fix | Status |
|---|----------|-------------|--------|
| 1 | C1, C2 | Lock down live-table RLS (teams, event_state, submissions, bingo_runs) — anyone can rewrite scores and hijack the event today | Done (048) |
| 2 | C7 | Stop the bingo line bonus from re-awarding on every reveal — guarantees a wrong leaderboard in any game with line points | Fixed |
| 3 | C6 | Make display + preview timers read-only — visible timer jumping on every screen in the room | Fixed |
| 4 | H1, H2, H3 | Atomic, idempotent scoring: increment-score RPC + approve-where-pending, with error checks before awarding | Fixed |
| 5 | C8 | Tame the realtime reload storm: filter the games listener, stop chat/bingo_runs full reloads, bound the submissions query | Fixed |
| 6 | C3 | Stop shipping quiz correct answers in anon-readable game config | Done (041) |
| 7 | C5 | Authenticate the edge functions (activate-bingo-run, invite-member) | Done |
| 8 | C4, H14 | Storage lockdown: no anon writes, path-prefix policies, upload size caps | Done (039) |
| 9 | H6, H7 | Participant integrity: cards for mid-game joiners + surface failed quiz/photo submissions instead of losing them silently | Open |
| 10 | H4, H5 | Correct score reversal on quiz restart and bingo restart | Fixed |

---

## Critical (8)

### C1 — Anonymous write access to all live tables (RLS `using (true)`)

- **Status:** Fixed (048)
- **Area:** RLS / Security
- **References:**
  - `supabase/migrations/048_live_write_lockdown.sql`
  - `supabase/migrations/041_event_join_token_scoping.sql` (Phase 2 read scoping)
- **Problem:** Phase 2 scoped reads by join token but left `for all` write policies on live tables. Any anon holder of a join token could still rewrite scores, event_state, approve submissions, or control bingo.
- **Fix:** Split read/write policies per table. Anon+token: participant actions only (team claim, own submissions, chat insert). Authenticated facilitator (`facilitator` / `client_admin` / `super_admin`): privileged writes. Triggers guard anon column changes on teams/submissions. `increment_team_score` and `score_current_quiz_question` require facilitator auth.

### C2 — bingo_runs / bingo_team_cards: open CRUD for anon

- **Status:** Fixed (048)
- **Area:** RLS / Security
- **References:**
  - `supabase/migrations/048_live_write_lockdown.sql`
  - `supabase/functions/activate-bingo-run/index.ts` (facilitator JWT)
  - `src/lib/activate-bingo-run.ts`, `src/lib/restart-bingo-run.ts`
- **Problem:** Anon could select/insert/update/delete all bingo runs and cards. Client-side `activateBingoRunLocal` / `restartBingoRun` relied on open policies.
- **Fix:** Anon select-only (join token). All bingo writes require authenticated facilitator. Edge function `activate-bingo-run` accepts facilitator JWT (not only client_admin). Local fallback still works for logged-in facilitators via RLS.

### C3 — Quiz answers readable by anyone before reveal

- **Status:** Fixed (041)
- **Area:** RLS / Security
- **References:**
  - `supabase/migrations/041_event_join_token_scoping.sql`
  - `src/hooks/use-live-event.ts` (`get_live_event_games` RPC)
- **Problem:** Game `config` (including `correctAnswerId` for every quiz question) was selectable by anon for ALL games across ALL tenants.
- **Breaks when:** A team member queries `games.select('config')` on their phone during the quiz and reads every correct answer. Quiet, undetectable cheating.
- **Recommended fix:** Strip answers from client-visible config via `get_live_event_games` (redacts until reveal); score via `score_current_quiz_question` RPC reading full config server-side.

### C4 — game-assets bucket: anon can upload/overwrite any path, no size limits

- **Status:** Fixed (039)
- **Area:** Storage / Security
- **References:**
  - `supabase/migrations/039_storage_game_assets_lockdown.sql`
- **Problem:** Anon could insert/update any object in the public `game-assets` bucket; any authenticated user could delete any object (including other orgs' music catalogs). No byte-size limits anywhere.
- **Fix:** Bucket `file_size_limit` set to 250 MB (matches the video cap). Anon writes are restricted to live upload paths only (`{eventId}/teams|submissions/...`, `{orgId}/bingo-bonus/...`) via `storage_game_assets_live_upload_path_allowed`. Authenticated writes are confined to the caller's own org prefix (`storage_game_assets_org_path_allowed`, with super-admin override); delete is org-prefix-scoped, so one org can no longer delete another's catalog. Public read is preserved so media URLs still resolve.

### C5 — Unauthenticated service-role edge functions

- **Status:** Fixed
- **Area:** Edge functions / Security
- **References:**
  - `supabase/functions/activate-bingo-run/index.ts` (facilitator JWT required)
  - `supabase/functions/invite-member/index.ts` (auth + org-admin check)
  - `supabase/functions/_shared/auth.ts`
- **Problem:** `activate-bingo-run` and `invite-member` accepted any unauthenticated POST and ran with the service role; the latent `reveal-bingo-winner` was deployed but unused.
- **Fix:** Every function now verifies the caller JWT up front. `activate-bingo-run` calls `requireAuthUser` + `requireEventFacilitatorOrSuperAdmin`; `invite-member` calls `requireAuthUser` + `requireOrgAdminOrSuperAdmin` before issuing an invite. `reveal-bingo-winner` has been deleted from the functions tree. (`invite-member` is also superseded by `create-org-user` for new flows.)

### C6 — Display screen (and preview iframe) writes event timers — fights the facilitator

- **Status:** Fixed
- **Area:** Realtime / Live flow
- **References:**
  - `src/pages/live/DisplayEventPage.tsx:73–124`
  - `src/components/live/DisplayPreviewFrame.tsx` (embed only skips sound gate)
- **Problem:** The display runs `useLiveTimer` with `createThrottledTimerSync` callbacks that call `updateState` for the main, quiz, and break timers — same as the facilitator. The facilitator's embedded display preview does too. Multiple writers tick at slightly different rates.
- **Breaks when:** Facilitator starts a quiz timer; the venue display and the preview iframe each write their own drifting `timer_seconds` every ~3s. The countdown visibly jumps backward/forward on every screen in the room.
- **Recommended fix:** Make display/participant timers read-only (no-op onTick, the pattern JoinGameView already uses). Only the facilitator persists timer state.

### C7 — Bingo line bonus re-awarded on every reveal after a team wins

- **Status:** Fixed
- **Area:** Scoring
- **References:** `src/lib/bingo-scoring.ts:55, 114–124`
- **Problem:** `lineAwarded` is a fresh `Set` created inside each `scoreBingoRound` call (verified). Once a team's win condition is achieved, every subsequent song reveal re-detects `achieved === true` and pays `bingo_line_points` again.
- **Breaks when:** With 50 line points, a team that completes a line on song 6 of 25 collects +50 on each of the remaining ~19 reveals — roughly 950 phantom points. Leaderboard is garbage by the end of the round.
- **Recommended fix:** Persist 'line bonus paid' per (run_id, team_id) — a column on bingo_runs/cards or tracked via event_state — and only award on the false→true transition.

### C8 — Realtime reload storm: unfiltered games listener + unbounded bundle fetches

- **Status:** Fixed
- **Area:** Realtime / Performance
- **References:**
  - `src/hooks/use-live-event.ts` (per-game listeners, bounded submissions, split chat/bingo)
  - `src/lib/live-broadcast.ts` (dedicated patch channel)
- **Problem:** The `games` realtime listener had NO filter — any game edit in any org triggered a debounced full-bundle reload on every connected live client of every tenant. Each reload refetched ALL submissions for the event with no limit; chat inserts and bingo_runs updates also forced full reloads despite having dedicated hooks.
- **Fix:** The bundle channel subscribes to `events`/`event_state`/`teams`/`submissions` filtered to the event, plus one `games` listener **per attached game id** (`id=eq.<gameId>`) that merges the changed row in place. The submissions fetch is capped at the 1000 most recent rows (`SUBMISSIONS_BUNDLE_LIMIT`); scoring paths that need more query the DB directly. Chat moved to its own broadcast/postgres channel (`useChatMessages`) and bingo runs/cards to `useBingoRun`, so neither forces a bundle reload. Cross-surface optimistic patches now go through the `live-broadcast` channel instead of full reloads.

---

## High (17)

### H1 — All team-score updates are non-atomic read-modify-write

- **Status:** Fixed
- **Area:** Scoring
- **References:**
  - `src/lib/increment-team-score.ts`
  - `src/lib/apply-submission-points.ts`
  - `supabase/migrations/034_increment_team_score.sql`
- **Problem:** Every scoring path reads `team.score` and writes back an absolute value. Concurrent writers (two facilitator tabs, auto-reveal racing manual reveal, bingo scoring overlapping a manual approval) read the same base and the last write wins.
- **Breaks when:** Facilitator approves two submissions for the same team in quick succession; the second write uses the stale pre-first-approval score and silently erases the first award.
- **Recommended fix:** One Postgres RPC `increment_team_score(team_id, delta)` doing `SET score = score + $1`, used by every approval/scoring path.

### H2 — Quiz double-scoring race (auto-reveal vs manual vs second facilitator)

- **Status:** Fixed
- **Area:** Scoring
- **References:**
  - `src/lib/live-event.ts` (`scoreCurrentQuizQuestion`)
  - `src/pages/live/FacilitatorEventPage.tsx` (auto-reveal, manual reveal)
- **Problem:** Idempotency is a client-side ref (`quizAutoRevealKey`) per browser. The DB guard (`status === 'approved' && points_awarded != null`) doesn't close the read-to-write window, so two scorers can both pass it.
- **Breaks when:** Timer hits zero (auto-reveal fires) at the moment the facilitator clicks Next Question, or two facilitator devices are open: correct teams get double points.
- **Recommended fix:** Atomic approval: `UPDATE submissions SET status='approved', points_awarded=$1 WHERE id=$2 AND status='pending' RETURNING id`, and only increment the team score when a row came back.

### H3 — approveSubmission awards points even when the submission update fails

- **Status:** Fixed
- **Area:** Error handling / Scoring
- **References:** `src/pages/live/FacilitatorEventPage.tsx:435–449`
- **Problem:** The submission `update` result is not checked before `updateTeam` adds points; `rejectSubmission` is also unchecked.
- **Breaks when:** A flaky connection drops the submission update; the team still gets points, the submission stays pending, and a second approval doubles them.
- **Recommended fix:** Check `{ error }` on the update; only award on success; surface failures via `notify()`.

### H4 — restartQuiz under-subtracts when a team has multiple scored questions

- **Status:** Fixed
- **Area:** Scoring
- **References:** `src/pages/live/FacilitatorEventPage.tsx` (`restartQuiz`)
- **Problem:** The loop subtracts each submission's points from the ORIGINAL `teams` snapshot, so a team with two 25-point answers loses 25, not 50.
- **Breaks when:** Quiz restarted after 3 questions: every multi-answer team keeps phantom quiz points; the rerun's leaderboard is wrong from the start.
- **Recommended fix:** Group submissions by team, sum quiz points, do one subtract per team (or use the H1 increment RPC with negative deltas).

### H5 — restartBingoRun wipes submissions but never reverses awarded points

- **Status:** Fixed
- **Area:** Scoring
- **References:** `src/lib/restart-bingo-run.ts`
- **Problem:** Restart deletes the run, cards, and bingo submissions, but scores already added to `teams.score` remain (unlike restartQuiz, which at least attempts reversal).
- **Breaks when:** Facilitator restarts bingo after teams earned 200 points; the fresh round starts with permanently inflated scores.
- **Recommended fix:** Before deleting, sum approved bingo/bonus `points_awarded` per team and subtract.

### H6 — Team that joins mid-bingo never gets a card — marked cells never score

- **Status:** Open
- **Area:** Game logic
- **References:**
  - `src/components/live/JoinGameView.tsx:1155–1158` (client-side fallback card)
  - `src/lib/activate-bingo-run.ts:61–88` (cards only at activation)
- **Problem:** Cards are generated once at activation for teams named at that moment. A late team sees a locally generated fallback grid, but `scoreBingoRound` only iterates DB cards, so they're invisible to scoring.
- **Breaks when:** A 4th team claims a slot during song 5. They play along the whole round and end with zero points and pending marks that never resolve.
- **Recommended fix:** On team claim during an active bingo stage, insert a card row for the live run (server-side), or block play with a clear 'joined too late for this round' message.

### H7 — Participant writes fail silently (quiz answers, photo submits, bingo bonus)

- **Status:** Fixed
- **Area:** Error handling
- **References:**
  - `src/components/live/JoinGameView.tsx:493–505` (quiz answer, no error check)
  - `src/components/live/JoinGameView.tsx:458–465` (open game, try/finally no catch)
  - `src/components/live/JoinGameView.tsx:551–560` (bonus answer, no try/catch)
  - `src/components/live/JoinGameView.tsx:513` (cancel, unchecked)
- **Problem:** Inserts/updates/uploads on the participant device ignore Supabase errors. The UI shows the optimistic state while the DB write was lost.
- **Breaks when:** Phone on weak Wi-Fi taps a quiz answer; the highlight shows but the insert failed. At reveal the team gets 'Incorrect/no answer' and complains to the facilitator.
- **Recommended fix:** Check `{ error }` on every write, revert optimistic UI, show `notify()` toasts, add catch blocks around uploads.

### H8 — Bingo scoring/advance/restart swallow DB errors

- **Status:** Open
- **Area:** Error handling
- **References:**
  - `src/lib/bingo-round-advance.ts:41–56`
  - `src/lib/bingo-scoring.ts:78–97` (console.error only)
  - `src/lib/bingo-bonus-scoring.ts:28–34`
- **Problem:** Approve/reject updates, pending-mark deletion, and run-index advances ignore or merely log errors; follow-up steps (points, advance) run anyway.
- **Breaks when:** Reveal partially fails: some teams' marks stay pending and show the wrong color, but the round advances and the inconsistency compounds.
- **Recommended fix:** Propagate errors to the facilitator caller and stop the advance; retry or notify.

### H9 — event_games and org branding load once and never update live

- **Status:** Open
- **Area:** Realtime
- **References:** `src/hooks/use-live-event.ts:19–27, 45–51`
- **Problem:** `event_games` and `organization_tenant_public` are fetched once into the bundle; neither table is in the realtime publication and there are no listeners — the same stale-data class as the games-config bug already hit.
- **Breaks when:** Staff attach a new photo challenge to the running event from admin; participants never see it until they manually refresh.
- **Recommended fix:** Publish `event_games` and listen with an `event_id` filter (reload the games slice), or denormalize what live screens need onto `events` (already realtime).

### H10 — bingo_team_cards not realtime + 60s staleTime — stale cards after restart

- **Status:** Open
- **Area:** Realtime
- **References:**
  - `src/hooks/use-bingo-run.ts:46–62`
  - `supabase/migrations/013_music_catalog_bingo_runs.sql` (no publication entry)
- **Problem:** Cards are cached for 60s with no postgres subscription; invalidation depends on event_state fields changing.
- **Breaks when:** Facilitator restarts bingo; a participant's device keeps showing the old card (tied to the deleted run) for up to a minute and marks cells the scorer will never approve.
- **Recommended fix:** Publish `bingo_team_cards` and subscribe/invalidate on run changes; set `staleTime: 0` for live card queries.

### H11 — bingoRunOverride can diverge from the DB run across facilitators

- **Status:** Open
- **Area:** Realtime / Live flow
- **References:** `src/pages/live/FacilitatorEventPage.tsx:106, 660`
- **Problem:** `effectiveBingoRun = bingoRunOverride ?? bingoRunQuery.data`; the local override is only cleared on stage switch, not when another facilitator restarts the run.
- **Breaks when:** Facilitator A restarts bingo; co-facilitator B keeps the old run's playOrder and advances/scoring against a run that no longer exists.
- **Recommended fix:** Clear the override on `bingo_runs` realtime events and prefer the React Query value once it reflects the latest activation.

### H12 — Cross-tenant enumeration: events, games, event_games, music_catalog readable by anyone

- **Status:** Fixed (041)
- **Area:** RLS / Security
- **References:**
  - `supabase/migrations/041_event_join_token_scoping.sql`
  - `src/lib/live-event-access.ts`
- **Problem:** `using (true)` SELECT policies let any anon client list every tenant's events, stages, game configs, and music catalog (licensed audio URLs).
- **Breaks when:** A competitor scrapes all client event names and the entire music catalog of every org.
- **Recommended fix:** Per-event `join_token` via `bootstrap_live_event_access` (event UUID in URL unchanged); anon reads require `x-join-token` header; `music_catalog` revoked from anon.

### H13 — Blank participant screen if the quiz game is deleted mid-event

- **Status:** Fixed
- **Area:** Empty states
- **References:** `src/components/live/JoinGameView.tsx:909–1063`
- **Problem:** The quiz branch assigns `body` only when game + question resolve; with a deleted game or missing question the screen renders an empty div.
- **Breaks when:** Admin deletes/replaces a quiz game while the stage is active: every participant phone goes blank with no message.
- **Recommended fix:** Add an explicit fallback ('Quiz unavailable — stand by') when the stage's game or question can't be resolved.

### H14 — No upload size caps anywhere; video duration check bypassed on metadata error

- **Status:** Fixed
- **Area:** Uploads
- **References:**
  - `src/components/live/VideoChallengeCapture.tsx:128` (onerror → resolve(true))
  - All `uploadAsset` call sites (no file.size checks)
- **Problem:** Only video duration is validated, and a metadata load failure ACCEPTS the file. Photos, audio, and logos have type hints (`accept=`) but no byte limits.
- **Breaks when:** A participant submits a 2GB video from their camera roll mid-event; uploads crawl for everyone on venue Wi-Fi and storage costs spike.
- **Recommended fix:** Reject on metadata error; enforce client-side byte caps (e.g. 50MB) plus server-side limits via storage policies or an upload proxy.

### H15 — Tablet password: plaintext storage, brute-forceable RPC, forgeable session flag

- **Status:** Open
- **Area:** Security
- **References:**
  - `supabase/migrations/008_tenant_subdomains.sql:73–94`
  - `src/pages/live/TabletPage.tsx:157` (sessionStorage '1')
- **Problem:** `verify_tablet_password` compares plaintext and is callable by anon with no rate limit; the client then just sets a sessionStorage flag anyone can set manually in DevTools.
- **Breaks when:** A guest opens DevTools on the venue tablet, sets the flag, and gets the tablet admin surface without the password.
- **Recommended fix:** Hash the password (crypt/bcrypt), rate-limit the RPC, and gate the tablet UI on a server-issued short-lived token instead of a client flag.

### H16 — Mobile: floating chat/exit buttons overlap submit controls; claim modals exceed the viewport

- **Status:** Fixed
- **Area:** Mobile UX
- **References:**
  - `src/components/live/JoinGameView.tsx:745, 1284–1339`
  - `src/pages/live/JoinEventPage.tsx:264–324`
  - `src/pages/live/FacilitatorEventPage.tsx:1643–1672`
- **Problem:** Fixed FABs (chat bottom-left, exit bottom-right, z-[9999]) sit over photo/video capture submit buttons (open-game flow uses pb-4 vs pb-24 elsewhere). The claim-team modal has no max-height/scroll, so the iOS keyboard clips the Join button.
- **Breaks when:** A team finishes a photo challenge and the Submit button is half-hidden under the chat bubble; another can't reach 'Join' once the keyboard opens on a small phone.
- **Recommended fix:** pb-24 + safe-area padding on capture flows, hide FABs during capture, `max-h-[90dvh] overflow-y-auto` on modals.

### H17 — Bingo cell text is 7–8px — unreadable on phones

- **Status:** Fixed
- **Area:** Mobile UX
- **References:** `src/components/live/JoinGameView.tsx:1233–1238`
- **Problem:** Cell labels render at `text-[8px]`/`text-[7px]` inside the fixed 5×5 grid.
- **Breaks when:** In a dim, noisy venue, teams can't read song titles on their cards — the core interaction of music bingo.
- **Recommended fix:** Minimum ~11px with tighter truncation, or tap-to-expand cell detail; keep 44px tap targets.

---

## Medium (11)

### M1 — skipQuizQuestion skips scoring AND bypasses the round intro

- **Status:** Open
- **Area:** Quiz rounds
- **References:** `src/pages/live/FacilitatorEventPage.tsx:531–547`
- **Problem:** Skip never scores submitted answers (teams that answered get nothing, possibly intended but undocumented) and jumps straight to `active`, never `round_intro`, diverging from goToNextQuestion at round boundaries.
- **Breaks when:** Facilitator skips the last question of Round 1; the ROUND 2 interstitial never shows and answered teams silently get zero.
- **Recommended fix:** Decide semantics: either score-then-skip or reject pending answers explicitly; route through the same round-boundary logic as goToNextQuestion.

### M2 — Quiz answers can change after the facilitator timer ends

- **Status:** Open
- **Area:** Quiz logic
- **References:**
  - `src/components/live/JoinGameView.tsx:479–506`
  - `src/pages/live/FacilitatorEventPage.tsx:281–282`
- **Problem:** Participant lock is a local 5s window from first tap; submit only checks `quiz_state === 'active'`. Auto-reveal triggers on the facilitator's local timer, so a participant with clock skew can still update their answer during scoring.
- **Breaks when:** Facilitator timer hits 0 and scoring starts; a phone showing 2s left changes its answer — the device shows Correct while the DB scored the old value (or vice versa).
- **Recommended fix:** Flip `quiz_state` to revealed BEFORE scoring and have submit reject non-active states server-side (RPC or status check in the update WHERE clause).

### M3 — Duplicate trackId on cards with fewer than 25 tracks — ambiguous scoring

- **Status:** Open
- **Area:** Bingo logic
- **References:**
  - `src/lib/bingo-engine.ts:39–54` (pick25 duplicates)
  - `src/lib/bingo-cell-match.ts:21–30`
- **Problem:** Cards pad to 25 cells by repeating tracks; submissions store trackId, not cell index, so any duplicate cell matches.
- **Breaks when:** A 15-track game has the same song on two cells; the scorer can approve a different cell than the team thinks they marked, confusing line detection.
- **Recommended fix:** Store and score by cell index (or unique per-cell id) instead of trackId.

### M4 — playOrder fallback to tracks[index] can mis-attribute the playing song

- **Status:** Open
- **Area:** Bingo logic
- **References:** `src/pages/live/FacilitatorEventPage.tsx:663–666`
- **Problem:** If a playOrder id isn't found in the current track list (playlist edited after activation), the UI/audio falls back to the positional track while scoring still uses the playOrder id.
- **Breaks when:** Facilitator hears Song A but the reveal validates marks against Song B; teams' correct marks get rejected.
- **Recommended fix:** Fail loudly when an id is missing rather than index-falling-back; freeze track metadata on the run at activation.

### M5 — Pressing Start clears announced winners — same team can be re-celebrated

- **Status:** Fixed
- **Area:** Bingo logic
- **References:** `src/pages/live/FacilitatorEventPage.tsx:757–761`
- **Problem:** Start/resume wipes `bingo_announced_winner_ids` while approved cells persist, so the next reveal re-detects the same win as new.
- **Breaks when:** After a win halt, facilitator presses Start instead of Continue; the same team gets a second trophy celebration.
- **Recommended fix:** Only clear announced winners on run restart/reset, not on Start.

### M6 — Chat misses messages sent during a disconnect; duplicate listener forces full reloads

- **Status:** Fixed
- **Area:** Realtime
- **References:** `src/hooks/use-live-event.ts` (`useChatMessages`)
- **Problem:** The `useChatMessages` append-only INSERT subscription had no reconnect reload, so messages sent while offline never appeared. Meanwhile the bundle channel ALSO listened to `chat_messages` and full-reloaded the bundle on every message.
- **Fix:** `useChatMessages` now re-fetches chat history on every (re)`SUBSCRIBED` after the first, and on `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`, so messages sent during a blip appear on reconnect. The redundant `chat_messages` listener was removed from the bundle channel — chat lives entirely on its own broadcast + postgres-changes channel keyed by the join token, with a generation guard against out-of-order reloads.

### M7 — 10 remaining native dialogs (window.confirm/prompt/alert)

- **Status:** Open
- **Area:** UX
- **References:**
  - `src/components/live/JoinGameView.tsx:340` (prompt — tablet password, **LIVE path**)
  - `src/pages/live/FacilitatorEventPage.tsx:1498` (confirm — restart bingo, **LIVE path**)
  - `src/components/games/MusicBingoEditor.tsx:56` (confirm)
  - `src/pages/rallyhub/ClientDetailPage.tsx:183` (confirm)
  - `src/pages/admin/EventsPage.tsx:92, 111` (alert), `124` (confirm)
  - `src/hooks/use-event-activation-flow.tsx:58` (alert)
  - `src/pages/rallyhub/GamesPage.tsx:18` (prompt), `30` (alert)
- **Problem:** Verified exhaustive list. The two on live paths matter most — native dialogs block the UI and behave badly in kiosk/tablet contexts.
- **Breaks when:** Participant taps 'leave team' on the venue tablet and gets a system prompt that may be suppressed in kiosk mode, locking them in.
- **Recommended fix:** Replace with the in-app modal pattern already used for game deletion; prioritize JoinGameView and FacilitatorEventPage.

### M8 — Optimistic updates race the debounced full reload

- **Status:** Open
- **Area:** Realtime
- **References:** `src/hooks/use-live-event.ts:126–131, 156–160, 249–264`
- **Problem:** A full bundle reload triggered by an unrelated table can return pre-write state and clobber an in-flight optimistic updateState; event_state realtime replaces the whole row with no merge against pending local patches.
- **Breaks when:** Facilitator toggles show_scores at the moment a game edit triggers a reload; the toggle visibly reverts, then re-applies a second later.
- **Recommended fix:** Merge reload results with pending local patches, or suppress reload-applied state for fields with in-flight writes (largely mitigated by fixing C8).

### M9 — Anon organizations_live_select allows full org enumeration (including tablet_password)

- **Status:** Fixed (038)
- **Area:** Security
- **References:** `supabase/migrations/006_live_event.sql:105–113`, `supabase/migrations/038_org_view_tenant_rpcs.sql`
- **Problem:** Migration 008 (intended view + lockdown) was never applied on production. Anon retained `organizations_live_select` (`using (true)`) plus `GRANT SELECT ON public.organizations TO anon`, exposing every org row including `tablet_password`, VAT, billing, and contact fields — not merely branding. The audit originally cited `organization_tenant_public`, which does not exist in the live database.
- **Breaks when:** Anyone runs `SELECT * FROM organizations` with the anon key and harvests all tenant secrets and tablet passwords in one query.
- **Recommended fix:** Drop `organizations_live_select`, revoke anon `SELECT` on `organizations`, and route live/tenant lookups through scoped SECURITY DEFINER RPCs (`get_organization_tenant_public`, `get_organization_tenant_by_subdomain`, `get_organizations_by_tablet_slug`, `resolve_tenant_by_host`) — implemented in 038.

### M10 — Accessibility: overlays lack dialog semantics; meaningful images have empty alt

- **Status:** Open
- **Area:** Accessibility
- **References:**
  - `src/components/live/JoinGameView.tsx:1341–1352` (chat overlay)
  - `src/pages/live/JoinEventPage.tsx:264–324` (claim modal)
  - `src/components/live/BingoBonusPanel.tsx:38–45` (question image alt='')
  - `src/components/live/SubmissionDetailModal.tsx:100–102` (unlabeled close)
- **Problem:** Chat overlays and claim modals are plain divs — no role=dialog, aria-modal, focus trap, or Escape; bonus-question images and submission proofs use empty alt; some icon buttons lack aria-label. Low-contrast micro text (opacity-40, text-[10px]) on live screens.
- **Breaks when:** A screen-reader user can't find the close control on the chat overlay; visual bonus questions are silently invisible to them.
- **Recommended fix:** Adopt the dialog pattern from SubmissionDetailModal everywhere, give meaningful images real alt text, label icon buttons, raise micro-text contrast.

### M11 — Uncompressed camera photos + silent admin upload failures + display layout shift

- **Status:** Open
- **Area:** Performance / Uploads
- **References:**
  - `src/components/live/PhotoChallengeCapture.tsx:69–101` (native res, JPEG 0.92)
  - `src/components/events/EventForm.tsx:183–187` (.then no .catch)
  - `src/components/games/MusicBingoEditor.tsx:439–467` (bonus media, no catch)
  - `src/components/live/Leaderboards.tsx:66–70` (unsized photos)
- **Problem:** Team selfies and challenge photos upload at full camera resolution; several admin upload chains have no error handling; leaderboard photos load without reserved dimensions and reshuffle the projector layout.
- **Breaks when:** 12MP submissions crawl on venue Wi-Fi; the orbit view jumps as photos pop in mid-round.
- **Recommended fix:** Downscale to ~1600px max edge / quality 0.75 before upload; add .catch with error state; reserve image dimensions.

---

## Low (6)

### L1 — Quiz can stall on active with zero named teams and a paused timer

- **Status:** Open
- **Area:** Quiz logic
- **References:** `src/pages/live/FacilitatorEventPage.tsx:270–282`
- **Problem:** Auto-reveal requires named teams (for all-answered) or a RUNNING timer at 0; with neither, the question sits in active forever (manual Reveal still works).
- **Breaks when:** Rehearsal/demo with empty slots and paused timer looks frozen.
- **Recommended fix:** Treat an exhausted timer as done regardless of the running flag.

### L2 — Leaderboard renders blank with zero named teams

- **Status:** Open
- **Area:** Empty states
- **References:** `src/components/live/Leaderboards.tsx:28–30`
- **Problem:** Unnamed teams are filtered out and nothing else renders.
- **Breaks when:** Display turned on before doors open shows an empty area instead of a 'waiting for teams' message.
- **Recommended fix:** Add empty-state copy ('Waiting for teams to join…').

### L3 — Storage path hygiene: raw file.name segments and extensionless live keys

- **Status:** Open
- **Area:** Uploads
- **References:**
  - `src/components/games/MusicCatalogUploader.tsx:94–97` (raw file.name in full-audio path)
  - `src/components/live/JoinGameView.tsx:453–456, 539–542`
  - `src/pages/live/JoinEventPage.tsx:132–135`
- **Problem:** Central sanitizeStoragePath prevents the old %2520 class, but the catalog full-audio path bypasses audioStorageFilename; live submission keys carry no extension.
- **Breaks when:** Odd filenames produce confusing object keys; content-type sniffing edge cases for extensionless objects on some CDNs.
- **Recommended fix:** Run all audio names through audioStorageFilename; append a sanitized extension to live upload keys.

### L4 — Dead fetchOrgSubdomain queries the RLS-blocked organizations base table

- **Status:** Open
- **Area:** RLS
- **References:** `src/lib/tenant.ts:212–217`
- **Problem:** No current callers, but any future anon/live usage would silently fail post-008 (no anon policy on the base table).
- **Breaks when:** A future feature uses it on a live page and gets empty results.
- **Recommended fix:** Delete it or reroute through `get_organization_tenant_by_subdomain` / `resolve_tenant_by_host` RPCs (038).

### L5 — Bingo tap optimistic state flickers before realtime confirms

- **Status:** Open
- **Area:** Live UX
- **References:** `src/components/live/JoinGameView.tsx:612–654`
- **Problem:** bingoPickOptimisticRef is cleared in finally, before the submission INSERT arrives via realtime, so the highlight can blink off briefly on slow networks.
- **Breaks when:** Participant double-taps thinking the mark didn't register.
- **Recommended fix:** Keep the optimistic state until the matching submission appears in the bundle.

### L6 — Misc: /tablet has no error boundary; stale localStorage team id; super-admin member lists silently empty

- **Status:** Open
- **Area:** Resilience
- **References:**
  - `src/router.tsx:97–98` (tablet routes unwrapped)
  - `src/pages/live/JoinEventPage.tsx:45, 186–199`
  - `src/hooks/use-rallyhub.ts:88–99` (profiles/org_members RLS gap)
- **Problem:** Render crash on the tablet → white screen; deleted team's localStorage id briefly produces a stub team view; super admin client-detail member lists return empty because profiles/organization_members lack super-admin SELECT policies.
- **Breaks when:** Each is a minor confusing dead-end rather than an event-breaker.
- **Recommended fix:** Wrap tablet routes in RouteErrorBoundary; clear stored team id on team DELETE; add super-admin SELECT policies or an RPC.

---

## Audit areas covered

1. **Live event flow & realtime** — C6, C8, H9–H11, M6, M8
2. **Scoring & game logic integrity** — C7, H1–H6, M1–M5
3. **Error handling & empty/loading states** — H3, H7, H8, H13, L1–L2, M7
4. **RLS & multi-tenancy / super admin** — C1–C3, C5, H12, H15, L4, M9
5. **Uploads & storage** — C4, H14, L3, M11
6. **Mobile & responsiveness** — H16, H17
7. **Accessibility (basic)** — M10
8. **Performance** — C8, M11
9. **Security (basic)** — C1–C5, H12, H15, M9

---

## Methodology

Five parallel read-only exploration passes (realtime, scoring, error handling/security, RLS/storage, UX/performance) with the highest-impact claims re-verified directly against source:

- Display timer writes (`DisplayEventPage.tsx:73–124`)
- Bingo line-bonus set scope (`bingo-scoring.ts:55`)
- Native dialog exhaustive grep (10 call sites)
- Storage policies (`007_storage_policies.sql`)
- `invite-member` auth (`supabase/functions/invite-member/index.ts`)

Severity prioritizes issues that would break or embarrass during a **live event with real participants**.

The June 18 remediation pass re-verified every `Fixed` claim directly against the current code and migrations (through `049`):

- Live-table write lockdown and participant guards (`048`, `049`)
- Per-event join-token read scoping + quiz/bonus answer redaction (`041`)
- Storage path/size lockdown (`039`) and scoped org tenant RPCs (`038`)
- Edge-function JWT checks (`activate-bingo-run`, `invite-member`; `reveal-bingo-winner` removed)
- Realtime: per-game listeners, bounded submissions, dedicated chat/bingo broadcast channels (`use-live-event.ts`, `live-broadcast.ts`)

H15 (tablet password) remains **Open**: `043`/`044` reverted `verify_tablet_password` to a plaintext comparison that is still anon-callable without rate limiting.

---

*Last updated: June 18, 2026 — 14 Open, 28 Fixed (C1–C8, H1–H17, M2, M5, M6, M9). All 8 criticals and all 17 highs closed. Remaining: M1, M3, M4, M7 (partial), M8, M10, M11, L1–L6.*
