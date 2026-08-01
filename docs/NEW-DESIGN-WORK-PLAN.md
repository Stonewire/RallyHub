# New design: remaining work plan

Date: 2026-08-01
Branch: `feature/new-design`
Source: Rumen's decisions on the gap audit (`docs/NEW-DESIGN-GAP-AUDIT.md`) plus the annotated screenshots in `~/Desktop/SCREENSHOTS/`.

## Decisions taken (locked)

| Topic | Decision |
|---|---|
| Profile photo, logo dropzone | Build them properly. They must actually work. |
| Help Centre | **Do not touch yet.** Writing the articles is a later task, once the rest of the design is in. |
| Design fields with no DB column | Add the columns. Implement the fields. |
| Pricing | Use the current website pricing already in `subscription-plans.ts`, not the design's older numbers. Plans are Pay Per Event, Starter and Pro (plus the existing Custom/enterprise tier). The design's invented Business tier is dropped. Keep the design's visual style. |
| Reset event data | **Keep current behaviour.** It clears teams, submissions, scores and chat, and keeps stages and branding, so the event restarts from scratch. The design's copy is wrong, not the code. |
| Features the design omits (Paddle portal, promo codes, subscription changes, invoices, bin, import, groups, etc.) | **Keep all of them.** Restyle into the new design language rather than removing. |
| Header | Keep. |
| Footer with legal pages | Already exists globally (`AppLegalFooter`). No work needed. |
| Buttons and controls | The neo-minimal styling drifted. Unify on the design's control language: sliding flip switches for two-state, dark pill with a sliding gold segment for three and four-state, consistent button shapes everywhere. |

## Phase 1: control primitives (DONE)

`FlipSwitch` and `SegmentedPill` built in `src/components/neo-minimal/`, verified at 52x26 with a 22px gold thumb and a track pinned to `#1d1f24` in both themes.

Applied so far: event editor Display / UI Colour / Purchase Items, the 4-way stage type control, puzzle style picker, text answer type, points static vs range.

Still to apply: quiz Background Designer Image vs Colours, music bingo Background Designer, crossword Across/Down/Block, Support New Ticket vs My Tickets segmented control, Games and Events filter chips, and a sweep for any remaining ad-hoc two-state buttons.

## Phase 2: schema additions

One migration per concern so each can be reverted independently.

1. `events.location` (text, nullable). Editor field plus the pin row on event cards.
2. `support_tickets.category` (text, nullable). Currently faked by prefixing the ticket body, which must be removed once the column exists.
3. `profiles.phone` (text, nullable).
4. `profiles.avatar_url` (text, nullable) plus a storage bucket and RLS for self-upload.
5. `games.deleted_by` (uuid, nullable, references profiles). Powers the Deleted Games column.
6. `GameConfig` additions (JSON, no migration needed): quiz `points_per_correct`, text `approval_mode` ('auto' | 'review').

Deferred and flagged, not in this phase: ticket file attachments. That needs a table, a bucket, virus/type policy and a size cap, and is a bigger piece of work than the rest combined.

## Phase 3: make the fake controls real

**Correction found later:** `profiles` carried SELECT policies only, so the
client-side `avatar_url` write added here was silently rejected by RLS. The
profile photo would have looked like it uploaded and then quietly not saved,
which is the exact failure this phase existed to remove. Migration
`20260801180000_profile_self_update.sql` adds a narrow self-update policy plus
a trigger pinning role, organisation, username and must_change_password, so a
user cannot promote themselves or move organisations through it. Phone uses the
same path.

1. **Profile photo.** Wire the avatar to a real file input, upload to the new bucket, store `avatar_url`, show it in My Account and in the header avatar with the initials fallback retained.
2. **Logo dropzone.** Real `onDragOver`/`onDrop`, plus enforcement of the "SVG, PNG or JPG (Max 2MB)" the UI already promises. Reject with a clear message rather than silently accepting.

## Phase 4: fields and behaviour from the design (DONE)

- Event: location field and card row, 40-character name cap, minimum 5 teams, break stage seconds, status editable inside the editor.
- Events list: date filter by specific date, month and year alongside the existing range.
- Event Links: rename to Player Join / Spectator View / Host Console.
- Delete button flips to Archive for Active events.
- Games: cover and solution "paste a URL" inputs, solution video link, quiz points per correct, text approval mode, Deleted Games columns (Cover, Type, Groups, Deleted By), bulk permanent delete, Add Group source-group selector, game editor dirty-check on Save.
- Quest stage picker: switch to the design's checkbox list with Select All and an explicit Save, with pending selections auto-committing on stage or group change.
- Music Library: mini player transport controls.

