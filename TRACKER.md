# RallyHub Fixes Tracker

Working branch: `fixes`. Nothing merges to `main` without Rumen's say-so.
Update the checkboxes here as work lands. Statuses verified against the actual
code on 2 Jul 2026 (the V2.0 rollback un-shipped several items the old Cowork
tracker showed as done; this file reflects what is really in `main` today).

**Versioning on main** (three numbers, MAJOR.MINOR.PATCH):
- Patch (small fixes): 2.0.1, 2.0.2, ...
- Minor (bigger updates): 2.1.0, 2.1.1, ...
- Major (big new features): 3.0.0, ...
Bump `APP_VERSION` in `src/lib/version.ts` + add a CHANGELOG entry on every main push.

---

## Already in main (verified, no action)

- [x] Bingo Start double-press fixed (staleness guard, commit ae62a28)
- [x] Winner sound on player phones fixed (ae62a28)
- [x] Bingo tile delay + auto-advance win (ae62a28)
- [x] Bingo win: instant green cells + line bonus pays once (67e4d30, tracked via `paid_line_bonus_team_ids`)
- [x] DB migrations 074-079 live: atomic line-bonus + restart RPCs, join token only for active events (P1-4), storage upload ownership (P0-2), attach-game refresh trigger (P1-2)
- [x] Client onboarding tour (19-step interactive walkthrough, this week)

## Re-land — was done pre-rollback, lost when main reverted to V2.0

- [ ] **BONUS-RM** Remove bonus games from music bingo (rollback restored the broken bonus code: editor, facilitator, player, display, BingoBonusPanel; rebuild properly later)
- [ ] **P1-3** Point the client bingo restart at the atomic `restart_bingo_run_scores` RPC (migration 077 is live but unused; client still does the old loop)
- [ ] **P1-B4** Cancelled challenge broadcasts so the player's pending tile clears without refresh
- [ ] **P2-2** Cap realtime reconnect backoff at 10s on both channels
- [ ] **P2-4** Strip PII debug logs (names / team ids in console)
- [ ] **ENG3** Re-delete dead components (scroll-area, BrandingTab, CompactListRow)

## Open bugs / security

- [ ] **P0-2b** Anon storage overwrite hardening (needs signed-URL or edge-function approach; join token invisible to storage RLS)
- [ ] **P1-1** Players recover if facilitator tab closes (PARKED: full-bundle poll froze bingo; needs non-disruptive server push)
- [ ] **P1-3b** Atomic quiz restart (same RPC treatment as bingo)
- [ ] **P2-1** Multi-facilitator last-write-wins (version/etag on event_state, or document single-writer)
- [ ] **P2-3** Tablet PIN: force non-default on first setup
- [ ] **P2-5** register-client signup rate limiting + captcha before public launch
- [ ] **P2-UP** Photo compression before upload + upload error handling
- [ ] **P2-LOG** Full activity log with filters (#12): every action per team/facilitator, filter by team/facilitator/action

## UI redesign — facilitator console

- [ ] **UI-1** Inline timer control + editing (#16): [-15] [15 min] [+15] next to Start; click countdown to set directly while paused, with Save
- [ ] **UI-2** Show Timer + Show Score side by side, centred at card bottom (#17)
- [ ] **UI-3** Display fills card + inline copy icon with "Link copied" feedback; remove Copy Link button (#18)
- [ ] **UI-4** Countdown + Reveal card to top of right column (#19)
- [ ] **UI-6** Announcements below Display, about a third of current height (#21)
- [ ] **UI-7** Bingo/Quiz/Break controls left under Announcements, shown only when active (#22)
- [ ] **ENG1** Refactor FacilitatorEventPage (do together with the UI redesign, same file)

## Quest stage editor

- [ ] **Q-1** Multi-select when adding Quest games (#13): select all / all photo / all video / all text
- [ ] **Q-2** Game-time label on selected games inside the stage (#14)
- [ ] **Q-3** Drag-to-reorder Quest games; order = players' display order (#15)

## Engineering health

- [ ] **ENG2** Refactor JoinGameView (second God-component)
- [ ] **ENG4** Lazy-load jspdf + ffmpeg (eagerly imported today)
- [ ] **ENG5** Test suite around scoring
- [ ] **ENG6** Clear lint backlog (~85 errors, mostly React 19 rules)
- [ ] **ENG7** Branch cleanup (delete neo-minimalism, security-hardening, bingo-live-fixes) + retire stale AUDIT.md

## Later / ideas

- [ ] **L-1** Client onboarding PDF (#23)
- [ ] **L-2** AI features for clients (#24): bulk game creation, AI descriptions
- [ ] Rebuild bonus games for music bingo properly (after BONUS-RM)
- [ ] Fix: hard reload on any /admin/* sub-route bounces to dashboard (pre-existing, noticed during onboarding work)
