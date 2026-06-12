# RallyHub Code Audit

**Read-only self-diagnostic · June 12, 2026**

42 findings across realtime, scoring, error handling, RLS/tenancy, storage, mobile, accessibility, performance, and security. **No code was changed** during this audit.

| Severity | Count |
|----------|-------|
| Critical | 8 |
| High | 17 |
| Medium | 11 |
| Low | 6 |

---

## Headline risk

The anon key grants **full write access** to every tenant's live tables (C1/C2): any participant can rewrite scores, reveal quiz answers, or reset a bingo run from DevTools. Combined with the bingo line-bonus repeat (C7) and multi-writer timers (C6), **scoring and timing cannot be trusted in a real event** until these are fixed.

---

## Top 10 before a real event

| # | Findings | What to fix |
|---|----------|-------------|
| 1 | C1, C2 | Lock down live-table RLS (teams, event_state, submissions, bingo_runs) — anyone can rewrite scores and hijack the event today |
| 2 | C7 | Stop the bingo line bonus from re-awarding on every reveal — guarantees a wrong leaderboard in any game with line points |
| 3 | C6 | Make display + preview timers read-only — visible timer jumping on every screen in the room |
| 4 | H1, H2, H3 | Atomic, idempotent scoring: increment-score RPC + approve-where-pending, with error checks before awarding |
| 5 | C8 | Tame the realtime reload storm: filter the games listener, stop chat/bingo_runs full reloads, bound the submissions query |
| 6 | C3 | Stop shipping quiz correct answers in anon-readable game config |
| 7 | C5 | Authenticate the edge functions (activate-bingo-run, invite-member) |
| 8 | C4, H14 | Storage lockdown: no anon writes, path-prefix policies, upload size caps |
| 9 | H6, H7 | Participant integrity: cards for mid-game joiners + surface failed quiz/photo submissions instead of losing them silently |
| 10 | H4, H5 | Correct score reversal on quiz restart and bingo restart |

---

## Critical (8)

### C1 — Anonymous write access to all live tables (RLS `using (true)`)

- **Area:** RLS / Security
- **References:** `supabase/migrations/006_live_event.sql:71–88, 110–117`
- **Problem:** `teams_live_all`, `submissions_live_all`, `event_state_live_all`, `chat_messages_live_all` are `for all to anon, authenticated using (true) with check (true)`, plus `grant all` to anon. Any browser with the public anon key can read and write every row of every tenant.
- **Breaks when:** A participant opens DevTools mid-event and runs `supabase.from('teams').update({ score: 99999 }).eq('id', …)` — or sets `quiz_state: 'revealed'` on event_state to expose answers, deletes rival submissions, or spams any event's chat. No login required.
- **Recommended fix:** Scope policies to the event (join against events / a join token), make writes column-restricted, and move score/state mutations behind SECURITY DEFINER RPCs. Never `using (true)` on writes.

### C2 — bingo_runs / bingo_team_cards: open CRUD for anon

- **Area:** RLS / Security
- **References:**
  - `supabase/migrations/013_music_catalog_bingo_runs.sql:71–104`
  - `src/lib/activate-bingo-run.ts:17–27` (client fallback)
  - `src/lib/restart-bingo-run.ts:10–17`
- **Problem:** Anon can select/insert/update/delete all bingo runs and cards. The client-side fallback in `activateBingoRunLocal` and `restartBingoRun` normalizes doing privileged operations from the browser, so locking the edge function alone won't help.
- **Breaks when:** Anyone with an event UUID (visible in the join URL/QR) deletes the active bingo run or rewrites `play_order` mid-game; every device desyncs.
- **Recommended fix:** Event-scoped policies; run activation/restart only through an authenticated edge function; remove the client-side local fallback.

### C3 — Quiz answers readable by anyone before reveal

- **Area:** RLS / Security
- **References:**
  - `supabase/migrations/006_live_event.sql:100–103` (games_live_select using (true))
  - `src/types/game-config.ts:7` (correctAnswerId in config)