All of the above landed. Two items were deliberately not built and moved to
Phase 7, because they change live-event behaviour: quiz points needed the
scoring column rather than a config key (the editor half is in, the smoke test
is not), and text approval mode alters how submissions are approved mid-event.
Bulk permanent delete is wired for Events only; Games has no safe
permanent-delete backend and inventing one is not a design task.

## Phase 5: restyle the kept features into the design language (DONE)

These stay functionally as they are; only their presentation changes.

- Billing: current plan card, plan cards with Upgrade / Current plan buttons, invoices as a proper table with Date / Event Name / Total / Status, Paddle portal entry, promo codes, subscription change form. Pricing text uses the code's numbers.
- Organisation: colour picker popover with hex and R/G/B sliders, country as a select, Tablet Access Save scoped to the PIN field only.
- Games: group management rows, import, inventory, install flows.
- Events: bin, duplicate, activation and status lifecycle surfaces.
- Support: keep status grouping, unread badges, realtime and mark-as-read, restyled.

## Phase 6: game preview (DONE)

The design's Preview modal (TV mock plus phone mock side by side) and the Quiz and Music Bingo Background Designer with live previews. Largest single unbuilt piece; deliberately last because it depends on the control primitives and the restyled editors.

Both built. The preview renders the draft being edited (real name, cover, first
question and answers) rather than the design's hardcoded sample, and sits in the
editor header so all six game types can reach it. The Background Designer is one
shared component for quiz and music bingo; it also fixed quiz colours being
editable only during creation and unreachable when editing an existing quiz.

Phase 5 note: Billing and Organisation were restructured (two-column billing,
plan actions, invoice table, colour picker popover, country dropdown, scoped
tablet save). Games, Events and Support needed no structural restyle beyond the
token layer they already inherit; the remaining work there was control
unification, which is complete. A sweep confirms every hand-rolled pill toggle
in the admin panel is now FlipSwitch or SegmentedPill: the only `aria-pressed`
controls left are the marketing site and the live facilitator mute button, both
outside this scope.

## Phase 7: live-path work, after the design is finished

These change behaviour that runs during a live event. Per TRACKER's rules they
land one at a time, each with a live smoke test on a throwaway event, and never
bundled into a design batch.

1. **Text approval mode. DONE, verified 1 Aug 2026.**

   Correction to how this item was originally written below: there was no
   inference to split. Tracing the code showed every text submission was
   inserted as `pending` and waited for a facilitator, whatever `points_type`
   said. So Auto is a new capability, not an untangling of an existing one.

   Opt-in per game via `config.text_approval_mode`. Absent or `review` keeps
   today's behaviour exactly, so existing text games are untouched. A match
   awards `points_static`, a miss awards 0 and is still approved, so a team is
   never left waiting on a decision that will not come. Confirmed with Rumen
   that Auto means auto: a wrong answer scores zero with no facilitator
   recourse, matching how quiz already behaves.

   Two bugs surfaced only by running real inserts, neither visible to the
   build or the type checker:
   - Trigger order. Postgres fires same-timing triggers alphabetically, and
     the original name sorted before `submissions_guard_participant_write`,
     which raises "Participants cannot set points". As first written it would
     have rejected every text submission. Renamed `zz_` so the guard sees the
     insert unchanged and the award lands after it passes.
   - `increment_team_score` requires `auth.uid()` and facilitator access,
     which a submitting participant has neither of. `teams.score` is updated
     directly instead, safe here because the award is computed from the game's
     own config and never from participant input.

   Verified: auto + correct approved at 25 with team score 25, auto + wrong
   approved at 0 with score unchanged, review mode still pending with null
   points. Probe data removed.

   **(original framing)** Today approval is derived from `points_type ===
   'range'`: choosing range points forces facilitator review, and static points
   forces automatic scoring. The design treats Game Style, Approval and Points
   as three independent switches.

2. **Quiz points verification. DONE, passed 1 Aug 2026.** Smoke-tested end to
   end against the live database: a quiz configured at 37 points per correct
   answer, a real active event, a real team claim, one answer, and auto-reveal
   scoring. The team scored exactly 37.
   The same run also confirmed the invoice was raised at 0.00 due under the
   Partner plan, that `events.location` persists, and that a game attaches to
   an event through the stage picker alone with no add-to-event step.
   Test data was archived and soft-deleted afterwards.

