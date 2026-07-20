# Crossword Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the crossword puzzle subtype to a 6×6 grid with blocked cells, an inline word-entry editor with auto-detected crossing words, and a player with per-word server auto-solve, a 3-use hint system, and a live countdown with time-plus-hint scoring.

**Architecture:** Pure logic (grid size, run detection, scoring, progress parsing) lives in `src/lib/puzzle-engine.ts` and is unit-tested. Answers never reach the client, so all correctness/hint checks are server RPCs in a new Supabase migration. The editor (`CrosswordEditor.tsx`) and player (`CrosswordPlayer.tsx`) are rebuilt against those.

**Tech Stack:** React + TypeScript, Vite, Vitest, Tailwind, Supabase (Postgres RPCs, Realtime broadcast).

## Global Constraints

- No em dashes or en dashes (—, –) in any user-facing copy or docs.
- British English in copy.
- Use existing neo-minimal / shadcn primitives already imported in the target files; add no new dependencies.
- Path alias `@/` → `src/`.
- Server functions follow the existing `security definer` + `set search_path = public` + `revoke all ... / grant execute ... to anon, authenticated` pattern.
- Client puzzle RPC calls authorise through the join-token + team-token guards already used by `update_crossword_fill`.
- `CROSSWORD_SIZE` is the single source of grid width; bump it to 6, do not hard-code 6 elsewhere in the engine.
- Run `npm test` and `npm run build` before the final push.

---

### Task 1: Engine — grid size, run detection, scoring, progress parsing

**Files:**
- Modify: `src/types/game-config.ts` (`CrosswordLayout`)
- Modify: `src/lib/puzzle-engine.ts`
- Test: `src/lib/puzzle-engine.test.ts`

**Interfaces:**
- Consumes: `PuzzleCrosswordWord`, `CrosswordLayout`, `CrosswordClue` from `@/types/game-config`.
- Produces:
  - `CROSSWORD_SIZE = 6`
  - `type CrosswordCell = { row: number; col: number }`
  - `detectCrosswordRuns(letters: Map<string,string>, blocked: Set<string>): { row:number; col:number; direction:'across'|'down'; answer:string }[]` — every maximal straight run of 2+ letters, across then down, sorted by row then col.
  - `buildCrosswordLayout(words: PuzzleCrosswordWord[], blocked?: CrosswordCell[]): CrosswordLayout` — now carries `blocked`.
  - `crosswordScore(maxPoints:number, solveSeconds:number, hintsUsed:number): number`
  - `PuzzleProgress` gains `hintsUsed:number`, `revealedCells:Record<string,string>`, `solvedWordIds:string[]`, `startedAt:string|null`.
  - `parsePuzzleProgress` parses those four fields.

- [ ] **Step 1: Add `blocked` to the layout type**

In `src/types/game-config.ts`, change `CrosswordLayout`:

```ts
export type CrosswordLayout = {
  cells: { row: number; col: number }[]
  blocked: { row: number; col: number }[]
  clues: CrosswordClue[]
}
```

- [ ] **Step 2: Write failing engine tests**

Append to `src/lib/puzzle-engine.test.ts` (add the imports to the top import block):

