# RallyHub Fixes Tracker

Workflow since 7 Jul 2026: small fixes, redesigns and features push straight
to `main` (production). The `fixes` branch is reserved for risky live-event
work (currently: the bingo smoothness investigation). Branch `stable-2.0` is
the pre-2.1.0 fallback checkpoint.

**Versioning on main** (three numbers, MAJOR.MINOR.PATCH):
- Patch (small fixes): 2.0.1, 2.0.2, ...
- Minor (bigger updates): 2.1.0, 2.1.1, ...
- Major (big new features): 3.0.0, ...
Bump `APP_VERSION` in `src/lib/version.ts` + add a CHANGELOG entry on every main push.

## How we avoid breaking things (rules for every session)

1. One live-event code change at a time. Never bundle two live-path changes in one commit.
2. Anything touching bingo, realtime, or the player view gets a live smoke test (throwaway event, real phone) before the next change starts.
3. Admin-only work (editors, settings, dashboards) is the safe zone and can move faster.
4. Scoring gets a test suite before we touch scoring again.
5. Every risky change lands as its own commit so a single `git revert` undoes exactly that change, not a whole batch. No more full rollbacks.

---

## Session plan

**Session 1 — safety net + zero-risk cleanup.** Set up vitest and write tests
around bingo scoring, line bonus, and restart maths (pure functions, no live
risk, protects everything after). Re-delete dead files (ENG3), strip PII logs
(P2-4), branch cleanup (ENG7).

**Session 2 — quest editor + admin features (safe zone).** Q-1 multi-select,
Q-2 game-time labels, Q-3 drag-to-reorder, P2-3 tablet PIN. None of this runs
during a live event.

**Session 3 — the bingo Start bug, alone.** P1-B1: needs live pairing with
Rumen's phone. One diagnosis, one change, one live test. Nothing else that
session.

**Session 4 — live re-lands, one at a time, each smoke-tested.** P1-B4 cancel
broadcast, then P1-3/P1-3b atomic restarts (server RPCs already live on the
DB), then P2-2 backoff cap last (error-path only; see note in its entry).

**Session 5 — remove bonus games again (BONUS-RM).** Touches editor,
facilitator, player and display, so it gets its own session and a full bingo
round smoke test.

**Session 6+ — facilitator console redesign.** UI-1 to UI-7 plus the
FacilitatorEventPage refactor (ENG1). Staged over multiple sessions; each
stage live-tested before the next.

**Parked / needs a design chat first:** P1-1,
ENG2, AI features (L-2), PDF report (PDF-1).

---

## Already in main (verified, no action)

- [x] Winner sound on player phones fixed (ae62a28)
- [x] Bingo tile delay + auto-advance win (ae62a28)
- [x] Bingo win: instant green cells + line bonus pays once (67e4d30, tracked via `paid_line_bonus_team_ids`)
- [x] DB migrations 074-079 live: atomic line-bonus + restart RPCs, join token only for active events (P1-4), storage upload ownership (P0-2), attach-game refresh trigger (P1-2)
- [x] **Fixed** migration 078's attach-game trigger wrote `events.updated_at`, a column that never existed on `events` — every event_games insert/delete threw `42703`, so games silently failed to attach to new events (event saved as draft, "This game is unavailable" in Play). Migration 084 adds the column + trigger (V2.3.0)
- [x] Recycle bin for games + events: soft-delete with a Bin tab, 30-day restore window, auto-purge via pg_cron (migration 085); invoiced events keep their row after purge for payment history. Description field got basic rich text (bold/italic/underline/size/colour) + a bigger box; video default duration now 30s (V2.3.0)
- [x] Client onboarding: 19-step interactive in-app tutorial (replaces the old L-1 "onboarding PDF" idea, dropped)
- [x] Onboarding v2 (on `fixes`): per-user progress (migration 083; every existing account resets, each new user gets their own tour, event_manager sees a trimmed 10-step run), panel auto-minimises to a corner pill while the spotlight points at the page, completed steps clickable to revisit, Mark complete on every step
- [x] Dropped the obsolete `organizations.onboarding_completed_tasks` / `onboarding_dismissed` columns — per-user version already live on `main`; applied via migration 086 with Rumen's explicit confirmation (2026-07-08), TS types cleaned up in `src/types/database.ts`