3. **Bingo clip length 60 seconds. DONE, verified 1 Aug 2026.** The design
   offers 30/60/90; the type and the clip generator permitted 30 and 90 only.

   The clip extraction worry turned out to be unfounded. `extractAudioClip`
   already takes an arbitrary `durationSeconds` and passes it to ffmpeg's
   `-t`, which truncates naturally at the end of a short track, and the WAV
   fallback is duration-agnostic too. `music_catalog.clip_duration_seconds`
   has no check constraint, so 60 stores without a migration. The real
   constraint was only the `30 | 90` union repeated in four places, now one
   `BINGO_CLIP_LENGTHS` list that the picker renders from, so a future length
   is a one-line change.

   Verified in the running app on a 25-track bingo game: the picker offers
   30/60/90, an existing game still reads 30, choosing 60 raises the existing
   "clips will be cleared" warning rather than silently wiping them, and after
   confirming, the editor reports "25 tracks need a 60s clip before live
   bingo". Left unsaved.

4. **FIXED and verified 1 Aug 2026.** `get_live_event_games` now returns
   `solution_description` and `solution_image_url` only when
   `caller_may_see_event_solutions()` is true, meaning an authenticated member
   of that organisation or platform staff. Participants join anonymously, so
   they receive nulls.
   Verified three ways rather than assumed. At SQL level by impersonating each
   case: anonymous false, own-org member true, other-org member false, so it
   does not leak across organisations either. Then end to end in the running
   app, by temporarily setting a probe solution on a game in a live demo
   event: the facilitator received it, the participant received null for the
   same game in the same event. The probe was reverted.
   Consequence: the design's Solution Video Link can now be built truthfully,
   because a facilitator-only field will actually stay facilitator-only.
   The original finding is kept below for the record.

   **(original finding)** Solution fields reach participants, hidden only by the UI. Found while
   building the design's "Solution Video Link". `get_live_event_games` returns
   `solution_description`, `solution_image_url` and, for video games, an
   unredacted `config` to anyone holding a join token.
   `redact_game_config_for_live` strips answers for quiz, text and puzzle, but
   video has no branch. Nothing renders those fields to players (only the
   facilitator's `SubmissionDetailModal` reads them), so this is obscured
   rather than exposed, but the bytes are in the participant's browser and
   readable from devtools.
   The design's Solution Video Link was therefore **not built**: adding a
   worked-answer URL would widen an existing weakness, and labelling it
   "players never receive it" would have been untrue.
   Fix: extend the redactor with a video branch that strips the solution
   fields, and consider stripping `solution_description` and
   `solution_image_url` from the participant payload generally. That changes
   the live bundle, so it lands here with a smoke test rather than in a design
   batch. Then the Solution Video Link can be added truthfully.

## Support seat: specified 1 Aug 2026, deliberately not built

Rumen described this while reviewing Organisation and was explicit that it is
for a later stage, not part of the design pass. Recorded here so the design
does not drift away from it.

**Shape.** An organisation has a maximum of **5 users plus 1 support seat**.
The support seat is us, helping the client run their events. A client admin
opts in per organisation ("allow support user"), which unlocks that one seat.

**What the support user may do:** prepare games, build and prepare events,
troubleshoot, and move an event between draft and demo states.

**What it must NOT do, and this is the part that needs enforcing in the
backend rather than the UI:**
- **Activate an event.** Activation raises an invoice, so a support user
  triggering it would spend a client's money.
- **Archive an event.**
- Billing actions are restricted; exact scope to be settled when built.

**Why nothing shipped now.** The toggle without the backing role would be a
control that does nothing, and the restrictions are the whole point of the
feature. It needs a role or flag on the membership, RLS that blocks activation
and archiving for it, a seat cap, and a billing decision. That is a feature, not
a design task.

## City suggestions: needs a data source, 1 Aug 2026

Rumen asked for City to be a dropdown like Country. Country became an input
with a datalist, so it can be typed or picked. City uses the same control but
offers nothing, because there is no list to offer.

There is no honest static city list to ship. Even limited to the 40 countries
the app supports, that is tens of thousands of names, and any subset we picked
would omit the town a given client is actually in, which is worse than a plain
text field because it implies the list is complete.

To make it suggest, it needs a places API (Google Places, Mapbox, or similar)
queried per keystroke and filtered by the chosen country. That is a key, a
network dependency, a cost per lookup and a debounce. Worth doing, but a feature
rather than a design change.

Postcode format validation landed instead, in `src/lib/countries.ts`, covering
all 40 countries with a per-country pattern and example. It is advisory: it
catches a UK code typed into a German address, but a string can match the
pattern and still not exist. Real verification is the same places API job.

## Installable RallyHub: brief for a discussion, 1 Aug 2026

Rumen wants more than a pinned tablet link. Parked deliberately; he asked to
discuss it before it is built. This is the brief, not a spec.

**What he wants installable:** the admin panel, on a computer or a tablet, so
an organiser opens it like an app. The facilitator console, so a host taps an
icon rather than hunting a link. And the existing tablet score entry.

**Why the facilitator console is the hard one.** The tablet link works because
it is a stable, event-agnostic entry point: one URL plus a 4-digit PIN, then
pick the event. The facilitator console is per event (`/facilitator/:eventId`),
so there is nothing durable to pin. There is already a `/facilitator` landing
page, which is the natural equivalent of the tablet picker and probably the
thing to build on.

**The idea Rumen was circling:** one Organisation Device Access app per client.
Install once, open it, and choose what this device is for right now: facilitate
an event, take scores, show the display, or administer. A launcher rather than
four separate installs.

**What to settle in the discussion, because these change the build:**

1. **One icon or several?** A manifest has one identity and one start_url. A
   launcher means one install and an in-app chooser. Separate installs mean
   several manifests served per route, and a device could hold an "Admin" icon
   and a "Scores" icon side by side. The launcher is tidier; separate icons are
   faster to reach and match how staff actually think about a shift.

2. **Three different auth models under one roof.** Tablet is anonymous plus an
   org PIN. Facilitator is an authenticated user with a role. Admin is a full
   login. A single installed app has to make "who is this device" and "who is
   this person" obvious, or someone will hand a tablet to a participant while an
   admin session is still live on it.

3. **Shared-device security.** A pinned app that stays signed in is convenient
   and is exactly how a facilitator's account leaks. The tablet PIN exists for
   this reason. Whatever we build needs the same answer for the facilitator
   console: a lock screen, a short session, or device-scoped credentials.

4. **Offline.** Still the separate, larger question: what a tablet does when the
   venue's wifi dies mid-event, and what happens to a score entered while
   offline. Worth deciding before, not after, because it shapes the whole thing.

**The cheap part, whatever we decide:** a basic manifest with square 192 and 512
icons (current brand icons are 285x271 and not square), plus the apple meta
tags. About half an hour, and it makes Chrome's Install option appear at all.
Omitting `start_url` makes an install launch from the page it was installed
from, which may solve the multi-entry-point problem outright, but that needs
testing on a real device rather than trusting the spec.

## Installable tablet app (PWA): not built, 1 Aug 2026

Rumen asked for a button on Tablet Access explaining how to install the tablet
link as an app, opening a PDF to be written later, and said a dead button was
acceptable for now.

Shipped a dialog with the actual steps instead: Android Chrome via the three
dots then Add to Home screen, iPad and iPhone via Safari's Share then Add to
Home Screen, including the warning that this does not work in Chrome on iOS.
That is useful today, and the PDF can replace or supplement it later without
moving the button.

**The gap Rumen correctly identified.** The app has no web manifest at all,
checked at the time of writing: no manifest.json, no link tag, no
apple-mobile-web-app meta. So a pinned link opens inside the browser with its
address bar rather than as a standalone app. The steps above still work and
still save staff from hunting for the link, but it is a bookmark, not an app.

To make it a real installable app: a web manifest with name, icons (192 and 512
at minimum), start_url pointing at the tablet route, display: standalone and a
theme colour; apple-touch-icon and apple-mobile-web-app-capable for iOS; and a
service worker if it should survive a patchy venue connection. The offline
question is the interesting one for a tablet at an event, and it is a real
piece of work rather than a design change.

## Quiz designer: specified 1 Aug 2026, next to build

Rumen's spec, captured before building because it needs config fields that do
not exist yet.

**Layout.** Half and half, not the two thirds used elsewhere.
- Left, Primary settings: quiz name, description, points per correct answer,
  time per question in seconds, and the number of rounds.
- Right, Quiz designer: the background, then the Groups card beneath it.
- Below both, full width: one card per round.

**Background.** A pill choosing Photo or Colours.
- Photo: upload or paste a link, with a preview. Same control as elsewhere.
- Colours: **four** background colours, forming a corner-to-corner gradient
  behind the quiz, one pinned to each corner like a slide. These are their own
  thing, NOT primary/secondary/accent. Brand colours come from the event; these
  only paint this quiz's background.
- Either way the panel previews how the quiz will look.

**Rounds.** Typing a number on the left generates that many rounds, collapsed.
Each round is its own full-width card with an editable name, shown to players
when that round starts, and a delete button. The two stay in step: deleting a
card lowers the number, and lowering the number removes rounds.

Confirmed with Rumen that lowering the number does remove rounds, so it can
destroy questions. When a round being removed is not empty, a dialog says how
many questions go with it and offers a dropdown of the other rounds to move
them to. Choosing a round reassigns them; choosing nothing deletes them with the
round. There is no add-round button down here; rounds are added from the number.

Logic and tests already landed in components/games/quiz-round-edits.ts; only
the dialog remains.

**Questions.** Inside a round: the question text, four answers, and a way to
mark the correct one. Every question has text; alongside it a pill chooses what
else the question carries: **None, Photo, Video, Audio**.
- Photo and Audio are uploads only.
- Video is an embed link, YouTube.
- Each needs a preview: the image and video inline, audio as a play button.
The point is questions like "who is in this photo", "what did you see in this
clip", "what can you hear".
An "Add another question" button sits at the bottom of each round.

**What this needs that does not exist.**
- A fourth background colour. GameConfig carries primary, secondary and accent;
  a fourth was deliberately not invented earlier because nothing consumed one.
  The corner gradient is the consumer, so it can be added now.
- Per-question media: a kind, defaulting to **none**, then photo, video or
  audio. Photo and audio are uploaded; video is a YouTube link. All three still
  resolve to a stored URL, since an upload produces one, so a single mediaUrl
  covers every case and only the way it is filled in differs.
  Today a question has only `photoUrl`, so existing photo questions have to keep
  working: read the old field when the new one is absent rather than migrating
  data.
- Nothing here changes scoring, so `points_static` stays the per-correct award.

**Deferred by Rumen:** how the media behaves during a live quiz, when the video
plays, whether audio autoplays, what the host sees. That belongs with the
player and display screens rather than the editor.

## Later, not now

- Write the Help Centre articles, then wire the modal's list and make the rows clickable.
- Ticket file attachments.
- Stat card week-over-week deltas (needs historical data that is not currently recorded).

## RESOLVED: migrations applied 1 Aug 2026

All seven were applied to project `rlnnhgnuprtatmhqxirb` with Rumen's explicit
approval, and verified by querying `information_schema` and `pg_policies`
rather than trusting the tool's success responses: six columns, the
`user-avatars` bucket with four storage policies, `profiles_update_own` plus
its `guard_profile_self_update` trigger, and `delete_own_account`.

Event creation, which failed with 42703 beforehand, now succeeds. The original
blocking report is kept below for the record.

## BLOCKING (now resolved): the branch could not run against the live database

Verified 1 Aug 2026 against production from the dev server. Every column added
in Phase 2 is missing, because those migrations are committed but deliberately
unapplied:

| Column | Probe result |
|---|---|
| `events.location` | 42703 does not exist |
| `support_tickets.category` | 42703 does not exist |
| `games.deleted_by` | 42703 does not exist |
| `games.deleted_by_name` | 42703 does not exist |
| `profiles.phone` | 42703 does not exist |
| `profiles.avatar_url` | 42703 does not exist |

The code writes all of them, so these operations fail outright on this branch:

- **Creating or saving an event** ("Failed to save event")
- **Creating a support ticket**
- **Deleting a game** (the soft-delete writes deleted_by)
- **Saving My Account** (phone) and **uploading a profile photo** (avatar_url,
  which also needs the unapplied self-update RLS policy)

This is not a styling issue. Until the seven migrations are applied, the branch
cannot be smoke-tested at all, which also blocks every Phase 7 item.

**Decision needed from Rumen.** All seven are additive: add column, add policy,
add bucket, add function. None drops or rewrites data, and each can be reverted.
Applying them to the live database is the normal way to make a feature branch
testable, but it is a production change, so it is not something to do
unattended. The alternative is making each write defensive so the branch runs
against either schema, which is throwaway complexity that would then need
removing.

## Phase 8: questions parked for Rumen

Rumen is away and cannot approve anything, so nothing in this file blocks on
him. Whenever a judgement call comes up that would normally be a question, the
work continues under a stated assumption and the question is appended here
with the assumption made, so he can overturn any of them in one pass on
return.

Rules while running unattended:
- Never push to `main`, and never apply a migration to production.
- Never invent a destructive backend capability that does not already exist.
- If a design element cannot be built truthfully, leave it out and record it
  here rather than shipping a control that does nothing.
- Commit after every self-contained chunk so an interrupted run loses nothing.

### Answered by assumption so far

**1. Billing "Upgrade" button target. CONFIRMED by Rumen 1 Aug 2026.**
Question: the design shows Upgrade on each plan card, but self-serve plan
switching is gated behind `PLAN_CHANGES_ENABLED` and is currently off.
Assumption: Upgrade scrolls to the existing Change subscription form rather
than starting its own checkout, so the button never silently does nothing.
Reverse by: pointing it at a real upgrade flow once plan changes are enabled.

**2. Invoice total column wording. RESOLVED 1 Aug 2026.**
Rumen asked whether Paddle generates the invoice. It does, and that settles it.

Paddle is Merchant of Record, so the legally-valid invoice is Paddle's PDF,
opened from the Invoice button on each row. Our own table shows
`invoices.amount_due`, which `activate_event` computes from the plan price
minus any promo discount. VAT is never part of that calculation, and nothing
in the app reads a VAT figure back from Paddle.

So "Total (incl. VAT)" would have been false. The column now reads
**"Total (excl. VAT)"** rather than a bare "Total": once VAT is actually
charged, the row and Paddle's PDF will show different numbers, and the label
explains why instead of looking like a bug.

Reverse by: consuming Paddle's tax totals through a webhook and storing them,
which is backend work rather than a design change.

**3. Country storage format.**
Question: store the country as an ISO code or a display name.
Assumption: names, because that is what `address_country` already holds and
what invoice exports print, so codes would need a data migration for no
visible gain. Values not on the list are preserved rather than blanked.
Reverse by: a migration mapping names to codes.

**4. Crossword direction control.**
Question: the design shows one Across/Down/Block pill; the editor uses a
Word/Block tool plus a contextual Across/Down step that only appears once a
run exists.
Assumption: keep the two-step model and only unify its styling, because
direction is meaningless before a cell is picked, and reworking it would
change puzzle authoring behaviour Rumen said he wants to walk through.
Reverse by: reworking the crossword editor's interaction model deliberately.

**5. Preview button placement.**
Question: the design puts Preview inside the Facilitator Only card.
Assumption: it lives in the editor header instead, because only photo and
video render that card, so following the design would hide Preview from four
of the six game types. Reverse by: moving it once every type has that card.

**6. Background Designer swatch count. CONFIRMED by Rumen 1 Aug 2026 (three is fine).**
Question: the design shows four colour swatches; `GameConfig` carries three
(primary, secondary, accent) and nothing reads a fourth.
Assumption: ship three rather than invent a field no surface consumes.
Reverse by: adding the fourth colour to GameConfig and to whatever renders
the background, then to this component.

**7. Background image vs colours mode.**
Question: store the chosen mode, or derive it.
Assumption: derived from whether `background_url` is set, so the mode cannot
disagree with the data. Consequence: switching to Colours clears the image
rather than remembering it. Reverse by: adding a stored mode flag if people
want to toggle back and forth without losing the upload.

## Pricing: settled 1 Aug 2026

`subscription-plans.ts` was queried because it prices Pro at EUR 200/month
against Starter at EUR 20/month, while the design showed EUR 25.

Rumen confirmed the code is right and the design is a stale note he never
bothered to correct. Starter is EUR 20/month, Pro is EUR 200/month, annual
billing is cheaper, and there is no free plan any more: what used to be called
Free is now pay-per-event. No change needed, and the design's pricing is not a
source of truth for this app.

## Help Centre: placeholder shipped 1 Aug 2026

Articles are far off and Rumen is happy to ship without them. The modal no
longer carries a search box over an empty array, which read as a broken
feature rather than an unfinished one. It now says "Coming soon" and offers
Contact support, which routes to `/admin/support`.

The search and article list return when there is real content, and that will
want a proper content system rather than the hardcoded array that was there.
