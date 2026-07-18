# Puzzle Games (Wordle, Matching, Crossword) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship all three puzzle subtypes from `feature/puzzles` in one release: enable the new manual 5x5 Crossword (editor, player, server scoring) and finish the shared work (facilitator visibility, integration wiring, tests).

**Architecture:** Crossword joins the existing puzzle architecture as a third subtype. Private words with answers live in `GameConfig.puzzle_crossword_words`; a derived public layout (`puzzle_crossword_layout`) is computed client-side at edit time so the SQL redactor only has to strip the private field. Play state lives in the existing `event_puzzle_progress` row; two new RPCs (`update_crossword_fill`, `validate_crossword_grid`) follow the exact guard and scoring pattern of `submit_wordle_guess`. Scoring is time-based, computed from database timestamps only.

**Tech Stack:** React + TypeScript (Vite), Supabase Postgres RPCs, vitest.

**Spec:** `docs/superpowers/specs/2026-07-18-puzzles-design.md`

## Global Constraints

- Branch: all work lands on `feature/puzzles`. Never push to `main`.
- Fixed 5x5 grid. Words are 2 to 5 letters, Unicode letters only, no spaces.
- Crossword scoring: solved within 120 seconds = max points; then each full extra minute removes 10% of remaining; floor 25% of max. `max(round(maxPoints * 0.9^extraMinutes), ceil(maxPoints * 0.25))` with `extraMinutes = max(0, floor((solveSeconds - 120) / 60))`.
- Timer starts when the team's `event_puzzle_progress` row is created, ends at validated solve. Database clock only.
- Answers must never reach the participant bundle. The redactor strips `puzzle_crossword_words`.
- Participant writes require the live-event join token AND the private team token (both already enforced by the existing guard pattern; copy it exactly).
- Never use em dashes or en dashes in any UI copy or docs.
- No new dependencies.
- Wordle and Matching behaviour must not change.
- Commit after every task. Run `npm test` before every commit; `npm run build` and `npm run lint` in the final task.
- Existing suite must stay green (`npm test` currently passes on the branch).

---

### Task 1: Crossword types and engine functions

**Files:**
- Modify: `src/types/game-config.ts`
- Modify: `src/lib/puzzle-engine.ts`
- Test: `src/lib/puzzle-engine.test.ts` (append to the existing file)

**Interfaces:**
- Consumes: existing `GameConfig`, `PuzzleType` ('crossword' already in the union).
- Produces (later tasks rely on these exact names):
  - `type PuzzleCrosswordWord = { id: string; answer: string; clue: string; row: number; col: number; direction: 'across' | 'down' }`
  - `type CrosswordClue = { id: string; number: number; direction: 'across' | 'down'; row: number; col: number; length: number; clue: string }`
  - `type CrosswordLayout = { cells: { row: number; col: number }[]; clues: CrosswordClue[] }`
  - `CROSSWORD_SIZE = 5`
  - `crosswordWordCells(word: PuzzleCrosswordWord): { row: number; col: number }[]`
  - `crosswordCellLetters(words: PuzzleCrosswordWord[]): { letters: Map<string, string>; conflicts: Set<string> }` (keys are `` `${row}-${col}` ``)
  - `validateCrosswordWords(words: PuzzleCrosswordWord[]): string | null`
  - `buildCrosswordLayout(words: PuzzleCrosswordWord[]): CrosswordLayout`
  - `crosswordScore(maxPoints: number, solveSeconds: number): number`
  - `PuzzleProgress` gains `filledCells: Record<string, string>`, `failedFullChecks: number`, `solveSeconds: number | null`, `lastCheckCorrect?: boolean`; `puzzleType` widened to `'wordle' | 'matching' | 'crossword'`.
  - `validatePuzzleConfig` accepts crossword configs (no longer returns the "coming soon" error).

- [ ] **Step 1: Add config types**

In `src/types/game-config.ts`, add below `PuzzleMatchingItem`:

```ts
export type CrosswordDirection = 'across' | 'down'

export type PuzzleCrosswordWord = {
  id: string
  answer: string
  clue: string
  row: number
  col: number
  direction: CrosswordDirection
}

export type CrosswordClue = {
  id: string
  number: number
  direction: CrosswordDirection
  row: number
  col: number
  length: number
  clue: string
}

export type CrosswordLayout = {
  cells: { row: number; col: number }[]
  clues: CrosswordClue[]
}
```

And in `GameConfig`, after `puzzle_matching_right_items`:

```ts
  /** Private crossword words with answers; stripped from every live payload. */
  puzzle_crossword_words?: PuzzleCrosswordWord[]
  /** Public grid layout derived at edit time; safe for participants. */
  puzzle_crossword_layout?: CrosswordLayout
```

- [ ] **Step 2: Write the failing tests**

Append to `src/lib/puzzle-engine.test.ts`:

```ts
import {
  buildCrosswordLayout,
  crosswordCellLetters,
  crosswordScore,
  validateCrosswordWords,
} from './puzzle-engine'
import type { PuzzleCrosswordWord } from '@/types/game-config'

const crossedWords: PuzzleCrosswordWord[] = [
  { id: 'a', answer: 'RALLY', clue: 'Our product', row: 0, col: 0, direction: 'across' },
  { id: 'b', answer: 'ROBOT', clue: 'Machine helper', row: 0, col: 0, direction: 'down' },
  { id: 'c', answer: 'TEAM', clue: 'Group of players', row: 4, col: 0, direction: 'across' },
]

describe('crossword engine', () => {
  it('maps letters and finds no conflicts on a valid overlap', () => {
    const { letters, conflicts } = crosswordCellLetters(crossedWords)
    expect(conflicts.size).toBe(0)
    expect(letters.get('0-0')).toBe('r')
    expect(letters.get('4-0')).toBe('t')
  })

  it('flags conflicting overlap letters', () => {
    const words: PuzzleCrosswordWord[] = [
      { id: 'a', answer: 'RALLY', clue: 'x', row: 0, col: 0, direction: 'across' },
      { id: 'b', answer: 'BINGO', clue: 'x', row: 0, col: 0, direction: 'down' },
    ]
    const { conflicts } = crosswordCellLetters(words)
    expect(conflicts.has('0-0')).toBe(true)
  })

  it('accepts a connected valid puzzle', () => {
    expect(validateCrosswordWords(crossedWords)).toBeNull()
  })

  it('rejects fewer than 2 words', () => {
    expect(validateCrosswordWords(crossedWords.slice(0, 1))).toMatch(/at least 2/i)
  })

  it('rejects out-of-bounds words', () => {
    const words: PuzzleCrosswordWord[] = [
      { id: 'a', answer: 'RALLY', clue: 'x', row: 0, col: 2, direction: 'across' },
      { id: 'b', answer: 'ROBOT', clue: 'x', row: 0, col: 2, direction: 'down' },
    ]
    expect(validateCrosswordWords(words)).toMatch(/fit/i)
  })

  it('rejects missing clues', () => {
    const words = crossedWords.map((w) => (w.id === 'c' ? { ...w, clue: ' ' } : w))
    expect(validateCrosswordWords(words)).toMatch(/clue/i)
  })

  it('rejects disconnected islands', () => {
    const words: PuzzleCrosswordWord[] = [
      { id: 'a', answer: 'AB', clue: 'x', row: 0, col: 0, direction: 'across' },
      { id: 'b', answer: 'AB', clue: 'x', row: 0, col: 0, direction: 'down' },
      { id: 'c', answer: 'CD', clue: 'x', row: 3, col: 3, direction: 'across' },
      { id: 'd', answer: 'CE', clue: 'x', row: 3, col: 3, direction: 'down' },
    ]
    expect(validateCrosswordWords(words)).toMatch(/cross/i)
  })

  it('numbers clues in top-left scan order', () => {
    const layout = buildCrosswordLayout(crossedWords)
    const byId = new Map(layout.clues.map((c) => [c.id, c]))
    expect(byId.get('a')?.number).toBe(1)
    expect(byId.get('b')?.number).toBe(1)
    expect(byId.get('c')?.number).toBe(2)
    expect(layout.cells.length).toBe(12)
  })

  it('scores full points inside 2 minutes', () => {
    expect(crosswordScore(100, 0)).toBe(100)
    expect(crosswordScore(100, 119)).toBe(100)
    expect(crosswordScore(100, 179)).toBe(100)
  })

  it('decays 10% of remaining per full extra minute', () => {
    expect(crosswordScore(100, 180)).toBe(90)
    expect(crosswordScore(100, 240)).toBe(81)
    expect(crosswordScore(100, 300)).toBe(73)
  })

  it('clamps at the 25% floor', () => {
    expect(crosswordScore(100, 60 * 60)).toBe(25)
  })
})
```

