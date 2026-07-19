# Crossword rework — design

Date: 2026-07-19
Branch: `feature/puzzles`
Status: approved for planning

Reworks the crossword puzzle subtype end to end following play-test feedback.
Touches the editor, the player, the pure engine (`src/lib/puzzle-engine.ts`),
the shared types (`src/types/game-config.ts`), and a new Supabase migration
(server-side scoring + validation RPCs).

## Goals

1. 6×6 grid with designer-paintable blocked cells.
2. A faster word-entry flow: click a cell, pick a run by hovering, type the word
   inline, then add a clue.
3. Auto-detect every crossing word so the designer never retypes a word, only
   supplies its clue.
4. A player experience with per-word auto-solve, a hint system, and a live
   countdown timer with live-decaying points.
5. A precise time-and-hint scoring model.

---

## 1. Editor (designer surface)

`src/components/games/CrosswordEditor.tsx`, rebuilt.

### Grid

- 6×6. `CROSSWORD_SIZE = 6`. Words are 2–6 letters.
- Cell states: empty, filled (letter), blocked.

### Blocked cells

- A **Block** toggle tool. With it active, clicking a cell toggles it blocked;
  a blocked cell renders solid yellow, holds no letter, and stops highlight
  runs. A blocked cell cannot be blocked if it already holds a letter (clear the
  letter first).
- Blocked cells are stored in the layout (`CrosswordLayout.blocked`) and are the
  only crossword state the participant payload keeps besides open cells and
  clues.

### Word entry flow

1. Click an empty (non-blocked) cell = the start cell.
2. Every cell reachable to the **right** and every cell reachable **below** the
   start lights faint yellow, stopping at the grid edge, a blocked cell, or the
   existing filled region boundary (the run must be placeable).
3. The designer hovers the horizontal run or the vertical run to choose
   direction (`across` / `down`); the hovered run brightens.
4. The designer types. Letters populate the run cell by cell. **Backspace**
   removes the last typed letter (last → first) with no cell selection.
5. Once typing starts, **Confirm** and **Cancel** buttons appear. Confirm opens
   a clue text box (character-limited, 200 chars). **Save** stores the word.
6. Cancel discards the draft and clears the highlight.

Overlaps are allowed only when the shared cells carry the same letter (existing
conflict rule, reused).

### Auto-detected crossing words

- On every edit, the editor derives the full word set from the placed letters:
  **every maximal straight run of 2+ contiguous letters** (across and down) is a
  word.
- Words the designer typed explicitly keep their clue. Runs that appear only as
  a side effect of crossings are **auto-detected words**; they render faint red
  in the grid and in the word list until they have a clue.
- Clicking a red run (grid or list) opens its clue box.
- **Save gate:** the config cannot be saved while any word lacks a clue. If the
  designer presses save with red words pending, the editor opens each missing
  clue box in turn (one after another) and blocks the final save until all are
  filled.

### Word list

Below the grid. Rows are labelled `R1..R6`, columns `A..F`; the start cell of a
word sets its label. Each row displays:

```
R1 · WORD · clue text
```

`WORD` is bold and coloured (yellow for clued, red for needs-clue). A remove
control deletes an explicitly typed word (auto-detected words disappear when the
letters that formed them are removed).

### Persistence

On change the editor writes:

- `config.puzzle_crossword_words`: the full materialised word set (typed +
  auto-detected), each with `id`, `answer`, `clue`, `row`, `col`, `direction`.
- `config.puzzle_crossword_layout`: `{ cells, blocked, clues }`, derived
  answer-free and safe for participants.

Existing validation (`validateCrosswordWords`) is adapted for the 6×6 size, the
new "every run is a word / needs a clue" rule, and blocked cells. The connected
group rule (every word must cross another) is kept.

---

## 2. Player surface

`src/components/live/CrosswordPlayer.tsx`, rebuilt.

The participant payload never contains answers (redaction strips
`puzzle_crossword_words`), so **all correctness checks are server-side.**

### Grid + clue access

- Renders the 6×6 grid from `layout`. Blocked cells render solid; open cells are
  inputs; **word-start cells are highlighted** because that is where clues are
  read.
- Tapping a start cell shows the clue(s) beginning there, each tagged **Across**
  or **Down**. Tapping a clue focuses that word for entry.

### Entry + auto-solve

- Typing auto-fills along the active word; **Backspace** auto-deletes backwards
  with no reselection.
