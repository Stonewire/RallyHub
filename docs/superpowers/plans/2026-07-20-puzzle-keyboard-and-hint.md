# Puzzle Keyboard + Hint Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the crossword hint to reveal exactly one letter per use (not one per unsolved word), and replace the native mobile keyboard in Crossword and Wordle with a persistent on-screen keyboard shared by both games.

**Architecture:** A single SQL fix to `use_crossword_hint`. A new presentational `VirtualKeyboard` component consumed by both `CrosswordPlayer` (rebuilt around a tracked cursor instead of real `<input>` focus) and `PuzzleGamePlayer`'s Wordle branch (drops its hidden `<input>`, drives `guess` state from the keyboard). A new answer-free `puzzle_keyboard_alphabet` config field picked by the designer in `PuzzleEditor`.

**Tech Stack:** React + TypeScript, Vite, Vitest, Tailwind, Supabase (Postgres RPC).

## Global Constraints

- No em dashes or en dashes (—, –) in any user-facing copy or docs.
- British English in copy.
- Path alias `@/` → `src/`.
- No new dependencies; use existing shadcn/neo-minimal primitives already imported in touched files.
- Server functions keep the existing `security definer` + `set search_path = public` pattern; grants are unchanged when a function's signature doesn't change.
- Run `npm test` and `npm run build` before the final push.
- This branch (`feature/puzzles`) is shared with a concurrent session that switches branches on the same checkout — commit and push after every task, don't leave work uncommitted between tool calls.

---

### Task 1: Crossword hint SQL fix — one letter total per use

**Files:**
- Create: `supabase/migrations/20260720170000_crossword_hint_single_letter.sql`

**Interfaces:**
- Consumes: existing `live_join_token_matches_event`, `puzzle_team_for_token`, `crossword_solved_word_ids`, `puzzle_progress_payload`, `event_puzzle_progress` (unchanged).
- Produces: `use_crossword_hint(uuid, uuid, text, jsonb)` — same signature, new selection logic. Callers (`CrosswordPlayer.tsx`) are unaffected by this task.

- [ ] **Step 1: Write the migration**

```sql
-- Crossword hint rework: reveal exactly one letter per use (previously
-- revealed one letter in every unsolved word at once, which could light up
-- many cells in a single press). Prefers a cell shared by two unsolved
-- crossing words so one hint helps both; otherwise falls back to any
-- unsolved word's first wrong cell. Deterministic tie-break: lowest
-- "row-col" key text (arbitrary but stable).

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
  v_candidates jsonb := '{}'::jsonb;
  v_counts jsonb := '{}'::jsonb;
  v_pick text;
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
      if lower(coalesce(v_filled ->> v_key, '')) <> substr(v_answer, v_i + 1, 1) then
        if v_candidates ? v_key then
          v_counts := jsonb_set(v_counts, array[v_key],
            to_jsonb(coalesce((v_counts ->> v_key)::integer, 1) + 1));
        else
          v_candidates := v_candidates || jsonb_build_object(v_key, upper(substr(v_answer, v_i + 1, 1)));
          v_counts := v_counts || jsonb_build_object(v_key, 1);
        end if;
      end if;
    end loop;
  end loop;

  -- Prefer a cell shared by two or more unsolved crossing words.
  select key into v_pick
  from jsonb_each_text(v_counts) as t(key, val)
  where val::integer >= 2
  order by key
  limit 1;

  -- Otherwise any single unsolved word's first wrong cell (deterministic).
  if v_pick is null then
    select key into v_pick from jsonb_each_text(v_candidates) as t(key, val) order by key limit 1;
  end if;

  -- Nothing left to reveal (e.g. everything already correct pending the
  -- next check) - don't burn a hint for no effect.
  if v_pick is not null then
    v_reveals := jsonb_build_object(v_pick, v_candidates ->> v_pick);
    update public.event_puzzle_progress
    set hints_used = v_progress.hints_used + 1,
        revealed_cells = coalesce(revealed_cells, '{}'::jsonb) || v_reveals,
        filled_cells = v_filled || v_reveals,
        updated_at = now()
    where event_id = p_event_id and team_id = v_team_id and game_id = p_game_id;
  end if;

  return public.puzzle_progress_payload(p_event_id, v_team_id, p_game_id);
end;
$$;
```

- [ ] **Step 2: Apply the migration to the shared Supabase project**

Use the Supabase MCP `apply_migration` tool against project `rlnnhgnuprtatmhqxirb` with name `crossword_hint_single_letter` and the SQL above. Expected: `{"success": true}`.