## Open bugs / security

- [ ] **SEC-TEAM Participant writes are event-scoped, not team-owned** — existing
  limitation found during the V2.10.3 optimistic-submit security review. Every
  anonymous participant in an event shares the same join token; current
  submission RLS/guards verify the event but cannot prove that the caller owns
  the submitted `team_id`. A participant crafting direct API requests could
  therefore attempt writes against another team in the same event. This is not
  introduced or widened by client-generated submission IDs (an ID collision is
  a rejected plain INSERT, never an overwrite). A real fix needs a separate
  short-lived participant/team credential minted when a team is claimed, then
  enforced in submission INSERT/UPDATE/DELETE policies and triggers. Treat as a
  dedicated live-security migration with compatibility planning and phone tests.
- [x] **P1-QUIZ-REVEAL** Next question did not auto-reveal after a timeout — **fixed in V2.10.2**. `quizTimerDisplay` remained `0` for the first render of the next question while `useLiveTimer` synchronized to the new duration in an effect. The facilitator interpreted that stale display as a second timeout and consumed the new question's one-shot reveal key before anyone answered; if the normal start write then won the race, later answers could not auto-reveal. Auto-reveal now uses authoritative `quiz_timer_running` + `quiz_timer_seconds`. The reveal RPC also advances `event_state.updated_at`, so timestamp-guarded fallback polling accepts the changed state when Realtime is missed. Regression-covered in `quiz-auto-reveal.test.ts`.
- [x] **FACIL-2** Event-manager facilitator-link black screen — **fixed in V2.5.5**. `isAtLeastFacilitator()` accidentally omitted `event_manager`; valid Afterglow event-manager sessions were rejected by the facilitator route, sent to login, and immediately redirected back to the same rejected UUID route in a loop. Added the missing role; the pretty link → UUID redirect is expected and unchanged.
- [x] **P1-B5** Event-manager bingo run missing — **fixed in V2.5.6**. FACIL-2 exposed a second authorization layer: the route accepted event managers, but `activate-bingo-run` and `is_facilitator_for_event()` still rejected them. The panel then fell back to playing the first configured clip despite zero `bingo_runs`/`bingo_team_cards`, so it displayed `0 / 0 songs` and could not advance. The RLS helper is live and verified against the Afterglow Test event-manager identity; the client fallback now creates runs/cards. Edge Function source is ready, but its dashboard deployment remains pending because the configured CLI account lacks project deploy privileges.
- [x] **SEC-1 Phase 1 security hardening** — **fully live as of 2026-07-11** (V2.4.8 on Vercel, migration applied to prod DB, 5 edge functions redeployed: create-client, create-org-user, register-client, update-org-user, set-org-user-password). Advisor confirms: anon-executable SECURITY DEFINER functions 46 → 28 (remainder are public-by-design or SEC-4 candidates), public bucket listing warnings gone. Note: the 2026-07-09 session committed all of this locally but deployed none of it — nothing was live until 11 July. See `docs/SECURITY-REVIEW-2026-07.md`.
- [x] **SEC-5 New advisor findings (2026-07-11)** — DONE (V2.4.9 + dashboard cleanup): `organizations` INSERT policy now `is_super_admin()` (was always-true); leaked password protection enabled in Auth; 14 mutable-search_path functions pinned to `search_path = public`; local `create-facilitator` + `invite-member` sources deleted; the deployed `smooth-api`, `invite-member`, `reveal-bingo-winner` functions deleted in the Supabase dashboard by Rumen (confirmed gone 2026-07-11). Deliberately NOT done (low value / over-engineering): the lone `invoices` SELECT multiple-permissive warning (would need 2→4 policies to preserve super-admin writes) and dropping a submissions index (the plain `(event_id)` is actively used; the composite is the unused one).
- [x] **LOAD-1 Live-event load test** — `npm run load:test` (`scripts/load-test-live-event.mjs`) simulates N participant phones over the real anon join-token path (bootstrap RPC, bundle load, Realtime subscribe, concurrent submission waves + broadcast fan-out), cleans up after itself. 2026-07-11 baseline vs prod: 15 phones — insert p50 98ms / p95 417ms, broadcast p50 53ms, 100% delivery, 0 errors; 30 phones — insert p50 118ms / p95 207ms, broadcast p50 54ms / max 182ms, 100% delivery, 0 errors.
- [x] **SEC-2 RLS performance advisor cleanup** — **live in V2.4.11** (migration `20260711180000`). Wrapped `auth.uid()`/`is_super_admin()`/`user_organization_id()` in `(select ...)` and merged own-org + super-admin permissive pairs across 18 tables. `auth_rls_initplan` 21 → 0; `multiple_permissive_policies` 29 → 1 (only invoices SELECT left; an all+select merge, skipped as low-value/awkward). Behaviour-preserving: RLS-visible row counts verified byte-identical for super_admin/client_admin/event_manager before vs after (in-DB simulation), anon path confirmed via load test.
- [x] **SEC-3 Index/query advisor cleanup** — **live in V2.4.9** (migration `20260711130000`). Added all 19 missing FK indexes + composite `submissions(event_id, created_at desc)`; advisor `unindexed_foreign_keys` 19 → 0. `unused_index` count rose (new indexes not yet hit — expected); deferred dropping the now-redundant plain `submissions(event_id)` index and any "unused" ones until after a real usage window.
- [x] **SEC-4 Security-definer grant audit, round 2** — **live in V2.4.10** (migration `20260711160000`). Revoked `anon` execute from 11 functions after verifying none are used by an anon surface: 5 RLS helpers (only in `authenticated` policies), 3 admin RPCs (authenticated pages only), 3 internal workers (service_role/cron). Each kept exactly the role it needs. Anon-executable SECURITY DEFINER: 28 → 17; the 17 that remain are all public-by-design (live bootstrap/lookup, tenant/login resolution, tablet PIN/session, join-token helpers, storage path checks). Verified anon path intact via load test (0 errors). Remaining follow-up (low priority): 39 authenticated-executable functions are mostly legitimate app RPCs; a possible future trim is `storage_game_assets_org_path_allowed`/`log_event_activity`/`record_tablet_login_failure` anon grants, deferred as higher-risk / lower-reward.
- [x] **P1-SUBMIT** Fixed, **on `main` as of V2.4.0**, with follow-ups in
  **V2.10.1** and **V2.10.3** — the original fix stopped awaiting best-effort
  broadcast fan-out before clearing the submitter's own loading state
  (`mergeOwnSubmission` locally + fire-and-forget broadcast). V2.10.1 pre-minted
  the signed Storage upload URL when a participant opens a photo/video challenge.
  V2.10.3 closes the remaining post-commit phone delay: text/photo/video quests
  insert a client-ID optimistic pending row as soon as the database request is
  dispatched, reconcile it with the returned server row, and roll it back on
  rejection. Cancel stays unavailable until acknowledgement. Production anon/RLS
  smoke: client-generated-ID insert 133ms, zero errors, temporary data cleaned up.
  File upload time still depends on size and connection, but the phone no longer
  holds its loading screen after dispatch while the facilitator already has the
  submission.
