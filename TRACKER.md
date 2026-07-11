# RallyHub Fixes Tracker

Workflow since 7 Jul 2026: small fixes, redesigns and features push straight
to `main` (production). The `fixes` branch is reserved for risky live-event
work (currently: the quest submit delay and the bingo smoothness
investigation). Branch `stable-2.0` is the pre-2.1.0 fallback checkpoint.

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
ENG2, AI features (L-2), Paddle (PAY-1), PDF report (PDF-1).

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

- [x] **SEC-1 Phase 1 security hardening** — **fully live as of 2026-07-11** (V2.4.8 on Vercel, migration applied to prod DB, 5 edge functions redeployed: create-client, create-org-user, register-client, update-org-user, set-org-user-password). Advisor confirms: anon-executable SECURITY DEFINER functions 46 → 28 (remainder are public-by-design or SEC-4 candidates), public bucket listing warnings gone. Note: the 2026-07-09 session committed all of this locally but deployed none of it — nothing was live until 11 July. See `docs/SECURITY-REVIEW-2026-07.md`.
- [~] **SEC-5 New advisor findings (2026-07-11)** — mostly done in V2.4.9. DONE: `organizations` INSERT policy now `is_super_admin()` (was always-true); leaked password protection enabled in Auth; 14 mutable-search_path functions pinned to `search_path = public`; local `create-facilitator` + `invite-member` sources deleted. STILL OPEN: the deployed `smooth-api`, `invite-member`, `reveal-bingo-winner` functions must be deleted in the Supabase dashboard (CLI token lacks the privilege — returns 403).
- [x] **LOAD-1 Live-event load test** — `npm run load:test` (`scripts/load-test-live-event.mjs`) simulates N participant phones over the real anon join-token path (bootstrap RPC, bundle load, Realtime subscribe, concurrent submission waves + broadcast fan-out), cleans up after itself. 2026-07-11 baseline vs prod: 15 phones — insert p50 98ms / p95 417ms, broadcast p50 53ms, 100% delivery, 0 errors; 30 phones — insert p50 118ms / p95 207ms, broadcast p50 54ms / max 182ms, 100% delivery, 0 errors.
- [ ] **SEC-2 RLS performance advisor cleanup**: wrap `auth.uid()`/helper calls in `(select ...)`, consolidate multiple permissive policies, rerun Supabase advisors.
- [x] **SEC-3 Index/query advisor cleanup** — **live in V2.4.9** (migration `20260711130000`). Added all 19 missing FK indexes + composite `submissions(event_id, created_at desc)`; advisor `unindexed_foreign_keys` 19 → 0. `unused_index` count rose (new indexes not yet hit — expected); deferred dropping the now-redundant plain `submissions(event_id)` index and any "unused" ones until after a real usage window.
- [ ] **SEC-4 Security-definer grant audit, round 2**: categorize remaining RPCs as public, authenticated, trigger-only, or internal helper; revoke direct execute where safe after testing.
- [x] **P1-SUBMIT** Fixed, **on `main` as of V2.4.0** — shipped ahead of a live phone test, at Rumen's explicit call (2026-07-08); watch closely on the next real event. 5 call sites in JoinGameView awaited the best-effort broadcast before clearing their own loading state; a stale/not-joined channel silently falls back to a REST call with a 10s timeout, while the facilitator's view updates independently and instantly (Postgres `postgres_changes`). Applied the same `mergeOwnSubmission` (local, synchronous) + fire-and-forget broadcast pattern already used by the 4 bingo call sites in the same file. Verified in a throwaway test event only (not a real phone/real event): submit/cancel resolve in ~150ms (was ~15s), DB row correctly written each time. New test: `src/lib/live-broadcast.test.ts`.
- [x] **P1-BINGO** 3 fixes landed, **on `main` as of V2.4.0** — shipped ahead of a live phone test, at Rumen's explicit call (2026-07-08); watch closely on the next real event. 1 structural item still open:
  1. **Start double-press (P1-B1) — fixed.** A brand-new bingo stage had no run row yet, so the first Start press had to await `activateBingoRun()` before it could call `play()` — outside the original user gesture, so mobile browsers silently blocked autoplay (the code literally said "press Start again to play"). Now the run pre-warms as soon as the stage is selected. Verified live: run row exists in the DB before any Start press.
  2. **"Stays yellow for a while before it turns green" — fixed.** The lock+score+reveal trigger only fired in a narrow 1-second `timeupdate` window (`remaining` between 4-5s); a skipped/coarse tick (plausible under tab throttling) silently deferred reveal+scoring until AFTER the full ~4s crossfade finished, so the next song was already playing while the previous one's cells sat pending. Widened the trigger to fire as soon as `remaining <= revealLeadSeconds`, no lower bound. New regression test in `src/lib/bingo-playback.test.ts` reproduces the exact skipped-tick case. This almost certainly also improves "win animation took a while to show up" (winner detection runs inside the same deferred call) — plausible but NOT separately live-verified since triggering a real win needs a full winning line.
  3. **"Sometimes can't select right away" — mitigated, not eliminated.** The grid is *intentionally* locked for ~4-5s every round while the previous song scores (marking during this window would score against the wrong song) — that lock itself is architectural, not a bug, and wasn't removed. Added a "Locking answers…" pill so a tap during this window reads as expected behaviour instead of a silent, confusing no-op. Verified live (patched `bingo_state` directly): pill shows, tap is a genuine no-op while locked, marking works normally once unlocked.
  - **Still open / bigger, riskier idea, not attempted this session:** shortening the lock window itself (e.g. advancing the track index at crossfade START instead of crossfade END) would need real architecture changes to how songs are sequenced — flagged for a future session if the mitigation above isn't enough.