Note on decay boundaries: `extraMinutes = max(0, floor((solveSeconds - 120) / 60))`, so 120 to 179 seconds is still 0 extra minutes (full points) and 180 seconds is the first decayed minute. The spec sentence "solved within 2 minutes = max" plus "each full extra minute" makes 180s the first boundary.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- puzzle-engine`
Expected: FAIL, `crosswordCellLetters` etc. not exported.

- [ ] **Step 4: Implement the engine functions**

Append to `src/lib/puzzle-engine.ts` (extend the imports from `@/types/game-config` with `CrosswordClue`, `CrosswordLayout`, `PuzzleCrosswordWord`):

```ts
export const CROSSWORD_SIZE = 5

export function crosswordWordCells(
  word: PuzzleCrosswordWord,
): { row: number; col: number }[] {
  return Array.from(Array.from(word.answer).keys()).map((i) => ({
    row: word.direction === 'down' ? word.row + i : word.row,
    col: word.direction === 'across' ? word.col + i : word.col,
  }))
}

export function crosswordCellLetters(words: PuzzleCrosswordWord[]): {
  letters: Map<string, string>
  conflicts: Set<string>
} {
  const letters = new Map<string, string>()
  const conflicts = new Set<string>()
  for (const word of words) {
    const chars = Array.from(word.answer.toLocaleLowerCase())
    crosswordWordCells(word).forEach(({ row, col }, i) => {
      const key = `${row}-${col}`
      const existing = letters.get(key)
      if (existing !== undefined && existing !== chars[i]) conflicts.add(key)
      letters.set(key, chars[i])
    })
  }
  return { letters, conflicts }
}

