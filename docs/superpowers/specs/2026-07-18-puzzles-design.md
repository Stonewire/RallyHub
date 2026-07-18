# Puzzle Games: Wordle, Matching, Crossword

Date: 18 July 2026
Branch: `feature/puzzles`
Status: approved design, ready for implementation planning
Supersedes the crossword section of `docs/PUZZLES-FEATURE-PLAN.md` (that doc
described an auto-placement generator; this design replaces it with manual grid
placement). Wordle and Matching sections of that doc remain accurate.

## Goal

Ship all three puzzle subtypes in one release from `feature/puzzles`:

1. Wordle (already playable on the branch)
2. Matching pairs (already playable on the branch)
3. Crossword (new: manual 5x5 editor, auto-solve play, time-decay scoring)

Plus the shared finishing work: facilitator completion visibility, integration
wiring, tests, and the release path. AI-assisted crossword authoring is a later
milestone and out of scope here.

## Crossword editor (organizer side)

- The puzzle chooser enables Crossword (removes the Upcoming badge).
- Fixed 5x5 grid. The organizer taps a cell, picks Across or Down, and types
  the word. Words are 2 to 5 letters, Unicode letters only, no spaces or
  punctuation.
- The word paints into the grid as typed. Conflicting letters on overlapping
  cells are flagged red immediately; an overlap must match exactly to be valid.
- Each placed word has a required clue field in a list beside the grid.
  Numbering is automatic in standard crossword order (top-left scan).
- Cells not used by any word are blocked (black) automatically. Deleting a
  word removes it from the grid and the clue list.
- Save validation: at least 2 words, every word has a non-empty clue, no
  letter conflicts, and every word crosses at least one other word (no
  disconnected islands).
- Maximum points: positive whole number, default 100. Same field the other
  puzzle subtypes use.

### Config shape

`GameConfig` gains `puzzle_crossword_words`: an array of
`{ id, answer, clue, row, col, direction }` where `direction` is
`'across' | 'down'`. The `answer` field is private solution data.

## Player experience (participant side)

- The team phone renders the 5x5 grid and the clue list split into Across and
  Down. Tapping a cell selects it; tapping again toggles direction. Letters
  come from the native keyboard. Blocked cells are not interactive.
- Progress (filled letters) synchronizes across all phones belonging to the
  same team, using the same progress mechanism Wordle and Matching use.
- Auto-solve detection: whenever every open cell is filled, the client calls
  the server to validate silently. If wrong, the player sees a subtle
  "keep going" state with no cell-level hints and play continues. If correct,
  the solved screen shows solve time and points earned.
- No check button, no reveal, no give-up flow in this release.

## Scoring (fixed RallyHub rule)

- Server-computed only. The timer starts when the team's puzzle progress row
  is created (first open) and ends at the validated solve.
- Solved within 2 minutes: full maximum points.
- After 2 minutes, each full extra minute removes 10% of the remaining
  possible score. Floor: 25% of maximum.
- Formula: `max(round(maxPoints * 0.9^extraMinutes), ceil(maxPoints * 0.25))`
  where `extraMinutes = max(0, floor((solveSeconds - 120) / 60))`.
- Phone clocks are never trusted; the database clock decides both timestamps.
- Wordle and Matching scoring stay exactly as shipped on the branch
  (10% of remaining per extra guess with a 10% floor; 5% of maximum per wrong
  match with a 25% floor).

## Server and security

- Migration extends the existing puzzle schema: `crossword` becomes a valid
  `puzzle_type`, the progress row gains `filled_cells` JSON and a
  `failed_full_checks` counter (statistics only; scoring is time-based).
- New RPC `validate_crossword_grid(event, team, game, cells)`:
  - validates the submitted grid against the private config server-side,
  - on success computes the time-decay score, inserts one auto-approved
    submission, and adds team points atomically,
  - reuses the row-lock and uniqueness pattern the Wordle and Matching RPCs
    already use so simultaneous phones cannot double-score,
  - never returns correct letters or per-cell feedback on failure.
- Redaction: the live-config redactor strips `answer` from every crossword
  word before the participant bundle is built. Players receive cell positions,
  numbering, clues, and grid shape only. Same function that already strips the
  Wordle answer and the Matching pair map.
- Participant writes keep both guards: the live-event join token and the
  team's private device token. Direct score edits remain blocked.

## Facilitator and integration

- Facilitator submissions panel shows puzzle completions as read-only
  auto-approved entries: team, puzzle name, awarded points, and the relevant
  effort stat (Wordle attempts, Matching wrong matches, Crossword solve time).
  Nothing to approve. Rides the existing submission broadcast; no new realtime
  surface.
- Wiring completed wherever the branch has gaps: Games library filter, quest
  quick filters, template installation, event builder compatibility, exports,
  and labels all recognise `puzzle` games including crossword.

## Testing

- Engine unit tests (vitest, colocated): crossword grid validation
  (correct fill, overlap conflicts, connectivity), time-decay maths including
  both clamp boundaries, and the existing Wordle and Matching tests stay green.
- Branch smoke via browser automation: author a crossword in the editor, play
  it to completion, confirm score and facilitator entry.
- Real-phone live test before merge: two phones on the same team to confirm
  sync, plus one full quest stage containing all three puzzle subtypes.

## Release path

- All work lands on `feature/puzzles`.
- When confirmed on the branch, merge directly into `staging` (single
  isolated change, skips `dev` per workflow), Rumen confirms staging, then
  merge to `main` as V2.14.0 with CHANGELOG and TRACKER updates.
