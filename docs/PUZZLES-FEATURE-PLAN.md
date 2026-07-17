# Puzzle Games — Feature Plan

Branch: `feature/puzzles`  
Status: specification prepared; implementation waits for scoring confirmation.

## Product shape

`Puzzle` is one top-level game type in the Games library. After choosing it, the
organizer chooses a puzzle subtype:

1. **Wordle** — available in the first release.
2. **Matching pairs** — available in the first release.
3. **Crossword** — shown as **Upcoming** and disabled in the first release.

Puzzle games keep the normal game fields: name, rich-text description, optional
cover image, maximum points, status, organization ownership, template/install
support, and facilitator visibility. Wordle and Matching are added to Quest
stages alongside Photo, Video, and Text games. They complete and score
automatically, so they do not need facilitator approval.

## Recommended scoring

### Wordle

- Guesses are unlimited.
- The organizer sets only the maximum points; the first-try score is that maximum.
- Every additional submitted guess removes 10% of the **remaining** possible
  score, rounded to the nearest whole point.
- A solved puzzle always awards at least 10% of the maximum, so teams still have
  a reason to finish after many guesses.
- Formula:
  `max(round(maxPoints × 0.90^(guessCount - 1)), ceil(maxPoints × 0.10))`
- With a 100-point maximum the first guesses award:
  `100, 90, 81, 73, 66, 59, 53, 48, 43, 39…`, with a 10-point floor.

This is smoother than subtracting ten fixed points each time and remains useful
with unlimited guesses. The 10% rate can be made configurable later, but the MVP
should keep one predictable RallyHub rule.

### Matching pairs

- The organizer sets the maximum points.
- Completing every pair with no mistakes awards the maximum.
- Each incorrect left/right match subtracts 5% of the maximum score.
- Correct matches do not reduce the score. The minimum completion award is 25%
  of the maximum, protecting teams from accidental taps while rewarding accuracy.
- Formula:
  `max(round(maxPoints × (1 - wrongMatches × 0.05)), ceil(maxPoints × 0.25))`
- With a 100-point maximum: `100, 95, 90, 85…`, with a 25-point floor.

### Crossword (later)

- The organizer sets the maximum points and the difficulty/prefill level.
- A correct first check awards the maximum.
- Each failed full-grid check removes 10% of the remaining possible score, with a
  10% floor. Prefilled letters change difficulty but do not secretly change the
  organizer's chosen maximum.

## Wordle configuration and play

Organizer fields:

- Answer: defaults to a five-letter example and accepts one word from 3–12
  Unicode letters. No spaces or punctuation in the first release.
- Maximum points: positive whole number; default 100.
- A live preview shows the correct number of columns.

Player experience:

- Dynamic Wordle grid with one column per answer letter and unlimited rows.
- Native phone keyboard plus an optional on-screen keyboard.
- A guess must contain exactly the answer's number of letters.
- Feedback uses the standard correct-position / present-elsewhere / absent colors,
  including correct duplicate-letter behavior.
- The solved state immediately shows attempts and points earned. Progress is
  shared across multiple phones belonging to the same team.
- The first release accepts any same-length letter sequence. Every submitted row
  counts and lowers the possible score, discouraging letter-probing. A language
  dictionary can be added later; requiring an English dictionary now would reject
  company names, places, accented words, and non-English events.

## Matching configuration and play

Organizer fields:

- 2–12 pairs.
- A left value and right value for every pair, for example `France` ↔ `Paris`.
- Values are required and must be unique within their own column in the MVP.
- Maximum points: positive whole number; default 100.

Player experience:

- Left and right columns are shuffled independently and consistently per team.
- A player selects one item on each side.
- Correct pairs lock in place; incorrect pairs briefly show as incorrect and then
  clear. The interface remains responsive while the server confirms the result.
- When all pairs are matched, points are awarded automatically and exactly once.
- Progress synchronizes between phones on the same team.

## Crossword without AI

A useful version is possible without AI if the organizer supplies both the words
and their clues. A deterministic backtracking generator can then try across/down
placements, maximizing shared letters and rejecting invalid adjacent words.

For a strict 5×5 first version, limits should be:

- Answers contain 2–5 letters.
- 3–6 organizer-supplied answer/clue pairs.
- Every placed word must cross at least one other word.
- The generator tries many valid placements, chooses the most connected layout,
  and reports exactly which words could not fit.
- The organizer sees and approves the generated preview before saving.
- A difficulty slider controls prefilled cells from 40% (easy) to 0% (hard), while
  ensuring no complete answer is accidentally revealed.

This creates a compact **crossword-style word cross**, not a guaranteed newspaper
crossword where every open row and column forms a dictionary word. Arbitrary word
lists often cannot fit a 5×5 grid. A true topic-to-crossword generator would need
either AI or a maintained dictionary-and-clue dataset. Future options are curated
RallyHub templates, optional 7×7 fallback, or AI-assisted word/clue suggestions.

For the first Puzzle release, the chooser will display Crossword as disabled with
an `Upcoming` badge. Its configuration types are reserved, but no incomplete game
can be saved or added to an event.

## Technical design and security

- Extend the database/TypeScript game type with `puzzle` and add
  `puzzle_type: 'wordle' | 'matching' | 'crossword'` to `GameConfig`.
- Add a dedicated `PuzzleEditor`; the subtype determines the fields displayed.
- Extend the Games filter, template installation, event builder compatibility,
  Quest quick filters, player challenge cards, exports, and labels.
- Add a protected per-event/team/game puzzle-progress record. It stores attempts,
  mistakes, matched cells, completion, and awarded points.
- Final completion creates one automatically approved puzzle submission and adds
  the points to the team atomically. Database row locks and uniqueness constraints
  prevent double scoring from simultaneous phones.
- Wordle answers and matching pair mappings must never be delivered in the live
  participant game bundle. The live-config redaction function removes private
  solution data; server RPCs validate guesses/matches using the full stored config.
- Participant writes require the live-event token and the team's private device
  token. Direct score edits remain blocked.
- Realtime broadcasts update the other team phone and facilitator immediately;
  local optimistic feedback keeps taps feeling instant.

## Delivery order

1. Schema, config types, redaction, protected progress/scoring RPCs, and engine
   unit tests.
2. Puzzle chooser/editor with Wordle and Matching; Crossword shown as Upcoming.
3. Quest-stage integration and participant Wordle experience.
4. Matching experience and same-team multi-phone synchronization.
5. Facilitator progress/completion visibility, exports, regression tests, and live
   branch testing.
6. Separate later milestone: non-AI crossword placement engine and editor preview.