export function validateCrosswordWords(words: PuzzleCrosswordWord[]): string | null {
  if (words.length < 2) return 'Add at least 2 words.'
  for (const word of words) {
    const length = Array.from(word.answer).length
    if (length < 2 || length > CROSSWORD_SIZE) {
      return `"${word.answer}" needs 2 to ${CROSSWORD_SIZE} letters.`
    }
    if (!/^\p{L}+$/u.test(word.answer)) return `"${word.answer}" can contain letters only.`
    const cells = crosswordWordCells(word)
    const last = cells[cells.length - 1]
    if (
      word.row < 0 || word.col < 0 ||
      last.row >= CROSSWORD_SIZE || last.col >= CROSSWORD_SIZE
    ) {
      return `"${word.answer}" does not fit on the grid from that cell.`
    }
    if (!word.clue.trim()) return `"${word.answer}" needs a clue.`
  }
  const { conflicts } = crosswordCellLetters(words)
  if (conflicts.size > 0) return 'Overlapping words must share the same letter.'

  // Connectivity: every word must share a cell with another word, and the
  // whole set must form one connected group.
  const cellOwners = new Map<string, number[]>()
  words.forEach((word, index) => {
    for (const { row, col } of crosswordWordCells(word)) {
      const key = `${row}-${col}`
      cellOwners.set(key, [...(cellOwners.get(key) ?? []), index])
    }
  })
  const adjacent = words.map(() => new Set<number>())
  for (const owners of cellOwners.values()) {
    for (const a of owners) for (const b of owners) if (a !== b) adjacent[a].add(b)
  }
  const seen = new Set<number>([0])
  const queue = [0]
  while (queue.length > 0) {
    const current = queue.pop() as number
    for (const next of adjacent[current]) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  if (seen.size !== words.length) return 'Every word must cross at least one other word.'
  return null
}

export function buildCrosswordLayout(words: PuzzleCrosswordWord[]): CrosswordLayout {
  const { letters } = crosswordCellLetters(words)
  const cells = [...letters.keys()]
    .map((key) => {
      const [row, col] = key.split('-').map(Number)
      return { row, col }
    })
    .sort((a, b) => a.row - b.row || a.col - b.col)
  const startNumbers = new Map<string, number>()
  let nextNumber = 1
  const clues: CrosswordClue[] = []
  const sortedWords = [...words].sort(
    (a, b) => a.row - b.row || a.col - b.col || (a.direction === 'across' ? -1 : 1),
  )
  for (const word of sortedWords) {
    const startKey = `${word.row}-${word.col}`
    let number = startNumbers.get(startKey)
    if (number === undefined) {
      number = nextNumber
      nextNumber += 1
      startNumbers.set(startKey, number)
    }
    clues.push({
      id: word.id,
      number,
      direction: word.direction,
      row: word.row,
      col: word.col,
      length: Array.from(word.answer).length,
      clue: word.clue,
    })
  }
  return { cells, clues }
}

export function crosswordScore(maxPoints: number, solveSeconds: number): number {
  const max = Math.max(0, Math.round(maxPoints))
  const extraMinutes = Math.max(0, Math.floor((Math.max(0, solveSeconds) - 120) / 60))
  return Math.max(Math.round(max * 0.9 ** extraMinutes), Math.ceil(max * 0.25))
}
```

- [ ] **Step 5: Extend PuzzleProgress and parsing**

In `src/lib/puzzle-engine.ts`, change `PuzzleProgress`:

```ts
export type PuzzleProgress = {
  puzzleType: 'wordle' | 'matching' | 'crossword'
  attempts: number
  wrongMatches: number
  guesses: PuzzleGuess[]
  matchedLeftIds: string[]
  matchedRightIds: string[]
  filledCells: Record<string, string>
  failedFullChecks: number
  solveSeconds: number | null
  completed: boolean
  pointsAwarded: number | null
  lastMatchCorrect?: boolean
  lastCheckCorrect?: boolean
}
```

In `parsePuzzleProgress`, replace the `type` line and extend the returned object:

```ts
  const type =
    raw.puzzleType === 'matching' ? 'matching'
    : raw.puzzleType === 'crossword' ? 'crossword'
    : 'wordle'
```

```ts
    filledCells:
      raw.filledCells && typeof raw.filledCells === 'object' && !Array.isArray(raw.filledCells)
        ? Object.fromEntries(
            Object.entries(raw.filledCells as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string',
            ),
          )
        : {},
    failedFullChecks: typeof raw.failedFullChecks === 'number' ? raw.failedFullChecks : 0,
    solveSeconds: typeof raw.solveSeconds === 'number' ? raw.solveSeconds : null,
    ...(typeof raw.lastCheckCorrect === 'boolean'
      ? { lastCheckCorrect: raw.lastCheckCorrect }
      : {}),
```

- [ ] **Step 6: Allow crossword in validatePuzzleConfig**

Replace the crossword line in `validatePuzzleConfig`:

```ts
  if (type === 'crossword') {
    const words = config.puzzle_crossword_words ?? []
    const layoutError = validateCrosswordWords(words)
    if (layoutError) return layoutError
    if (!config.puzzle_crossword_layout) {
      return 'Crossword layout is missing. Re-open the editor and save again.'
    }
    return null
  }
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS, including the pre-existing Wordle/Matching and bingo suites.

- [ ] **Step 8: Commit**

```bash
git add src/types/game-config.ts src/lib/puzzle-engine.ts src/lib/puzzle-engine.test.ts
git commit -m "feat: add crossword engine, layout builder, and time-decay scoring"
```

---

### Task 2: Database migration and generated types

**Files:**
- Create: `supabase/migrations/20260718120000_crossword_puzzles.sql`
- Modify: `src/types/database.ts` (RPC + table typings)

**Interfaces:**
- Consumes: guard pattern and helpers from `supabase/migrations/20260717005019_puzzle_games.sql` (`puzzle_team_for_token`, `live_join_token_matches_event`, `puzzle_progress_payload`, `rallyhub.puzzle_score_award` setting).
- Produces:
  - RPC `update_crossword_fill(p_event_id uuid, p_game_id uuid, p_team_token text, p_cells jsonb) returns jsonb`
  - RPC `validate_crossword_grid(p_event_id uuid, p_game_id uuid, p_team_token text, p_cells jsonb) returns jsonb`
  - `puzzle_progress_payload` now also returns `filledCells`, `failedFullChecks`, `solveSeconds`.
  - `event_puzzle_progress` gains `filled_cells jsonb` and `failed_full_checks integer`; `puzzle_type` check includes `'crossword'`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260718120000_crossword_puzzles.sql`:

```sql
-- Crossword puzzle subtype: manual 5x5 grids, silent full-grid validation,
-- time-decay scoring computed from database timestamps only.

alter table public.event_puzzle_progress
  drop constraint if exists event_puzzle_progress_puzzle_type_check;
alter table public.event_puzzle_progress
  add constraint event_puzzle_progress_puzzle_type_check
  check (puzzle_type in ('wordle', 'matching', 'crossword'));

alter table public.event_puzzle_progress
  add column if not exists filled_cells jsonb not null default '{}'::jsonb,
  add column if not exists failed_full_checks integer not null default 0
    check (failed_full_checks >= 0);

-- Solved within 120s = max. Each FULL extra minute removes 10% of remaining.
-- Floor 25% of max. Mirrors crosswordScore() in src/lib/puzzle-engine.ts.
create or replace function public.puzzle_crossword_points(
  p_max_points integer,
  p_solve_seconds numeric
)
returns integer
language sql
immutable
set search_path = public
as $$
  select greatest(
    round(
      greatest(p_max_points, 0)
      * power(0.90, greatest(0, floor((greatest(p_solve_seconds, 0) - 120) / 60)))
    )::integer,
    ceil(greatest(p_max_points, 0) * 0.25)::integer
  );
$$;

-- Redactor: crossword answers never reach participants. The public layout
-- (puzzle_crossword_layout) is already answer-free, so only the private
-- word list has to go.
-- NOTE FOR IMPLEMENTER: copy the FULL body of redact_game_config_for_live
-- from 20260717005019_puzzle_games.sql lines 46-137 verbatim, and insert the
-- branch below inside the `elsif p_game_type = 'puzzle' then` block, after
-- the matching branch:
--
--     elsif result ->> 'puzzle_type' = 'crossword' then
--       result := result - 'puzzle_crossword_words';
--
-- The whole function must be recreated because `create or replace` replaces
-- the entire body.

-- Payload: expose crossword fill state alongside the existing fields.
-- NOTE FOR IMPLEMENTER: copy the FULL body of puzzle_progress_payload from
-- 20260717005019_puzzle_games.sql lines 238-292 verbatim and change ONLY the
-- final return statement to:
--
--   return jsonb_build_object(
--     'puzzleType', v_config ->> 'puzzle_type',
--     'attempts', coalesce(v_progress.attempts, 0),
--     'wrongMatches', coalesce(v_progress.wrong_matches, 0),
--     'guesses', coalesce(v_progress.wordle_guesses, '[]'::jsonb),
--     'matchedLeftIds', v_left_ids,
--     'matchedRightIds', v_right_ids,
--     'filledCells', coalesce(v_progress.filled_cells, '{}'::jsonb),
--     'failedFullChecks', coalesce(v_progress.failed_full_checks, 0),
--     'solveSeconds', case
--       when v_progress.completed_at is not null
--       then floor(extract(epoch from v_progress.completed_at - v_progress.created_at))::integer
--     end,
--     'completed', v_progress.completed_at is not null,
--     'pointsAwarded', v_progress.points_awarded
--   );

create or replace function public.update_crossword_fill(
  p_event_id uuid,
  p_game_id uuid,
  p_team_token text,
  p_cells jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_config jsonb;
  v_event_status text;
  v_stage jsonb;
  v_submissions_open boolean;
  v_progress public.event_puzzle_progress%rowtype;
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Reload the team page.';
  end if;

  v_team_id := public.puzzle_team_for_token(p_event_id, p_team_token);
  if v_team_id is null then
    raise exception 'This phone is not authorized for a team. Rejoin the event.';
  end if;

  select g.config, e.status,
         e.stages_config -> es.current_stage_index, es.submissions_open
  into v_config, v_event_status, v_stage, v_submissions_open
  from public.event_games eg
  join public.games g on g.id = eg.game_id and g.type = 'puzzle'
  join public.events e on e.id = eg.event_id
  join public.event_state es on es.event_id = e.id
  where eg.event_id = p_event_id and eg.game_id = p_game_id;

  if v_config is null or v_config ->> 'puzzle_type' <> 'crossword' then
    raise exception 'Crossword puzzle not found.';
  end if;
  if v_event_status not in ('active', 'demo') or not coalesce(v_submissions_open, false) then
    raise exception 'This event is not accepting answers.';
  end if;
  if v_stage ->> 'type' <> 'open' or not exists (
    select 1 from jsonb_array_elements_text(coalesce(v_stage -> 'gameIds', '[]'::jsonb)) game_id
    where game_id = p_game_id::text
  ) then
    raise exception 'This puzzle is not in the current Quest stage.';
  end if;

  if jsonb_typeof(coalesce(p_cells, '{}'::jsonb)) <> 'object'
     or pg_column_size(coalesce(p_cells, '{}'::jsonb)) > 4096 then
    raise exception 'Invalid crossword fill payload.';
  end if;

  -- Row creation starts the solve timer.
  insert into public.event_puzzle_progress (event_id, team_id, game_id, puzzle_type)
  values (p_event_id, v_team_id, p_game_id, 'crossword')
  on conflict (event_id, team_id, game_id) do nothing;

  select p.* into v_progress
  from public.event_puzzle_progress p
  where p.event_id = p_event_id and p.team_id = v_team_id and p.game_id = p_game_id
  for update;

  if v_progress.completed_at is null then
    update public.event_puzzle_progress
    set filled_cells = coalesce(p_cells, '{}'::jsonb),
        updated_at = now()
    where event_id = p_event_id and team_id = v_team_id and game_id = p_game_id;
  end if;

  return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id);
end;
$$;

create or replace function public.validate_crossword_grid(
  p_event_id uuid,
  p_game_id uuid,
  p_team_token text,
  p_cells jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_config jsonb;
  v_points integer;
  v_event_status text;
  v_stage jsonb;
  v_submissions_open boolean;
  v_progress public.event_puzzle_progress%rowtype;
  v_word jsonb;
  v_answer text;
  v_row integer;
  v_col integer;
  v_correct boolean := true;
  v_i integer;
  v_key text;
  v_solve_seconds integer;
  v_awarded integer;
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Reload the team page.';
  end if;

  v_team_id := public.puzzle_team_for_token(p_event_id, p_team_token);
  if v_team_id is null then
    raise exception 'This phone is not authorized for a team. Rejoin the event.';
  end if;

  select g.config, greatest(coalesce(g.points_static, 100), 1), e.status,
         e.stages_config -> es.current_stage_index, es.submissions_open
  into v_config, v_points, v_event_status, v_stage, v_submissions_open
  from public.event_games eg
  join public.games g on g.id = eg.game_id and g.type = 'puzzle'
  join public.events e on e.id = eg.event_id
  join public.event_state es on es.event_id = e.id
  where eg.event_id = p_event_id and eg.game_id = p_game_id;

  if v_config is null or v_config ->> 'puzzle_type' <> 'crossword' then
    raise exception 'Crossword puzzle not found.';
  end if;
  if v_event_status not in ('active', 'demo') or not coalesce(v_submissions_open, false) then
    raise exception 'This event is not accepting answers.';
  end if;
  if v_stage ->> 'type' <> 'open' or not exists (
    select 1 from jsonb_array_elements_text(coalesce(v_stage -> 'gameIds', '[]'::jsonb)) game_id
    where game_id = p_game_id::text
  ) then
    raise exception 'This puzzle is not in the current Quest stage.';
  end if;

  insert into public.event_puzzle_progress (event_id, team_id, game_id, puzzle_type)
  values (p_event_id, v_team_id, p_game_id, 'crossword')
  on conflict (event_id, team_id, game_id) do nothing;

  select p.* into v_progress
  from public.event_puzzle_progress p
  where p.event_id = p_event_id and p.team_id = v_team_id and p.game_id = p_game_id
  for update;

  if v_progress.completed_at is not null then
    return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id);
  end if;

  for v_word in
    select value from jsonb_array_elements(coalesce(v_config -> 'puzzle_crossword_words', '[]'::jsonb))
  loop
    v_answer := lower(coalesce(v_word ->> 'answer', ''));
    v_row := (v_word ->> 'row')::integer;
    v_col := (v_word ->> 'col')::integer;
    for v_i in 0 .. char_length(v_answer) - 1 loop
      if v_word ->> 'direction' = 'down' then
        v_key := (v_row + v_i) || '-' || v_col;
      else
        v_key := v_row || '-' || (v_col + v_i);
      end if;
      if lower(coalesce(p_cells ->> v_key, '')) <> substr(v_answer, v_i + 1, 1) then
        v_correct := false;
      end if;
    end loop;
  end loop;

  if v_correct then
    v_solve_seconds := floor(extract(epoch from now() - v_progress.created_at))::integer;
    v_awarded := public.puzzle_crossword_points(v_points, v_solve_seconds);

    update public.event_puzzle_progress
    set filled_cells = coalesce(p_cells, '{}'::jsonb),
        completed_at = now(),
        points_awarded = v_awarded,
        updated_at = now()
    where event_id = p_event_id and team_id = v_team_id and game_id = p_game_id;

    perform set_config('rallyhub.puzzle_score_award', 'on', true);
    insert into public.submissions (
      event_id, team_id, game_id, media_url, media_type, status, points_awarded
    ) values (
      p_event_id, v_team_id, p_game_id, 'crossword:' || v_solve_seconds,
      'puzzle', 'approved', v_awarded
    );
    update public.teams set score = score + v_awarded where id = v_team_id;
    perform set_config('rallyhub.puzzle_score_award', 'off', true);
  else
    update public.event_puzzle_progress
    set filled_cells = coalesce(p_cells, '{}'::jsonb),
        failed_full_checks = v_progress.failed_full_checks + 1,
        updated_at = now()
    where event_id = p_event_id and team_id = v_team_id and game_id = p_game_id;
  end if;

  return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id)
    || jsonb_build_object('lastCheckCorrect', v_correct);
