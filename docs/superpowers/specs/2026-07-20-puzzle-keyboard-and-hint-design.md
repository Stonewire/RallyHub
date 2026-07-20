# Puzzle player input rework: virtual keyboard + hint fix

Date: 2026-07-20
Branch: `feature/puzzles`
Status: approved for planning

Follow-up to the crossword rework (`2026-07-19-crossword-rework-design.md`),
driven by live play-test feedback. Three independent fixes/changes bundled
because they touch the same player surfaces:

1. Editor: hovering a run to pick direction didn't focus the typing input
   (already fixed directly, see below — trivial bug, not part of the plan).
2. Crossword hint over-reveals (one letter per unsolved word, so a single
   press can light up many letters at once).
3. Both Crossword and Wordle pop the native mobile keyboard, causing the
   viewport to jump. Replace with a persistent on-screen keyboard.

## 1. Editor hover-focus bug (already fixed, no plan task)

`CrosswordEditor.tsx`'s `onMouseEnter` handler called `setDir(...)` directly
instead of `chooseDirection(...)`, so hovering a run picked a direction but
never focused the draft input — the designer had to click into the input
box manually to type, which is exactly the "separate box" friction reported.
Fixed by routing the hover handler through `chooseDirection`, which already
focuses the input. Committed standalone before this spec.

## 2. Crossword hint: one letter total per use

**Current:** `use_crossword_hint` loops every still-unsolved word and reveals
one cell in each, so one press can reveal many cells across the grid at once.

**New:** one press reveals **exactly one cell**, chosen by this priority:

1. A cell shared by two (or more) currently-unsolved words that cross —
   picking it advances both words for the price of one hint.
2. If no unsolved words cross each other, the first empty cell of any one
   unsolved word (arbitrary deterministic choice: the first unsolved word in
   the stored word order, first empty cell in that word).

Everything else is unchanged: `hints_used` still caps at 3, each use is still
a flat −10% to the eventual score, revealed cells still lock and render
distinctly, and the reveal still merges into `filled_cells` so the per-word
check picks it up.

This is a SQL-only change to `use_crossword_hint` in a new migration. No
column or payload shape changes.

## 3. Shared on-screen keyboard

### New component: `src/components/live/VirtualKeyboard.tsx`

Renders **inline**, always present (never conditionally mounted/unmounted),
so nothing shifts in and out of the layout — that alone removes the jump
complaint; no fixed/sticky positioning is needed for that purpose.

Props:
```ts
type VirtualKeyboardProps = {
  alphabet: 'latin' | 'cyrillic'
  onKey: (letter: string) => void
  onBackspace: () => void
  onSubmit?: () => void          // present only when a submit key is wanted
  submitDisabled?: boolean
  keyState?: Record<string, 'correct' | 'present' | 'absent'>  // Wordle only
}
```

Two static key layouts, defined as plain arrays of rows:
- Latin: standard QWERTY three rows + Backspace (and Submit, when `onSubmit`
  is passed) on the bottom row.
- Cyrillic: standard ЙЦУКЕН three rows + Backspace/Submit on the bottom row.

Each key is a `<button type="button">` (never a text input, so it never
triggers a native IME/keyboard). When `keyState` is supplied, a key's
background follows the same green/yellow/gray convention as the boxes, and a
key whose state is `'absent'` renders `disabled` — it cannot be pressed again
for the rest of that puzzle. Crossword passes no `keyState` (plain keys).

### New config field

`puzzle_keyboard_alphabet?: 'latin' | 'cyrillic'` on `GameConfig`, default
`'latin'` when absent. Answer-free, so it needs no redaction — it passes
through to the live payload unchanged for both puzzle types.

`PuzzleEditor.tsx` gets a two-button Latin/Cyrillic toggle, shown for both
the Wordle section and the Crossword section (`CrosswordEditor` also reads
it directly from `config`, since the keyboard used during grid design is a
separate concern — the designer still types with area's real keyboard in the
admin panel; alphabet only affects the *player's* on-screen keyboard).

### Crossword player rework

Cells stop being `<input>` elements. Each open cell becomes a
non-focusable `<button>` showing its letter. New state:
`activeIndex: number` — the cursor's position within `activeCells` (the
currently active word's cell list).

- Tapping a cell: keeps existing clue-resolution logic (pick the clue that
  covers this cell, or show the clue panel at a word-start cell), then sets
  `activeIndex` to that cell's position in the newly active word.
- `VirtualKeyboard`'s `onKey`: writes the letter at `activeCells[activeIndex]`
  (unless locked), advances `activeIndex` to the next non-locked cell in
  `activeCells` (matches today's auto-advance), and triggers the existing
  auto-check-on-fill exactly as now.
- `onBackspace`: mirrors today's `onCellKeyDown` — if the cursor cell has a
  letter, clear it; otherwise step back to the previous non-locked cell and
  clear that one, moving the cursor there.
- The cursor cell renders with a distinct ring/style so the player can see
  where the next keystroke lands.
- No `onSubmit` — auto-check-on-fill is unchanged.

### Wordle player rework (`PuzzleGamePlayer.tsx`)

The current guess row is already rendered as per-letter boxes
(lines 231-240) sitting on top of a hidden real `<input>` — that hidden
input is what pops the native keyboard. Remove the `<input>` entirely;
`guess` state is now driven only by `VirtualKeyboard`:

- `onKey`: append the letter if `guess.length < wordLength`.
- `onBackspace`: drop the last character.
- `onSubmit`: same as today's "Submit guess" button (disabled until
  `guess.length === wordLength`); the visible `LiveAccentButton` "Submit
  guess" stays as a second way to submit, both call the same
  `submitWordleGuess`.

New helper in `puzzle-engine.ts`:

```ts
export function wordleKeyStates(
  guesses: PuzzleGuess[],
): Record<string, WordleCellState> {
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

Passed as `VirtualKeyboard`'s `keyState` (uppercased keys look up their
lowercase entry). A key with state `'absent'` is disabled — the player
cannot type that letter again for the rest of the puzzle, matching the
explicit "can't reuse gray letters, can reuse yellow/green" rule.

## Out of scope

- Matching/Pairs keyboard (explicitly excluded — it has no free-text input).
- Any change to Wordle/Crossword scoring, RLS, or the join/team-token flow.
- Auto-detecting alphabet from puzzle content — not possible client-side
  since answers are redacted; the designer sets it explicitly.
