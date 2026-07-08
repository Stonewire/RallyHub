# RallyHub Changelog

Version shown small under "Sign out" in the admin sidebar (`src/lib/version.ts`).
Bump `APP_VERSION` and add an entry here on each meaningful update merged to `main`.
Numbering: first = major updates, second = bigger batches of features/redesigns,
third = small fixes (e.g. 2.1.1).

## V2.4.4 — 2026-07-08 (signup rate limiting + register page crash fix)
- **P2-5**: the public signup endpoint now rejects more than 5 signup
  attempts per IP per hour (server-side, before any org/user is created).
  Captcha (Turnstile) is deferred until the site/secret keys are set up.
- **Fixed**: the register page could crash outright ("Rendered fewer hooks
  than expected") if a signed-in check changed value between renders (e.g.
  a stale/expired session in the browser) — two early returns sat before a
  block of `useState` calls, violating React's hooks rules. Found while
  testing the rate limit above; registration was silently broken for
  anyone who hit that edge case.

## V2.4.3 — 2026-07-08 (event activity log filters)
Added actor (team/facilitator/admin, by name) and action filters to the
per-event activity log (admin event page + facilitator panel), so you can
narrow a busy event log down to e.g. "just this team" or "just submission
rejections." Download CSV respects the active filters.

## V2.4.2 — 2026-07-08 (admin reload bug fix + small cleanups)
- **Hard reload on any /admin/* sub-route bounced to the dashboard**: for one
  render after a signed-in session resolved, the app could read `role: null`
  before the profile had actually finished loading, and a role-gated
  redirect treated that as "no access," bouncing to /login and then to the
  default dashboard once the real role loaded a moment later. Fixed by
  tracking which user id the loaded profile actually belongs to, so the
  loading flag stays true until it truly matches — reload now stays on the
  page you were on.
- **P2-1 documented**: multi-facilitator last-write-wins is a known,
  accepted limitation for now (single-facilitator workflow assumed); noted
  directly in code (`use-live-event.ts`) rather than built around.
- Dropped the Q-2 (game-time label) and bonus-games-rebuild items from the
  backlog — not wanted. Added Paddle payment integration and the branded
  PDF event-recap report as tracked future work.

## V2.4.1 — 2026-07-08 (remove music bingo bonus challenges)
Removed the bonus round feature completely: editor creation UI, facilitator
trigger/reveal/end controls, player answer UI, display rendering, plus the
now-orphaned `BingoBonusPanel`, `bingo-bonus-scoring`, and
`bingo-submission-url`. Regular bingo (start, marking, scoring, reveal, win
celebration) untouched — verified end-to-end with a throwaway event via
browser automation, not yet a live phone test.

## V2.4.0 — 2026-07-08 (live-event reliability: submit delay + bingo)
Shipped ahead of a live phone test, at Rumen's call — worth watching closely
on the next real event.
- **Quest submit/cancel stuck ~15s on "Submitting…"**: five spots (photo/video/
  text submit, quiz answers, cancel) waited on a best-effort broadcast to
  other devices before clearing their own loading state. A channel that
  isn't in a joined state (e.g. a backgrounded tab during a video capture)
  silently falls back to a slow REST call with a 10s timeout - meanwhile the
  facilitator's own view updates independently and instantly, which is why
  it looked like the facilitator saw it first. Now updates the player's own
  view immediately (matching the pattern already used for bingo marks) and
  sends the broadcast in the background instead of blocking on it.
- **Bingo Start needing 2-3 presses**: a brand-new bingo stage had no run
  row yet, so the first press had to wait on a network call before playing
  audio - by then it's no longer inside the tap that triggered it, so mobile
  browsers silently blocked the sound. The run now loads as soon as the
  stage is selected, before Start is ever pressed.
- **Bingo cells staying yellow long after the correct answer should show**:
  the "reveal this song's answers" trigger only fired in a narrow one-second
  window of the song's playback; a skipped update (any tab hiccup) pushed it
  to fire only after the whole song-change transition finished, so the next
  song was already playing while the last one's answers hadn't updated yet.
  Now it can't get skipped.
- **Tapping a bingo cell sometimes doing nothing**: the grid is briefly
  locked every round while the previous song is being scored - correct
  behaviour, but a tap during that window looked like the app just ignored
  it. Now shows a short "Locking answers…" note so it reads as expected.

## V2.3.3 — 2026-07-07 (description editor: text colour actually fixed)
- The real bug: the colour picker writes a `<font color="...">` attribute,
  not a CSS style, and the sanitizer only ever kept colour via `style` -
  so it was silently stripped every time you hit Save. Confirmed fixed by
  colouring text, saving, and reloading against the live database.

## V2.3.2 — 2026-07-07 (description editor: text colour fix)
- Picking a text colour in the description editor didn't stick - the native
  colour picker steals keyboard focus from the editor, so the colour command
  was running against nothing. It now refocuses the editor before applying
  the colour, so it saves and reloads correctly.

## V2.3.1 — 2026-07-07 (description formatting on player screens)
- The photo/video "take a photo/video" briefing screen was showing the
  description's HTML tags as literal text (e.g. `<b><u>`) instead of
  formatting them - it was missing the rich text renderer added in V2.3.0.
  Fixed, and reordered that screen (and the two other challenge screens) to
  Title → Points → Photo → Description → Button, so there's no empty gap
  when a game has no cover image.
- Description text on player-facing challenge screens is bigger and
  semibold by default, for readability.

## V2.3.0 — 2026-07-07 (recycle bin + description formatting + events fix)
- **Fixed a live bug**: creating an event and attaching games could fail with
  `column "updated_at" of relation "events" does not exist`, leaving the
  event saved but with no games attached (so it showed "This game is
  unavailable" in Play mode). The `events` table was missing a column a
  trigger added in a previous migration depended on.
- **Recycle bin**: deleting a game or event now moves it to a Bin tab
  (Games and Events pages) instead of destroying it - restore it or open it
  directly from there. Shows days left before it's gone for good (30 days),
  then it's auto-deleted. Invoiced events keep their record for payment
  history even after the bin empties.
- **Game description**: the box is now a proper multi-line editor with
  basic formatting - bold, italic, underline, bigger/smaller text, and text
  colour. Formatting only applies to the description field.
- Video games now default to a 30 second max duration instead of 2 minutes
  (still fully editable per game).

## V2.2.1 — 2026-07-07 (game editor + card cleanup)
- Editing a photo or video game (including ones brought in via batch import)
  now has the full editor: points (static/range), solution description and
  image, and for video the max duration + example video clip. Previously
  these were create-only and Edit showed a placeholder message.
- Removed the Draft/Active status dot from game cards on the Games page -
  it was never actionable (games have no status workflow like events do)
  and just added visual noise.

## V2.2.0 — 2026-07-07 (batch game import)
Import button on the Games page: download a CSV template, fill in one row per
game (quiz games: one row per question), upload, review the per-row validation,
and create the whole batch in one go. Supports photo / video / text / quiz,
static or 100-500 range points, time limits, typed and multiple-choice answers,
and a Group column that files games into groups (created automatically). The
original hand-made sheets (Name, Type, Description, Point type, Points) import
unchanged. Music bingo is excluded on purpose - it needs audio uploads.

## V2.1.1 — 2026-07-07 (facilitator console polish)
Rumen's review pass on the redesign: announcement buttons on their own row,
display copy icon top-left, one-row [-15][play][+15] stepper without the
minute chip, green glow on the live stage-controls card, and a yellow border
on selected Stage / filter buttons so selection is obvious in both themes.

## V2.1.0 — 2026-07-07 (the fixes-branch batch)
Everything from the fixes branch, merged via PR #1. Pre-merge state saved as
branch `stable-2.0`.
- Onboarding v2: per-user tours (every account reset; event managers get a
  trimmed run), auto-minimising panel, revisitable completed steps, Mark
  complete on every step. Interactive 19-step spotlight tour underneath.
- Facilitator console redesign: countdown + Reveal Winner top right, inline
  countdown editing, stepper next to Start, display preview fills its card
  with a hover copy icon, compact announcements, stage controls left and
  only when active.
- Quest editor: quick-add (All / photo / video / text), drag-to-reorder;
  player phones follow the stage order.
- Re-landed post-rollback fixes: cancel clears the player tile instantly,
  atomic bingo + quiz restart score reversal (RPCs), reconnect backoff cap,
  PII debug logs stripped, dead components deleted.
- Tablet kiosk link blocked until the default 1234 PIN is changed.
- vitest suite over the bingo scoring core (30 tests); jspdf + ffmpeg now
  lazy-load out of the main bundle.

## V2.0 — 2026-06-23 (first client-ready stable)
First version stable enough for clients to use in production. Highlights:
- Live event: winner sound on all player phones, bingo-winner.mp3, facilitator
  Mute, stopped-team player block, bingo "Failed to advance" race fixed.
- Admin: client dashboard home, event delete, ghost Branding tab removed,
  CSV media/log exports.
- Billing: first event free for paid plans, trials surfaced on super-admin.
- Music: super-admin library + install-to-clients, genre, search/sort, playlists
  (incl. add-whole-playlist to music bingo).
- Shareable slug links: /{client}/events/{event}/{facilitator|display|teams} and
  /{client}/tablet, with QR regeneration.
- Go-live domains: app./admin.rallyhub.games.

Tagged in git as `v2.0-stable`. `main` stays production; new work happens on the
`new-features` branch and is merged to `main` only after testing.