end;
$$;

revoke all on function public.update_crossword_fill(uuid, uuid, text, jsonb) from public;
grant execute on function public.update_crossword_fill(uuid, uuid, text, jsonb) to anon, authenticated;
revoke all on function public.validate_crossword_grid(uuid, uuid, text, jsonb) from public;
grant execute on function public.validate_crossword_grid(uuid, uuid, text, jsonb) to anon, authenticated;
revoke all on function public.puzzle_crossword_points(integer, numeric) from public;
```

Follow both `NOTE FOR IMPLEMENTER` comments: the two `create or replace` bodies for `redact_game_config_for_live` and `puzzle_progress_payload` must be pasted in full (copied from the 20260717005019 migration) with only the described insertions, then the note comments removed. The migration must contain the complete functions, not the notes.

- [ ] **Step 2: Update hand-authored DB types**

In `src/types/database.ts`:
- In the `event_puzzle_progress` Row/Insert/Update types, add `filled_cells: Json` and `failed_full_checks: number` (optional in Insert/Update).
- In the `Functions` section, alongside `submit_wordle_guess`, add:

```ts
      update_crossword_fill: {
        Args: {
          p_event_id: string
          p_game_id: string
          p_team_token: string
          p_cells: Json
        }
        Returns: Json
      }
      validate_crossword_grid: {
        Args: {
          p_event_id: string
          p_game_id: string
          p_team_token: string
          p_cells: Json
        }
        Returns: Json
      }
```

(Match the exact surrounding formatting of the existing puzzle RPC entries.)

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: PASS (no TS errors; nothing consumes the new RPCs yet).

- [ ] **Step 4: Apply the migration to the Supabase project**

Apply `20260718120000_crossword_puzzles.sql` via the Supabase MCP `apply_migration` tool (name: `crossword_puzzles`). This project applies migrations to the shared cloud DB; there is no working local stack (see DEV-DB1 in TRACKER.md).

Verify after applying, via `execute_sql`:

```sql
select public.puzzle_crossword_points(100, 0)   as t0,
       public.puzzle_crossword_points(100, 179) as t179,
       public.puzzle_crossword_points(100, 180) as t180,
       public.puzzle_crossword_points(100, 240) as t240,
       public.puzzle_crossword_points(100, 3600) as floor_check;
