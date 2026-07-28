# Puzzle game library — content plan

Last reviewed: 28 July 2026. Companion to `GAME-CONTENT-PLAN.md`, which covers
quests and quizzes. Puzzle games shipped in V2.16.0.

Everything here installs into the **RallyHub Game Library** org
(`rallyhub-library`) with `is_platform_template = true`, so client orgs pick them
up through the existing Install to clients flow on the game editor. Nothing here
is client-specific.

## What a puzzle game is

One `puzzle` game with a subtype. All three score automatically, server-side,
and run inside a Quest stage alongside photo/video/text challenges.

| Subtype | Player does | Scoring |
|---|---|---|
| `wordle` | Guesses a hidden word on the built-in keyboard | Full points on the first guess, then -10% of the remaining score per extra guess |
| `matching` | Taps pairs across two shuffled columns | Full points with no mistakes; each wrong pair reduces the score |
| `crossword` | Fills a 6x6 grid from clues | Full points at or under 5:00, -5% per 30s over, -10% per hint, 10% floor |

Keyboard alphabet is per puzzle: `latin` or `cyrillic`. Set it to match the
answer language, not the client's UI language.

## Production rules

- **Wordle answers must be exactly one word, no proper nouns, no plurals of
  convenience.** A team that cannot guess it feels cheated rather than beaten.
- Keep Wordle answers to 5 letters unless the theme demands otherwise. The
  engine supports 3–12.
- **Matching puzzles use 6 pairs.** Fewer feels trivial; more does not fit a
  phone screen without scrolling during a timed event.
- Matching pairs must be unambiguous. If two right-hand items could plausibly
  belong to the same left-hand item, rewrite one.
- **Crossword grids are 6x6.** Blocked cells are painted in the editor; every
  straight run of 2+ letters is auto-detected and must be clued before saving.
- Aim for 6–8 words per crossword with at least three crossings.
- Points: Wordle 100, Matching 80, Crossword 120. Crosswords are worth most
  because they take longest and carry the live timer.
- Clues stay clean and workplace-safe. No politics, no religion, no anything a
  facilitator would have to apologise for.

## Set 1 — Wordle (12 puzzles)

All 5 letters, Latin keyboard unless marked.

| Game name | Answer | Theme | Points |
|---|---|---|---:|
| Word Rally: Teamwork | TRUST | Team-building warm-up | 100 |
| Word Rally: The Office | EMAIL | Workplace | 100 |
| Word Rally: Coffee Break | BEANS | Workplace, light | 100 |
| Word Rally: On the Move | TRAIN | Travel | 100 |
| Word Rally: Summer | BEACH | Outdoor and summer events | 100 |
| Word Rally: Winter | FROST | Winter events | 100 |
| Word Rally: Music | CHORD | Pairs well with music bingo | 100 |
| Word Rally: Food | BREAD | Catering and dinner events | 100 |
| Word Rally: Sport | MEDAL | Competitive days | 100 |
| Word Rally: Nature | RIVER | Outdoor and retreat events | 100 |
| Word Rally: Celebration | PARTY | End-of-event finale | 100 |
| Дума Rally: Отбор (Cyrillic) | ЕКИПИ | Bulgarian clients | 100 |

The Cyrillic entry is the template for a Bulgarian set. Build the rest of that
set only once a Bulgarian client actually asks, so the library does not fill
with unplayed games.

## Set 2 — Matching (10 puzzles)

6 pairs each.

**Capitals of Europe** — France/Paris, Portugal/Lisbon, Austria/Vienna,
Bulgaria/Sofia, Ireland/Dublin, Norway/Oslo.

**Capitals of the World** — Japan/Tokyo, Peru/Lima, Kenya/Nairobi,
Canada/Ottawa, Vietnam/Hanoi, Morocco/Rabat.

**Who Invented It** — Telephone/Bell, Lightbulb filament/Edison,
World Wide Web/Berners-Lee, Dynamite/Nobel, Printing press/Gutenberg,
Polio vaccine/Salk.

**Animal Groups** — Crows/Murder, Lions/Pride, Geese/Gaggle, Fish/School,
Wolves/Pack, Owls/Parliament.

**Office Jargon Decoder** — "Circle back"/Talk again later,
"Low-hanging fruit"/Easy win, "Bandwidth"/Spare time,
"Touch base"/Quick catch-up, "Deep dive"/Detailed look,
"Move the needle"/Make real progress.

**Units and Measures** — Distance/Metre, Force/Newton, Power/Watt,
Frequency/Hertz, Pressure/Pascal, Energy/Joule.

**Landmarks to Cities** — Colosseum/Rome, Acropolis/Athens,
Sagrada Familia/Barcelona, Charles Bridge/Prague, Little Mermaid/Copenhagen,
Atomium/Brussels.

**Film Taglines** — Six original, non-quoted descriptions written in-house.
Do not paste real taglines; they are copyrighted. Describe the premise instead.

**Sports and Their Terms** — Tennis/Deuce, Golf/Birdie, Cricket/Googly,
Basketball/Alley-oop, Fencing/Riposte, Rowing/Coxswain.

**Team Roles** — Six role names paired with plain-English descriptions, written
in-house so it works as an icebreaker rather than a knowledge test.

## Set 3 — Crossword (6 puzzles)

Each is a 6x6 grid built in the editor. Word banks below; exact placement is
done in the editor because it auto-detects runs and forces a clue on each.

| Game name | Word bank | Theme |
|---|---|---|
| Grid Rally: Office Life | DESK, EMAIL, TEAM, MEET, NOTE, CHAIR | Workplace |
| Grid Rally: On Tour | MAP, TRAIN, HOTEL, PACK, GATE, TOUR | Travel and offsites |
| Grid Rally: Kitchen | OVEN, SALT, RICE, PAN, HERB, CHEF | Catering and dinner |
| Grid Rally: Outdoors | TENT, PATH, LAKE, MOSS, HILL, CAMP | Retreats |
| Grid Rally: Music | DRUM, BASS, SONG, TUNE, BAND, NOTE | Pairs with music bingo |
| Grid Rally: Celebration | CAKE, TOAST, GIFT, DANCE, HOST, CHEER | Finale slot |

Words are deliberately short and common. A 6x6 grid with obscure vocabulary is
unsolvable inside the 5-minute full-points window.

## Build order

1. Wordle set. Fastest to produce, no layout work, immediately playable.
2. Matching set. Content is written above; only needs entering.
3. Crossword set. Slowest, needs grid layout per puzzle in the editor.
4. Covers, once the content above is approved. Prompts live in
   `GAME-COVER-PROMPTS.md`.
5. Mark all of them `is_platform_template = true` so client orgs can install them.

## Open question for Rumen

Ruled-out letters on the Wordle keyboard are currently **disabled**, not just
greyed. Real Wordle lets you type them anyway. It is safe (a letter only locks
once every occurrence has come back grey) but it is a deliberate deviation from
what players expect. Confirm keep or change before the covers are made.
