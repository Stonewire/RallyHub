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

## Phase 5: restyle the kept features into the design language

These stay functionally as they are; only their presentation changes.

- Billing: current plan card, plan cards with Upgrade / Current plan buttons, invoices as a proper table with Date / Event Name / Total / Status, Paddle portal entry, promo codes, subscription change form. Pricing text uses the code's numbers.
- Organisation: colour picker popover with hex and R/G/B sliders, country as a select, Tablet Access Save scoped to the PIN field only.
- Games: group management rows, import, inventory, install flows.
- Events: bin, duplicate, activation and status lifecycle surfaces.
- Support: keep status grouping, unread badges, realtime and mark-as-read, restyled.

## Phase 6: game preview

The design's Preview modal (TV mock plus phone mock side by side) and the Quiz and Music Bingo Background Designer with live previews. Largest single unbuilt piece; deliberately last because it depends on the control primitives and the restyled editors.

## Phase 7: live-path work, after the design is finished

These change behaviour that runs during a live event. Per TRACKER's rules they
land one at a time, each with a live smoke test on a throwaway event, and never
bundled into a design batch.

1. **Text approval mode.** Today approval is derived from `points_type ===
   'range'`: choosing range points forces facilitator review, and static points
   forces automatic scoring. The design treats Game Style, Approval and Points
   as three independent switches. Splitting them needs a `text_approval_mode`
   config field, the server-side approval path updated to read it, and a
   fallback to the current inference so existing text games are unaffected.
   The field was drafted and then removed rather than ship a control that
   nothing enforces.

2. **Quiz points verification.** Quiz now writes `games.points_static`, which
   `score_current_quiz_question` reads as the per-correct-answer award. Before
   this, quiz games never wrote that column at all, so scoring fell back to its
   hardcoded 10. The editor change is in, but it alters live scoring, so it
   needs a real quiz round smoke-tested end to end: set a non-default value,
   run a question, confirm the awarded score matches.

3. **Bingo clip length 60 seconds.** The design offers 30/60/90; the type and
   the clip generator permit 30 and 90 only. Adding 60 touches clip extraction.

## Later, not now

- Write the Help Centre articles, then wire the modal's list and make the rows clickable.
- Ticket file attachments.
- Stat card week-over-week deltas (needs historical data that is not currently recorded).

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

**1. Billing "Upgrade" button target.**
Question: the design shows Upgrade on each plan card, but self-serve plan
switching is gated behind `PLAN_CHANGES_ENABLED` and is currently off.
Assumption: Upgrade scrolls to the existing Change subscription form rather
than starting its own checkout, so the button never silently does nothing.
Reverse by: pointing it at a real upgrade flow once plan changes are enabled.

**2. Invoice total column wording.**
Question: the design's column reads "Total (incl. VAT)", but the app states
"All prices exclude VAT" in three places.
Assumption: the column says "Total", trusting the code per the locked pricing
decision. Reverse by: changing the label if prices really are VAT-inclusive,
which would also mean correcting the three disclaimers.

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

**6. Background Designer swatch count.**
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

## Open question for Rumen

`subscription-plans.ts` prices Pro at **EUR 200/month** against Starter at EUR 20/month, while the design shows EUR 25. The per-event prices (199 / 149 / 99) match the design exactly, so only the Pro monthly figure looks anomalous. Worth confirming it is not a typo before it goes in front of customers.