```

Expected: `100, 100, 90, 81, 25`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260718120000_crossword_puzzles.sql src/types/database.ts
git commit -m "feat: add crossword schema, fill sync, and validation RPCs"
```

---

### Task 3: Crossword editor

**Files:**
- Create: `src/components/games/CrosswordEditor.tsx`
- Modify: `src/components/games/PuzzleEditor.tsx`

**Interfaces:**
- Consumes: `validateCrosswordWords`, `buildCrosswordLayout`, `crosswordCellLetters`, `crosswordWordCells`, `CROSSWORD_SIZE` from `@/lib/puzzle-engine`; `PuzzleCrosswordWord`, `CrosswordDirection`, `GameConfig` from `@/types/game-config`.
- Produces: `CrosswordEditor({ config, setConfig })` component with the same props contract as the Wordle/Matching sections. Every mutation writes BOTH `puzzle_crossword_words` and `puzzle_crossword_layout` (via `buildCrosswordLayout`) so the saved config always carries the public layout.

- [ ] **Step 1: Create CrosswordEditor**

Create `src/components/games/CrosswordEditor.tsx`:

```tsx
import { ArrowDown, ArrowRight, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CROSSWORD_SIZE,
  buildCrosswordLayout,
  crosswordCellLetters,
  crosswordWordCells,
  validateCrosswordWords,
} from '@/lib/puzzle-engine'
import type {
  CrosswordDirection,
  GameConfig,
  PuzzleCrosswordWord,
} from '@/types/game-config'

const GRID = Array.from({ length: CROSSWORD_SIZE }, (_, row) =>
  Array.from({ length: CROSSWORD_SIZE }, (_, col) => ({ row, col })),
)

export function CrosswordEditor({
  config,
  setConfig,
}: {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
}) {
  const words = useMemo(() => config.puzzle_crossword_words ?? [], [config.puzzle_crossword_words])
  const [start, setStart] = useState<{ row: number; col: number } | null>(null)
  const [direction, setDirection] = useState<CrosswordDirection>('across')
  const [draftAnswer, setDraftAnswer] = useState('')
  const [draftClue, setDraftClue] = useState('')

  const { letters, conflicts } = useMemo(() => crosswordCellLetters(words), [words])
  const validationError = words.length > 0 ? validateCrosswordWords(words) : null

  function commitWords(next: PuzzleCrosswordWord[]) {
    setConfig((current) => ({
      ...current,
      puzzle_crossword_words: next,
      puzzle_crossword_layout: buildCrosswordLayout(next),
    }))
  }

  const draftCells =
    start && draftAnswer
      ? crosswordWordCells({
          id: 'draft',
          answer: draftAnswer,
          clue: '',
          row: start.row,
          col: start.col,
          direction,
        })
      : []
  const draftOutOfBounds = draftCells.some(
    (cell) => cell.row >= CROSSWORD_SIZE || cell.col >= CROSSWORD_SIZE,
  )
  const canAdd =
    start !== null &&
    Array.from(draftAnswer).length >= 2 &&
    draftClue.trim().length > 0 &&
    !draftOutOfBounds

  function addWord() {
    if (!start || !canAdd) return
    commitWords([
      ...words,
      {
        id: crypto.randomUUID(),
        answer: draftAnswer,
        clue: draftClue.trim(),
        row: start.row,
        col: start.col,
        direction,
      },
    ])
    setDraftAnswer('')
    setDraftClue('')
    setStart(null)
  }

  return (
    <div className="space-y-5">
      <div>
        <Label>Crossword grid</Label>
        <p className="text-muted-foreground mt-1 text-xs">
          Tap a start cell, pick a direction, type the word and its clue, then add it.
          Words are 2 to {CROSSWORD_SIZE} letters and every word must cross another.
        </p>
      </div>

      <div className="mx-auto grid w-fit grid-cols-5 gap-1">
        {GRID.flat().map(({ row, col }) => {
          const key = `${row}-${col}`
          const letter = letters.get(key)
          const isDraft = draftCells.some((cell) => cell.row === row && cell.col === col)
          const isStart = start?.row === row && start.col === col
          return (
            <button
              key={key}
              type="button"
              aria-label={`Cell row ${row + 1}, column ${col + 1}`}
              onClick={() => setStart({ row, col })}
              className={`flex size-11 items-center justify-center rounded-md border text-base font-black uppercase transition-colors ${
                conflicts.has(key)
                  ? 'border-red-500 bg-red-500/20 text-red-600'
                  : isStart
                    ? 'border-[#FFC107] bg-[#FFC107]/25'
                    : isDraft
                      ? 'border-[#FFC107]/70 bg-[#FFC107]/10'
                      : letter
                        ? 'border-border bg-muted'
                        : 'border-border/60 bg-background'
              }`}
            >
              {letter?.toLocaleUpperCase() ?? ''}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={direction === 'across' ? 'default' : 'outline'}
            onClick={() => setDirection('across')}
          >
            <ArrowRight className="mr-1 size-4" /> Across
          </Button>
          <Button
            type="button"
            size="sm"
            variant={direction === 'down' ? 'default' : 'outline'}
            onClick={() => setDirection('down')}
          >
            <ArrowDown className="mr-1 size-4" /> Down
          </Button>
        </div>
        <Input
          value={draftAnswer}
          maxLength={CROSSWORD_SIZE}
          autoComplete="off"
          spellCheck={false}
          placeholder="WORD"
          className="w-28 bg-background font-bold uppercase tracking-[0.15em]"
          onChange={(event) =>
            setDraftAnswer(event.target.value.replace(/[^\p{L}]/gu, '').toLocaleUpperCase())
          }
        />
        <Input
          value={draftClue}
          maxLength={200}
          placeholder="Clue for this word"
          className="min-w-48 flex-1 bg-background"
          onChange={(event) => setDraftClue(event.target.value)}
        />
        <Button type="button" size="sm" disabled={!canAdd} onClick={addWord}>
          <Plus className="mr-1 size-4" /> Add word
        </Button>
      </div>
      {start === null ? (
        <p className="text-muted-foreground text-xs">Tap a grid cell to choose where the word starts.</p>
      ) : draftOutOfBounds ? (
        <p className="text-xs font-medium text-red-600">That word does not fit from the selected cell.</p>
      ) : null}

      {words.length > 0 ? (
        <div className="space-y-2">
          <Label>Words and clues</Label>
          {words.map((word) => (
            <div key={word.id} className="flex items-center gap-2 text-sm">
              <span className="w-20 shrink-0 font-bold uppercase tracking-wide">{word.answer}</span>
              <span className="text-muted-foreground w-16 shrink-0 text-xs">
                {word.direction === 'across' ? 'Across' : 'Down'} R{word.row + 1}C{word.col + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{word.clue}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${word.answer}`}
                onClick={() => commitWords(words.filter((item) => item.id !== word.id))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {validationError ? (
        <p className="text-xs font-medium text-amber-600">{validationError}</p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Enable crossword in PuzzleEditor**

In `src/components/games/PuzzleEditor.tsx`:

1. Import the editor and grid icon:

```tsx
import { Grid3X3, Plus, Puzzle, Rows3, Trash2 } from 'lucide-react'
import { CrosswordEditor } from '@/components/games/CrosswordEditor'
```

(`Clock3` is no longer needed; remove it.)

2. Replace the crossword entry in `SUBTYPES` (remove `upcoming: true`):

```tsx
  {
    type: 'crossword',
    name: 'Crossword',
    description: 'Build a 5x5 crossword. Faster solves earn more points.',
    icon: Puzzle,
  },
```

3. In `selectSubtype`, delete the line `if (type === 'crossword') return` and add crossword defaults to the spread:

```tsx
      puzzle_crossword_words: current.puzzle_crossword_words ?? [],
```

4. The `const active = selected === type && !upcoming` line simplifies to `const active = selected === type` (the `upcoming` flag and badge markup can stay for future subtypes; no entry uses it now).

5. Replace the crossword placeholder block at the bottom:

```tsx
      {selected === 'crossword' ? <CrosswordEditor config={config} setConfig={setConfig} /> : null}
```

- [ ] **Step 3: Verify build and behaviour**

Run: `npm run build && npm test`
Expected: PASS.

Then run `npm run dev`, open Games, create a New Game of type Puzzle, pick Crossword, and confirm: grid renders, adding RALLY across at R1C1 and ROBOT down at R1C1 paints shared R, conflict shows red when adding a clashing word, save is blocked with the validation message until the puzzle is valid (the existing new/edit pages already call `validatePuzzleConfig` before saving).

- [ ] **Step 4: Commit**

```bash
git add src/components/games/CrosswordEditor.tsx src/components/games/PuzzleEditor.tsx
git commit -m "feat: add manual 5x5 crossword editor"
```

---

### Task 4: Crossword player

**Files:**
- Create: `src/components/live/CrosswordPlayer.tsx`
- Modify: `src/components/live/PuzzleGamePlayer.tsx`

**Interfaces:**
- Consumes: `update_crossword_fill` / `validate_crossword_grid` RPCs (Task 2), `parsePuzzleProgress`, `crosswordScore` display context, `CrosswordLayout` from config, `publishPuzzleProgressChange` / `publishLiveBundleReload` / `subscribeLiveBundleBroadcast` from `@/lib/live-broadcast`, `getCurrentParticipantSession` for the team token (same pattern as `PuzzleGamePlayer`).
- Produces: `CrosswordPlayer({ eventId, teamId, game, accentColor })`, rendered by `PuzzleGamePlayer` when `puzzleType(config) === 'crossword'`.

- [ ] **Step 1: Create CrosswordPlayer**

Create `src/components/live/CrosswordPlayer.tsx`:

```tsx
import { Check, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  publishLiveBundleReload,
  publishPuzzleProgressChange,
  subscribeLiveBundleBroadcast,
} from '@/lib/live-broadcast'
import { getCurrentParticipantSession } from '@/lib/participant-session'
import { parsePuzzleProgress, type PuzzleProgress } from '@/lib/puzzle-engine'
import { supabase } from '@/lib/supabase'
import type { GameConfig } from '@/types/game-config'
import type { Json } from '@/types/json'
import type { Tables } from '@/types/helpers'

type Props = {
  eventId: string
  teamId: string
  game: Tables<'games'>
  accentColor: string
}

function formatSolveTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export function CrosswordPlayer({ eventId, teamId, game, accentColor }: Props) {
  const config = (game.config ?? {}) as GameConfig
  const layout = config.puzzle_crossword_layout
  const session = getCurrentParticipantSession()
  const teamToken =
    session?.eventId === eventId && session.teamId === teamId ? session.purchaseToken : undefined

  const [progress, setProgress] = useState<PuzzleProgress | null>(null)
  const [cells, setCells] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [wrongFlash, setWrongFlash] = useState(false)
  const syncTimer = useRef<number | null>(null)
  const cellRefs = useRef(new Map<string, HTMLInputElement>())

  const openCells = useMemo(() => layout?.cells ?? [], [layout])
  const openKeys = useMemo(
    () => openCells.map(({ row, col }) => `${row}-${col}`),
    [openCells],
  )
  const across = useMemo(
    () => (layout?.clues ?? []).filter((clue) => clue.direction === 'across'),
    [layout],
  )
  const down = useMemo(
    () => (layout?.clues ?? []).filter((clue) => clue.direction === 'down'),
    [layout],
  )
  const startNumbers = useMemo(() => {
    const map = new Map<string, number>()
    for (const clue of layout?.clues ?? []) {
      map.set(`${clue.row}-${clue.col}`, clue.number)
    }
    return map
  }, [layout])

  const applyProgress = useCallback((next: PuzzleProgress) => {
    setProgress(next)
    setCells((current) => (next.completed ? next.filledCells : { ...next.filledCells, ...current }))
  }, [])

  // Mounting registers the fill row, which starts the solve timer server-side.
  useEffect(() => {
    if (!teamToken) {
      setError('Rejoin this event on this phone once to enable secure puzzle play.')
      setLoading(false)
      return
    }
    let cancelled = false
    void supabase
      .rpc('update_crossword_fill', {
        p_event_id: eventId,
        p_game_id: game.id,
        p_team_token: teamToken,
        p_cells: {},
      })
      .then(({ data, error: loadError }) => {
        if (cancelled) return
        if (loadError) {
          setError(loadError.message)
        } else {
          applyProgress(parsePuzzleProgress(data as Json))
          setError(null)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [applyProgress, eventId, game.id, teamToken])

  useEffect(
    () =>
      subscribeLiveBundleBroadcast(eventId, {
        onBundlePatch: (patch) => {
          if (
            patch.kind === 'puzzle_progress' &&
            patch.teamId === teamId &&
            patch.gameId === game.id &&
            teamToken
          ) {
            void supabase
              .rpc('get_team_puzzle_progress', {
                p_event_id: eventId,
                p_game_id: game.id,
                p_team_token: teamToken,
              })
              .then(({ data }) => {
                if (data) applyProgress(parsePuzzleProgress(data as Json))
              })
          }
        },
      }),
    [applyProgress, eventId, game.id, teamId, teamToken],
  )

  const syncFill = useCallback(
    (nextCells: Record<string, string>) => {
      if (!teamToken) return
      if (syncTimer.current !== null) window.clearTimeout(syncTimer.current)
      syncTimer.current = window.setTimeout(() => {
        void supabase
          .rpc('update_crossword_fill', {
            p_event_id: eventId,
            p_game_id: game.id,
            p_team_token: teamToken,
            p_cells: nextCells,
          })
          .then(() => publishPuzzleProgressChange(eventId, teamId, game.id))
      }, 700)
    },
    [eventId, game.id, teamId, teamToken],
  )

  const checkGrid = useCallback(
    async (nextCells: Record<string, string>) => {
      if (!teamToken || checking) return
      setChecking(true)
      try {
        const { data, error: checkError } = await supabase.rpc('validate_crossword_grid', {
          p_event_id: eventId,
          p_game_id: game.id,
          p_team_token: teamToken,
          p_cells: nextCells,
        })
        if (checkError) throw checkError
        const next = parsePuzzleProgress(data as Json)
        applyProgress(next)
        void publishPuzzleProgressChange(eventId, teamId, game.id)
        if (next.completed) {
          void publishLiveBundleReload(eventId)
        } else if (next.lastCheckCorrect === false) {
          setWrongFlash(true)
          window.setTimeout(() => setWrongFlash(false), 900)
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Could not check the crossword.')
      } finally {
        setChecking(false)
      }
    },
    [applyProgress, checking, eventId, game.id, teamId, teamToken],
  )

  function setCellLetter(key: string, raw: string) {
    const letter = raw.replace(/[^\p{L}]/gu, '').slice(-1).toLocaleUpperCase()
    const nextCells = { ...cells }
    if (letter) nextCells[key] = letter
    else delete nextCells[key]
    setCells(nextCells)
    setError(null)
    syncFill(nextCells)
    if (letter) {
      const index = openKeys.indexOf(key)
      const nextKey = openKeys[index + 1]
      if (nextKey) cellRefs.current.get(nextKey)?.focus()
    }
    if (openKeys.every((cellKey) => nextCells[cellKey])) {
      void checkGrid(nextCells)
    }
  }

  if (!layout || openCells.length === 0) {
    return <p className="py-8 text-white/70">This crossword is not configured yet.</p>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-white/75">
        <Loader2 className="size-5 animate-spin" /> Loading crossword…
      </div>
    )
  }

  if (progress?.completed) {
    return (
      <div className="xp-glass-panel rounded-2xl bg-black/30 p-8">
        <Check className="mx-auto size-12 text-green-400" />
        <p className="mt-3 text-2xl font-black">Crossword complete!</p>
        <p className="mt-2 text-lg font-semibold" style={{ color: accentColor }}>
          +{progress.pointsAwarded ?? 0} points
        </p>
        {progress.solveSeconds !== null ? (
          <p className="mt-2 text-sm text-white/65">
            Solved in {formatSolveTime(progress.solveSeconds)}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        className={`mx-auto grid w-fit grid-cols-5 gap-1 transition-transform ${
          wrongFlash ? 'animate-[shake_0.4s_ease-in-out]' : ''
        }`}
      >
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => {
            const key = `${row}-${col}`
            const open = openKeys.includes(key)
            if (!open) {
              return <span key={key} className="size-12 rounded-md bg-black/50" />
            }
            const number = startNumbers.get(key)
            return (
              <span key={key} className="relative">
                {number ? (
                  <span className="absolute top-0.5 left-1 z-10 text-[9px] font-bold text-white/70">
                    {number}
                  </span>
                ) : null}
                <input
                  ref={(node) => {
                    if (node) cellRefs.current.set(key, node)
                    else cellRefs.current.delete(key)
                  }}
                  value={cells[key] ?? ''}
                  disabled={checking}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`Row ${row + 1} column ${col + 1}`}
                  className="size-12 rounded-md border-2 border-white/30 bg-white/10 text-center text-lg font-black uppercase text-white focus:border-white"
                  onChange={(event) => setCellLetter(key, event.target.value)}
                />
              </span>
            )
          }),
        )}
      </div>
      {wrongFlash ? (
        <p className="text-sm font-semibold text-amber-300">Not quite yet. Keep going!</p>
      ) : null}
      <div className="grid gap-4 text-left sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/60">Across</p>
          <ul className="mt-1 space-y-1 text-sm">
            {across.map((clue) => (
              <li key={clue.id}>
                <span className="font-bold">{clue.number}.</span> {clue.clue}{' '}
                <span className="text-white/50">({clue.length})</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/60">Down</p>
          <ul className="mt-1 space-y-1 text-sm">
            {down.map((clue) => (
              <li key={clue.id}>
                <span className="font-bold">{clue.number}.</span> {clue.clue}{' '}
                <span className="text-white/50">({clue.length})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-xs text-white/60">
        Solve fast for full points. The grid checks itself when every cell is filled.
      </p>
      {error ? (
        <p className="rounded-xl bg-red-950/70 px-4 py-3 text-sm text-red-100" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Route crossword in PuzzleGamePlayer**

In `src/components/live/PuzzleGamePlayer.tsx`:

1. Import: `import { CrosswordPlayer } from '@/components/live/CrosswordPlayer'`
2. Replace the final fallback branch (`<p ...>This puzzle type is coming soon.</p>`) with:

```tsx
      ) : (
        <CrosswordPlayer eventId={eventId} teamId={teamId} game={game} accentColor={accentColor} />
      )}
```

The header block (title, points badge, cover, description) already renders above for every subtype, so `CrosswordPlayer` only renders the play surface.

- [ ] **Step 3: Verify**

Run: `npm run build && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/live/CrosswordPlayer.tsx src/components/live/PuzzleGamePlayer.tsx
git commit -m "feat: add participant crossword play with auto-solve detection"
```

---

### Task 5: Facilitator puzzle visibility

**Files:**
- Modify: `src/lib/text-game.ts` (add `puzzleSubmissionStatLabel`; extend `isOpenStageSubmissionMediaType`)
- Modify: `src/pages/live/FacilitatorEventPage.tsx` (submission list rendering around line 2086)
- Modify: `src/components/live/SubmissionDetailModal.tsx` (puzzle branch)
- Test: `src/lib/text-game.test.ts` (create if absent)

**Interfaces:**
- Consumes: submission `media_url` formats produced by the RPCs: `wordle:<attempts>`, `matching:<attempts>`, `crossword:<solveSeconds>`; `media_type = 'puzzle'`.
- Produces: `puzzleSubmissionStatLabel(mediaUrl: string | null | undefined): string`; `isOpenStageSubmissionMediaType` returns true for `'puzzle'`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/text-game.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { isOpenStageSubmissionMediaType, puzzleSubmissionStatLabel } from './text-game'

describe('puzzle submission display', () => {
  it('counts puzzle submissions as open-stage submissions', () => {
    expect(isOpenStageSubmissionMediaType('puzzle')).toBe(true)
    expect(isOpenStageSubmissionMediaType('photo')).toBe(true)
    expect(isOpenStageSubmissionMediaType('bingo')).toBe(false)
  })

  it('labels each puzzle stat from the media_url', () => {
    expect(puzzleSubmissionStatLabel('wordle:1')).toBe('Solved in 1 guess')
    expect(puzzleSubmissionStatLabel('wordle:4')).toBe('Solved in 4 guesses')
    expect(puzzleSubmissionStatLabel('matching:7')).toBe('Matched in 7 attempts')
    expect(puzzleSubmissionStatLabel('crossword:95')).toBe('Solved in 1:35')
    expect(puzzleSubmissionStatLabel('unknown')).toBe('Puzzle complete')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- text-game`
Expected: FAIL, `puzzleSubmissionStatLabel` not exported.

- [ ] **Step 3: Implement in text-game.ts**

Change `isOpenStageSubmissionMediaType`:

```ts
export function isOpenStageSubmissionMediaType(mediaType: string | null | undefined): boolean {
  return (
    mediaType === 'photo' || mediaType === 'video' || mediaType === 'text' || mediaType === 'puzzle'
  )
}
```

Add:

```ts
export function puzzleSubmissionStatLabel(mediaUrl: string | null | undefined): string {
  const [kind, rawValue] = (mediaUrl ?? '').split(':')
  const value = Number.parseInt(rawValue ?? '', 10)
  if (Number.isNaN(value)) return 'Puzzle complete'
  if (kind === 'wordle') return `Solved in ${value} ${value === 1 ? 'guess' : 'guesses'}`
  if (kind === 'matching') return `Matched in ${value} ${value === 1 ? 'attempt' : 'attempts'}`
  if (kind === 'crossword') {
    const minutes = Math.floor(value / 60)
    return `Solved in ${minutes}:${String(value % 60).padStart(2, '0')}`
  }
  return 'Puzzle complete'
}
```

Widening `isOpenStageSubmissionMediaType` also makes `quest-progress.ts` and the JoinGameView progress counters treat completed puzzles as quest submissions, which is the desired quest-progress behaviour (a completed puzzle counts like a submitted challenge).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- text-game`
Expected: PASS.

- [ ] **Step 5: Render puzzle rows in the facilitator list**

In `src/pages/live/FacilitatorEventPage.tsx`, import `puzzleSubmissionStatLabel` from `@/lib/text-game` (extend the existing import). In the submission list item (around line 2086), the thumbnail chain currently starts with `sub.media_type === 'text' ?`. Insert a puzzle branch BEFORE the `sub.media_url ?` check so `wordle:3` is never treated as an image URL:

```tsx
                          {sub.media_type === 'puzzle' ? (
                            <div className="bg-muted flex size-16 shrink-0 flex-col items-center justify-center rounded p-1 text-center">
                              <span className="text-[10px] font-bold uppercase">Puzzle</span>
                              <span className="text-[9px] leading-tight text-muted-foreground">
                                {puzzleSubmissionStatLabel(sub.media_url)}
                              </span>
                            </div>
                          ) : sub.media_type === 'text' ? (
```

Also append the points to the row body: inside the `min-w-0 flex-1` div, after the status badge, add:

```tsx
                            {sub.media_type === 'puzzle' && sub.points_awarded !== null ? (
                              <span className="text-muted-foreground ml-2 text-xs font-semibold">
                                +{sub.points_awarded} pts
                              </span>
                            ) : null}
```

- [ ] **Step 6: Puzzle branch in SubmissionDetailModal**

In `src/components/live/SubmissionDetailModal.tsx`, find where the modal renders media by `media_type` (photo/video/text branches). Add a `'puzzle'` branch that shows, instead of media: the game name, `puzzleSubmissionStatLabel(submission.media_url)`, and `+{submission.points_awarded} points`, with no approve/reject controls (the submission is already approved). Match the modal's existing layout primitives; import `puzzleSubmissionStatLabel` from `@/lib/text-game`.

- [ ] **Step 7: Verify + commit**

Run: `npm run build && npm test`
Expected: PASS.

```bash
git add src/lib/text-game.ts src/lib/text-game.test.ts src/pages/live/FacilitatorEventPage.tsx src/components/live/SubmissionDetailModal.tsx
git commit -m "feat: show puzzle completions in the facilitator panel"
```

---

### Task 6: Integration wiring sweep

**Files:**
- Modify: only files found lacking by the greps below (expected candidates: `src/pages/admin/GamesPage.tsx`, `src/lib/event-export.ts`, quest quick-add filters in the stage editor).

**Interfaces:**
- Consumes: `isPuzzleGame` from `@/lib/puzzle-engine`; game `type === 'puzzle'`.
- Produces: no new interfaces; closes gaps.

- [ ] **Step 1: Audit the wiring**

Run each and read the hits:

```bash
grep -rn "music_bingo" src/pages/admin src/components/events src/lib/event-export.ts | grep -v "puzzle"
grep -rn "'photo' | 'video'" src --include="*.ts" --include="*.tsx"
grep -rn "All photo\|All video\|All text" src/components/events
```

Checklist to confirm, fixing each gap found:
1. Games library type filter includes Puzzle (GamesPage).
2. Quest stage editor quick-add (Q-1 All/All photo/... buttons) and the game picker list puzzle games as addable.
3. Template installation copies puzzle configs intact (config is opaque JSON; verify no type allowlist blocks `puzzle`).
4. `src/lib/event-export.ts` (ZIP/CSV export) labels `media_type 'puzzle'` rows using `puzzleSubmissionStatLabel` instead of treating `media_url` as a downloadable URL.
5. Any game-type label maps (badge text, icons) include `puzzle`.

- [ ] **Step 2: Fix the gaps found**

For each gap, follow the existing pattern in the file (e.g. add `{ value: 'puzzle', label: 'Puzzle' }` to filter option arrays; add a `case 'puzzle':` to label maps). In `event-export.ts`, puzzle submissions must appear in the CSV log with the stat label and be skipped by the media downloader.

- [ ] **Step 3: Verify + commit**

Run: `npm run build && npm test && npm run lint`
Expected: PASS, 0 lint problems.

```bash
git add -A src
git commit -m "feat: wire puzzle games through filters, exports, and labels"
```

---

### Task 7: Full verification, docs, and handoff to live testing

**Files:**
- Modify: `TRACKER.md`, `docs/PUZZLES-FEATURE-PLAN.md`

**Interfaces:** none; verification and documentation.

- [ ] **Step 1: Full local gate**

Run: `npm run build && npm run lint && npm test`
Expected: build clean, lint 0 problems, all tests pass.

- [ ] **Step 2: Browser smoke on the branch**

With `npm run dev` (or the branch's Vercel preview) and browser automation:
1. Create a throwaway org event with one Quest stage containing one Wordle, one Matching, one Crossword game.
2. Author the crossword: RALLY across R1C1, ROBOT down R1C1, TEAM across R5C1 plus clues; confirm save succeeds.
3. Join as a participant (use `?tenant=` and the join link), complete all three puzzles; confirm the crossword auto-checks when full, a wrong grid shows "Not quite yet", and the solved screen shows time and points.
4. Confirm the facilitator panel lists all three completions with stat labels and points, and the team score increased exactly once per puzzle.
5. Confirm the participant bundle contains no answers: in the browser network tab, inspect the live games payload; `puzzle_crossword_words`, `puzzle_wordle_answer`, `puzzle_matching_pairs` must all be absent.

- [ ] **Step 3: Update docs**

- `TRACKER.md`: update the PUZZLE entry (or add one under "Later / ideas" if none exists) to: all three subtypes implemented on `feature/puzzles`, awaiting Rumen's real-phone test (two phones same team) before staging.
- `docs/PUZZLES-FEATURE-PLAN.md`: update the header status line and the crossword section to reflect the shipped manual design; point to the spec `docs/superpowers/specs/2026-07-18-puzzles-design.md`.

- [ ] **Step 4: Commit + push**

```bash
git add TRACKER.md docs/PUZZLES-FEATURE-PLAN.md
git commit -m "docs: record puzzle release status and crossword design change"
git push
```

- [ ] **Step 5: Hand off**

Report to Rumen: what shipped, the smoke results, and the remaining human steps: real-phone live test (two phones, one team, all three puzzles), then merge `feature/puzzles` into `staging`, confirm, then `main` as V2.14.0 with CHANGELOG + `APP_VERSION` bump. The version bump and CHANGELOG entry happen at the `main` merge, not on this branch.