- When a word's cells are all filled, the client asks the server to check
  progress (debounced). The server returns the set of fully-correct word ids:
  - correct word → locks green (solved);
  - filled but not in the solved set → gentle shake + red highlight, editable
    again.
- The puzzle completes when every word is solved. The server marks completion,
  computes the award, and the completed view shows the points.

### Hints

- A **Hint** button, **3 uses per team**.
- Each use calls `use_crossword_hint`. The server reveals **the first still-empty
  cell of each unsolved word**, de-duplicated where words cross (a shared cell
  counts once), and returns those cell letters. Revealed letters are shown
  locked in the grid.
- Each hint applies a flat **−10%** to the final score. The button disables at 3
  uses or when solved.

### Live timer + live points

- Countdown from **5:00**, derived from the server `created_at` start time.
  Green, turning **yellow** in the final minute, then **red and negative** past
  zero (it keeps counting up the overage).
- Points display ticks down live using the scoring formula below, with
  `maxPoints` (public `points_static`) and the current `hintsUsed`. This is a
  live estimate; the **server award on completion is authoritative.**

---

## 3. Scoring

Implemented identically in the engine (`crosswordScore`) and SQL
(`puzzle_crossword_points`).

```
overBlocks  = ceil( max(0, solveSeconds - 300) / 30 )
factor      = max( 0.10, 1 - 0.05 * overBlocks - 0.10 * hintsUsed )
points      = round( maxPoints * factor )
```

- Solve under 5:00 (300 s) with no hints = 100%.
- Each 30-second block over 5:00 (time effectively rounded **up** to the next
  30 s) = −5%; a full minute over = −10%.
- Each hint used = −10% flat.
- Hard floor = 10% of max; a completed puzzle always awards at least the floor.

Verification: 345 s (5:45) → overBlocks 2 → −10%. 310 s (5:10) → overBlocks 1 →
−5%. 330 s (5:30) → −5%. 360 s (6:00) → −10%.

---

## 4. Types

`src/types/game-config.ts`:

- `CrosswordLayout` gains `blocked: { row: number; col: number }[]`.

`src/lib/puzzle-engine.ts` `PuzzleProgress`:

- adds `hintsUsed: number`, `revealedCells: Record<string, string>`,
  `solvedWordIds: string[]`.
- `parsePuzzleProgress` parses the three new fields defensively.

---

## 5. Server (new migration)

New file `supabase/migrations/<ts>_crossword_rework.sql`.

- `event_puzzle_progress` gains `hints_used integer not null default 0
  check (hints_used between 0 and 3)` and `revealed_cells jsonb not null
  default '{}'`.
- `puzzle_crossword_points(max_points, solve_seconds, hints_used)` — new
  signature mirroring the engine formula (drop-and-recreate the old two-arg fn).
- `redact_game_config_for_live` unchanged for crossword (still strips
  `puzzle_crossword_words`; the layout already carries blocked cells safely).
- `puzzle_progress_payload` extended to return `hintsUsed`, `revealedCells`, and
  `solvedWordIds` (the ids of words whose stored `filled_cells` are all correct).
- `use_crossword_hint(event, game, token, cells)` — new RPC: authorises via join
  token + team token + stage checks (same guards as the existing RPCs); caps at
  3; computes the reveal set (first empty cell per unsolved word, deduped at
  crossings) from the private answers; merges into `revealed_cells` and
  `filled_cells`; returns the standard payload.
- `validate_crossword_grid` becomes a per-word progress check: saves `cells`,
  computes each word's correctness, and when **all** words are correct marks
  `completed_at`, computes the award with the new three-arg scoring fn (time +
  hints), writes the approved `submissions` row and team score exactly as today.
  Returns the payload plus `solvedWordIds`.

All new functions follow the existing `security definer` + `revoke/grant
anon, authenticated` pattern.

---

## 6. Tests

`src/lib/puzzle-engine.test.ts` extends the existing crossword coverage:

- `crosswordScore` at the boundary cases above, including hint penalties and the
  10% floor.
- Auto-detection: a grid of placed letters yields the expected set of runs
  (2+ length, across and down) as words.
- `parsePuzzleProgress` round-trips the three new fields.

---

## Out of scope

- Wordle and matching subtypes are untouched.
- No change to the facilitator completion panel beyond what already reads
  `pointsAwarded` / `solveSeconds`.
- Multi-language clue support is not added here.