- **Problem:** Game `config` (including `correctAnswerId` for every quiz question) is selectable by anon for ALL games across ALL tenants.
- **Breaks when:** A team member queries `games.select('config')` on their phone during the quiz and reads every correct answer. Quiet, undetectable cheating.
- **Recommended fix:** Strip answers from client-visible config (server-only column, or a view that omits them) and restrict game SELECT to games attached to the live event.

### C4 — game-assets bucket: anon can upload/overwrite any path, no size limits

- **Area:** Storage / Security
- **References:**
  - `supabase/migrations/007_storage_policies.sql:21–37`
  - `supabase/migrations/031_music_catalog_super_admin.sql:19–23` (auth delete any path)
- **Problem:** Anonymous users can insert/update any object in the public `game-assets` bucket; any authenticated user can delete any object (including other orgs' music catalogs). No byte-size limits anywhere.
- **Breaks when:** Anyone floods the bucket with multi-GB junk on your storage bill, or overwrites another org's clip MP3s at known public paths so their bingo plays the wrong audio.
- **Recommended fix:** Require auth + org/event path-prefix checks (`storage.foldername(name)[1] = user_organization_id()`), use signed upload URLs for participants, and enforce size caps.

### C5 — Unauthenticated service-role edge functions

- **Area:** Edge functions / Security
- **References:**
  - `supabase/functions/activate-bingo-run/index.ts:11–28`
  - `supabase/functions/invite-member/index.ts:13–30`
  - `supabase/functions/reveal-bingo-winner/index.ts` (latent — unused but deployed)
- **Problem:** `activate-bingo-run` and `invite-member` accept any unauthenticated POST and execute with the service role. `invite-member` lets anyone invite any email into any organization (verified — no Authorization check at all).
- **Breaks when:** An attacker POSTs to `/functions/v1/activate-bingo-run` to reset any event's bingo run, or invites themselves into a victim org via `invite-member`.
- **Recommended fix:** Verify the caller JWT and role/org membership at the top of every function; `create-client` already does this correctly — copy that pattern. Delete `reveal-bingo-winner` if unused.

### C6 — Display screen (and preview iframe) writes event timers — fights the facilitator

- **Area:** Realtime / Live flow
- **References:**
  - `src/pages/live/DisplayEventPage.tsx:73–124`
  - `src/components/live/DisplayPreviewFrame.tsx` (embed only skips sound gate)
- **Problem:** The display runs `useLiveTimer` with `createThrottledTimerSync` callbacks that call `updateState` for the main, quiz, and break timers — same as the facilitator. The facilitator's embedded display preview does too. Multiple writers tick at slightly different rates.
- **Breaks when:** Facilitator starts a quiz timer; the venue display and the preview iframe each write their own drifting `timer_seconds` every ~3s. The countdown visibly jumps backward/forward on every screen in the room.
- **Recommended fix:** Make display/participant timers read-only (no-op onTick, the pattern JoinGameView already uses). Only the facilitator persists timer state.

### C7 — Bingo line bonus re-awarded on every reveal after a team wins

- **Area:** Scoring
- **References:** `src/lib/bingo-scoring.ts:55, 114–124`
- **Problem:** `lineAwarded` is a fresh `Set` created inside each `scoreBingoRound` call (verified). Once a team's win condition is achieved, every subsequent song reveal re-detects `achieved === true` and pays `bingo_line_points` again.
- **Breaks when:** With 50 line points, a team that completes a line on song 6 of 25 collects +50 on each of the remaining ~19 reveals — roughly 950 phantom points. Leaderboard is garbage by the end of the round.
- **Recommended fix:** Persist 'line bonus paid' per (run_id, team_id) — a column on bingo_runs/cards or tracked via event_state — and only award on the false→true transition.

### C8 — Realtime reload storm: unfiltered games listener + unbounded bundle fetches

- **Area:** Realtime / Performance
- **References:**
  - `src/hooks/use-live-event.ts:219–223` (games listener, no filter)
  - `src/hooks/use-live-event.ts:53–57` (all submissions, no limit)
  - `src/hooks/use-live-event.ts:209–217` (chat + bingo_runs → full reload)
- **Problem:** The `games` realtime listener (added in the recent stale-config fix) has NO filter — any game edit in ANY org triggers a debounced full-bundle reload on every connected live client of every tenant. Each reload refetches ALL submissions for the event with no limit; chat inserts and bingo_runs updates also force full reloads.
- **Breaks when:** An admin edits a game in another org while your event runs: 30 phones + the display + the facilitator all refetch thousands of submission rows over bar Wi-Fi. Repeated chat messages keep the storm going; the UI lags exactly when it matters.
- **Recommended fix:** Filter the games listener to the event's game IDs (or merge the changed row in place), drop the chat/bingo_runs full-reload handlers (each already has its own hook), and bound the submissions query (by stage/status or a limit).

---

## High (17)

### H1 — All team-score updates are non-atomic read-modify-write

- **Area:** Scoring
- **References:**
  - `src/lib/apply-submission-points.ts:9–19`
  - `src/lib/live-event.ts:367–371`
  - `src/pages/live/FacilitatorEventPage.tsx:435–442`
- **Problem:** Every scoring path reads `team.score` and writes back an absolute value. Concurrent writers (two facilitator tabs, auto-reveal racing manual reveal, bingo scoring overlapping a manual approval) read the same base and the last write wins.
- **Breaks when:** Facilitator approves two submissions for the same team in quick succession; the second write uses the stale pre-first-approval score and silently erases the first award.
- **Recommended fix:** One Postgres RPC `increment_team_score(team_id, delta)` doing `SET score = score + $1`, used by every approval/scoring path.

### H2 — Quiz double-scoring race (auto-reveal vs manual vs second facilitator)

- **Area:** Scoring
- **References:**
  - `src/pages/live/FacilitatorEventPage.tsx:252–302`
  - `src/lib/live-event.ts:358–371`
- **Problem:** Idempotency is a client-side ref (`quizAutoRevealKey`) per browser. The DB guard (`status === 'approved' && points_awarded != null`) doesn't close the read-to-write window, so two scorers can both pass it.
- **Breaks when:** Timer hits zero (auto-reveal fires) at the moment the facilitator clicks Next Question, or two facilitator devices are open: correct teams get double points.
- **Recommended fix:** Atomic approval: `UPDATE submissions SET status='approved', points_awarded=$1 WHERE id=$2 AND status='pending' RETURNING id`, and only increment the team score when a row came back.

### H3 — approveSubmission awards points even when the submission update fails

- **Area:** Error handling / Scoring
- **References:** `src/pages/live/FacilitatorEventPage.tsx:435–449`
- **Problem:** The submission `update` result is not checked before `updateTeam` adds points; `rejectSubmission` is also unchecked.
- **Breaks when:** A flaky connection drops the submission update; the team still gets points, the submission stays pending, and a second approval doubles them.
- **Recommended fix:** Check `{ error }` on the update; only award on success; surface failures via `notify()`.

### H4 — restartQuiz under-subtracts when a team has multiple scored questions

- **Area:** Scoring
- **References:** `src/pages/live/FacilitatorEventPage.tsx:575–591`
- **Problem:** The loop subtracts each submission's points from the ORIGINAL `teams` snapshot, so a team with two 25-point answers loses 25, not 50.
- **Breaks when:** Quiz restarted after 3 questions: every multi-answer team keeps phantom quiz points; the rerun's leaderboard is wrong from the start.
- **Recommended fix:** Group submissions by team, sum quiz points, do one subtract per team (or use the H1 increment RPC with negative deltas).

### H5 — restartBingoRun wipes submissions but never reverses awarded points

- **Area:** Scoring
- **References:** `src/lib/restart-bingo-run.ts:10–17`
- **Problem:** Restart deletes the run, cards, and bingo submissions, but scores already added to `teams.score` remain (unlike restartQuiz, which at least attempts reversal).
- **Breaks when:** Facilitator restarts bingo after teams earned 200 points; the fresh round starts with permanently inflated scores.
- **Recommended fix:** Before deleting, sum approved bingo/bonus `points_awarded` per team and subtract.

### H6 — Team that joins mid-bingo never gets a card — marked cells never score

- **Area:** Game logic
- **References:**
  - `src/components/live/JoinGameView.tsx:1155–1158` (client-side fallback card)
  - `src/lib/activate-bingo-run.ts:61–88` (cards only at activation)
- **Problem:** Cards are generated once at activation for teams named at that moment. A late team sees a locally generated fallback grid, but `scoreBingoRound` only iterates DB cards, so they're invisible to scoring.
- **Breaks when:** A 4th team claims a slot during song 5. They play along the whole round and end with zero points and pending marks that never resolve.
- **Recommended fix:** On team claim during an active bingo stage, insert a card row for the live run (server-side), or block play with a clear 'joined too late for this round' message.

### H7 — Participant writes fail silently (quiz answers, photo submits, bingo bonus)

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

- **Area:** Error handling
- **References:**
  - `src/lib/bingo-round-advance.ts:41–56`
  - `src/lib/bingo-scoring.ts:78–97` (console.error only)
  - `src/lib/bingo-bonus-scoring.ts:28–34`
- **Problem:** Approve/reject updates, pending-mark deletion, and run-index advances ignore or merely log errors; follow-up steps (points, advance) run anyway.
- **Breaks when:** Reveal partially fails: some teams' marks stay pending and show the wrong color, but the round advances and the inconsistency compounds.
- **Recommended fix:** Propagate errors to the facilitator caller and stop the advance; retry or notify.

### H9 — event_games and org branding load once and never update live

- **Area:** Realtime
- **References:** `src/hooks/use-live-event.ts:19–27, 45–51`
- **Problem:** `event_games` and `organization_tenant_public` are fetched once into the bundle; neither table is in the realtime publication and there are no listeners — the same stale-data class as the games-config bug already hit.
- **Breaks when:** Staff attach a new photo challenge to the running event from admin; participants never see it until they manually refresh.
- **Recommended fix:** Publish `event_games` and listen with an `event_id` filter (reload the games slice), or denormalize what live screens need onto `events` (already realtime).

### H10 — bingo_team_cards not realtime + 60s staleTime — stale cards after restart

- **Area:** Realtime
- **References:**
  - `src/hooks/use-bingo-run.ts:46–62`
  - `supabase/migrations/013_music_catalog_bingo_runs.sql` (no publication entry)
- **Problem:** Cards are cached for 60s with no postgres subscription; invalidation depends on event_state fields changing.
- **Breaks when:** Facilitator restarts bingo; a participant's device keeps showing the old card (tied to the deleted run) for up to a minute and marks cells the scorer will never approve.
- **Recommended fix:** Publish `bingo_team_cards` and subscribe/invalidate on run changes; set `staleTime: 0` for live card queries.

### H11 — bingoRunOverride can diverge from the DB run across facilitators

- **Area:** Realtime / Live flow
- **References:** `src/pages/live/FacilitatorEventPage.tsx:106, 660`
- **Problem:** `effectiveBingoRun = bingoRunOverride ?? bingoRunQuery.data`; the local override is only cleared on stage switch, not when another facilitator restarts the run.
- **Breaks when:** Facilitator A restarts bingo; co-facilitator B keeps the old run's playOrder and advances/scoring against a run that no longer exists.
- **Recommended fix:** Clear the override on `bingo_runs` realtime events and prefer the React Query value once it reflects the latest activation.

### H12 — Cross-tenant enumeration: events, games, event_games, music_catalog readable by anyone

- **Area:** RLS / Security
- **References:**
  - `supabase/migrations/006_live_event.sql:90–103`
  - `supabase/migrations/013_music_catalog_bingo_runs.sql:66–69`
  - `supabase/migrations/003_games_events_schema.sql:145–147` (open org INSERT)
- **Problem:** `using (true)` SELECT policies let any anon client list every tenant's events, stages, game configs, and music catalog (licensed audio URLs). Separately, ANY authenticated user can insert rows into `organizations`.
- **Breaks when:** A competitor scrapes all client event names and the entire music catalog of every org; any logged-in event manager pollutes the tenant namespace with junk orgs.
- **Recommended fix:** Restrict SELECT to rows linked to a known live event / own org; org creation only via the super-admin edge function.

### H13 — Blank participant screen if the quiz game is deleted mid-event

- **Area:** Empty states
- **References:** `src/components/live/JoinGameView.tsx:909–1063`
- **Problem:** The quiz branch assigns `body` only when game + question resolve; with a deleted game or missing question the screen renders an empty div.
- **Breaks when:** Admin deletes/replaces a quiz game while the stage is active: every participant phone goes blank with no message.
- **Recommended fix:** Add an explicit fallback ('Quiz unavailable — stand by') when the stage's game or question can't be resolved.

### H14 — No upload size caps anywhere; video duration check bypassed on metadata error

- **Area:** Uploads
- **References:**
  - `src/components/live/VideoChallengeCapture.tsx:128` (onerror → resolve(true))
  - All `uploadAsset` call sites (no file.size checks)
- **Problem:** Only video duration is validated, and a metadata load failure ACCEPTS the file. Photos, audio, and logos have type hints (`accept=`) but no byte limits.
- **Breaks when:** A participant submits a 2GB video from their camera roll mid-event; uploads crawl for everyone on venue Wi-Fi and storage costs spike.
- **Recommended fix:** Reject on metadata error; enforce client-side byte caps (e.g. 50MB) plus server-side limits via storage policies or an upload proxy.

### H15 — Tablet password: plaintext storage, brute-forceable RPC, forgeable session flag

- **Area:** Security
- **References:**
  - `supabase/migrations/008_tenant_subdomains.sql:73–94`
  - `src/pages/live/TabletPage.tsx:157` (sessionStorage '1')
- **Problem:** `verify_tablet_password` compares plaintext and is callable by anon with no rate limit; the client then just sets a sessionStorage flag anyone can set manually in DevTools.
- **Breaks when:** A guest opens DevTools on the venue tablet, sets the flag, and gets the tablet admin surface without the password.
- **Recommended fix:** Hash the password (crypt/bcrypt), rate-limit the RPC, and gate the tablet UI on a server-issued short-lived token instead of a client flag.

### H16 — Mobile: floating chat/exit buttons overlap submit controls; claim modals exceed the viewport

- **Area:** Mobile UX
- **References:**
  - `src/components/live/JoinGameView.tsx:745, 1284–1339`
  - `src/pages/live/JoinEventPage.tsx:264–324`
  - `src/pages/live/FacilitatorEventPage.tsx:1643–1672`
- **Problem:** Fixed FABs (chat bottom-left, exit bottom-right, z-[9999]) sit over photo/video capture submit buttons (open-game flow uses pb-4 vs pb-24 elsewhere). The claim-team modal has no max-height/scroll, so the iOS keyboard clips the Join button.
- **Breaks when:** A team finishes a photo challenge and the Submit button is half-hidden under the chat bubble; another can't reach 'Join' once the keyboard opens on a small phone.
- **Recommended fix:** pb-24 + safe-area padding on capture flows, hide FABs during capture, `max-h-[90dvh] overflow-y-auto` on modals.

### H17 — Bingo cell text is 7–8px — unreadable on phones

- **Area:** Mobile UX
- **References:** `src/components/live/JoinGameView.tsx:1233–1238`
- **Problem:** Cell labels render at `text-[8px]`/`text-[7px]` inside the fixed 5×5 grid.
- **Breaks when:** In a dim, noisy venue, teams can't read song titles on their cards — the core interaction of music bingo.
- **Recommended fix:** Minimum ~11px with tighter truncation, or tap-to-expand cell detail; keep 44px tap targets.

---

## Medium (11)

### M1 — skipQuizQuestion skips scoring AND bypasses the round intro

- **Area:** Quiz rounds
- **References:** `src/pages/live/FacilitatorEventPage.tsx:531–547`
- **Problem:** Skip never scores submitted answers (teams that answered get nothing, possibly intended but undocumented) and jumps straight to `active`, never `round_intro`, diverging from goToNextQuestion at round boundaries.
- **Breaks when:** Facilitator skips the last question of Round 1; the ROUND 2 interstitial never shows and answered teams silently get zero.
- **Recommended fix:** Decide semantics: either score-then-skip or reject pending answers explicitly; route through the same round-boundary logic as goToNextQuestion.

### M2 — Quiz answers can change after the facilitator timer ends

- **Area:** Quiz logic
- **References:**
  - `src/components/live/JoinGameView.tsx:479–506`
  - `src/pages/live/FacilitatorEventPage.tsx:281–282`
- **Problem:** Participant lock is a local 5s window from first tap; submit only checks `quiz_state === 'active'`. Auto-reveal triggers on the facilitator's local timer, so a participant with clock skew can still update their answer during scoring.
- **Breaks when:** Facilitator timer hits 0 and scoring starts; a phone showing 2s left changes its answer — the device shows Correct while the DB scored the old value (or vice versa).
- **Recommended fix:** Flip `quiz_state` to revealed BEFORE scoring and have submit reject non-active states server-side (RPC or status check in the update WHERE clause).

### M3 — Duplicate trackId on cards with fewer than 25 tracks — ambiguous scoring

- **Area:** Bingo logic
- **References:**
  - `src/lib/bingo-engine.ts:39–54` (pick25 duplicates)
  - `src/lib/bingo-cell-match.ts:21–30`
- **Problem:** Cards pad to 25 cells by repeating tracks; submissions store trackId, not cell index, so any duplicate cell matches.
- **Breaks when:** A 15-track game has the same song on two cells; the scorer can approve a different cell than the team thinks they marked, confusing line detection.
- **Recommended fix:** Store and score by cell index (or unique per-cell id) instead of trackId.

### M4 — playOrder fallback to tracks[index] can mis-attribute the playing song

- **Area:** Bingo logic
- **References:** `src/pages/live/FacilitatorEventPage.tsx:663–666`
- **Problem:** If a playOrder id isn't found in the current track list (playlist edited after activation), the UI/audio falls back to the positional track while scoring still uses the playOrder id.
- **Breaks when:** Facilitator hears Song A but the reveal validates marks against Song B; teams' correct marks get rejected.
- **Recommended fix:** Fail loudly when an id is missing rather than index-falling-back; freeze track metadata on the run at activation.

### M5 — Pressing Start clears announced winners — same team can be re-celebrated

- **Area:** Bingo logic
- **References:** `src/pages/live/FacilitatorEventPage.tsx:757–761`
- **Problem:** Start/resume wipes `bingo_announced_winner_ids` while approved cells persist, so the next reveal re-detects the same win as new.
- **Breaks when:** After a win halt, facilitator presses Start instead of Continue; the same team gets a second trophy celebration.
- **Recommended fix:** Only clear announced winners on run restart/reset, not on Start.

### M6 — Chat misses messages sent during a disconnect; duplicate listener forces full reloads

- **Area:** Realtime
- **References:** `src/hooks/use-live-event.ts:209–213, 305–339`
- **Problem:** useChatMessages append-only INSERT subscription has no reconnect reload, so messages sent while offline never appear. Meanwhile the bundle channel ALSO listens to chat_messages and full-reloads the bundle on every message.
- **Breaks when:** Wi-Fi blip on the facilitator laptop: a team's question sent during the gap is permanently invisible until manual refresh.
- **Recommended fix:** Reload chat on SUBSCRIBED status (same pattern as the bundle channel); remove the redundant chat listener from the bundle channel.

### M7 — 10 remaining native dialogs (window.confirm/prompt/alert)

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

- **Area:** Realtime
- **References:** `src/hooks/use-live-event.ts:126–131, 156–160, 249–264`
- **Problem:** A full bundle reload triggered by an unrelated table can return pre-write state and clobber an in-flight optimistic updateState; event_state realtime replaces the whole row with no merge against pending local patches.
- **Breaks when:** Facilitator toggles show_scores at the moment a game edit triggers a reload; the toggle visibly reverts, then re-applies a second later.
- **Recommended fix:** Merge reload results with pending local patches, or suppress reload-applied state for fields with in-flight writes (largely mitigated by fixing C8).

### M9 — organization_tenant_public view allows full tenant enumeration

- **Area:** Security
- **References:** `supabase/migrations/008_tenant_subdomains.sql:54–67`
- **Problem:** The view is granted to anon with no row filter and (as a default view) may bypass base-table RLS via owner privileges — exposing every org's subdomain, tablet_slug, and branding.
- **Breaks when:** Anyone lists all tenant subdomains and tablet slugs in one query and probes each tenant's tablet page.
- **Recommended fix:** Set `security_invoker = true` and route public lookups through the `resolve_tenant_by_host` RPC only.

### M10 — Accessibility: overlays lack dialog semantics; meaningful images have empty alt

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

- **Area:** Quiz logic
- **References:** `src/pages/live/FacilitatorEventPage.tsx:270–282`
- **Problem:** Auto-reveal requires named teams (for all-answered) or a RUNNING timer at 0; with neither, the question sits in active forever (manual Reveal still works).
- **Breaks when:** Rehearsal/demo with empty slots and paused timer looks frozen.
- **Recommended fix:** Treat an exhausted timer as done regardless of the running flag.

### L2 — Leaderboard renders blank with zero named teams

- **Area:** Empty states
- **References:** `src/components/live/Leaderboards.tsx:28–30`
- **Problem:** Unnamed teams are filtered out and nothing else renders.
- **Breaks when:** Display turned on before doors open shows an empty area instead of a 'waiting for teams' message.
- **Recommended fix:** Add empty-state copy ('Waiting for teams to join…').

### L3 — Storage path hygiene: raw file.name segments and extensionless live keys

- **Area:** Uploads
- **References:**
  - `src/components/games/MusicCatalogUploader.tsx:94–97` (raw file.name in full-audio path)
  - `src/components/live/JoinGameView.tsx:453–456, 539–542`
  - `src/pages/live/JoinEventPage.tsx:132–135`
- **Problem:** Central sanitizeStoragePath prevents the old %2520 class, but the catalog full-audio path bypasses audioStorageFilename; live submission keys carry no extension.
- **Breaks when:** Odd filenames produce confusing object keys; content-type sniffing edge cases for extensionless objects on some CDNs.
- **Recommended fix:** Run all audio names through audioStorageFilename; append a sanitized extension to live upload keys.

### L4 — Dead fetchOrgSubdomain queries the RLS-blocked organizations base table

- **Area:** RLS
- **References:** `src/lib/tenant.ts:212–217`
- **Problem:** No current callers, but any future anon/live usage would silently fail post-008 (no anon policy on the base table).
- **Breaks when:** A future feature uses it on a live page and gets empty results.
- **Recommended fix:** Delete it or reroute through organization_tenant_public / resolve_tenant_by_host.

### L5 — Bingo tap optimistic state flickers before realtime confirms

- **Area:** Live UX
- **References:** `src/components/live/JoinGameView.tsx:612–654`
- **Problem:** bingoPickOptimisticRef is cleared in finally, before the submission INSERT arrives via realtime, so the highlight can blink off briefly on slow networks.
- **Breaks when:** Participant double-taps thinking the mark didn't register.
- **Recommended fix:** Keep the optimistic state until the matching submission appears in the bundle.

### L6 — Misc: /tablet has no error boundary; stale localStorage team id; super-admin member lists silently empty

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

---

*Generated from RallyHub codebase audit — no code changes were made.*