```ts
import {
  CROSSWORD_SIZE,
  crosswordScore,
  detectCrosswordRuns,
  parsePuzzleProgress,
} from '@/lib/puzzle-engine'

describe('crossword grid size', () => {
  it('is 6', () => {
    expect(CROSSWORD_SIZE).toBe(6)
  })
})

describe('crossword scoring', () => {
  it('awards full points under five minutes with no hints', () => {
    expect(crosswordScore(100, 299, 0)).toBe(100)
    expect(crosswordScore(100, 300, 0)).toBe(100)
  })
  it('deducts five percent per thirty second block over five minutes', () => {
    expect(crosswordScore(100, 310, 0)).toBe(95) // 5:10 -> 1 block
    expect(crosswordScore(100, 330, 0)).toBe(95) // 5:30 -> 1 block
    expect(crosswordScore(100, 345, 0)).toBe(90) // 5:45 -> 2 blocks
    expect(crosswordScore(100, 360, 0)).toBe(90) // 6:00 -> 2 blocks
  })
  it('deducts ten percent per hint', () => {
    expect(crosswordScore(100, 200, 1)).toBe(90)
    expect(crosswordScore(100, 200, 3)).toBe(70)
  })
  it('floors at ten percent of max', () => {
    expect(crosswordScore(100, 6000, 3)).toBe(10)
  })
})

describe('crossword run detection', () => {
  it('finds every across and down run of two or more letters', () => {
    // C A T  on row 0 (cols 0-2); C on (0,0) also starts a down C-O-W
    const letters = new Map<string, string>([
      ['0-0', 'c'], ['0-1', 'a'], ['0-2', 't'],
      ['1-0', 'o'], ['2-0', 'w'],
    ])
    const runs = detectCrosswordRuns(letters, new Set())
    expect(runs).toEqual([
      { row: 0, col: 0, direction: 'across', answer: 'cat' },
      { row: 0, col: 0, direction: 'down', answer: 'cow' },
    ])
  })
  it('breaks runs on blocked cells and ignores single letters', () => {
    const letters = new Map<string, string>([
      ['0-0', 'a'], ['0-1', 't'], ['0-3', 'x'],
    ])
    const runs = detectCrosswordRuns(letters, new Set(['0-2']))
    expect(runs).toEqual([{ row: 0, col: 0, direction: 'across', answer: 'at' }])
  })
})

describe('crossword progress parsing', () => {
  it('reads hints, revealed cells, solved words and start time', () => {
    const parsed = parsePuzzleProgress({
      puzzleType: 'crossword',
      hintsUsed: 2,
      revealedCells: { '0-0': 'C', '1-1': 'x' },
      solvedWordIds: ['a', 'b'],
      startedAt: '2026-07-19T10:00:00Z',
    })
    expect(parsed.hintsUsed).toBe(2)
    expect(parsed.revealedCells).toEqual({ '0-0': 'C', '1-1': 'x' })
    expect(parsed.solvedWordIds).toEqual(['a', 'b'])
    expect(parsed.startedAt).toBe('2026-07-19T10:00:00Z')
  })
  it('defaults the new fields', () => {
    const parsed = parsePuzzleProgress({ puzzleType: 'crossword' })
    expect(parsed.hintsUsed).toBe(0)
    expect(parsed.revealedCells).toEqual({})
    expect(parsed.solvedWordIds).toEqual([])
    expect(parsed.startedAt).toBeNull()
  })
})
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `npm test -- puzzle-engine`
Expected: FAIL (`detectCrosswordRuns`/`crosswordScore` arity, missing fields).

- [ ] **Step 4: Implement the engine changes**

In `src/lib/puzzle-engine.ts`:

Bump the constant and export the cell type:

```ts
export const CROSSWORD_SIZE = 6

export type CrosswordCell = { row: number; col: number }
```

Add run detection (place near `crosswordCellLetters`):

```ts
/** Every maximal straight run of 2+ letters, across then down, row-major. */
export function detectCrosswordRuns(
  letters: Map<string, string>,
  blocked: Set<string>,
): { row: number; col: number; direction: CrosswordDirection; answer: string }[] {
  const runs: { row: number; col: number; direction: CrosswordDirection; answer: string }[] = []
  const at = (row: number, col: number) => {
    const key = `${row}-${col}`
    return blocked.has(key) ? undefined : letters.get(key)
  }
  const scan = (direction: CrosswordDirection) => {
    for (let a = 0; a < CROSSWORD_SIZE; a++) {
      let run = ''
      let startB = 0
      const flush = (endB: number) => {
        if (run.length >= 2) {
          const row = direction === 'across' ? a : startB
          const col = direction === 'across' ? startB : a
          runs.push({ row, col, direction, answer: run })
        }
        run = ''
      }
      for (let b = 0; b < CROSSWORD_SIZE; b++) {
        const letter = direction === 'across' ? at(a, b) : at(b, a)
        if (letter) {
          if (run.length === 0) startB = b
          run += letter
        } else {
          flush(b)
        }
      }
      flush(CROSSWORD_SIZE)
    }
  }
  scan('across')
  scan('down')
  return runs.sort(
    (x, y) => x.row - y.row || x.col - y.col || (x.direction === 'across' ? -1 : 1),
  )
}
```

Note `CrosswordDirection` is already imported from `@/types/game-config`; add it to that import if not present.

Extend `buildCrosswordLayout` to accept and emit blocked cells:

```ts
export function buildCrosswordLayout(
  words: PuzzleCrosswordWord[],
  blocked: CrosswordCell[] = [],
): CrosswordLayout {
  const { letters } = crosswordCellLetters(words)
  const cells = [...letters.keys()]
    .map((key) => {
      const [row, col] = key.split('-').map(Number)
      return { row, col }
    })
    .sort((a, b) => a.row - b.row || a.col - b.col)
  // ... existing clue-numbering block unchanged ...
  return { cells, blocked, clues }
}
```

Replace `crosswordScore` with the three-arg model:

```ts
export function crosswordScore(
  maxPoints: number,
  solveSeconds: number,
  hintsUsed: number,
): number {
  const max = Math.max(0, Math.round(maxPoints))
  const overBlocks = Math.ceil(Math.max(0, solveSeconds - 300) / 30)
  const factor = Math.max(0.1, 1 - 0.05 * overBlocks - 0.1 * Math.max(0, hintsUsed))
  return Math.round(max * factor)
}
```

Extend the `PuzzleProgress` type with:

```ts
  hintsUsed: number
  revealedCells: Record<string, string>
  solvedWordIds: string[]
  startedAt: string | null