- [ ] **Step 3: Smoke-test with a throwaway seed (same pattern as the crossword rework verification)**

Run via `execute_sql` against the same project: seed a game with three crossword words where two of them cross at an unsolved cell and one is isolated, call `use_crossword_hint` once, and assert only one key appears in the returned `revealedCells` and it is the shared crossing cell. Then call it again and assert a second, different key is revealed and `hintsUsed` is now 2. Clean up the seeded rows in the same transaction (same throwaway-seed-then-delete pattern used for the original crossword rework verification).

Expected: first hint reveals exactly the shared cell; `hintsUsed` increments by exactly 1 per call; no more than one new key appears in `revealedCells` per call.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260720170000_crossword_hint_single_letter.sql
git commit -m "fix: crossword hint reveals one letter total, not one per word"
git push origin feature/puzzles
```

---

### Task 2: Engine helper — `wordleKeyStates`

**Files:**
- Modify: `src/lib/puzzle-engine.ts`
- Test: `src/lib/puzzle-engine.test.ts`

**Interfaces:**
- Consumes: existing `PuzzleGuess`, `WordleCellState` types (already exported).
- Produces: `wordleKeyStates(guesses: PuzzleGuess[]): Record<string, WordleCellState>` — lowercase-letter keys, best state seen across all guesses (`correct` beats `present` beats `absent`).

- [ ] **Step 1: Write the failing test**

Add to `src/lib/puzzle-engine.test.ts` (add `wordleKeyStates` to the existing import from `@/lib/puzzle-engine`):

```ts
describe('wordleKeyStates', () => {
  it('keeps the best state seen for each letter across all guesses', () => {
    const states = wordleKeyStates([
      { word: 'RATE', feedback: ['absent', 'correct', 'present', 'absent'] },
      { word: 'CARS', feedback: ['absent', 'present', 'absent', 'correct'] },
    ])
    expect(states).toEqual({
      r: 'absent',
      a: 'correct',
      t: 'present',
      e: 'absent',
      c: 'absent',
      s: 'correct',
    })
  })

  it('returns an empty map for no guesses', () => {
    expect(wordleKeyStates([])).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- puzzle-engine`
Expected: FAIL (`wordleKeyStates` is not exported).

- [ ] **Step 3: Implement it**

Add to `src/lib/puzzle-engine.ts`, near `wordleFeedback`:

```ts
/** Best-seen key state per letter across every guess: correct > present > absent. */
export function wordleKeyStates(guesses: PuzzleGuess[]): Record<string, WordleCellState> {
  const priority: Record<WordleCellState, number> = { absent: 0, present: 1, correct: 2 }
  const state: Record<string, WordleCellState> = {}
  for (const { word, feedback } of guesses) {
    Array.from(word.toLocaleLowerCase()).forEach((letter, i) => {
      const next = feedback[i]
      if (!next) return
      const current = state[letter]
      if (!current || priority[next] > priority[current]) state[letter] = next
    })
  }
  return state
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- puzzle-engine`
Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/puzzle-engine.ts src/lib/puzzle-engine.test.ts
git commit -m "feat: add wordleKeyStates helper for on-screen keyboard coloring"
git push origin feature/puzzles
```

---

### Task 3: `VirtualKeyboard` component

**Files:**
- Create: `src/components/live/VirtualKeyboard.tsx`

**Interfaces:**
- Consumes: `WordleCellState` from `@/lib/puzzle-engine`.
- Produces:
  ```ts
  type VirtualKeyboardProps = {
    alphabet: 'latin' | 'cyrillic'
    onKey: (letter: string) => void
    onBackspace: () => void
    onSubmit?: () => void
    submitDisabled?: boolean
    keyState?: Record<string, WordleCellState>
    disabled?: boolean
  }
  export function VirtualKeyboard(props: VirtualKeyboardProps): JSX.Element
  ```
  `CrosswordPlayer` uses it with no `onSubmit`/`keyState` (plain keys). `PuzzleGamePlayer`'s Wordle branch passes both.

No test: pure presentational component (a row map + button clicks), no branching logic worth a unit test per the project's existing convention (bingo/scoring pure functions are tested; dumb render components are not).

- [ ] **Step 1: Create the component**

```tsx
import type { WordleCellState } from '@/lib/puzzle-engine'

type Alphabet = 'latin' | 'cyrillic'

const LATIN_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

// Bulgarian 30-letter Cyrillic alphabet, alphabetical rows. This is a tap
// keyboard, not a physical one, so there is no ЙЦУКЕН layout to match.
const CYRILLIC_ROWS = [
  ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'Й'],
  ['К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У'],
  ['Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ь', 'Ю', 'Я'],
]

const STATE_COLOR: Record<WordleCellState, string> = {
  correct: '#16A34A',
  present: '#D97706',
  absent: '#4B5563',
}

type Props = {
  alphabet: Alphabet
  onKey: (letter: string) => void
  onBackspace: () => void
  onSubmit?: () => void
  submitDisabled?: boolean
  keyState?: Record<string, WordleCellState>
  disabled?: boolean
}

export function VirtualKeyboard({
  alphabet,
  onKey,
  onBackspace,
  onSubmit,
  submitDisabled,
  keyState,
  disabled,
}: Props) {
  const rows = alphabet === 'cyrillic' ? CYRILLIC_ROWS : LATIN_ROWS
  return (
    <div className="space-y-1.5 select-none">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-1">
          {row.map((letter) => {
            const state = keyState?.[letter.toLocaleLowerCase()]
            const locked = state === 'absent'
            return (
              <button
                key={letter}
                type="button"
                disabled={disabled || locked}
                onClick={() => onKey(letter)}
                className="flex h-10 min-w-8 flex-1 items-center justify-center rounded-md text-sm font-bold uppercase text-white transition-colors disabled:opacity-40"
                style={{ backgroundColor: state ? STATE_COLOR[state] : 'rgba(255,255,255,0.12)' }}
              >
                {letter}
              </button>
            )
          })}
        </div>
      ))}
      <div className="flex justify-center gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={onBackspace}
          className="h-10 flex-[1.5] rounded-md bg-white/10 text-xs font-bold uppercase text-white disabled:opacity-40"
        >
          Delete
        </button>
        {onSubmit ? (
          <button
            type="button"
            disabled={disabled || submitDisabled}
            onClick={onSubmit}
            className="h-10 flex-[1.5] rounded-md bg-white/10 text-xs font-bold uppercase text-white disabled:opacity-40"
          >
            Submit
          </button>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors referencing `VirtualKeyboard.tsx`.

- [ ] **Step 3: Commit and push**

```bash
git add src/components/live/VirtualKeyboard.tsx
git commit -m "feat: add shared on-screen keyboard for Crossword and Wordle"
git push origin feature/puzzles
```

---

### Task 4: `puzzle_keyboard_alphabet` config field + editor toggle

**Files:**
- Modify: `src/types/game-config.ts`
- Modify: `src/components/games/PuzzleEditor.tsx`

**Interfaces:**
- Produces: `GameConfig.puzzle_keyboard_alphabet?: 'latin' | 'cyrillic'` (absent = `'latin'`). Read by both player rebuilds in Tasks 5 and 6.

- [ ] **Step 1: Add the field**

In `src/types/game-config.ts`, add to `GameConfig` (near the other `puzzle_*` fields):

```ts
  /** On-screen keyboard alphabet for Wordle/Crossword players. Answer-free. */
  puzzle_keyboard_alphabet?: 'latin' | 'cyrillic'
```

- [ ] **Step 2: Add the editor toggle**

In `src/components/games/PuzzleEditor.tsx`, insert this block right after the closing `</div>` of the subtype grid (i.e. immediately before the `{selected === 'wordle' ? (` block):

```tsx
      {selected === 'wordle' || selected === 'crossword' ? (
        <div>
          <Label>Player keyboard</Label>
          <p className="text-muted-foreground mt-1 text-xs">
            Which on-screen keyboard players see while solving.
          </p>
          <div className="mt-2 flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={(config.puzzle_keyboard_alphabet ?? 'latin') === 'latin' ? 'default' : 'outline'}
              onClick={() =>
                setConfig((current) => ({ ...current, puzzle_keyboard_alphabet: 'latin' }))
              }
            >
              Latin
            </Button>
            <Button
              type="button"
              size="sm"
              variant={config.puzzle_keyboard_alphabet === 'cyrillic' ? 'default' : 'outline'}
              onClick={() =>
                setConfig((current) => ({ ...current, puzzle_keyboard_alphabet: 'cyrillic' }))
              }
            >
              Cyrillic
            </Button>
          </div>
        </div>
      ) : null}
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit -p . && npm run build`
Expected: no errors.

- [ ] **Step 4: Commit and push**

```bash
git add src/types/game-config.ts src/components/games/PuzzleEditor.tsx
git commit -m "feat: add player keyboard alphabet setting to puzzle editor"
git push origin feature/puzzles
```

---

### Task 5: Crossword player rework — cursor-driven cells, no native input

**Files:**
- Modify: `src/components/live/CrosswordPlayer.tsx`

**Interfaces:**
- Consumes: `VirtualKeyboard` from Task 3 (`onKey`, `onBackspace`, no `onSubmit`/`keyState`); `config.puzzle_keyboard_alphabet` from Task 4.
- Produces: no new exports; internal-only rework.

- [ ] **Step 1: Add the cursor state and remove the input-ref map**

Remove the `cellRefs` ref (no longer needed) and add an `activeIndex` state. Replace:

```ts
  const syncTimer = useRef<number | null>(null)
  const cellRefs = useRef(new Map<string, HTMLInputElement>())
```

with:

```ts
  const syncTimer = useRef<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
```

- [ ] **Step 2: Replace `onCellFocus` with `selectCell` (sets the cursor instead of relying on DOM focus)**

Replace the `onCellFocus` function:

```ts
  function onCellFocus(key: string) {
    const starts = cluesByStart.get(key)
    if (starts && starts.length > 0) setPanelCell(key)
    // If the cell belongs to the active word keep it; otherwise pick a clue
    // that covers this cell so typing flows in a sensible direction.
    if (!activeClue || !activeCells.includes(key)) {
      const covering = clues.find((c) => clueCells(c).includes(key))
      if (covering) setActiveClueId(covering.id)
    }
  }
```

with:

```ts
  function selectCell(key: string) {
    const starts = cluesByStart.get(key)
    if (starts && starts.length > 0) setPanelCell(key)
    let clue = activeClue && activeCells.includes(key) ? activeClue : null
    if (!clue) {
      clue = clues.find((c) => clueCells(c).includes(key)) ?? null
      if (clue) setActiveClueId(clue.id)
    }
    if (clue) {
      const cellsForClue = clueCells(clue)
      const index = cellsForClue.indexOf(key)
      setActiveIndex(index === -1 ? 0 : index)
    }
  }
```

- [ ] **Step 3: Replace `setCellLetter` and `onCellKeyDown` with `handleKey` and `handleBackspace`**

Replace both functions:

```ts
  function setCellLetter(key: string, raw: string) {
    if (isLocked(key)) return
    const letter = raw.replace(/[^\p{L}]/gu, '').slice(-1).toLocaleUpperCase()
    const nextCells = { ...cells }
    if (letter) nextCells[key] = letter
    else delete nextCells[key]
    setCells(nextCells)
    setError(null)
    syncFill(nextCells)
    if (letter && activeClue) {
      const index = activeCells.indexOf(key)
      const nextKey = activeCells.slice(index + 1).find((k) => !isLocked(k))
      if (nextKey) cellRefs.current.get(nextKey)?.focus()
    }
    if (activeClue && activeCells.every((k) => nextCells[k])) {
      void checkWord(nextCells, activeClue.id)
    }
  }

  function onCellKeyDown(key: string, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Backspace' || !activeClue) return
    if (cells[key]) return // default clears this cell
    const index = activeCells.indexOf(key)
    const prevKey = activeCells.slice(0, index).reverse().find((k) => !isLocked(k))
    if (!prevKey) return
    event.preventDefault()
    const nextCells = { ...cells }
    delete nextCells[prevKey]
    setCells(nextCells)
    syncFill(nextCells)
    cellRefs.current.get(prevKey)?.focus()
  }
```

with:

```ts
  function handleKey(letter: string) {
    if (checking || !activeClue) return
    const key = activeCells[activeIndex]
    if (!key || isLocked(key)) return
    const nextCells = { ...cells, [key]: letter.toLocaleUpperCase() }
    setCells(nextCells)
    setError(null)
    syncFill(nextCells)
    const nextIndex = activeCells.findIndex((k, i) => i > activeIndex && !isLocked(k))
    if (nextIndex !== -1) setActiveIndex(nextIndex)
    if (activeCells.every((k) => nextCells[k])) {
      void checkWord(nextCells, activeClue.id)
    }
  }

  function handleBackspace() {
    if (checking || !activeClue) return
    const key = activeCells[activeIndex]
    if (key && cells[key] && !isLocked(key)) {
      const nextCells = { ...cells }
      delete nextCells[key]
      setCells(nextCells)
      syncFill(nextCells)
      return
    }
    const prevIndex = [...activeCells.keys()]
      .slice(0, activeIndex)
      .reverse()
      .find((i) => !isLocked(activeCells[i]))
    if (prevIndex === undefined) return
    const prevKey = activeCells[prevIndex]
    const nextCells = { ...cells }
    delete nextCells[prevKey]
    setCells(nextCells)
    syncFill(nextCells)
    setActiveIndex(prevIndex)
  }
```

- [ ] **Step 4: Update the clue-panel button to set the cursor instead of focusing**

Replace:

```tsx
                onClick={() => {
                  setActiveClueId(clue.id)
                  const first = clueCells(clue).find((k) => !isLocked(k))
                  if (first) cellRefs.current.get(first)?.focus()
                }}
```

with:

```tsx
                onClick={() => {
                  setActiveClueId(clue.id)
                  const cellsForClue = clueCells(clue)
                  const first = cellsForClue.findIndex((k) => !isLocked(k))
                  setActiveIndex(first === -1 ? 0 : first)
                }}
```

- [ ] **Step 5: Replace the `<input>` cells with cursor-aware `<button>` cells**

Replace the cell-rendering block:

```tsx
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
                  value={locked ? (progress?.filledCells[key] ?? cells[key] ?? '') : cells[key] ?? ''}
                  readOnly={locked}
                  disabled={checking}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`Row ${row + 1} column ${col + 1}`}
                  onFocus={() => onCellFocus(key)}
                  onChange={(event) => setCellLetter(key, event.target.value)}
                  onKeyDown={(event) => onCellKeyDown(key, event)}
                  className={`size-12 rounded-md border-2 text-center text-lg font-black uppercase focus:border-white ${
                    solved
                      ? 'border-green-400/70 bg-green-500/25 text-green-100'
                      : revealed
                        ? 'border-amber-300/70 bg-amber-400/20 text-amber-100'
                        : inActive
                          ? 'border-white/70 bg-white/20 text-white'
                          : 'border-white/30 bg-white/10 text-white'
                  } ${number && !locked && !inActive ? 'ring-2 ring-inset ring-[#FFC107]/60' : ''} ${
                    wrongFlash && inActive ? 'border-red-400/80' : ''
                  }`}
                />
              </span>
            )
```

with:

```tsx
            const isCursor = inActive && !locked && activeCells[activeIndex] === key
            return (
              <span key={key} className="relative">
                {number ? (
                  <span className="absolute top-0.5 left-1 z-10 text-[9px] font-bold text-white/70">
                    {number}
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={checking}
                  onClick={() => selectCell(key)}
                  aria-label={`Row ${row + 1} column ${col + 1}`}
                  className={`size-12 rounded-md border-2 text-center text-lg font-black uppercase ${
                    solved
                      ? 'border-green-400/70 bg-green-500/25 text-green-100'
                      : revealed
                        ? 'border-amber-300/70 bg-amber-400/20 text-amber-100'
                        : inActive
                          ? 'border-white/70 bg-white/20 text-white'
                          : 'border-white/30 bg-white/10 text-white'
                  } ${number && !locked && !inActive ? 'ring-2 ring-inset ring-[#FFC107]/60' : ''} ${
                    isCursor ? 'ring-2 ring-white' : ''
                  } ${wrongFlash && inActive ? 'border-red-400/80' : ''}`}
                >
                  {locked ? (progress?.filledCells[key] ?? cells[key] ?? '') : (cells[key] ?? '')}
                </button>
              </span>
            )
```

- [ ] **Step 6: Add the keyboard below the clue panel**

Add the import:

```ts
import { VirtualKeyboard } from '@/components/live/VirtualKeyboard'
```

Insert the keyboard just before the closing `wrongFlash` paragraph block (after the clue-panel `if/else` block, before `{wrongFlash ? (`):

```tsx
      <VirtualKeyboard
        alphabet={config.puzzle_keyboard_alphabet ?? 'latin'}
        onKey={handleKey}
        onBackspace={handleBackspace}
        disabled={checking}
      />

```

- [ ] **Step 7: Type-check and build**

Run: `npx tsc --noEmit -p . && npm run build`
Expected: no errors (confirms no leftover references to `cellRefs`, `setCellLetter`, `onCellKeyDown`, `onCellFocus`).

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: all suites pass (this task touches no pure-logic functions, so no test changes are expected here).

- [ ] **Step 9: Commit and push**

```bash
git add src/components/live/CrosswordPlayer.tsx
git commit -m "feat: crossword player uses on-screen keyboard, drops native input"
git push origin feature/puzzles
```

---

### Task 6: Wordle player rework — boxes + keyboard, no native input

**Files:**
- Modify: `src/components/live/PuzzleGamePlayer.tsx`

**Interfaces:**
- Consumes: `VirtualKeyboard` from Task 3, `wordleKeyStates` from Task 2, `config.puzzle_keyboard_alphabet` from Task 4.
- Produces: no new exports; internal-only rework.

- [ ] **Step 1: Import the new pieces**

Add to the existing imports:

```ts
import { VirtualKeyboard } from '@/components/live/VirtualKeyboard'
```

Add `wordleKeyStates` to the existing `@/lib/puzzle-engine` import list (alongside `liveMatchingItems`, `parsePuzzleProgress`, etc.).

- [ ] **Step 2: Add the keyboard handlers and key-state calculation**

Add inside the component, near the other `submit*`/`setSelected*` handlers:

```ts
  function handleWordleKey(letter: string) {
    if (saving) return
    setGuess((current) => (Array.from(current).length < wordLength ? current + letter.toLocaleUpperCase() : current))
  }

  function handleWordleBackspace() {
    if (saving) return
    setGuess((current) => Array.from(current).slice(0, -1).join(''))
  }
```

Add near where `wordLength` is computed:

```ts
  const wordleKeyState = useMemo(() => wordleKeyStates(progress?.guesses ?? []), [progress?.guesses])
```

(`useMemo` is already imported at the top of this file.)

- [ ] **Step 3: Remove the native `<input>` and wire in the keyboard**

Replace this block (the guess input, between the guess-boxes preview and the Submit button):

```tsx
          <input
            value={guess}
            disabled={saving}
            maxLength={wordLength}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="xp-field w-full rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-center text-lg font-bold uppercase tracking-[0.18em] text-white placeholder:text-white/45"
            placeholder={`${wordLength}-letter word`}
            onChange={(event) =>
              setGuess(
                event.target.value
                  .replace(/[^\p{L}]/gu, '')
                  .slice(0, wordLength)
                  .toLocaleUpperCase(),
              )
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter' && Array.from(guess).length === wordLength) {
                void submitWordleGuess()
              }
            }}
          />
```

with:

```tsx
          <VirtualKeyboard
            alphabet={config.puzzle_keyboard_alphabet ?? 'latin'}
            onKey={handleWordleKey}
            onBackspace={handleWordleBackspace}
            onSubmit={() => void submitWordleGuess()}
            submitDisabled={saving || Array.from(guess).length !== wordLength}
            keyState={wordleKeyState}
            disabled={saving}
          />
```

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit -p . && npm run build`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including the Task 2 `wordleKeyStates` tests.

- [ ] **Step 6: Commit and push**

```bash
git add src/components/live/PuzzleGamePlayer.tsx
git commit -m "feat: wordle player uses on-screen keyboard, drops native input"
git push origin feature/puzzles
```

---

### Task 7: Final checks, tracker update, push

- [ ] **Step 1: Full test, build, lint**

Run: `npm test && npm run build && npm run lint`
Expected: all green.

- [ ] **Step 2: Update `TRACKER.md`**

Add a line noting: crossword hint now reveals one letter total per use (prefers a crossing intersection); Crossword and Wordle both use a shared on-screen keyboard (Latin/Cyrillic, designer-selected per puzzle) instead of the native mobile keyboard; editor hover-to-type bug fixed.

- [ ] **Step 3: Commit and push**

```bash
git add TRACKER.md
git commit -m "docs: note puzzle keyboard rework and hint fix in tracker"
git push origin feature/puzzles
```

---

## Self-Review Notes

- Spec coverage: hint fix (Task 1), shared keyboard component (Task 3), alphabet config + editor toggle (Task 4), Crossword cursor rework (Task 5), Wordle box+keyboard rework (Task 6), key-state coloring and gray-letter lock (Task 2 + Task 6 `keyState`/`disabled`). Editor hover-focus bug was already fixed and committed before this plan (noted in the spec, not a task here).
- Type consistency checked: `VirtualKeyboardProps` in Task 3 matches every call site in Tasks 5 and 6 (`alphabet`, `onKey`, `onBackspace`, optional `onSubmit`/`submitDisabled`/`keyState`, `disabled`). `wordleKeyStates` signature in Task 2 matches its Task 6 call site exactly.
- No placeholders: every step has literal code, not descriptions.