- [x] **P1-BINGO** 3 fixes landed, **on `main` as of V2.4.0** — shipped ahead of a live phone test, at Rumen's explicit call (2026-07-08); the structural follow-up is now fixed on `fixes` and awaits Rumen's real-phone confirmation before merging:
  1. **Start double-press (P1-B1) — fixed.** A brand-new bingo stage had no run row yet, so the first Start press had to await `activateBingoRun()` before it could call `play()` — outside the original user gesture, so mobile browsers silently blocked autoplay (the code literally said "press Start again to play"). Now the run pre-warms as soon as the stage is selected. Verified live: run row exists in the DB before any Start press.
  2. **"Stays yellow for a while before it turns green" — fixed.** The lock+score+reveal trigger only fired in a narrow 1-second `timeupdate` window (`remaining` between 4-5s); a skipped/coarse tick (plausible under tab throttling) silently deferred reveal+scoring until AFTER the full ~4s crossfade finished, so the next song was already playing while the previous one's cells sat pending. Widened the trigger to fire as soon as `remaining <= revealLeadSeconds`, no lower bound. New regression test in `src/lib/bingo-playback.test.ts` reproduces the exact skipped-tick case. This almost certainly also improves "win animation took a while to show up" (winner detection runs inside the same deferred call) — plausible but NOT separately live-verified since triggering a real win needs a full winning line.
  3. **"Sometimes can't select right away" — structural fix confirmed and promoted in V2.11.0 (2026-07-15).** Deep replay found two independent causes: scoring read pending marks *before* the phone was locked (a late-tap race), and the one auto-advance callback was discarded whenever scoring was still busy, leaving players locked on the old round indefinitely. The phone now locks before the scoring snapshot; the callback waits for that exact scoring job instead of returning; correct-mark writes are batched, team score updates run concurrently, and the next round opens as soon as the next audio deck starts while the 4s fade finishes locally in the background. Isolated browser smoke with 15 simultaneous correct marks: lock in 0.28s, next song selectable in 0.96s total. Controlled 15-team winner: winning player notice in 1.04s. Only the authoritative winning team's phone renders a static black screen with one `BINGO!` text node—no confetti, motion component, transition, or animated class. Rumen confirmed the phone flow works without issues before promotion; display/facilitator celebration remains separate.