```

Extend `parsePuzzleProgress`'s returned object (reuse the existing `strings` and record-of-string patterns already in the function):

```ts
    hintsUsed: typeof raw.hintsUsed === 'number' ? raw.hintsUsed : 0,
    revealedCells:
      raw.revealedCells && typeof raw.revealedCells === 'object' && !Array.isArray(raw.revealedCells)
        ? Object.fromEntries(
            Object.entries(raw.revealedCells as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string',
            ),
          )
        : {},
    solvedWordIds: strings(raw.solvedWordIds),
    startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : null,
```

Update `validateCrosswordWords`: after the existing per-word length/letter/fit checks, also reject a word whose cells overlap a blocked cell. Since blocked cells live in the layout not the words, add an optional param:

```ts
export function validateCrosswordWords(
  words: PuzzleCrosswordWord[],
  blocked: CrosswordCell[] = [],
): string | null {
  const blockedKeys = new Set(blocked.map((c) => `${c.row}-${c.col}`))
  // inside the per-word loop, after the fit check:
  //   if (crosswordWordCells(word).some(({ row, col }) => blockedKeys.has(`${row}-${col}`)))
  //     return `"${word.answer}" runs through a blocked cell.`
  // ... rest unchanged ...
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `npm test -- puzzle-engine`
Expected: PASS (all suites).

- [ ] **Step 6: Commit**

```bash
git add src/lib/puzzle-engine.ts src/lib/puzzle-engine.test.ts src/types/game-config.ts
git commit -m "feat: crossword engine 6x6, run detection, time+hint scoring"
```

---

### Task 2: Supabase migration — hints, per-word validation, live start time

**Files:**
- Create: `supabase/migrations/20260719120000_crossword_rework.sql`

**Interfaces:**
- Consumes existing: `puzzle_team_for_token`, `live_join_token_matches_event`, `puzzle_progress_payload`, `event_puzzle_progress`, `submissions`, `teams`.
- Produces:
  - columns `event_puzzle_progress.hints_used`, `event_puzzle_progress.revealed_cells`
  - `puzzle_crossword_points(integer, numeric, integer)` (three-arg)
  - payload keys `hintsUsed`, `revealedCells`, `solvedWordIds`, `startedAt`
  - RPC `use_crossword_hint(uuid, uuid, text, jsonb) returns jsonb`
  - `validate_crossword_grid(uuid, uuid, text, jsonb)` returning per-word solve state + award on completion.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260719120000_crossword_rework.sql`:

```sql
-- Crossword rework: 3-use hint reveals, per-word solve checks, and a
-- time+hint scoring model. All correctness stays server-side; answers never
-- leave the database.

alter table public.event_puzzle_progress
  add column if not exists hints_used integer not null default 0
    check (hints_used between 0 and 3),
  add column if not exists revealed_cells jsonb not null default '{}'::jsonb;

-- Solved <=300s with no hints = max. Each 30s block over 300s = -5%
-- (time rounded up). Each hint = -10%. Floor 10% of max.
drop function if exists public.puzzle_crossword_points(integer, numeric);
create or replace function public.puzzle_crossword_points(
  p_max_points integer,
  p_solve_seconds numeric,
  p_hints_used integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  select greatest(
    round(
      greatest(p_max_points, 0)
      * greatest(
          0.10,
          1
          - 0.05 * ceil(greatest(0, greatest(p_solve_seconds, 0) - 300) / 30.0)
          - 0.10 * greatest(0, coalesce(p_hints_used, 0))
        )
    )::integer,
    ceil(greatest(p_max_points, 0) * 0.10)::integer
  );
$$;

-- Shared helper: which word ids are fully correct given a filled-cells map.
create or replace function public.crossword_solved_word_ids(
  p_words jsonb,
  p_cells jsonb
)
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare
  v_word jsonb;
  v_answer text;
  v_row integer;
  v_col integer;
  v_i integer;
  v_key text;
  v_ok boolean;
  v_ids text[] := '{}';
begin
  for v_word in select value from jsonb_array_elements(coalesce(p_words, '[]'::jsonb)) loop
    v_answer := lower(coalesce(v_word ->> 'answer', ''));
    v_row := (v_word ->> 'row')::integer;
    v_col := (v_word ->> 'col')::integer;
    v_ok := char_length(v_answer) > 0;
    for v_i in 0 .. char_length(v_answer) - 1 loop
      if v_word ->> 'direction' = 'down' then
        v_key := (v_row + v_i) || '-' || v_col;
      else
        v_key := v_row || '-' || (v_col + v_i);
      end if;
      if lower(coalesce(p_cells ->> v_key, '')) <> substr(v_answer, v_i + 1, 1) then
        v_ok := false;
      end if;
    end loop;
    if v_ok then
      v_ids := array_append(v_ids, v_word ->> 'id');
    end if;
  end loop;
  return v_ids;
end;
$$;

-- Payload now also reports hints, revealed cells, solved words and the
-- solve start time (created_at) so the client can run a live countdown.
create or replace function public.puzzle_progress_payload(
  p_event_id uuid,
  p_team_id uuid,
  p_game_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_config jsonb;
  v_progress public.event_puzzle_progress%rowtype;
  v_pairs jsonb;
  v_left_ids jsonb := '[]'::jsonb;
  v_right_ids jsonb := '[]'::jsonb;
  v_pair jsonb;
  v_solved text[] := '{}';
begin
  select g.config into v_config
  from public.games g
  where g.id = p_game_id and g.type = 'puzzle';

  if v_config is null then
    raise exception 'Puzzle not found.';
  end if;

  select p.* into v_progress
  from public.event_puzzle_progress p
  where p.event_id = p_event_id and p.team_id = p_team_id and p.game_id = p_game_id;

  if v_config ->> 'puzzle_type' = 'matching' and v_progress.team_id is not null then
    v_pairs := coalesce(v_config -> 'puzzle_matching_pairs', '[]'::jsonb);
    for v_pair in select value from jsonb_array_elements(v_pairs) loop
      if (v_pair ->> 'id') = any(v_progress.matched_pair_ids) then
        v_left_ids := v_left_ids || jsonb_build_array(v_pair ->> 'leftId');
        v_right_ids := v_right_ids || jsonb_build_array(v_pair ->> 'rightId');
      end if;
    end loop;
  end if;

  if v_config ->> 'puzzle_type' = 'crossword' and v_progress.team_id is not null then
    v_solved := public.crossword_solved_word_ids(
      coalesce(v_config -> 'puzzle_crossword_words', '[]'::jsonb),
      coalesce(v_progress.filled_cells, '{}'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'puzzleType', v_config ->> 'puzzle_type',
    'attempts', coalesce(v_progress.attempts, 0),
    'wrongMatches', coalesce(v_progress.wrong_matches, 0),
    'guesses', coalesce(v_progress.wordle_guesses, '[]'::jsonb),
    'matchedLeftIds', v_left_ids,
    'matchedRightIds', v_right_ids,
    'filledCells', coalesce(v_progress.filled_cells, '{}'::jsonb),
    'revealedCells', coalesce(v_progress.revealed_cells, '{}'::jsonb),
    'hintsUsed', coalesce(v_progress.hints_used, 0),
    'solvedWordIds', to_jsonb(v_solved),
    'failedFullChecks', coalesce(v_progress.failed_full_checks, 0),
    'startedAt', v_progress.created_at,
    'solveSeconds', case
      when v_progress.completed_at is not null
      then floor(extract(epoch from v_progress.completed_at - v_progress.created_at))::integer
    end,
    'completed', v_progress.completed_at is not null,
    'pointsAwarded', v_progress.points_awarded
  );
end;
$$;

-- One hint: reveal the first still-empty cell of each unsolved word, deduped
-- where words cross. Server authored so answers never leak. Caps at 3.
create or replace function public.use_crossword_hint(
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
  v_solved text[];
  v_word jsonb;
  v_answer text;
  v_row integer;
  v_col integer;
  v_i integer;
  v_key text;
  v_filled jsonb;
  v_reveals jsonb := '{}'::jsonb;
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

  insert into public.event_puzzle_progress (event_id, team_id, game_id, puzzle_type)
  values (p_event_id, v_team_id, p_game_id, 'crossword')
  on conflict (event_id, team_id, game_id) do nothing;

  select p.* into v_progress
  from public.event_puzzle_progress p
  where p.event_id = p_event_id and p.team_id = v_team_id and p.game_id = p_game_id
  for update;

  if v_progress.completed_at is not null or v_progress.hints_used >= 3 then
    return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id);
  end if;

  -- Start from the caller's current fill so we do not re-reveal filled cells.
  v_filled := coalesce(p_cells, v_progress.filled_cells, '{}'::jsonb);
  v_solved := public.crossword_solved_word_ids(
    coalesce(v_config -> 'puzzle_crossword_words', '[]'::jsonb), v_filled);

  for v_word in
    select value from jsonb_array_elements(coalesce(v_config -> 'puzzle_crossword_words', '[]'::jsonb))
  loop
    if (v_word ->> 'id') = any(v_solved) then
      continue;
    end if;
    v_answer := lower(coalesce(v_word ->> 'answer', ''));
    v_row := (v_word ->> 'row')::integer;
    v_col := (v_word ->> 'col')::integer;
    for v_i in 0 .. char_length(v_answer) - 1 loop
      if v_word ->> 'direction' = 'down' then
        v_key := (v_row + v_i) || '-' || v_col;
      else
        v_key := v_row || '-' || (v_col + v_i);
      end if;
      -- first cell not already correct and not already granted this pass
      if lower(coalesce(v_filled ->> v_key, '')) <> substr(v_answer, v_i + 1, 1)
         and not (v_reveals ? v_key) then
        v_reveals := v_reveals || jsonb_build_object(v_key, upper(substr(v_answer, v_i + 1, 1)));
        exit;
      end if;
    end loop;
  end loop;

  update public.event_puzzle_progress
  set hints_used = v_progress.hints_used + 1,
      revealed_cells = coalesce(revealed_cells, '{}'::jsonb) || v_reveals,
      filled_cells = v_filled || v_reveals,
      updated_at = now()
  where event_id = p_event_id and team_id = v_team_id and game_id = p_game_id;

  return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id);
end;
$$;

-- Per-word check + completion award. Saves the fill, and when every word is
-- correct marks completion and awards using time + hints.
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
  v_words jsonb;
  v_solved text[];
  v_total integer;
  v_all boolean;
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

  v_words := coalesce(v_config -> 'puzzle_crossword_words', '[]'::jsonb);
  v_total := jsonb_array_length(v_words);
  v_solved := public.crossword_solved_word_ids(v_words, coalesce(p_cells, '{}'::jsonb));
  v_all := v_total > 0 and cardinality(v_solved) = v_total;

  if v_all then
    v_solve_seconds := floor(extract(epoch from now() - v_progress.created_at))::integer;
    v_awarded := public.puzzle_crossword_points(v_points, v_solve_seconds, v_progress.hints_used);

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
        updated_at = now()
    where event_id = p_event_id and team_id = v_team_id and game_id = p_game_id;
  end if;

  return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id)
    || jsonb_build_object('lastCheckCorrect', v_all);
end;
$$;

revoke all on function public.use_crossword_hint(uuid, uuid, text, jsonb) from public;
grant execute on function public.use_crossword_hint(uuid, uuid, text, jsonb) to anon, authenticated;
revoke all on function public.puzzle_crossword_points(integer, numeric, integer) from public;
revoke all on function public.crossword_solved_word_ids(jsonb, jsonb) from public;
```

- [ ] **Step 2: Type-check the SQL by applying it to the linked Supabase branch (or local)**

If a local Supabase stack is available: `supabase db reset` (or `supabase migration up`). Otherwise apply via the Supabase MCP `apply_migration` against a dev branch, never production. Expected: no errors; functions created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260719120000_crossword_rework.sql
git commit -m "feat: crossword hint RPC, per-word validation, time+hint scoring SQL"
```

---

### Task 3: Editor rebuild — 6×6, blocked cells, inline entry, auto-detected clues

**Files:**
- Modify: `src/components/games/CrosswordEditor.tsx` (full rebuild)
- Modify: `src/components/games/PuzzleEditor.tsx:34` (description copy 5x5 → 6x6)

**Interfaces:**
- Consumes: `CROSSWORD_SIZE`, `detectCrosswordRuns`, `buildCrosswordLayout`, `crosswordCellLetters`, `validateCrosswordWords`, `crosswordWordCells` from `@/lib/puzzle-engine`; `GameConfig`, `PuzzleCrosswordWord`, `CrosswordDirection`, `CrosswordCell` types.
- Produces: writes `config.puzzle_crossword_words` (full materialised set) and `config.puzzle_crossword_layout` (`{cells, blocked, clues}`).

**Editor state model:**
- `placed: Map<string,string>` — letters keyed `row-col` (lower-case).
- `blocked: Set<string>` — blocked cell keys.
- `clues: Map<string,string>` — clue text keyed by run key `${row}-${col}-${direction}`.
- `tool: 'word' | 'block'`.
- Draft entry: `start: CrosswordCell | null`, `direction: CrosswordDirection | null` (null until a run is hovered), `draft: string`.
- `clueTarget: string | null` — run key whose clue box is open.
- `saveQueue: string[]` — run keys still needing clues during a save sweep.

**Derived each render:**
- `runs = detectCrosswordRuns(placed, blocked)`; map each to a `PuzzleCrosswordWord` (stable id per run key kept in a `useRef<Map<runKey,id>>`), `clue: clues.get(runKey) ?? ''`.
- `words` = that mapped array. Persist via `commit(words, blocked)` which calls `setConfig` with `puzzle_crossword_words: words` and `puzzle_crossword_layout: buildCrosswordLayout(words, blockedCells)`.
- `needsClue = runKeys where clue is empty`.

- [ ] **Step 1: Rebuild the component skeleton and grid**

Render a `CROSSWORD_SIZE`×`CROSSWORD_SIZE` grid (`grid-cols-6`). Each cell button:
- blocked → solid yellow (`bg-[#FFC107]`), no letter.
- part of a needs-clue run → faint red (`border-red-400 bg-red-500/10 text-red-600`).
- has a letter → `bg-muted`.
- in the active draft highlight run → faint yellow; the hovered directional run brighter.
- empty → `bg-background`.

Tool toggle (two `Button`s: Word / Block). In Block mode a cell click toggles `blocked` (guard: cannot block a cell that holds a letter; clear letter first). In Word mode a cell click sets `start` and clears `direction`/`draft`.

- [ ] **Step 2: Implement run highlight + hover direction**

When `start` is set, compute the reachable across run (start.col → right until edge/blocked) and down run (start.row → down until edge/blocked). Highlight both faint. Attach `onMouseEnter` handlers on the across-run cells and down-run cells that set `direction` accordingly; on touch devices fall back to two small "Across →" / "Down ↓" buttons that set `direction`. The chosen run brightens.

- [ ] **Step 3: Implement inline typing**

Once `direction` is chosen, capture typing via a hidden/auto-focused input bound to `draft`:
- `onChange`: keep only letters, upper-case, clamp length to the chosen run length; store in `draft`.
- Render each draft letter into its run cell live.
- Backspace naturally shortens `draft` (last→first) via the input; no cell selection.
- Show **Confirm** and **Cancel** once `draft.length >= 1`. Cancel clears `start/direction/draft`.
- Confirm: write the draft letters into `placed` (respecting overlaps: identical letters allowed, conflicting letters rejected with an inline red message), then open the clue box for that run key (`clueTarget = runKey`). Clear the draft entry state.

- [ ] **Step 4: Implement the clue box and auto-detected words**

When `clueTarget` is set, show an `Input` (maxLength 120) + Save button that writes into `clues` for that run key and closes. After every `placed`/`blocked` change, `commit(...)` so `runs` recompute; newly appeared runs with no clue are auto-detected and render faint red both in-grid and in the list.

- [ ] **Step 5: Implement the word list**

Below the grid, list `words` sorted row-major. Each entry:
- label `R{row+1}` for across start / column letter `A..F` = `String.fromCharCode(65+col)` where helpful; show start as `R{row+1}·{colLetter}` and direction arrow.
- `WORD` bold, coloured yellow if clued else red; clicking a red word opens its clue box.
- clue text (muted). A remove control clears that run's letters from `placed` (only valid for isolated runs; if a run shares cells, removing clears just the non-shared cells — simplest: disable remove for crossing words and rely on grid editing). Keep it simple: remove clears the whole run's cells that are not part of any other run.

- [ ] **Step 6: Implement the save gate**

Expose the editor's validity to the parent the same way today (the parent reads `validatePuzzleConfig`). Additionally, within the editor, if the user clicks a local "Review clues" affordance while `needsClue` is non-empty, walk `saveQueue` opening each clue box in turn. The config-level `validateCrosswordWords(words, blockedCells)` already blocks save while any word lacks a clue, so the parent save button stays disabled until clues are complete. Verify `validatePuzzleConfig` passes `blocked` through (update `src/lib/puzzle-engine.ts` `validatePuzzleConfig` crossword branch to read `config.puzzle_crossword_layout?.blocked ?? []` and pass it to `validateCrosswordWords`).

- [ ] **Step 7: Update the subtype description**

In `src/components/games/PuzzleEditor.tsx:34` change `'Build a 5x5 crossword. Faster solves earn more points.'` to `'Build a 6x6 crossword. Faster solves earn more points.'`

- [ ] **Step 8: Verify in the browser**

Start the dev server (`preview_start` with the app's launch config), open the admin puzzle editor, build a small crossword: type an across word, confirm a down word auto-detects and shows red until clued, paint a blocked cell, confirm save is blocked until all clues exist. Screenshot.

- [ ] **Step 9: Commit**

```bash
git add src/components/games/CrosswordEditor.tsx src/components/games/PuzzleEditor.tsx src/lib/puzzle-engine.ts
git commit -m "feat: rebuild crossword editor with inline entry and auto clues"
```

---

### Task 4: Player rebuild — clue popover, per-word solve, hints, live timer

**Files:**
- Modify: `src/components/live/CrosswordPlayer.tsx` (full rebuild)

**Interfaces:**
- Consumes: `parsePuzzleProgress`, `PuzzleProgress`, `crosswordScore` from `@/lib/puzzle-engine`; RPCs `update_crossword_fill`, `validate_crossword_grid`, `use_crossword_hint`, `get_team_puzzle_progress`; layout `{cells, blocked, clues}`; `game.points_static` for the live estimate.
- Produces: no new exports.

**Behaviour:**
- Grid: `CROSSWORD_SIZE` wide from `layout`. Blocked cells solid; open cells inputs; word-start cells (any clue whose `row-col` equals the cell) get a highlighted ring + the clue number.
- Active word: tapping a start cell opens a small panel listing the clue(s) there tagged Across/Down; tapping one sets the active word (its cell keys, in order). Typing fills along the active word; Backspace deletes backwards.
- Revealed cells (`progress.revealedCells`) render locked (read-only, distinct style). Solved words (`progress.solvedWordIds`) render green and locked.
- Debounced autosave via `update_crossword_fill` (reuse existing 700ms pattern). When the active word's cells are all filled, call `validate_crossword_grid` with the full `cells`; apply returned `solvedWordIds`; if the just-completed word is not solved, shake + red flash; if `completed`, publish reload.
- Hint button: shows `3 - hintsUsed` remaining; calls `use_crossword_hint` with current `cells`; merges `revealedCells` and re-renders; disabled at 0 remaining or when solved.
- Live timer: `startedAt` from progress; `elapsed = now - startedAt`; `remaining = 300 - elapsed`. Display `m:ss`, green while `remaining > 60`, yellow `0 < remaining <= 60`, red and showing `-m:ss` when negative. Tick with a 1s interval.
- Live points: `crosswordScore(game.points_static ?? 100, max(0, elapsed), progress.hintsUsed)` shown next to the timer, updating each tick. Label it as the live estimate.
- Completed view: unchanged shape (check, `+points`, solve time).

- [ ] **Step 1: Rebuild state + data wiring**

Keep the mount effect that calls `update_crossword_fill({})` to start the timer and load progress, the broadcast subscription, and the debounced `syncFill`. Add local `active: {key,dir}` word tracking and a `now` state ticked by a `setInterval` (1000ms) while not completed.

- [ ] **Step 2: Grid render with start highlights, revealed + solved styling**

Render blocked cells as solid; compute `solvedCellKeys` from `progress.solvedWordIds` mapped through the clue list to cell keys; render solved/revealed cells locked. Word-start cells get a ring and the clue number badge.

- [ ] **Step 3: Active-word entry + clue panel**

On start-cell tap, show the clue panel; on clue tap set `active`. `setCellLetter` writes into `cells`, advances focus to the next cell of the active word, autosaves, and when the active word is fully filled triggers `checkWord`.

- [ ] **Step 4: checkWord (server per-word)**

`checkWord` calls `validate_crossword_grid` with the full `cells`, parses progress, applies solved words, flashes red on the active word if it is filled-but-not-solved, and on `completed` publishes the live-bundle reload. Reuse the existing `checking` guard + `wrongFlash` pattern.

- [ ] **Step 5: Hint button**

Add a Hint button (`Lightbulb` icon). On click call `use_crossword_hint` with current `cells`, apply returned progress (revealed cells now locked), and let the increased `hintsUsed` flow into the live points. Disable at 3 or when solved.

- [ ] **Step 6: Live timer + points**

Render the countdown and live estimate per the behaviour above using `now`, `progress.startedAt`, `progress.hintsUsed`, and `crosswordScore`. Colours via conditional classes. No copy with dashes.

- [ ] **Step 7: Verify in the browser**

With the dev server running, join as a participant on a crossword stage: type a word and confirm it locks green when correct and shakes when wrong; use a hint and confirm one letter per unsolved word reveals and the points drop 10%; watch the timer cross 5:00 into red; solve fully and confirm the awarded points match `crosswordScore`. Screenshot the solved state.

- [ ] **Step 8: Commit**

```bash
git add src/components/live/CrosswordPlayer.tsx
git commit -m "feat: rebuild crossword player with hints, per-word solve, live timer"
```

---

### Task 5: Final checks + push

- [ ] **Step 1: Full test + build + lint**

Run: `npm test` then `npm run build` then `npm run lint`
Expected: tests pass, build succeeds (type-check clean), lint clean.

- [ ] **Step 2: Update TRACKER.md**

Add a line under the puzzles work noting the crossword rework (6×6, blocked cells, inline editor, hints, live timer, time+hint scoring) landed on `feature/puzzles`.

- [ ] **Step 3: Commit and push**

```bash
git add TRACKER.md
git commit -m "docs: note crossword rework in tracker"
git push origin feature/puzzles
```

---

## Self-Review Notes

- Spec coverage: 6×6 (Task 1 constant, Task 3 grid), blocked cells (Tasks 1–4), inline entry (Task 3), auto-detected clues + save gate (Tasks 1,3), player start highlights + clue panel (Task 4), per-word auto-solve (Tasks 2,4), hints 3× −10% (Tasks 2,4), scoring model (Tasks 1,2), live timer + points (Task 4). All covered.
- Types are consistent: `detectCrosswordRuns`, `crosswordScore(max,seconds,hints)`, `buildCrosswordLayout(words,blocked)`, `validateCrosswordWords(words,blocked)`, payload keys `hintsUsed/revealedCells/solvedWordIds/startedAt` used identically in engine, SQL, and both components.
- Server is authoritative for all correctness, hints, and awards; client holds no answers.
```
