# RallyHub Fixes Tracker

Workflow since 7 Aug 2026 (simplified; supersedes the 4-level flow):

- Two levels only. Substantial features get a `feature/<short-name>` branch;
  everything else may go straight to `main`. `main` is live production.
- `staging` and `dev` are retired — do not merge into them.
- Never push while a client event is `active` (own test events are fine).
- Every main push bumps `APP_VERSION` + CHANGELOG entry.

Branch `stable-2.0` is the pre-2.1.0 fallback checkpoint. The old `fixes`
branch is historical and must not receive new work.

## QUIZ-1, SHIPPED V3.29.0, 29 Aug 2026

Three quiz features Rumen asked for after the fix rounds.

- **Two-button questions.** `QuizQuestion.answerStyle` (`'choices' | 'binary'`,
  absent = choices, so every saved question is unchanged). Binary renders as
  two large buttons: positional emerald and rose on the player view and the
  big screen, side by side, bottom-anchored on the phone. The colours are
  positional ONLY and must never track `correctAnswerId`; a selected answer
  paints in the event accent exactly like multiple choice, so the colour never
  leaks the answer. Labels default to True/False (locale-aware) and are
  editable, so Yes/No works too.
- **Variable answer count**, 2 to 6. Deleting the answer that held the correct
  mark moves the mark to the first remaining answer. Switching an existing
  question to binary resets to True/False unless it already had exactly two
  answers, because keeping "the first two" silently discarded the correct
  answer whenever it sat third or fourth (caught in browser QA before ship).
- **Import from another quiz**, button beside "New question" in each round.
  Copies get fresh ids for the question and every answer and drop `roundId`,
  so an imported question is independent of its source from the moment it
  lands.

Facilitator console needed no change: it already lays answers out two-up.

Found by review while building this, fixed in the same version:
- Question media is stored at a path keyed by the QUESTION id and uploaded with
  upsert, so two questions sharing a `mediaUrl` are not two copies. Import now
  duplicates the storage object via `copyGameFile` (`src/lib/game-upload.ts`),
  falling back to the shared URL if the copy fails, since a shared file still
  plays and losing the attachment would be worse. Anything else that clones a
  question must do the same; `duplicateSelected` inside one quiz still shares.
- `validateQuizConfig` now requires text on EVERY answer row, not just two of
  them. With rows addable and removable, a blank row otherwise reached players
  as an unlabelled button, and could even be marked correct.
- `removeRound` clears `rounds_enabled` when the last round goes. Rounds on
  with zero rounds drew a placeholder round card whose id was regenerated every
  render, so it could never be expanded and "New question" was unreachable.

Known, NOT fixed (pre-existing, wider than this work): `setRoundCount` in
`GameFields.tsx` turns rounds on without assigning existing questions to a
round, so any question with a null `roundId` disappears from the editor the
moment rounds are enabled. It still plays; it just cannot be seen or edited.

## FIX-ROUND-2, SHIPPED V3.28.0, 29 Aug 2026

All thirteen notes from Rumen's second test pass (memory:
test-notes-2026-08-26, R2.1 to R2.13) plus two bugs found while verifying
them. Everything else on his list passed.

Live path notes worth carrying forward:
- Back navigation now runs through a layer stack (src/lib/history-layers.ts
  plus useBackLayer). The join page's old back trap swallowed every press; it
  is now the floor UNDER the stack and only re-pushes its guard entry when no
  layer is open. Wired layers: open game, store sheet, chat drawer, exit
  dialog. Facilitator, display and admin surfaces were deliberately left out.
- The display's bingo visualizer analyses the round's clip through an
  AnalyserNode that is never connected to the context destination, which is
  what keeps the screen silent. Muting the element instead feeds silence into
  the graph and reads as zeros: measured against a production clip, do not
  "fix" it by muting. Any failure falls back permanently to the seeded bars.
- textOnAccent (src/lib/live-event.ts) is now WCAG relative luminance and is
  the single helper for ink on any brand-painted control. New brand-coloured
  controls must call it rather than hardcoding black or white.
- White label reuses organizations.hide_platform_branding (no new column). It
  now hides the client admin sidebar mark as well as the live watermark; the
  org's own logo or name shows instead.

Two bugs found during verification, both fixed:
- A reset team slot could never be claimed again: it kept its
  inventory_team_access row, and teams_guard_participant_update refuses a name
  change on a team that still holds a private token. Six dead slots across
  three events were released by the repair in 20260829121000; the new
  reset_team RPC prevents recurrence.
- "Start next run" always failed (V3.27.1): the pre-recurring
  event_status_lifecycle_guard blocked the restart's flip to Ready. The guard
  now recognises the one sanctioned re-armed shape.

Accepted, not done this round: no server backstop for stage-type flags; the
back-layer stack covers the player surface only.

## FIX-ROUND-1, planned 26 Aug 2026 (from Rumen's V3.22.0 test pass)

Source: Rumen's 15 test notes (memory: test-notes-2026-08-26). Rules for this
round: nothing that already works gets touched; related items grouped; NO
per-item testing by Rumen. All phases ship, then ONE big test round with
step-by-step scripts ("Test 1: name" + numbered open/check/do steps), which
also covers his untested backlog (username login + forgot password +
wrong-domain rejection + old subdomain redirect, tablet kiosk + tablet
recording audio, PWA install, matching puzzle offline). Claude verifies each
change itself before moving on (build, tests, preview); Rumen only tests at
the end.

**Phase 1, admin-safe quick fixes (straight to main, fast lane): SHIPPED
V3.23.0, 26 Aug.** All seven items landed (crossword clue fix turned out to be
a clue-key identity bug, not input clobbering; clues now remap when runs shift
or merge). Bonus: bg winnerExclaim (step 2 of the ceremony) fixed alongside
P1.6. Loudness normalisation applies to newly cut clips only; existing
catalog clips renormalise on re-cut. Items listed for reference:
- P1.1 Crossword editor: clue always saves; Enter flow (word -> Enter -> clue
  -> Enter -> saved). PuzzleEditor/CrosswordEditor.
- P1.2 Stage boxes stand out (yellow or charcoal accent, incl bookends);
  Add stage button sits above the End stage. EventForm.
- P1.3 Event logo auto-resize/normalise at upload.
- P1.4 Org default language moves into Brand Identity as a compact dropdown
  (SettingsPage).