- [x] **P0-2b** Anon storage overwrite hardening — new `mint-storage-upload-url` edge function verifies the join token against the specific event (a normal request, headers ARE visible there, unlike storage RLS), then mints a signed upload URL scoped to exactly that path. Both participant upload call sites (quest submissions in `JoinGameView.tsx`, team claim photo in `JoinEventPage.tsx`) now route through it via `uploadParticipantAsset`. Since nothing else in the app called storage directly (confirmed via grep), also removed the old anon INSERT/UPDATE policies on `game-assets` entirely (migration 088) — structurally different from the 076→079 revert (that tried to make RLS itself token-aware and broke live uploads; this just removes the anon write path since the signed-URL flow needs zero RLS grant). Verified live: signed-URL upload succeeds, and a direct anon upload attempt now correctly gets rejected with an RLS error. (on `main` as of V2.4.6)
- [x] **P1-1** Players recover if facilitator tab closes — **on `main` as of V2.4.12, needs a real-phone bingo smoke test.** Root cause of the parked attempt: a *full-bundle* poll replaced games/state and reset the bingo player. Real fix is targeted: the current song index is persisted to `bingo_runs` on every advance, so `useBingoRun` now polls just that row and moves players forward only when the facilitator's broadcast has been silent 6s+ (a no-op while broadcasts flow → normal play untouched). `pickRecoveredBingoRun` guard prevents any rewind on a stale read (unit-tested). Quiz/announcements/timer/break were already covered by the existing `event_state` safety poll in `use-live-event.ts`; quest submissions are player→server so never froze. Minor remaining gap (not fixed, low value): live team *scores* on the player view don't poll, so they'd freeze if the facilitator drops — cosmetic, players can still play.
- [x] **P1-3b** Atomic quiz restart — restart_quiz_scores RPC (migration 082, live on prod) + client swap (on `fixes`; needs live test)
- [x] **P2-1** Multi-facilitator last-write-wins — documented rather than fixed: `updateState` in `src/hooks/use-live-event.ts` now has a comment spelling out the single-facilitator assumption and what a real fix (version/etag on event_state) would need (on `main` as of V2.4.2)
- [x] **P2-3** Tablet PIN: Settings warns + blocks the kiosk link until a non-default password is saved (on `fixes`)
- [x] **P2-5** register-client signup rate limiting — per-IP limit (5/hour, `signup_attempts` table, migration 087), enforced server-side in the edge function before any org/user is created; verified live (5 succeed, 6th returns 429). **Bonus fix**: found and fixed a real hooks-order bug in `RegisterPage.tsx` while testing — two early `return`s sat before 8 `useState` calls, crashing the whole page ("Rendered fewer hooks than expected") whenever `user`/host status changed value between renders (e.g. a stale session). Registration was silently broken for anyone hitting that edge case (on `main` as of V2.4.4)
- [x] **P2-5b** Cloudflare Turnstile wired into the register form + `register-client` Edge Function. The frontend sends the Turnstile token with signup, and the Edge Function verifies it server-side when `TURNSTILE_SECRET_KEY` is configured; rate limiting remains in place as the fallback guard. (V2.4.7)
- [x] **P2-UP** Photo compression before upload — found the real gap: the in-app WebRTC camera capture already downscaled via `downscalePhoto`, but the native-camera-app fallback (`ChallengeMediaCaptureFlow.tsx`, used on iOS) and both team-claim-photo pickers (participant `JoinEventPage.tsx`, facilitator `FacilitatorEventPage.tsx`) uploaded the raw, full-resolution file straight from the camera. Wired `downscalePhoto` into all three. Verified live: a 1.2MB test photo uploaded through the team-claim path landed in storage at 253KB (~79% smaller), correct filename/mimetype preserved. Upload error handling already existed (`validateUploadFileSize` + try/catch on all paths), so scoped to just the compression gap (on `main` as of V2.4.6)
- [x] **P2-LOG** Full activity log with filters (#12) — client-side filter by actor (team/facilitator/admin, by name) and by action, on top of the existing per-event log; CSV download respects the active filters (on `main` as of V2.4.3)

## Re-land — was done pre-rollback, lost when main reverted to V2.0

- [x] **BONUS-RM** Remove bonus games from music bingo — editor, facilitator, player, display, `BingoBonusPanel`/`bingo-bonus-scoring`/`bingo-submission-url` all removed; verified with a throwaway org/event via browser automation (Start on first press, 29-song run plays, cell marks instantly, no bonus UI anywhere) — not a live phone test, still worth a real one before the next event (on `main` as of V2.4.1)
- [x] **P1-3** Client bingo restart now calls the atomic `restart_bingo_run_scores` RPC — exact re-apply of 401ec01 (on `fixes`; needs live test)
- [x] **P1-B4** Cancel broadcast re-landed — exact re-apply of 3656e4c (on `fixes`; needs live test)
- [x] **P2-2** Backoff cap re-landed — exact re-apply of bb34912's backoff half; error-path only, resets on successful subscribe (on `fixes`; needs live test)
- [x] **P2-4** Strip PII debug logs (names / team ids in console) — re-landed on `fixes`, log statements only
- [x] **ENG3** Re-delete dead components (scroll-area, BrandingTab, CompactListRow) — re-landed on `fixes`

## UI redesign — facilitator console

- [x] **UI-1** Inline timer control + editing (#16) — [-15] [N min] [+15] next to Start; click paused countdown to type minutes or mm:ss, Save/Cancel (on `fixes`)
- [x] **UI-2** Show Timer + Show Score side by side, centred card footer (#17) (on `fixes`)
- [x] **UI-3** Display fills card, hover copy icon with "Link copied" pill, Copy Link button removed (#18) (on `fixes`)
- [x] **UI-4** Countdown + Reveal card at top of right column (#19) (on `fixes`)
- [x] **UI-6** Announcements compact single row below Display (#21) (on `fixes`)
- [x] **UI-7** Quiz/Bingo/Break controls left under Announcements, only when that stage is active; quest review stays right (#22) (on `fixes`)
- [~] **ENG1** Refactor FacilitatorEventPage — **stage 1 on `main` as of V2.4.13** (needs facilitator smoke test). Extracted the 4 leaf modals (winner routing, team claim, reset-team, event log) to `src/components/live/facilitator/FacilitatorModals.tsx` as presentational components; page still owns state/handlers, props TypeScript-checked, no behaviour change, 2268 → 2146 lines. STILL OPEN: the 980-line render body + 36 state vars are the bulk; decompose in further staged passes, each live-tested. Purely internal (no user benefit) — lower priority than the Paddle feature.

## Quest stage editor

- [x] **Q-1** Multi-select when adding Quest games (#13): All / All photo / All video / All text quick-add with counts, drawing from the whole org library (on `fixes`)
- [x] **Q-3** Drag-to-reorder Quest games; order = players' display order (#15) — draggable list in the stage editor + JoinGameView follows gameIds order (on `fixes`; player side needs Rumen's live test)

## Engineering health

- [~] **ENG2** Refactor JoinGameView (second God-component) — **stage 1 on `main` as of V2.4.14** (needs participant smoke test). Extracted the 3 leaf overlays (facilitator chat, announcement, exit-password dialog) to `src/components/live/participant/JoinGameOverlays.tsx` as presentational components; page still owns state/handlers, props TypeScript-checked, no behaviour change, 1555 → 1484 lines. STILL OPEN: the header/body render blocks + state machine are the bulk; decompose in further staged passes, each live-tested. Purely internal — lower priority than the Paddle feature.
- [x] **ENG4** Lazy-load jspdf + ffmpeg — main bundle 1881 kB → 1481 kB, gzip 550 → 419 kB (on `fixes`)
- [x] **ENG5** Test suite around scoring — vitest, 30 tests on the bingo core (win detection, cell matching, card generation); `npm test`
- [x] **ENG6** Clear lint backlog — 96 problems (79 errors, 17 warnings) down to 0. Mechanical fixes (unused escapes/assignments, irregular whitespace, control regex) plus ~50 targeted `eslint-disable` comments for legitimate patterns the new React Compiler rules over-flag (the "keep ref fresh" idiom, hydrate-form-from-fetch, object-URL previews, fetch-on-mount). Found and fixed a real bug along the way: a dead `else if` branch in bingo auto-advance (`no-dupe-else-if` caught it — the branch could never execute, since its condition was a subset of the preceding `if`) — verified live with a full throwaway bingo round, crossfade + multi-song auto-advance all correct afterward. Also deleted one unused deprecated hook (`useFacilitatorChatUnread`). (on `main` as of V2.4.5)
- [x] **ENG7** Branch cleanup — AUDIT.md retired to docs/AUDIT-2026-06.md; all four stale branches deleted (neo-minimalism, security-hardening, bingo-live-fixes, new-features — fully merged, approved by Rumen)

## Fixed — admin reload bug

- [x] Hard reload on any /admin/* sub-route bounced to the dashboard — root cause: `profileLoading` in `src/contexts/auth-context.tsx` could read `false` for one render after a signed-in session resolved but before the profile (and role) had actually loaded for that user, so role-gated redirects (`RequireAuth`'s platform-access check) briefly saw `role: null`, treated it as "no access," and sent the user to `/login` without preserving where they'd been — landing them on the default dashboard once the real role loaded a moment later. Fixed by tracking which user id the loaded profile actually belongs to, so `profileLoading` stays true until it genuinely matches. Verified live across `/admin/games`, `/admin/settings`, `/admin/team` — reload now stays put (on `main` as of V2.4.2).

## Later / ideas

- [~] **PUZZLES-1 Puzzle game family:** all three subtypes implemented on
  `feature/puzzles` (2026-07-18). Wordle, Matching, and the manual 5x5 Crossword
  are Quest-stage games with automatic, server-authoritative scoring and
  synchronized team progress. Crossword: organizer places words on the grid with
  clues, players auto-solve (silent full-grid validation), score decays with
  solve time (full points under 2 minutes, then 10% of remaining per extra
  minute, 25% floor). Both puzzle migrations (20260717005019 and
  20260718120000) are applied to the shared Supabase project; note the base
  migration had never been applied before 18 Jul, so puzzles were code-only
  until then. Design: `docs/superpowers/specs/2026-07-18-puzzles-design.md`.
  Build, lint, and 133 unit tests pass. Remaining before staging: Rumen's
  real-phone live test (two phones, one team, all three puzzles).

- [~] **PUZZLES-2 Crossword rework:** on `feature/puzzles` (2026-07-19), after
  play-test feedback. 6x6 grid; designer can paint blocked (solid yellow) cells;
  inline word entry (click a cell, hover the row/column that lights up, type the
  word, add a clue); every straight run of 2+ letters is auto-detected as a word
  and must be clued before saving. Player: word-start cells highlighted, tap for
  clues, per-word server auto-solve (green on correct, shake on wrong), 3 hints
  per team (each reveals one letter per unsolved word, deduped at crossings,
  -10% each), live countdown from 5:00 (green, yellow in the last minute, red and
  negative after) with points decaying live. New scoring: full points at or under
  5:00, -5% per 30s block over (rounded up), -10% per hint, 10% floor, always
  awarded on solve. New migration `20260719120000_crossword_rework.sql` (hint RPC,
  per-word validation, 3-arg scoring) APPLIED to the shared Supabase project
  (2026-07-19); server scoring + solve-detection smoke-tested against the DB and
  match the engine. Build, lint, and 139 unit tests pass. Design:
  `docs/superpowers/specs/2026-07-19-crossword-rework-design.md`,
  plan: `docs/superpowers/plans/2026-07-19-crossword-rework.md`.

- [x] **LINKS-1 Branch-aware generated links:** live in V2.13.1. Facilitator,
  display, teams, pretty event,
  Inventory purchase, and tablet links now use the domain of the page currently
  open. Copied links, opened links, individual QR images, and PDF QR exports
  therefore stay inside the active Vercel preview, local environment, staging, or
  production deployment.

- [x] **INVENTORY-1 Physical item library:** live in V2.13.0. Tenant admins can
  create reusable items with optional
  photos/descriptions and point prices, copy stable purchase links, download a
  single QR PNG, or export selected/all QR cards as a print-ready A4 PDF. Player
  Quest screens include a Buy Items button that opens an in-app rear-camera QR
  scanner; successful scans show the item, price, and team balance before any
  points are deducted. Purchases atomically deduct points and keep an audit record.
  A private per-device team token prevents one participant spending another team's
  points, and row locking prevents concurrent double-spends. Purchase RPCs also
  support signed-in test browsers but still require both the live-event token and
  private team token. The participant team-field guard permits only the validated,
  transaction-marked Inventory deduction; direct participant score edits remain
  blocked. Facilitators receive live, persistent purchase notifications above
  Submissions with the team, item, cost, time, and purchase count.

- [x] **MKT-1** Marketing homepage redesign — **live in V2.5.0**. Rebuilt `rallyhub.games` from the design handoff (`Marketing Page Design/`) into maintainable components under `src/components/marketing/home/` + `src/styles/marketing-home.css`. Verified: build/lint/tests pass, no console errors, no horizontal overflow at 375px, mobile menu + palette preview + form validation all work, dark mode holds. Optimised hero/display images + real OG image added. Accuracy guardrails applied (no instant-scoring-for-all, no client-management or free-event claims).
- [x] **CONTACT-1** Marketing demo form backend — **live in V2.5.1**. `submit-contact` Edge Function (deployed) validates + honeypot + per-IP rate limit, stores every lead in `contact_submissions` (RLS super-admin read), emails via Resend when `RESEND_API_KEY` is set (graceful degradation: lead saved even without the key). Frontend wired with loading/success/error + mailto fallback. Verified end to end. **Remaining (Rumen, dashboard):** set `RESEND_API_KEY` (+ optional `CONTACT_TO_EMAIL`/`CONTACT_FROM_EMAIL`) Edge Function secrets to turn on the email — see `docs/RESEND-SETUP.md`. Confirm the `hello@rallyhub.games` inbox exists/forwards.
- [~] **EMAIL-1** Transactional email via Resend — **code/deliverables done in V2.5.1**, dashboard config remains. Branded auth templates in `docs/email/rallyhub-auth-templates.html`; full guide in `docs/RESEND-SETUP.md`. Decision stands: Resend as Supabase Auth **Custom SMTP** (built-in sender is test-only). **Remaining (Rumen, one-time):** create Resend account, verify rallyhub.games domain (SPF/DKIM DNS), then in Supabase → Auth → SMTP Settings enter Resend SMTP (`smtp.resend.com`, user `resend`, pass = API key) and paste the templates. Reuse the same Resend account for CONTACT-1 and later non-auth email (invoices once PAY-1 lands).
- [x] **FACIL-1** Facilitator admin access — **live in V2.5.2** (needs a facilitator-account smoke test). Facilitators were fully locked out of the app/admin (4 guards bounced them; platform host looped to /login). Now they log in and land on a restricted surface: read-only Events page with open/copy links + teams QR (`FacilitatorEventsPage`), and a Profile page to edit their own name (`FacilitatorSettingsPage`, org shown read-only). Sidebar stripped to Events + Profile. All changes gated on `isFacilitatorOnlyRole`, other roles untouched (verified build/lint + unauth→login redirect; couldn't e2e the facilitator login without creds). **Decision to confirm:** facilitators can edit their own name but NOT rename the org (that affects branding/subdomain for everyone; left as a client_admin power). Say if facilitators should be able to edit the org too.
- [ ] **REDESIGN-1** Full app redesign — every page, admin panels included. Far future; Rumen is starting the design file (2026-07-13). Parked until designs are ready. When it lands, fold ENG1/ENG2 (God-component refactors) into it.
- [x] **PRICING-1** Final plan ladder promoted in V2.12.0: Pay Per Event €199/event with no subscription; Starter €20/mo or €180/yr + €149/event and 2 events/month; Pro €200/mo or €1,800/yr + €99/event and unlimited events; Custom by contact. Standard plans include 5 teams/event. Business is retired. See `docs/PAYMENTS-AND-PLAN-ECONOMICS.md`.
- [~] **PAY-2 add-ons:** additional-team billing is complete in V2.12.1: five included, then €10/team, snapshotted server-side into the activation invoice and automatically included in Paddle's exact invoice charge. Remaining: decide and implement the optional per-event RallyHub branding-removal price/product.
- [ ] **L-2** AI features for clients (#24): bulk game creation, AI descriptions
- [~] **PAY-1 current:** Paddle subscription, event checkout, webhook, and per-event auto-charge paths have all been sandbox-tested successfully (confirmed by Rumen, 15 Jul 2026). Pay Per Event is postpaid: an event goes live immediately, then an invoice is raised; another event is blocked while an earlier invoice is unpaid. Starter and Pro require an active paid-through subscription. Limits and friendly messages are server/UI enforced. V2.11.0 removed automatic first-event-free (selected clients use a 100% event promo), closed privileged invoice RPC direct access, and added an in-app Starter/Pro plan-change flow with Paddle proration preview and payment-failure protection. V2.12.0 applies the final prices and removes the signup trial. Plan changes remain feature-flagged off until live-payment verification. Full rules and unit economics: `docs/PAYMENTS-AND-PLAN-ECONOMICS.md`.
- [~] **DATA-1 Storage-first deletion lifecycle:** code promoted in V2.11.0; Supabase deployment remains. Event Bin expiry, six-month retention, manual permanent event deletion, super-admin client deletion, and client-requested 30-day account deletion converge on one private retry queue + `data-lifecycle` Edge worker. Storage prefixes are deleted through the API in 1,000-object batches before DB finalization; failures remain retryable. Client Organization Settings includes request/restore controls, Paddle renewal scheduling/undo, and a 30-day countdown. Deployment/Vault setup and destructive smoke checklist: `docs/DATA-LIFECYCLE.md`.
- [ ] **DEV-DB1 Fresh local Supabase reset:** the historical migration chain cannot currently build a database from zero. Migrations 030/037 consume a newly added enum label in the same transaction, then 038 attempts to change `resolve_tenant_by_host`'s return type with `create or replace`. This predates DATA-1; the new lifecycle migration was instead applied and behavior-tested successfully against an isolated Supabase Postgres schema. Repair the historical chain separately without rewriting already-applied production state.
- [ ] **PAY-1 live launch:** follow `docs/PADDLE-LIVE-CHECKLIST.md`: apply the pending billing/lifecycle migrations; deploy current Paddle Edge Functions and `data-lifecycle`; configure lifecycle Vault/cron secrets; audit and clear confirmed sandbox Paddle IDs; switch Supabase/Vercel to live Paddle credentials and production environment together; confirm production webhook subscriptions, VAT-exclusive tax setting, and the destructive lifecycle smoke checklist. Enable `VITE_ENABLE_PLAN_CHANGES` / `ENABLE_PLAN_CHANGES` only after the live smoke test.
- [ ] **CONTENT-1 Game catalogue:** parked for next week in `docs/GAME-CONTENT-PLAN.md`. Produce five groups of 25 quest placements, then six themed quizzes with 60 questions each: 20 easy, 20 medium, and 20 hard. Generate covers only after content approval.
- [ ] **PDF-1** Branded PDF event-recap report — `src/lib/event-export.ts` currently ships a ZIP of media + CSV logs as a stand-in; the real branded PDF report was deferred and never built
