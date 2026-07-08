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

**Parked / needs a design chat first:** P0-2b, P1-1, P2-1, P2-UP, P2-LOG,
ENG2, ENG4, ENG6, admin reload bug, AI features (L-2).

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
- [ ] After `fixes` merges to main: drop the obsolete `organizations.onboarding_completed_tasks` / `onboarding_dismissed` columns (production main still reads them until then)

## Open bugs / security

- [x] **P1-SUBMIT** Fixed (on `fixes`, needs live phone test before main) — 5 call sites in JoinGameView awaited the best-effort broadcast before clearing their own loading state; a stale/not-joined channel silently falls back to a REST call with a 10s timeout, while the facilitator's view updates independently and instantly (Postgres `postgres_changes`). Applied the same `mergeOwnSubmission` (local, synchronous) + fire-and-forget broadcast pattern already used by the 4 bingo call sites in the same file. Verified live: submit/cancel now resolve in ~150ms (was ~15s), DB row correctly written each time. New test: `src/lib/live-broadcast.test.ts`.
- [ ] **P1-BINGO** (own dedicated session, on `fixes`) Bingo smoothness: marks sometimes cannot be selected right away, correct cells stay yellow before turning green, phone win animation delayed. Includes the old Start double-press (P1-B1). Rumen accepts this will take a big investigation — IN PROGRESS
- [ ] **P1-B1** Bingo Start still needs 2-3 presses (folded into P1-BINGO)
- [ ] **P0-2b** Anon storage overwrite hardening (needs signed-URL or edge-function approach; join token invisible to storage RLS)
- [ ] **P1-1** Players recover if facilitator tab closes (PARKED: full-bundle poll froze bingo; needs non-disruptive server push)
- [x] **P1-3b** Atomic quiz restart — restart_quiz_scores RPC (migration 082, live on prod) + client swap (on `fixes`; needs live test)
- [ ] **P2-1** Multi-facilitator last-write-wins (version/etag on event_state, or document single-writer)
- [x] **P2-3** Tablet PIN: Settings warns + blocks the kiosk link until a non-default password is saved (on `fixes`)
- [ ] **P2-5** register-client signup rate limiting + captcha before public launch
- [ ] **P2-UP** Photo compression before upload + upload error handling
- [ ] **P2-LOG** Full activity log with filters (#12): every action per team/facilitator, filter by team/facilitator/action

## Re-land — was done pre-rollback, lost when main reverted to V2.0

- [ ] **BONUS-RM** Remove bonus games from music bingo (rollback restored the broken bonus code: editor, facilitator, player, display, BingoBonusPanel; rebuild properly later)
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
- [ ] **Q-2** Game-time label on selected games inside the stage (#14) — SKIPPED for now per Rumen (games have no single time field; revisit if wanted)
- [x] **Q-3** Drag-to-reorder Quest games; order = players' display order (#15) — draggable list in the stage editor + JoinGameView follows gameIds order (on `fixes`; player side needs Rumen's live test)

## Engineering health

- [ ] **ENG2** Refactor JoinGameView (second God-component)
- [x] **ENG4** Lazy-load jspdf + ffmpeg — main bundle 1881 kB → 1481 kB, gzip 550 → 419 kB (on `fixes`)
- [x] **ENG5** Test suite around scoring — vitest, 30 tests on the bingo core (win detection, cell matching, card generation); `npm test`
- [ ] **ENG6** Clear lint backlog (~85 errors, mostly React 19 rules)
- [x] **ENG7** Branch cleanup — AUDIT.md retired to docs/AUDIT-2026-06.md; all four stale branches deleted (neo-minimalism, security-hardening, bingo-live-fixes, new-features — fully merged, approved by Rumen)

## Later / ideas

- [ ] **L-2** AI features for clients (#24): bulk game creation, AI descriptions
- [ ] Rebuild bonus games for music bingo properly (after BONUS-RM)
- [ ] Fix: hard reload on any /admin/* sub-route bounces to dashboard (pre-existing, noticed during onboarding work)