- P1.5 Status menu: options coloured like their status; demo copy ("test with
  this one"); active copy (charge triggers + 24h validity).
- P1.6 BG winner string: "Да обявим кой е победител".
- P1.7 Music clip loudness normalisation in the cut pipeline
  (extract-audio-clip.ts, ffmpeg loudnorm; admin-side processing).

**Phase 2, live-surface fixes: SHIPPED V3.24.0, 27 Aug.** All five items
landed, then a 3-lens adversarial review of the merged batch confirmed 4 bugs
(1 bingo-start activation clobber, 3 keyboard long-press rollover/bubble
bugs) which were fixed before the push, plus hardenings (reconcile failure
notify, cross-stage override guard, unlock-WAV bail in the clip player,
emoji-safe team initials). The activate-bingo-run edge function was
redeployed (v25) with the never-reset-a-playing-round guard AND the
event-manager authorisation that had been pending since V2.5.6. Latin
keyboards now offer the accent long-press union map regardless of device
language (an accented answer stays typeable for an English-pinned team).
Deferred, accepted: display outage can briefly show the previous round's
reveal colours; wake lock does not retry an initial low-power refusal.
Rumen's live smoke of bingo start + display happens in the big test round.
Items listed for reference:
- P2.1 Example video label follows event UI colour, slightly bigger.
- P2.2 Bingo Start multi-press: re-diagnose and fix (P1-B1 successor). LANDED
  (this round): three residual windows found and closed. (1) A Start press
  racing the pre-warm fired its own extra activation round trip; stage select,
  pre-warm and press now share one in-flight activation promise. (2) Any
  play() issued after awaited work ran outside the gesture and autoplay policy
  swallowed it (the "press Start again" notify was the tell); both audio decks
  now get a silent in-gesture unlock on Start and Next, so post-await play()
  succeeds and that notify is a true last resort. Activation failures in the
  press path also notify now instead of failing silently. (3) Start was
  disabled while the run query loaded, silently eating early presses; a
  run-less press now plays the positional clip inside the gesture and the
  run's play order is reconciled to the played clip in the background
  (guarded swap, src/lib/bingo-start-reconcile.ts, unit-tested). Scoring,
  reveal timing, card generation and broadcast logic untouched. Needs the
  end-of-round live smoke test like every live-path change.
- P2.3 Screen Wake Lock on all live surfaces (re-acquire on visibilitychange).
- P2.4 Keyboards: standard layouts per language (BG Phonetic QWERTY, not
  alphabetical), iPhone-style uniform key sizing, long-press for special
  characters. VirtualKeyboard.
- P2.5 Bingo display redesign: team circles bottom (grey -> lit on pick ->
  green/red on reveal), centre audio visualizer, no song metadata.

**Phase 3, offline round 2: SHIPPED V3.25.0, 27 Aug.** All three items
landed, then a 2-lens adversarial review confirmed 4 bugs (phantom approved
tile on a dropped puzzle result, store-poll flashing the readiness dot,
stale images served forever after a same-URL re-upload, media downloads
invisible to the dot) which were fixed before the push, plus probe/SW
hardenings. Accepted gaps, flagged for Rumen: no cross-event eviction on the
80 MB media cache yet; custom brand fonts not cached offline. Real-device
offline proof lands in the big test round. Items listed for reference:
- P3.1 Puzzle completion offline: auto-return to list + tile turns green
  (state source for tiles while offline; wordle/crossword, check matching).
  LANDED: two root causes. (1) The solved-hold timer had the parent's inline
  onSolvedAutoClose in its effect deps, so every join-surface re-render
  cleared and re-armed the 1s hold; offline, the realtime channel's reconnect
  backoff re-renders faster than the hold, so the return never fired (all
  three puzzle types, matching included). The timer now arms once per solve
  with the callback in a ref. The crossword additionally never told its
  parent it was done offline (online that rode the Realtime broadcast);
  CrosswordPlayer now fires an onSolved callback on the unsolved-to-solved
  transition, never on reopening a finished grid. (2) Tiles derive state from
  bundle submissions, which offline completion never creates. The queued
  puzzle-result now merges a provisional approved submissions row into the
  bundle at queue time and again on rehydration after a reload (mirror of the
  open-submission pending cards; queuedPuzzleSubmissionRow in
  src/lib/offline/puzzle-local.ts, unit-tested). Its id is the outbox
  clientId, which submit_offline_puzzle_result uses as the row's primary key,
  so the authoritative row replaces it in place on drain, no flicker.
  Scoring, the RPC and the exactly-once machinery untouched. Known narrow
  gap, same as open submissions: a full bundle refetch racing ahead of the
  drain while back online can briefly drop the provisional row until the
  drain merges the server row.
- P3.2 Offline media caching: game photos, Powered by RallyHub logo, UI sound
  effects (extend package/blob cache + SW).
- P3.3 Sync status dot: yellow syncing, green complete, red failed. LANDED
  (this round). Placement per Rumen's device-test brief: the top-left corner
  next to the WifiOff icon on the player surface, not the version label as
  first noted here. New tracker src/lib/offline/readiness.ts (unit-tested):
  each download path (answer package, store snapshot, bundle snapshot; any
  future kind self-registers via one report call, ready for P3.2's image
  cache) reports begin/settle plus an IndexedDB honesty probe, so green means
  the stored artefacts were actually verified, a stale copy from an earlier
  session still counts as ready when a refresh fails, and red means a
  download failed or cannot complete. Aria-label/tooltip strings in all five
  live locales. Download semantics, outbox and sw.js untouched.
- Phase 3 review fixes. LANDED: (1) a dropped puzzle-result now removes its
  provisional approved row from the bundle (tile back to unsolved, failure
  toast honest; local IDB progress stays so reopening shows the board). (2)
  The store sheet's 10s poll no longer drives the readiness dot: only
  JoinGameView's join-time and reconnect downloads pass reportReadiness for
  the begin/settle cycle, the sheet's polls report at most an atomic success.
  (3) Same-URL cover re-uploads refresh on joined devices: downloadEventMedia
  re-fetches cached URLs online with cache 'reload' (caps and headroom guard
  kept, a failed refresh keeps the stale copy) and sw.js serves cross-origin
  images stale-while-revalidate with a best-effort background update. (4)
  Media downloads register a 'media' readiness kind with a full per-URL cache
  probe; an event with zero images never registers it, so it cannot block
  green. (5) Hardenings: the bundle-snapshot readiness probe is a key-only
  IDB existence check (no full deserialise per evaluation), and the sw.js
  image route falls through to plain fetch if caches.open rejects.
  Accepted gaps, NOT fixed: no cross-event eviction for the 80 MB media cache
  yet, and custom brand fonts are not cached offline (decision for Rumen).

**Phase 4, event lifecycle (demo/active): SHIPPED V3.26.0, 27 Aug.**
- P4.1 Demo keeps the full configured team list: the demo cap on team_count
  and the slot deletion on the switch to demo are gone (useUpdateEventStatus
  no longer touches team_count; demoTeamSlots removed from the join and
  facilitator surfaces). Only claiming is capped at 2, by the existing client
  guards plus migration 20260827120000_demo_claim_cap.sql, which re-creates
  claim_team_with_inventory_access with a claimed-teams count check behind an
  event-row lock (taken before the team-row lock, matching reset_event_data's
  lock order).
- P4.2 Demo -> active clears demo data behind a warning: the activation
  billing dialog probes for claimed teams/submissions on demo events, lists
  what will be wiped, and on confirm runs resetEventData before the status
  change. The never-activated reset guard stands: clearDemoData is only ever
  set when activated_at is null, and the (normally unreachable) previously
  activated case shows a "data kept" note instead.
- Danger notes stand: syncTeamSlots deletes surplus unclaimed slots from many
  call sites; reset guard (never-activated only) is the billing wall, do not
  weaken it for ordinary events.

**Phase 5, billing correctness (N2): LANDED V3.26.0.**
- [x] P5.1 Paddle webhook refund handling: adjustment.created/updated with
  action refund + status approved. Subscription refund -> sub tx canceled,
  org downgraded to rookie, Paddle sub canceled immediately via API,
  paddle_subscription_id cleared; event-invoice refund -> invoice marked
  'refunded' (new status, migration 20260827090000). subscription.canceled
  backstop no longer re-asserts plan_key/billing_period and clears the sub
  id, so it cannot undo the downgrade. Demo orgs never downgraded. NEEDS:
  migration applied + paddle-webhook redeployed.
- [x] P5.2 Suspension visible in Billing: banner + Suspended badge in
  BillingOverview; start subscription, pay invoice and plan changes disabled
  while suspended (portal/billing details stays available).

**Phase 6, platform customization: SHIPPED V3.27.0, 28 Aug (built on
feature/platform-customization, merged to main).** All four features landed
(P6.1 feature flags incl broader set, P6.2 custom subscriptions, P6.3 open
joining with end-of-event team settlement incl a second team_settlement
invoice kind, P6.4 recurring events with event_occurrences + superseded
invoices). A 3-lens adversarial review confirmed 9 bugs, all fixed pre-merge
(headliners: settlement now collects even when the activation invoice was
auto-charged or comped; restart keeps invoiced_at so permanent delete cannot
cascade away paid history; custom subscriptions require an active paid-through
subscription and clear on full refund; open_joining locked while live;
Add-stage respects stage-type flags). Five migrations applied to prod;
paddle-checkout v21 and paddle-webhook v15 deployed. Accepted gaps flagged:
automatic collection of team-settlement invoices (Pay now + rookie gate only
for now); no server-side backstop for stage-type flags; group platform
installs surface per-game trigger errors instead of pre-filtering; recurring
scheduling is manual (no cron). Original item list for reference:
- P6.1 Per-client feature flags, broader set (Rumen's call 26 Aug): a
  feature_flags jsonb on organizations covering allowed game types PLUS
  store on/off, offline on/off, allowed stage types (+ column GUARD trigger:
  staff/service_role only, since org RLS lets client_admin update own row).
  Staff UI in ClientDetailPage. Gates CREATION/config surfaces only
  (NewGameTypeModal, GamesPage filters, NewGamePage types, EventForm stage
  types + store toggle, game import, platform-library installs) plus a
  server-side games insert check. Live surfaces and already-built games keep
  working (live events must never break).
- P6.2 Custom subscription: org columns custom_price/interval/charge-per-event
  toggle (guarded like P6.1), staff sets amount monthly or yearly; client
  Billing shows "Custom subscription"; paddle-checkout mints the inline price;
  create_event_activation_invoice respects the per-event toggle. Prices are
  duplicated in three places today (subscription-plans.ts, paddle-checkout,
  DB plan functions), overrides must be read consistently in all.
- P6.3 Open joining / unlimited teams: event checkbox; join page offers
  "Join as a new team" primary + "Rejoin a team" small link; new SECURITY
  DEFINER create-and-claim RPC (anon has no teams INSERT by design);
  syncTeamSlots bypassed for open-join events; team surcharge settled at
  event END from actually-claimed teams (today the invoice snapshots
  team_count at activation, so this is a new settlement step, is_demo
  excluded).
- P6.4 Recurring events: occurrence model on the SAME event (join links and
  printed QR codes must keep working across runs), per-run data reset via a
  new occurrence-aware path (existing reset guard stays for normal events),
  per-occurrence invoice on each activation, entitlement gate counts
  occurrences.

**Then: BIG TEST ROUND.** Step-by-step scripts for every phase item plus the
untested backlog, in Rumen's format.

Phases 4+5 review round (27 Aug): a 2-lens adversarial review of the merged
batch confirmed 7 bugs, all fixed pre-push: dropped the events demo team-count
DB constraint (would have killed P4.1), added precheck_event_activation so a
refused activation cannot wipe demo data first, demo-clear probe now covers
facilitator-only state and the demo-to-ready-to-active detour plus a fresh
re-probe at confirm, EventsPage drag failures surface errors, and the refund
webhook now handles partial refunds (no-op), renewal refunds (Paddle API
fallback), superseded subscriptions (live guard both ends) and cancels in
Paddle BEFORE downgrading (500-retry on cancel failure only). Accepted gaps:
chargebacks and refund reversals deliberately unhandled; refunded invoices
have no UI recovery path; RPC demo-cap error reaches phones untranslated.

Design decisions locked with Rumen 26 Aug: recurring = SAME event with
occurrence model (QR codes survive runs); open-join team surcharge settles at
event END; feature flags = broader set in round one (game types, store,
offline, stage types); subscription refunds downgrade AUTOMATICALLY via the
webhook.

## I18N-1 Five languages + multilingual events (SHIPPED V3.22.0, 26 Aug 2026)

Merged from `feature/i18n-reland` (the reland of the abandoned `feature/i18n`,
rebuilt on current main). English, Bulgarian, Spanish, French, Dutch across
admin and all live surfaces; org default language (staff can pre-set per
client); per-event language; multilingual events with per-team choice;
Cyrillic on-screen keyboard. Architecture and the rules for adding strings are
in CLAUDE.md's Internationalisation section. DB side (columns + tenant RPC
return tables) was already live in prod before the merge, verified again at
merge time. Locale parity is test-enforced (all 5 languages key-identical).
Remaining: Rumen's live test pass.

## Checklists, tasks, prep status (SHIPPED as V3.18.0, 11 Aug 2026)

New feature branch off `main`. Adds: always-on Welcome/End event stages
(Welcome pinned first with a holding message + teams-joining on the display;
End pinned last, freezes all play, custom closing message; winner reveal still
separate); per-game prep status (draft / in_progress / done / needs_attention)
on the library cards with a "Sort by status" option; an optional prep checklist
tag field on games (stored in `games.config`) and store items
(`inventory_items.checklist_items`); a per-event Task list tab in the event
editor; and an aggregated Event checklist (grouped + summed × team count, tick
state on `events.checklist_state` that resets on team-count change, browser
print to PDF).

Additive migration `20260811120000_checklists_tasks_prep_status` (games
`prep_status`, inventory `checklist_items`, events `checklist_state`,
`event_tasks` table + org RLS) is already applied to production via MCP (0
active events at the time; backward-compatible). `APP_VERSION` set to V3.18.0
pending merge.

Adversarial multi-agent review caught and fixed three high-severity bugs before
commit: (1) entering the End stage closed submissions but nothing reopened them
on returning to a game stage; (2) injecting Welcome into a legacy live event's
stages on save would shift `current_stage_index`; (3) the checklist print rule
blanked the page. All three fixed and re-verified (build, lint, 292 tests).

## Current state, 10 Aug 2026 (read this first)

Production is **V3.17.0** on rallyhub.games / app.rallyhub.games /
admin.rallyhub.games. Domain architecture v2 (see its own section below)
landed from `feature/domain-architecture-v2`, merged to `main` overnight
9-10 Aug. `feature/client-feedback-v3` (85 uncommitted marketing-related
changes, 11 commits behind at the time) was abandoned in favour of a fresh
branch off `main` — nothing on it was lost, it just wasn't picked back up;
see git history if any of that work still needs recovering.

**Done and live:** full admin redesign (V3.0.0, 3 Aug), camera overhaul
(V3.1.0), the 7-9 Aug client-feedback marathon (V3.2.0-V3.9.0: event Store,
camera gate, scoring guards, per-stage branding, NumberField, iOS perf +
missed-paint fix, on-screen keyboard with purchased click pack), marketing
homepage rework (V3.11.0), mobile/tablet phases 1-2 (V3.10.x + V3.12.0:
hamburger admin nav below 1280px, sticky save bar, centred toolbars,
full-screen game editor on tablet, back-gesture auto-save in both editors,
facilitator single vertical flow with Preview popup), and domain
architecture v2 (V3.17.0, 10 Aug: path-based client/admin URLs, wrong-domain
login rejection, public splash pages, redirect shim for every old link).

**Actively next:** the mobile app entry flow per Rumen's
earlier brief: install as PWA, log in with an account, then choose Admin, or
pick an event and enter as Facilitator or Team player; tablet password stays
for exiting an event and cross-device team sign-in. Android verification pass
after that.

**Biggest still-open items:** PAY-1 live Paddle launch (checklist in
`docs/PADDLE-LIVE-CHECKLIST.md`), PAY-3 Paddle webhook secret/replay for the
RallyHub Gaming live test transaction, DOMAIN-1 apex redirect + manual
verification checklist (below), DATA-1 lifecycle deployment steps,
CONTENT-1's 159 cover images, CF2-5 camera permission
re-request, CF2-10 slideshow, PDF-1 branded recap report, L-2 AI features,
ENG1/ENG2 God-component refactors, H6 mid-bingo join risk, DEV-DB1 broken
local migration chain, HERMIT-ENCODE workaround in place.

## OFFLINE-1 Offline mode for quest play (SHIPPED V3.21.0-V3.21.3)

**STATUS 18 Aug: ALL SEVEN STAGES LIVE in prod (V3.21.0), plus a hardening
round (V3.21.1-V3.21.3) from the first device test.** Verified end-to-end
against production: offline wordle/matching solve -> queued result -> reconnect
drain -> server re-score lands in submissions (90/80 pts, DB-checked); offline
auto-text instant verdict matches the server on drain (case-sensitive btrim
hash, verified both ways); offline store order shows the full-screen Order
sent, sits as WAITING TO SEND in My Items, and drains to inventory_orders;
crossword opens offline with the timer and the live one-letter crossing hint;
offline BOOT proven on the iOS simulator (Safari killed, relaunched with no
network, board renders from the SW shell + IDB snapshot with the offline pill).
Hardening found by that test: a failed first IndexedDB open no longer poisons
the session (iOS Safari flake), puzzle players re-download a missing answer
pack when opened online and show plain offline copy instead of raw
"TypeError: Load failed", the store snapshot downloads at join (not first
open), and an expired join token now re-mints + retries instead of leaving
"Failed to load event" until an app restart. Remaining check: Rumen's
real-device dead-spot test. On 15 Aug a full
five-lens review of all session work confirmed 13 findings (4 high), all fixed
the same day: outbox teardown on unmount (no zombie drains after exit/team
takeover), team-scoped rehydration (rejoining as another team can't destroy the
old team's queue), reload-hydration (queued items reappear as pending cards, so
a reload can't invite a duplicate submission and double points), original
submit-time created_at preserved, the answer-package RPC now ships text keys
ONLY for auto-approve games (migration 20260814180000 APPLIED to prod, verified
both ways), answer keys refresh on reconnect, sw.js can no longer wipe the
queued-media cache on a service worker update, no re-upload of already-uploaded
video on retry, plus exactly-once settle and late-write-undo hardening in the
queue. Offline round trip re-verified in-app INCLUDING a page reload (row lands
with the original timestamp). Still not real-device tested — that remains the
one open verification before/after shipping.
Each stage was adversarially reviewed and verified before commit.
- **Stage 1 (V3.19.0)** instant background submit — every quest submission
  returns to the list immediately; upload+insert+reconcile run in a background
  outbox (`src/lib/offline/outbox.ts`); retries transient, drops+surfaces
  permanent, reconciles a dropped-response duplicate. Closes CF4-4. Reviewed
  twice (7+1 findings fixed).
- **Stage 2** download-on-join answer package — RPC `get_offline_event_package`
  (migration `20260814100000`, APPLIED to prod) returns only the answer data
  redaction strips (text as sha256 hashes, puzzles plaintext), gated on a valid
  private team token. Client stores it in IndexedDB on join. Security-reviewed
  SAFE; verified client sha256 == server hash, wrong-event/no-token return null.
- **Stage 3** durable queue — outbox persists to IndexedDB + Cache API
  (`outbox-persistence.ts`); `start()` rehydrates+drains on mount. Verified
  twice in-app (submit offline -> queued in IDB, no DB row -> reconnect ->
  same client-UUID row lands, queue empties). Hardened through THREE review
  rounds: in-memory-first enqueue (persist failure never loses a submission),
  150MB blob cap + headroom guard, NetworkSubmitError retries a real outage
  forever while a server 5xx caps and a PG-code rejection drops, no dangling
  blobKey, stale other-event prune. Accepted lows (Stage 7 / low-prob):
  in-memory-only items (over cap) lack a "not saved offline" signal;
  cross-tab prune race needs two events open on one device.
- **Stage 4 groundwork** — `scoring.ts`: text offline verdict reproduces the
  server's auto-approve exactly (choose_answer id compare; type_text sha256 of
  btrim(input) vs shipped hashes), unit-tested, hash proven byte-identical.
  NOT wired into the submit flow yet.

Remaining: Stage 4 integration (score text+puzzles offline in the submit flow;
puzzles need a server reconcile RPC since they score via dedicated RPCs, not a
plain insert), 5 (offline store), 6 (SW app-shell caching, highest risk, cannot
be prod-verified until the push unblocks), 7 (offline UI incl. the "not saved
offline" signal).

Rumen's brief 12 Aug 2026, decisions locked 12 Aug, build started 12 Aug on
`feature/offline-mode`. **Full design + grounded facts + 7-stage plan live in
`docs/OFFLINE-MODE-SPEC.md` — read that first.** Scope is quest stages only:
quiz and music bingo are lock-step and need the network by nature, so they stay
online-only and say so if the connection drops.

Locked decisions: text auto-approve scores offline via sha256 answer hashes
(answers stay unreadable); puzzles ship un-redacted config so they score offline
instantly (wordle + crossword answers readable, crossword hints work offline,
accepted leak for a low-stakes team-building context); store order queues and
the facilitator declines overspend at fulfilment; download happens only after
join, gated on the private team token; ships to main stage by stage as each goes
green + passes adversarial review, real-device offline test is Rumen's afterward.

**The goal.** A team's device keeps playing through a dead spot. Venue wifi
drops, a phone loses signal in a basement, the group walks out of range: the
app stays usable and nothing the team did is lost.

1. **Download on join.** When a team joins, the device pulls everything that
   stage needs and stores it locally: game content, descriptions, cover and
   instruction media, puzzle data, the store catalogue. After that the player
   can open, read and play offline.
   Download starts **only after the team has joined**, never before, so the
   content is not fetchable by anyone who merely has the event link.
2. **Background submissions.** Submitting never blocks the player. The result
   screen and the return to the challenge list happen immediately, the upload
   goes to a local queue and drains whenever the device is back online.
   This is the behaviour **online too**, not just offline: nobody waits on an
   upload, so it feels instant. It also removes the last of the CF4-4
   waiting-on-submit complaints by design rather than by tuning.
3. **Catch-up sync.** When the connection returns, queued submissions go up
   and everything that changed while away comes down: approvals, points,
   facilitator messages, announcements, stage changes.
4. **Auto-scored games work offline.** Auto-approve text games and puzzles
   need their answers in the downloaded package so scoring can run on the
   device and the team gets its result immediately.
5. **Store works offline.** The catalogue is part of the download so a team
   can place an order without a connection; the order joins the same queue.

**Decisions to make before building** (each one changes the design, worth
half an hour with Rumen rather than guessing):

- **Answers on the device contradict V3.15.3.** We deliberately strip correct
  answers out of the player payload so they cannot be read from the network
  traffic. Shipping them to the device for offline auto-scoring undoes that
  for exactly those games. Options: accept it for auto-approve games only
  (they are the low-stakes ones), ship hashes instead of plain answers (works
  for exact-match text, not for puzzles), or keep auto-approve online-only
  and queue those as pending. Recommend hashes for text, and accept plain
  puzzle data since a puzzle's answer is derivable from playing it anyway.
- **Store double-spend.** Points are server-authoritative and orders deduct on
  completion. Two devices on the same team, both offline, can both order past
  the balance. Simplest honest answer: queue the order offline, let the
  server reject it on sync if the points are gone, and tell the team clearly.
  Anything smarter needs a local balance ledger and is not worth it yet.
- **Storage budget.** Video submissions are the problem, not the content. A
  queued 1080p clip is tens of MB and iOS evicts browser storage under
  pressure. Need a cap, a visible "waiting to send" state, and a rule for
  what happens when a device is out of room.
- **Join-token expiry.** Tokens are short-lived. A device offline for longer
  than the token's life cannot sync on return without re-minting. Needs a
  refresh path that does not force the team to rejoin.
- **Queue ordering and retries.** Submissions must not double-submit on retry
  (the client-generated id from P1-SUBMIT already covers this, reuse it) and
  should keep their original timestamps so scoring and the log stay honest.

**What already helps.** A service worker ships today (PWA work), the live
bundle is already a single snapshot object (`LiveEventBundle`), patches
already arrive as `LiveBundlePatch` messages, and submissions already carry
client-generated ids for optimistic insert. The queue is the genuinely new
piece; the rest is mostly plumbing what exists into local storage.

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

## Domain architecture v2, 9-10 Aug 2026 (V3.16.6 -> V3.17.0, shipped)

Full path-based multi-tenancy rewrite, driven by Paddle rejecting
`app.rallyhub.games` for domain approval (partly citing the login wall) and
needing both `app.rallyhub.games` and `admin.rallyhub.games` approved.
Design spec: `docs/superpowers/specs/2026-08-03-domain-architecture-and-paddle-approval-design.md`.
Plan (17 tasks, exact code, full execution ledger): `docs/superpowers/plans/2026-08-08-domain-architecture-v2.md`
and `.superpowers/sdd/2026-08-08-domain-architecture-v2/progress.md`.

**Shipped:** `app.rallyhub.games/{client}/admin/...` replaces
`{client}.rallyhub.games`; live event links are
`app.rallyhub.games/{client}/{event}/join|display|facilitator`. Super admins
can only sign in on `admin.rallyhub.games`, client roles only on
`app.rallyhub.games` — wrong domain shows an error with a jump link, not a
silent redirect. Every old subdomain link keeps resolving through a redirect
shim (tablet links unchanged, out of scope). New branded public splash pages
at both domain roots. Reserved subdomain words rejected at signup and by a
DB trigger. A final whole-branch review (after all 14 tasks individually
shipped) caught and fixed one Critical issue (missing env var fallbacks for
`VITE_ADMIN_HOST`/`VITE_PLATFORM_HOST` that could silently serve the wrong
content on the wrong domain) and two Important ones (a fresh client login
never actually reached their `/{slug}/admin` panel — the headline feature
was inert; a live session on the wrong domain wasn't rejected, only fresh
logins were).

**Still open (not done tonight, explicitly deferred by the final review):**
- **DOMAIN-1** Apex redirect: `rallyhub.games/admin*` and `/login*` should
  hard-redirect to the same path on `app.rallyhub.games` per the spec, but
  no task implemented it — currently a client bookmark to the marketing
  apex's `/admin` still works there directly (its own separate login/session,
  same "login wall" pattern Paddle flagged, just not on a domain Paddle is
  reviewing tonight). ~20 min fix, low urgency since the apex is already
  Paddle-approved.
- Deep legacy paths (`sharphawk.app.rallyhub.games/admin/events`) don't get
  the new-scheme redirect, only the bare `/` does — old host still resolves
  them directly via the pre-existing host-based path, so nothing breaks,
  it just doesn't modernise.
- New registrations still land on the unscoped `/admin` panel on first
  visit rather than `/{slug}/admin` immediately (a synchronous
  role-to-path function can't do the async org lookup) — `HostAdminLayout`
  now forwards them the moment they load any admin page, so this only
  matters for the split second before that first redirect fires.
- No `robots.txt`/`noindex` on the two new splash pages.
- `src/components/demo/DemoSandboxBar.tsx` has two hard `/admin`
  navigations the sweep didn't catch — confirmed inert (only reachable via
  the demo host or with demo credentials), low priority.
- **Task 15 (manual verification checklist) and Task 16 (Paddle domain
  resubmission runbook)** in the plan are explicitly for Rumen to run after
  deploying, not automated — resubmit `app.rallyhub.games` and
  `admin.rallyhub.games` to Paddle once the splash pages are live, then
  walk the manual checklist (login on both domains, wrong-domain rejection,
  a live event's short links, at least one old subdomain link still
  working).

## Client feedback marathon, 7-9 Aug 2026 (V3.2.0 -> V3.9.0, all shipped)

Everything from the two 7 Aug client events plus Rumen's 8 Aug test passes:
back-button trap, team slot takeover (tablet password), text answer verdicts,
tablet recording audio, export fixes, event Store (designer 50/50, player
basket, facilitator fulfilment with partial "Complete selected" completion,
Purchase items live toggle), forced one-time camera permission gate,
auto-approve text scoring guard (P0001), quiz stale-index clamps, YouTube
embeds everywhere, per-stage event/game branding, NumberField (deletable,
no wheel edits), iOS missed-paint fix + perf pass (LiveClock isolation,
static mobile blobs), on-screen keyboard (bottom-docked, purchased click
pack, key pop, nearest-key proximity), QR purchase flow retired.

Still open / untested (9 Aug review with Rumen):
- Tablet recording audio fix (V3.2.x) unverified on the real tablet.
- Android untested for the 8-9 Aug batch — Rumen will run it another time.
- Per-stage branding: tested by Rumen, works. Closed.
- Store round three (partial completion, My Items, overlay): tested, works. Closed.
- Bingo squares stay silent — Rumen's call, no select sound there.
- Mobile/tablet redesign in progress: V3.10.x hamburger nav + centred
  toolbars, V3.12.0 full-screen game editor on tablet, back-gesture
  auto-save (game + event editors, no unsaved-changes dialog), facilitator
  single vertical flow with Preview popup and teams last. Next brief from
  Rumen: app entry flow (login, then Admin / Facilitator / Team player).
- H6 (teams joining mid-bingo) remains a live risk, unchanged.

## Session plan (HISTORICAL — all six sessions delivered by mid-July 2026; kept for context)

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

## Client live test, 3 Aug 2026 (V3.0.0)

Rumen ran a real event with a client on the V3.0.0 release. Nineteen items,
grouped by surface. Branch: `feature/client-feedback-v3`. All nineteen are done,
including the auto-approval migration (CF-18), applied to the shared project
(and later guarded by the 8 Aug `text_score_award` marker migration).

**Event editor**
- [x] **CF-1** Duplicate a game from the library
- [x] **CF-2** Move stages up and down
- [x] **CF-3** Collapsible stages
- [x] **CF-4** Search bar when picking games for a Quest stage
- [x] **CF-5** Pressing "Save changes" while games are being added should commit
  the game selection instead of dropping it (currently you must press the
  games' own Save first)

**Player**
- [x] **CF-6** Wordle: hold the completion screen ~1.5s before returning to the
  game list, so the result is readable
- [x] **CF-7** Text games: show the text box is focused (caret / flicker)
- [x] **CF-8** Buying an item returns to the event automatically
- [x] **CF-9** Players see the event timer, following the same
  "Timer on display" toggle the display obeys: toggle off, players lose it too

**Facilitator**
- [x] **CF-10** Show the stage's name, not "STAGE 1"
- [x] **CF-11** Text games needing review: show the facilitator the correct
  answer alongside the submission
- [x] **CF-12** Submission cards carry a badge for the game type (photo, video,
  text, …)
- [x] **CF-13** Facilitator chat messages show "Facilitator", not the person's
  own name
- [x] **CF-14** Puzzle answers for the facilitator are inconsistent: Spice Rack
  shows them, Circle Pieces does not

**Media and content**
- [x] **CF-15** Square photos and videos render horizontally
- [x] **CF-16** Long game descriptions are cut off instead of shown in full
- [x] **CF-17** Size limit for photo uploads on games

**Scoring**
- [x] **CF-18** Text auto-approval should reject a wrong answer, not leave it

**Permissions**
- [x] **CF-19** Event managers need the tablet QR code too

## Open bugs / security

### Auth-bypass audit, 11 Aug 2026 (6 confirmed findings, 1 refuted)

Prompted by Rumen asking whether login-page injection ("type symbols / DROP
TABLE / ignore-all-instructions and get in") was possible. Verdict: no. Supabase
parameterises all queries, there is no dynamic string-built SQL, no hardcoded
backdoor, and the app uses no AI so prompt injection has no surface. XSS is
also covered (React escapes; the one raw-HTML sink is sanitised and organiser
only). The audit did surface these adjacent issues:

- [x] **AUD-3 Team name/photo overwrite** (medium) FIXED V3.18.2. Any participant
  could rename another team and swap its photo (offensive image on the display),
  because `teams_guard_participant_update` protected score/color/slot/status but
  not name/photo, and the anon update policy only checked the shared event join
  token. Guard now requires `x-team-token` ownership for name/photo edits on a
  claimed team. Migration `20260811210000`, applied to prod and verified.
- [x] **AUD-6 Signup captcha fails open** (low, config-dependent) FIXED V3.18.2.
  `register-client` skipped Turnstile if `TURNSTILE_SECRET_KEY` was unset. Now
  fails closed. Redeployed (v23). Rumen confirmed the secret is set in prod.
- [x] **AUD-4 Username to email disclosure** (low) FULLY LIVE + VERIFIED 11 Aug
  (V3.18.3). Frontend deployed, then anon+authenticated AND public execute
  revoked on `resolve_login_email` (migrations `20260811213000`). Verified after
  revoke: direct anon RPC now returns 401 "permission denied for function
  resolve_login_email" (oracle closed), and `login-identifier` still returns a
  session (login intact). Gotcha logged: Postgres grants EXECUTE to PUBLIC by
  default, so revoking anon/authenticated alone left the oracle open via PUBLIC;
  had to revoke PUBLIC too. Rumen chose to fix it (build + test on QA first).
  Done: two new edge functions deployed to prod, `login-identifier`
  (username sign-in resolves + signs in server-side, returns only the session,
  never the email) and `request-password-reset` (forgot-password resolves +
  sends reset mail server-side, always generic `{ok:true}`). Client rewired
  (`auth-context.tsx`, `ForgotPasswordPage.tsx`); `resolveLoginEmail` removed
  from `auth-identifier.ts`. Verified against the QA account by direct curl:
  correct username -> 200 session with NO email in the body; wrong password,
  unknown username and `%` wildcard all -> identical generic 401; email login
  still works; reset endpoint returns generic `{ok:true}` for unknown/empty.
  `npm run build` green. REMAINING (Rumen): push V3.18.3 so the new frontend is
  live, THEN apply migration `20260811213000` to revoke anon execute on
  `resolve_login_email`. Order matters: revoking before the new frontend is live
  breaks username login on the old frontend.
- [ ] **AUD-1/2/5 Tablet PIN weaknesses** (medium/low) WON'T FIX per Rumen
  (11 Aug): default PIN `1234`, no forced change, anon-resolvable org id/slug,
  org-scoped-only lockout. Rumen's call: org is responsible for setting a unique
  PIN. One residual code gap worth a small future fix regardless of PIN strength:
  `takeover_team_slot` (`20260807140000`) has NO lockout at all (unlike
  `verify_tablet_password`), so its PIN check is unthrottled brute-forceable.
- refuted: `get_tablet_events_for_org(uuid)` anon cross-tenant leak was real in
  migration 042 but already dropped/replaced by `20260709165744` (two-arg,
  token-gated). No action.

- [x] **SEC-TEAM Participant writes are event-scoped, not team-owned** — **fully
  live 2026-07-29 (V2.19.0 + migrations 20260719130000, 20260729010000).**
  Merged from `feature/team-write-security` (2026-07-19) after re-verifying it
  against three weeks of intervening changes. Deployed in the required order:
  client (x-team-token header) shipped first, migration applied after. Live
  end-to-end test against production immediately after, using a real join
  token, the real `claim_team_with_inventory_access` RPC, and real submission
  inserts: legitimate own-team write succeeded (201), a forged write using
  another team's token was rejected (400, "This phone is not authorized for
  that team"), and a write with no token at all was rejected the same way.
  **That same test caught a real bug the original implementation had never
  actually been run against**: the migration revoked EXECUTE on
  `team_has_private_token`/`live_team_token_matches` from `anon` but the
  calling trigger isn't `SECURITY DEFINER`, so it broke every anonymous
  submission write the instant it went live — SECURITY DEFINER controls what a
  function's body runs as once called, not who is allowed to call it.
  Corrected within minutes via a follow-up grant migration, then re-tested
  clean. Compatibility: teams claimed before the token existed (pre-V2.13.0)
  keep the old event-scoped behaviour instead of being locked out. Puzzle RPC
  score inserts keep their bypass (they validate the same token as an
  argument). Test fixtures cleaned up after.
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
- [x] **P2-3** Tablet PIN: Settings warns + blocks the kiosk link until a non-default password is saved (on `main` since V2.1.0, `src/pages/admin/SettingsPage.tsx:91-92,465-485`)
- [x] **P2-5** register-client signup rate limiting — per-IP limit (5/hour, `signup_attempts` table, migration 087), enforced server-side in the edge function before any org/user is created; verified live (5 succeed, 6th returns 429). **Bonus fix**: found and fixed a real hooks-order bug in `RegisterPage.tsx` while testing — two early `return`s sat before 8 `useState` calls, crashing the whole page ("Rendered fewer hooks than expected") whenever `user`/host status changed value between renders (e.g. a stale session). Registration was silently broken for anyone hitting that edge case (on `main` as of V2.4.4)
- [x] **P2-5b** Cloudflare Turnstile wired into the register form + `register-client` Edge Function. The frontend sends the Turnstile token with signup, and the Edge Function verifies it server-side when `TURNSTILE_SECRET_KEY` is configured; rate limiting remains in place as the fallback guard. (V2.4.7)
- [x] **P2-UP** Photo compression before upload — found the real gap: the in-app WebRTC camera capture already downscaled via `downscalePhoto`, but the native-camera-app fallback (`ChallengeMediaCaptureFlow.tsx`, used on iOS) and both team-claim-photo pickers (participant `JoinEventPage.tsx`, facilitator `FacilitatorEventPage.tsx`) uploaded the raw, full-resolution file straight from the camera. Wired `downscalePhoto` into all three. Verified live: a 1.2MB test photo uploaded through the team-claim path landed in storage at 253KB (~79% smaller), correct filename/mimetype preserved. Upload error handling already existed (`validateUploadFileSize` + try/catch on all paths), so scoped to just the compression gap (on `main` as of V2.4.6)
- [x] **P2-LOG** Full activity log with filters (#12) — client-side filter by actor (team/facilitator/admin, by name) and by action, on top of the existing per-event log; CSV download respects the active filters (on `main` as of V2.4.3)

## Re-land — was done pre-rollback, lost when main reverted to V2.0

All of the below were merged into `main` via PR #1 as part of the V2.1.0
"fixes-branch batch" (2026-07-07). The `fixes` branch itself no longer exists
(deleted post-merge). Confirmed live on `main` by code inspection 2026-07-29;
whether Rumen ever did the originally-requested live-phone confirmation pass
on P1-3/P1-B4/P2-2/Q-3 specifically is not recorded anywhere in git history —
worth a real pass if it's been a while since the last live event exercised them.

- [x] **BONUS-RM** Remove bonus games from music bingo — editor, facilitator, player, display, `BingoBonusPanel`/`bingo-bonus-scoring`/`bingo-submission-url` all removed; verified with a throwaway org/event via browser automation (Start on first press, 29-song run plays, cell marks instantly, no bonus UI anywhere) — not a live phone test, still worth a real one before the next event (on `main` as of V2.4.1)
- [x] **P1-3** Client bingo restart calls the atomic `restart_bingo_run_scores` RPC — exact re-apply of 401ec01, confirmed live on `main` (`src/lib/restart-bingo-run.ts:23`)
- [x] **P1-B4** Cancel broadcast re-landed — exact re-apply of 3656e4c, confirmed live on `main` (`cancelPendingSubmission`, `src/components/live/JoinGameView.tsx:760-776`)
- [x] **P2-2** Backoff cap re-landed — exact re-apply of bb34912's backoff half; error-path only, resets on successful subscribe, confirmed live on `main` (`src/hooks/use-live-event.ts:375-379,578-579`)
- [x] **P2-4** Strip PII debug logs (names / team ids in console) — confirmed live on `main`, zero matches left
- [x] **ENG3** Re-delete dead components (scroll-area, BrandingTab, CompactListRow) — confirmed live on `main`, zero references left

## New design rollout (client admin panel)

**SHIPPED: the whole redesign merged to `main` and went live as V3.0.0 on
3 Aug 2026** ("release: V3.0.0, the new design ships", commit 33de51e).
Rumen ran a real client event on it the same day, which is the sign-off.
The `delete_own_account` migration ND-5 flagged as pending IS applied to
production (verified 9 Aug 2026). The stale `feature/new-design` branch
pointer still exists with a few WIP commits; do not resume work on it.
Design reference and handover live in `new-design/`.
Spec: `docs/superpowers/specs/2026-07-30-new-design-shell-and-dashboard-design.md`.
Plan: `docs/superpowers/plans/2026-07-30-new-design-shell-and-dashboard.md`.

- [x] **ND-1** Phase 1: app shell + Overview. Shipped in V3.0.0.
  Cool grey surfaces (`#f7f7f8` canvas, white cards, `#1f2126` text) with brand
  yellow `#ffc107` kept; Inter replaces Manrope; radii tightened to 3/6/10px;
  new slate and neutral 100-900 ramps. New 40px header carries search, New Game,
  New Event, theme toggle, Help, Exit and an initials avatar. Sidebar keeps every
  role-gating rule but loses its theme and sign-out rows, and Organisation and
  Billing are now flat top-level items. Overview rebuilt as four stat tiles, a
  30-day participation chart (hand-rolled SVG, no charting dependency) with a
  Submissions/Teams switcher, a game-type breakdown and the activity feed.
  Deliberately omitted, with reasons: stat week-over-week deltas (no historical
  data), an "active players" metric (no participants table, submissions carry
  only `team_id`), image avatars (`profiles` has no `avatar_url`), help article
  content (no content system), and the Your Plan and Quick Links cards (dropped
  by decision). Auth and marketing pages still read the legacy `--rh-*` tokens
  and stay ivory; restyling them is a later phase.
- [x] **ND-2** Phase 2: Organisation, Billing, Support, My Account, Games and Events.
  Code complete and reviewed live while building. Organisation dropped its
  tab strip (now navigated from the flat sidebar) and gained a two-column Brand
  Identity / Legal & Billing Details layout; account deletion moved into a new
  shared `DangerZone` component (`src/components/admin/DangerZone.tsx`) matching
  the design's red-bordered pattern, reusable for My Account and the event editor
  later. Onboarding tour's billing step retargeted from the removed tab to the
  sidebar Billing item (`nav-billing`). Support gained an Export button
  (plain-text transcript download) and Enter-to-send with Shift+Enter for
  newlines, both named in the design and previously missing.
  Phase 2 broad-layout pass 2 is now code complete and awaiting Rumen's live
  review: Games now uses the reference's library tabs, compact cover-card grid,
  type chips, group filter, renamed Add Group/Add Game actions and a 560px
  slide-over editor with full-screen affordance; Music Library now has a proper
  playlist rail and compact song table; Deleted Games/Events use the shared
  bordered table treatment. Events now has status chips, date-range filtering,
  Upcoming vs Past/Archived card sections, inline lifecycle controls, the
  four-part Display/UI Colour/Branding/Teams strip, and revised Event Links.
  New Game's type picker and the Event editor's Primary, Branding, Teams,
  Games, Stages and shared Danger Zone surfaces now follow the same design
  language. The shared Organisation/Team facilitator table was updated too.
  Build and lint are clean; all 153 tests pass.
- [x] **ND-3** Interaction/detail refinement. Safe redesign scope is code complete:
  the Event editor now has reference-style Display/UI/Purchase toggles, live
  desktop/mobile branding previews, a team stepper, four-way stage type control,
  refined break fields, and a complete Download/Reset/Delete Danger Zone. The
  Puzzle Designer now has the Wordle/Matching/Crossword segmented control,
  keyboard control, Wordle preview and denser matching-pair editor without any
  scoring or live-game rule changes. Client Billing alone now uses a two-column
  layout; the shared super-admin Paddle view is unchanged. Support chat now
  renders the current user's messages right/blue and the other party left/gold.
  My Account gained the identity header, inline name editing, password mismatch
  state and dirty-only Save/Discard controls. The final autonomous pass completed
  the group workflows (select/filter games while creating a group, and Add Games
  for an existing group), type/group/search filters plus bulk restore in Deleted
  Games, a real Music Library preview player and its playlist/date/duration table,
  group-aware Quest-stage picking that collapses behind Add More after selection,
  corrected the global New Game shortcut, and added skip-navigation, semantic main
  content and a useful 404 recovery action. Production build and lint are clean;
  all 153 tests pass. Still intentionally absent: profile
  photo. (Log-out-all-devices and per-user account deletion were absent for the
  same reason but have since been built, see ND-5.) Permanent deletion of games
  is also not exposed because no safe game-deletion backend exists. Puzzle
  gameplay/scoring was deliberately preserved; only its editor presentation was
  redesigned. The branch still requires Rumen's overall staging/sign-off before
  it can enter the release workflow.
- [x] **ND-4** (shipped in V3.0.0) High-fidelity layout correction after live review. The earlier
  implementation followed the feature inventory but did not follow the design's
  page geometry closely enough. The shared page shell now uses the full admin
  workspace with the reference's 32px inset instead of a centered 1152px column,
  and admin headings use Inter at 32px/700 rather than the legacy display serif.
  Organisation now follows the exact two-column hierarchy: Brand Identity and
  Legal & Billing on the left, Tablet Access and Team Management on the right,
  with Public/Private tags, the large logo dropzone, compact colour controls,
  payment-details link, compact QR controls, and both data-export and deletion
  rows in the Danger Zone. Billing now uses the reference's 1:2 plan/invoice
  grid; Support uses its centered heading, segmented control and 520px case
  form; My Account uses paired profile/details and password/security columns.
  Games and Events use the denser auto-fill card grids from the design, and the
  Music Library now includes its right-hand album/playlist rail. Real Paddle,
  auth, deletion, event lifecycle and game-editing behavior remains intact.
  Build/lint/tests are clean (153 tests); awaiting Rumen's refreshed visual pass.

## UI redesign — facilitator console

- [x] **UI-1** Inline timer control + editing (#16) — [-15] [N min] [+15] next to Start; click paused countdown to type minutes or mm:ss, Save/Cancel (on `main` since V2.1.0)
- [x] **UI-2** Show Timer + Show Score side by side, centred card footer (#17) (on `main` since V2.1.0)
- [x] **UI-3** Display fills card, hover copy icon with "Link copied" pill, Copy Link button removed (#18) (on `main` since V2.1.0)
- [x] **UI-4** Countdown + Reveal card at top of right column (#19) (on `main` since V2.1.0)
- [x] **UI-6** Announcements compact single row below Display (#21) (on `main` since V2.1.0)
- [x] **UI-7** Quiz/Bingo/Break controls left under Announcements, only when that stage is active; quest review stays right (#22) (on `main` since V2.1.0)
- [~] **ENG1** Refactor FacilitatorEventPage — **stage 1 on `main` as of V2.4.13** (needs facilitator smoke test). Extracted the 4 leaf modals (winner routing, team claim, reset-team, event log) to `src/components/live/facilitator/FacilitatorModals.tsx` as presentational components; page still owns state/handlers, props TypeScript-checked, no behaviour change, 2268 → 2146 lines at the time. STILL OPEN, and has grown since: as of 2026-07-29 `src/pages/live/FacilitatorEventPage.tsx` is back up to **2259 lines / 24 `useState` calls** (unrelated feature work — puzzles, inventory — added back onto it). No stage 2 decomposition has happened. Purely internal (no user benefit) — lower priority than the Paddle feature.

## Quest stage editor

- [x] **Q-1** Multi-select when adding Quest games (#13): All / All photo / All video / All text quick-add with counts, drawing from the whole org library (on `main` since V2.1.0)
- [x] **Q-3** Drag-to-reorder Quest games; order = players' display order (#15) — draggable list in the stage editor + JoinGameView follows gameIds order (on `main` since V2.1.0; a confirmed live-phone pass on the player side isn't recorded anywhere, worth doing if it's been a while)

## Engineering health

- [~] **ENG2** Refactor JoinGameView (second God-component) — **stage 1 on `main` as of V2.4.14** (needs participant smoke test). Extracted the 3 leaf overlays (facilitator chat, announcement, exit-password dialog) to `src/components/live/participant/JoinGameOverlays.tsx` as presentational components; page still owns state/handlers, props TypeScript-checked, no behaviour change, 1555 → 1484 lines at the time. STILL OPEN, and has grown since: as of 2026-07-29 `src/components/live/JoinGameView.tsx` is up to **1632 lines**. No stage 2 decomposition has happened. Purely internal — lower priority than the Paddle feature.
- [x] **ENG4** Lazy-load jspdf + ffmpeg — main bundle 1881 kB → 1481 kB, gzip 550 → 419 kB (on `main` since V2.1.0)
- [x] **ENG5** Test suite around scoring — vitest, 30 tests on the bingo core (win detection, cell matching, card generation); `npm test`
- [x] **ENG6** Clear lint backlog — 96 problems (79 errors, 17 warnings) down to 0. Mechanical fixes (unused escapes/assignments, irregular whitespace, control regex) plus ~50 targeted `eslint-disable` comments for legitimate patterns the new React Compiler rules over-flag (the "keep ref fresh" idiom, hydrate-form-from-fetch, object-URL previews, fetch-on-mount). Found and fixed a real bug along the way: a dead `else if` branch in bingo auto-advance (`no-dupe-else-if` caught it — the branch could never execute, since its condition was a subset of the preceding `if`) — verified live with a full throwaway bingo round, crossfade + multi-song auto-advance all correct afterward. Also deleted one unused deprecated hook (`useFacilitatorChatUnread`). (on `main` as of V2.4.5)
- [x] **ENG7** Branch cleanup — AUDIT.md retired to docs/AUDIT-2026-06.md; all four stale branches deleted (neo-minimalism, security-hardening, bingo-live-fixes, new-features — fully merged, approved by Rumen)

## Fixed — admin reload bug

- [x] Hard reload on any /admin/* sub-route bounced to the dashboard — root cause: `profileLoading` in `src/contexts/auth-context.tsx` could read `false` for one render after a signed-in session resolved but before the profile (and role) had actually loaded for that user, so role-gated redirects (`RequireAuth`'s platform-access check) briefly saw `role: null`, treated it as "no access," and sent the user to `/login` without preserving where they'd been — landing them on the default dashboard once the real role loaded a moment later. Fixed by tracking which user id the loaded profile actually belongs to, so `profileLoading` stays true until it genuinely matches. Verified live across `/admin/games`, `/admin/settings`, `/admin/team` — reload now stays put (on `main` as of V2.4.2).

## Later / ideas

- [x] **PUZZLES-1 Puzzle game family:** live in V2.16.0. All three subtypes shipped
  (built 2026-07-18). Wordle, Matching, and the manual 5x5 Crossword
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

- [x] **PUZZLES-2 Crossword rework:** live in V2.16.0 (built 2026-07-19), after
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

- [x] **PUZZLES-3 Puzzle keyboard + hint fix:** live in V2.16.0
  (built 2026-07-20), after a second play-test round. Crossword hint fixed: now
  reveals exactly one letter per use (was one letter per unsolved word,
  which could light up many cells at once), preferring a cell shared by two
  unsolved crossing words; smoke-tested against the live DB. Crossword and
  Wordle both drop the native mobile keyboard (which caused viewport jump)
  in favour of a shared, always-present on-screen `VirtualKeyboard`
  (Latin/Cyrillic, designer-selected per puzzle via a new
  `puzzle_keyboard_alphabet` config field). Crossword cells are now
  cursor-driven buttons instead of real `<input>`s. Wordle keeps its box
  display but types via the same keyboard, with keys coloured green/yellow/
  gray from guess history and gray (absent) letters locked from reuse. Also
  fixed an editor bug where hovering a run to pick direction never focused
  the typing input. New migration
  `20260720170000_crossword_hint_single_letter.sql` applied to the shared
  Supabase project. Build, lint, and 141 unit tests pass. Design:
  `docs/superpowers/specs/2026-07-20-puzzle-keyboard-and-hint-design.md`,
  plan: `docs/superpowers/plans/2026-07-20-puzzle-keyboard-and-hint.md`.

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

- [x] **MKT-2** Marketing homepage rework, agency-first positioning — **live in
  V3.11.0** (9 Aug 2026, parallel session). New hero, Book a demo primary CTA,
  event store / pricing-comparison / trust sections, voice guide at
  `docs/marketing/voice-guide.md`, serif display font retired.
- [x] **MKT-1** Marketing homepage redesign — **live in V2.5.0**. Rebuilt `rallyhub.games` from the design handoff (`Marketing Page Design/`) into maintainable components under `src/components/marketing/home/` + `src/styles/marketing-home.css`. Verified: build/lint/tests pass, no console errors, no horizontal overflow at 375px, mobile menu + palette preview + form validation all work, dark mode holds. Optimised hero/display images + real OG image added. Accuracy guardrails applied (no instant-scoring-for-all, no client-management or free-event claims).
- [x] **CONTACT-1** Marketing demo form backend — **live in V2.5.1**. `submit-contact` Edge Function (deployed) validates + honeypot + per-IP rate limit, stores every lead in `contact_submissions` (RLS super-admin read), emails via Resend when `RESEND_API_KEY` is set (graceful degradation: lead saved even without the key). Frontend wired with loading/success/error + mailto fallback. Verified end to end. **Remaining (Rumen, dashboard):** set `RESEND_API_KEY` (+ optional `CONTACT_TO_EMAIL`/`CONTACT_FROM_EMAIL`) Edge Function secrets to turn on the email — see `docs/RESEND-SETUP.md`. Confirm the `hello@rallyhub.games` inbox exists/forwards.
- [x] **EMAIL-1** Transactional email via Resend — **done.** Code/deliverables landed in V2.5.1; Rumen confirms the Resend account, domain verification and Supabase Custom SMTP were set up (3 Aug 2026). Branded auth templates in `docs/email/rallyhub-auth-templates.html`; full guide in `docs/RESEND-SETUP.md`. Decision stands: Resend as Supabase Auth **Custom SMTP** (built-in sender is test-only).
- [x] **FACIL-1** Facilitator admin access — **live in V2.5.2, smoke-tested for real 2026-07-29.** Facilitators were fully locked out of the app/admin (4 guards bounced them; platform host looped to /login). Now they log in and land on a restricted surface: read-only Events page with open/copy links + teams QR (`FacilitatorEventsPage`), and a Profile page (`FacilitatorSettingsPage`, org shown read-only). Sidebar stripped to Events + Profile. Confirmed live against a real facilitator login on a local dev server: correct sidebar restriction, Profile page renders and prefills correctly. **Decision confirmed:** facilitators can edit their own name/username/email/password but NOT rename the org (left as a client_admin power).
- [x] **ACCT-1** Self-service account settings for every role — **live in V2.18.0.** New shared `MyAccountPanel` (first/last name, username, email, password) backed by `update-org-user`'s existing self-service path, which already supported any role editing their own record but had no frontend beyond name. Facilitators' Profile page now exposes all four fields. Event managers previously had zero personal account access (`/admin/settings` silently bounced them to Events) — now get the same page plus a new sidebar "Profile" entry. Client admins/super admins get a new "My Account" tab in Settings. Verified live against a real facilitator login.
- [x] **REDESIGN-1** Full app redesign — superseded and delivered: the admin
  redesign shipped as V3.0.0 (see "New design rollout"), and the mobile/tablet
  adaptation is the current V3.10.x-V3.12.0 work stream. ENG1/ENG2
  (God-component refactors) were NOT folded in and stay open.
- [x] **PRICING-1** Final plan ladder promoted in V2.12.0: Pay Per Event €199/event with no subscription; Starter €20/mo or €180/yr + €149/event and 2 events/month; Pro €200/mo or €1,800/yr + €99/event and unlimited events; Custom by contact. Standard plans include 5 teams/event. Business is retired. See `docs/PAYMENTS-AND-PLAN-ECONOMICS.md`.
- [~] **PAY-2 add-ons:** additional-team billing is complete in V2.12.1: five included, then €10/team, snapshotted server-side into the activation invoice and automatically included in Paddle's exact invoice charge. Remaining: decide and implement the optional per-event RallyHub branding-removal price/product.
- [ ] **L-2** AI features for clients (#24): bulk game creation, AI descriptions
- [~] **PAY-1 current:** Paddle subscription, event checkout, webhook, and per-event auto-charge paths have all been sandbox-tested successfully (confirmed by Rumen, 15 Jul 2026). Pay Per Event is postpaid: an event goes live immediately, then an invoice is raised; another event is blocked while an earlier invoice is unpaid. Starter and Pro require an active paid-through subscription. Limits and friendly messages are server/UI enforced. V2.11.0 removed automatic first-event-free (selected clients use a 100% event promo), closed privileged invoice RPC direct access, and added an in-app Starter/Pro plan-change flow with Paddle proration preview and payment-failure protection. V2.12.0 applies the final prices and removes the signup trial. Plan changes remain feature-flagged off until live-payment verification. Full rules and unit economics: `docs/PAYMENTS-AND-PLAN-ECONOMICS.md`.
- [~] **DATA-1 Storage-first deletion lifecycle:** code promoted in V2.11.0; Supabase deployment remains. Event Bin expiry, six-month retention, manual permanent event deletion, super-admin client deletion, and client-requested 30-day account deletion converge on one private retry queue + `data-lifecycle` Edge worker. Storage prefixes are deleted through the API in 1,000-object batches before DB finalization; failures remain retryable. Client Organization Settings includes request/restore controls, Paddle renewal scheduling/undo, and a 30-day countdown. Deployment/Vault setup and destructive smoke checklist: `docs/DATA-LIFECYCLE.md`.
- [ ] **DEV-DB1 Fresh local Supabase reset:** the historical migration chain cannot currently build a database from zero. Migrations 030/037 consume a newly added enum label in the same transaction, then 038 attempts to change `resolve_tenant_by_host`'s return type with `create or replace`. This predates DATA-1; the new lifecycle migration was instead applied and behavior-tested successfully against an isolated Supabase Postgres schema. Repair the historical chain separately without rewriting already-applied production state.
- [ ] **PAY-1 live launch:** follow `docs/PADDLE-LIVE-CHECKLIST.md`: apply the pending billing/lifecycle migrations; deploy current Paddle Edge Functions and `data-lifecycle`; configure lifecycle Vault/cron secrets; audit and clear confirmed sandbox Paddle IDs; switch Supabase/Vercel to live Paddle credentials and production environment together; confirm production webhook subscriptions, VAT-exclusive tax setting, and the destructive lifecycle smoke checklist. Enable `VITE_ENABLE_PLAN_CHANGES` / `ENABLE_PLAN_CHANGES` only after the live smoke test.
- [ ] **PAY-3 Live webhook secret + missed events (9 Aug):** a real live-mode
  €1.80 test charge on RallyHub Gaming succeeded, but the live notification
  destination's actual signing secret only surfaced via `GET
  /notification-settings/{id}` (`endpoint_secret_key`) — the value pasted
  into Supabase's `PADDLE_WEBHOOK_SECRET` was wrong, so webhook signature
  verification failed (`401 Invalid signature`) and `transaction.completed`
  / `subscription.created` never landed. Fix: confirm Rumen has pasted
  `pdl_ntfset_01kympmfcjxd3mkphmd4xnxj3d_FGB10dFZO0rQaeJDHd3UyI4ikf2IUAa0`
  into the Supabase secret, then replay those two events from Paddle's
  dashboard so RallyHub Gaming's org row (`63e284db-9e4f-408b-83df-2e311fee968b`)
  gets its `paddle_subscription_id`/`subscription_status` populated (both
  still null despite the real charge).
- [~] **CONTENT-1 Game catalogue:** **147 platform templates are live** in the
  RallyHub Game Library org (`is_platform_template = true`), installable by
  client orgs through the existing Install to clients flow.
  - All **125 quest placements** seeded across the five groups via
    `scripts/seed-quest-library.mjs`, which parses `docs/GAME-CONTENT-PLAN.md`
    so the markdown stays the source of truth (`--dry` previews, `--remove`
    undoes). 49 photo, 57 video, 19 text.
  - **28 puzzle games** (12 Wordle, 10 Matching, 6 Crossword) seeded via
    `scripts/seed-puzzle-library.mjs` into a "Puzzles" group. Content and rules:
    `docs/GAME-CONTENT-PLAN-PUZZLES.md`. Crossword grids are generated and
    validated by `scripts/build-crosswords.mjs`; verified live that a generated
    grid renders 18 cells and the server accepts a solved word.
  - Cover prompts for every puzzle plus the five quest group covers are in
    `docs/GAME-COVER-PROMPTS.md`, with a SOURCE MANUALLY list for covers needing
    a licensed reference.
  - **6 themed quizzes, 360 questions** seeded via
    `scripts/seed-quiz-library.mjs` into a "Quizzes" group: Harry Potter, Marvel,
    Bonjour France, Passport Please, Screen Time, and the 90s & 2000s Time
    Machine. Each is 20 easy, 20 medium and 20 hard across three rounds, 4
    options, 20 points, 10-second timer. Source data in `scripts/data/quizzes/`.
    `scripts/check-quizzes.mjs` enforces round sizes, four unique options, a
    valid correct index and no duplicate questions; verified in the database that
    all 360 correct-answer ids resolve to a real option.
    Correct answers are shuffled deterministically at seed time
    (`scripts/lib/quiz-shuffle.mjs`) because writing them where they read best
    put them in the first two slots almost every time.
  - **159 cover prompts** in `docs/GAME-COVER-PROMPTS.md`, grouped into 7 pasteable
    batches (one per quest group, one for puzzles, one for quizzes), each naming
    its output folder and exact filenames. Regenerate with
    `scripts/build-cover-prompts.mjs` after adding games.
  - Remaining: generating and uploading the 159 cover images.
- [x] **TEXT-JUDGED Judged free-text games** — a text game with **range** points
  is now scored by the facilitator instead of being matched against a correct
  answer. Free-type games need no answers; choose-answer games still need their
  options but no correct one marked. The editor relabels the answer fields as
  optional organiser notes, and the facilitator's reference panel hides itself
  when there is nothing to reference. Verified end to end on a throwaway event:
  the player gets a free answer box showing "Up to 250", the submission lands
  `pending` with the range attached, and the facilitator gets the points input.
  Four judged challenges written in the plan with fixed points were seeded as
  ranges floored at a third of the planned value (the plan's number stays the
  maximum) because a judged text game cannot express fixed points.
- [ ] **PDF-1** Branded PDF event-recap report — `src/lib/event-export.ts` currently ships a ZIP of media + CSV logs as a stand-in; the real branded PDF report was deferred and never built

## Shipped but never got a tracker line (backfilled 2026-07-29)

- [x] **DEMO-1 Public self-resetting demo account** — live and in daily use:
  `demo.rallyhub.games` needs no login and is the standing UI-verification
  environment (production confirmation happened in practice). Implemented on
  `feature/demo-account`: passwordless shared tenant entry, 30-minute automatic
  restore + manual countdown control, deterministic year-long history using the
  real platform game library, runnable live events, simulated Paddle checkout,
  plan changes, fake paid/unpaid invoices, storage cleanup, and deletion guards.
  Supabase migration and Edge Functions deployed and smoke-tested on 2026-07-30;
  the `demo.rallyhub.games` CNAME is configured. The expanded seed is also live:
  all 159 active platform games refresh into the demo, 14 events use distinct
  game sets, and the ready `RallyHub Product Showcase` includes Quest, Quiz,
  Break, and a playable 25-track CC0 Music Bingo stage. All seven platform game
  groups and memberships are preserved; the demo-only bingo sits in its own
  group, with zero ungrouped games. Awaiting browser/device production
  confirmation. See `docs/DEMO-SANDBOX.md`.

- [x] **LEGAL-1** DPA / legal-acceptance tracking + participant privacy notice (V2.10.0) — GDPR-relevant, no dedicated line existed until now.
- [x] **GAMES-FILTER** Game-group filter + search in the Add-games / quest-stage-picker modals, went through several iterations: added (V2.13.2), "Hide points for teams" toggle (V2.13.3), stage-picker scoping (V2.13.4), a scoping fix (V2.13.5), then the filter/search UI was fully reverted back to type-only pills (V2.13.6) — current state is the V2.13.6 reversion.
- [x] **VIDEO-INSTR** Example/instructional video attachable to photo games, plus a fix for one that was saved but never shown (V2.14.0).
- [x] **GAMES-PANEL** Edit-games-from-a-side-panel redesign (V2.15.0), plus a real points-editor bug fix for text games (V2.15.1) and a cropped-cover-image fix (V2.15.2).
- [x] **INVENTORY-2** Per-event "Teams can buy items with their points" toggle, enforced both client-side and server-side (V2.16.1).
- [x] **DIAG-1** Client-side diagnostic logging (`client_diagnostics` table) — permanent capture of currently-mysterious failures (edge function calls, storage uploads, photo capture, video recording, and the text-submit close timing) with real error detail, both on-screen and queryable server-side. Ships as V2.20.8. Built after reverting V2.20.1-V2.20.6 (see `docs/superpowers/specs/2026-07-30-media-capture-investigation-design.md`) because those six commits were guessed and verified only in a sandboxed browser, never on real hardware. Root-cause fixes for the underlying failures are deferred to a follow-up spec once real evidence comes back from Rumen's iPhone and Android tablet.

- [x] **CAPTURE-2026-07-30** The full camera/upload investigation that DIAG-1 was built for, resolved end to end across V2.20.9-V2.20.28, every fix picked from measured device evidence: x-team-token CORS gate re-landed (submissions restored on all platforms); tablet shutter (ImageCapture 2-23s per shot) replaced with preview-frame capture; choppy tablet video (3fps at a forced 3120x2448) fixed by dropping the max-resolution reconfigure, then 720p recording on Android per Rumen's fps-over-quality call (iOS keeps 1080p); full field of view with no zoom crop, edge-to-edge capture screens; join photo uses the in-app camera on tablets; Hermit's 8-13s shutter was the JPEG encode fighting the live camera pipeline for the GPU in the system WebView, fixed by releasing the camera before encoding (confirmed on device). Still parked: iPhone in-app video shows horizontal/slightly zoomed (exact-portrait demand shipped in V2.20.21, needs one retest); Hermit never delivered a single client_diagnostics insert while Chrome on the same tablet did (worked around with on-screen display, worth understanding before relying on diagnostics rows from WebView traffic).

- [x] **IOS-FREEZE** (RESOLVED 8 Aug 2026, V3.6.x: the stall was an iOS
  missed paint — WebKit committed but never presented the frame — fixed with
  a 1px repaint nudge after submit, plus the V3.6.1 perf pass; Rumen's 9 Aug
  iPhone test passes closed the complaint. Historical detail below.)
  iPhone post-submit freeze (constant ~2-4s, floats between the submitting screen and the next tap; also delays approval echoes). Exhaustively instrumented across V2.20.10-V2.20.31: submit close, paint delay, tap dispatch (hardware timestamp), and render all measure clean on every reproduction, and zero iOS diagnostic rows exceeded thresholds all night — the stall is provably OUTSIDE the page (WKWebView/Safari input+display pipeline), which is why three page-level candidate fixes (toast backdrop-blur, iOS-only flat toast, skipping the submit sound) each changed nothing on device and were reverted. Next step when picking this up: 10-minute wired session — iPhone via cable, Mac Safari Develop menu, record a Web Inspector timeline during a text submit; the timeline sees the layers page instrumentation cannot. Not event-blocking: tablets are the event platform, and the iPhone flow works correctly, just sluggish for a few seconds after each submit.

- [~] **HERMIT-ENCODE** Correction to CAPTURE-2026-07-30: the Hermit shutter fix (V2.20.27, camera release before encode) was confirmed on one good round but the stall is INTERMITTENT, so that confirmation was a lucky streak, not a fix. Rumen's on-screen stage data (31 Jul 2026) pins it precisely: frame grab is ~15ms every time; the JPEG encode intermittently stalls at a near-constant ~13.1s (five sightings at 13.1-13.2s plus 7.3s/8.7s outliers), content-independent, first-shot-of-a-game biased, retakes instant. That constancy is a timeout inside Hermit's WebView encoder, outside our code. V2.20.35 restructures around it: the captured canvas IS the preview (shutter feels instant always), the JPEG encodes in the background during human review, and Submit shows "Preparing" only if tapped before a stalled encode finishes. On-screen stats stay (draw ms, then encode ms when it lands). True root cause would need chrome://inspect on the tablet with Hermit's WebView debugging enabled; only worth it if the background-encode approach still bothers real events.

- [-] **COMPANION-APP** ~~RallyHub companion app for the App Store and Play Store~~ — **dropped by Rumen, 3 Aug 2026.** The PWA work (installable manifest, per-page manifests for the tablet and join surfaces, iOS splash screens, service worker) covers what the wrapper was for: teams install RallyHub from the browser on any of the four platforms and get a full-screen app with no third-party WebView. Verified on the Android tablet, which offered "Add to home screen" straight from the join page. `docs/IDEA-COMPANION-APP.md` stays as the reasoning if the decision is ever revisited. Note the Hermit encode stall (HERMIT-ENCODE) is a Hermit problem, so it disappears with Hermit rather than needing a wrapper of our own.

- [x] **ND-5** (shipped in V3.0.0; `delete_own_account` migration confirmed
  applied to production 9 Aug 2026) New design: merged `main` into `feature/new-design`, plus the two
  My Account Danger Zone actions that had been shipped as disabled placeholders.
  The branch had drifted 54 commits behind `main` (branched at the V2.19.1
  hotfix, missing all V2.20.x Hermit/camera work and V2.21.0's event media
  export). Merged on Rumen's instruction, six conflicts, all resolved as "keep
  the redesign's structure, carry main's demo guard into it": the demo's
  sign-out suppression moved onto the header Exit button, since the redesign
  moved sign-out out of the sidebar; the Organisation Danger Zone is swapped for
  a non-destructive explainer card on demo orgs; promo codes keep both the new
  grid wrapper and `!isDemo`. V2.21.0's export progress reporting (file counts,
  MB, missing-file warning, error surfacing) was ported into the redesign's
  Danger Zone download row rather than dropped. Branch is now 0 behind `main`;
  build and lint clean, 180/180 tests.
  **Log out of all devices** now calls `supabase.auth.signOut({ scope: 'global' })`,
  revoking every refresh token. No backend was needed.
  **Delete my account** adds `delete_own_account()`
  (`supabase/migrations/20260801120000_delete_own_account.sql`).
  `remove_organization_user` already deletes an auth account fully but
  deliberately refuses self-deletion, being the org-admin path for removing
  someone else, so this is the self-service sibling. Guards: super_admin refused
  (staff removed manually), demo orgs refused, and the last remaining
  client_admin refused so an org cannot be orphaned with nobody able to
  administer or delete it. Deleting the whole organisation stays a separate
  action on the Organisation page.
  **The migration is deliberately NOT applied to production.** It ships with the
  redesign at release, per the branch workflow. Consequence: until it is applied,
  Delete my account will fail with a missing-function error, so the RPC must be
  applied as part of releasing this branch. The destructive paths are also
  unverified end to end, because exercising them would delete Rumen's own live
  account; the confirm dialog, its Cancel path and both buttons' rendering were
  verified, the RPC itself was not.

## CF2 — Feedback from the 7 Aug live event (Ufficju Elettorali, Afterglow)

Rumen approved pushing straight to main on 7 Aug (no events imminent).

- [ ] CF2-1 Default "Welcome" stage type: shows a welcome message while teams
      sign in, instead of exposing all games immediately.
- [x] CF2-2 BUG iPhone non-Safari browsers (Chrome iOS) cannot access the
      camera for video. Investigate: Chrome on iOS is WebKit; getUserMedia
      availability + our capture-platform detection.
- [ ] CF2-3 QUESTION Non-Chrome browsers on Android: does the app work?
      (Event diagnostics show Samsung Browser submitting successfully.)
- [x] CF2-4 Inventory purchase page needs a back/return control in every
      state, especially "item unavailable".
- [ ] CF2-5 Manual camera permission re-request when a team refused it at
      join. Rumen wants this reachable via "facilitator menu" — interpretation
      to confirm (a device cannot re-prompt another device).
- [x] CF2-6 Superseded by the event Store (V3.3.0 + V3.4.0): teams order
      from a basket, the facilitator's Store orders card ticks items off per
      team, Complete all takes the points, done orders collapse into their
      own list. The old scan-to-buy purchases panel stays for storeless
      events.
- [x] CF2-7 Camera permission gate at join (V3.4.0): full screen prompt
      right after joining with one big Approve button; refusal shows how to
      fix it in browser settings plus Try again; skip is a small link.
- [x] CF2-8 Team slot takeover: a new device may claim a taken slot by
      entering the org's TABLET password (Rumen's decision, 7 Aug); the old
      device is logged out via token rotation.
- [x] CF2-9 Review cards and the submission modal show the team's answer,
      a correct/wrong verdict chip and the full expected answer (V3.2.x).
      **Was silently broken by the live-feed answer redaction** and re-fixed
      in V3.15.3: `get_live_event_games` stripped `text_correct_answer_id` /
      `text_correct_answers` from every caller's config, facilitators
      included, so the modal had nothing to compare against. Staff of the
      event's org now get the unredacted config; anonymous players and the
      display screen still get it stripped (proved both ways in the DB).
- [ ] CF2-10 "Play slideshow" facilitator action: display cycles all
      submissions + team photos (end-of-event while packing).
- [x] CF2-11 BUG root-caused: parseTextGameConfig silently fell back to
      options[0] when the correct id was unset, and typed games carried
      leftover options from earlier edits. Strict by-mode reads shipped with
      unit tests over the real leftover shapes (V3.2.x).
- [x] CF2-12 Readable submit errors: diagnostics logged "[object Object]"
      (supabase error objects aren't Error instances); players need a
      friendly "check connection, tap to retry" message.
- [x] CF2-13 Video upload progress: uploads ran 12s-260s at the event with
      only a spinner; show real percentage via the signed-URL upload.
- [x] CF2-14 Android hardware Back closed the QR camera-app browser sheet and
      teams had to rescan; the join page now traps popstate with a guard
      history entry so Back keeps the event open.
