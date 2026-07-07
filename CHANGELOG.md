# RallyHub Changelog

Version shown small under "Sign out" in the admin sidebar (`src/lib/version.ts`).
Bump `APP_VERSION` and add an entry here on each meaningful update merged to `main`.
Numbering: first = major updates, second = bigger batches of features/redesigns,
third = small fixes (e.g. 2.1.1).

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