- [x] **P0-2b** Anon storage overwrite hardening — new `mint-storage-upload-url` edge function verifies the join token against the specific event (a normal request, headers ARE visible there, unlike storage RLS), then mints a signed upload URL scoped to exactly that path. Both participant upload call sites (quest submissions in `JoinGameView.tsx`, team claim photo in `JoinEventPage.tsx`) now route through it via `uploadParticipantAsset`. Since nothing else in the app called storage directly (confirmed via grep), also removed the old anon INSERT/UPDATE policies on `game-assets` entirely (migration 088) — structurally different from the 076→079 revert (that tried to make RLS itself token-aware and broke live uploads; this just removes the anon write path since the signed-URL flow needs zero RLS grant). Verified live: signed-URL upload succeeds, and a direct anon upload attempt now correctly gets rejected with an RLS error. (on `main` as of V2.4.6)
- [ ] **P1-1** Players recover if facilitator tab closes (PARKED: full-bundle poll froze bingo; needs non-disruptive server push)
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
- [ ] **ENG1** Refactor FacilitatorEventPage (still 2300 lines; extract components in a later pass now the layout is settled)

## Quest stage editor

- [x] **Q-1** Multi-select when adding Quest games (#13): All / All photo / All video / All text quick-add with counts, drawing from the whole org library (on `fixes`)
- [x] **Q-3** Drag-to-reorder Quest games; order = players' display order (#15) — draggable list in the stage editor + JoinGameView follows gameIds order (on `fixes`; player side needs Rumen's live test)

## Engineering health

- [ ] **ENG2** Refactor JoinGameView (second God-component)
- [x] **ENG4** Lazy-load jspdf + ffmpeg — main bundle 1881 kB → 1481 kB, gzip 550 → 419 kB (on `fixes`)
- [x] **ENG5** Test suite around scoring — vitest, 30 tests on the bingo core (win detection, cell matching, card generation); `npm test`
- [x] **ENG6** Clear lint backlog — 96 problems (79 errors, 17 warnings) down to 0. Mechanical fixes (unused escapes/assignments, irregular whitespace, control regex) plus ~50 targeted `eslint-disable` comments for legitimate patterns the new React Compiler rules over-flag (the "keep ref fresh" idiom, hydrate-form-from-fetch, object-URL previews, fetch-on-mount). Found and fixed a real bug along the way: a dead `else if` branch in bingo auto-advance (`no-dupe-else-if` caught it — the branch could never execute, since its condition was a subset of the preceding `if`) — verified live with a full throwaway bingo round, crossfade + multi-song auto-advance all correct afterward. Also deleted one unused deprecated hook (`useFacilitatorChatUnread`). (on `main` as of V2.4.5)
- [x] **ENG7** Branch cleanup — AUDIT.md retired to docs/AUDIT-2026-06.md; all four stale branches deleted (neo-minimalism, security-hardening, bingo-live-fixes, new-features — fully merged, approved by Rumen)

## Fixed — admin reload bug

- [x] Hard reload on any /admin/* sub-route bounced to the dashboard — root cause: `profileLoading` in `src/contexts/auth-context.tsx` could read `false` for one render after a signed-in session resolved but before the profile (and role) had actually loaded for that user, so role-gated redirects (`RequireAuth`'s platform-access check) briefly saw `role: null`, treated it as "no access," and sent the user to `/login` without preserving where they'd been — landing them on the default dashboard once the real role loaded a moment later. Fixed by tracking which user id the loaded profile actually belongs to, so `profileLoading` stays true until it genuinely matches. Verified live across `/admin/games`, `/admin/settings`, `/admin/team` — reload now stays put (on `main` as of V2.4.2).

## Later / ideas

- [ ] **L-2** AI features for clients (#24): bulk game creation, AI descriptions
- [ ] **PAY-1** Paddle integration for the payment system (subscriptions/billing — currently no payment processor wired up)
- [ ] **PDF-1** Branded PDF event-recap report — `src/lib/event-export.ts` currently ships a ZIP of media + CSV logs as a stand-in; the real branded PDF report was deferred and never built
