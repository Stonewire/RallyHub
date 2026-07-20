import { Grid3X3, Plus, Puzzle, Rows3, Trash2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'

import { CrosswordEditor } from '@/components/games/CrosswordEditor'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { newMatchingPair, puzzleType, validatePuzzleConfig } from '@/lib/puzzle-engine'
import type { GameConfig, PuzzleType } from '@/types/game-config'

const SUBTYPES: {
  type: PuzzleType
  name: string
  description: string
  icon: typeof Grid3X3
  upcoming?: boolean
}[] = [
  {
    type: 'wordle',
    name: 'Wordle',
    description: 'Teams guess your word. Fewer guesses earn more points.',
    icon: Grid3X3,
  },
  {
    type: 'matching',
    name: 'Matching',
    description: 'Teams connect related values from two shuffled columns.',
    icon: Rows3,
  },
  {
    type: 'crossword',
    name: 'Crossword',
    description: 'Build a 6x6 crossword. Faster solves earn more points.',
    icon: Puzzle,
  },
]

export function PuzzleEditor({
  config,
  setConfig,
}: {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
}) {
  const selected = puzzleType(config)
  const pairs = config.puzzle_matching_pairs ?? [
    newMatchingPair('France', 'Paris'),
    newMatchingPair('Italy', 'Rome'),
  ]

  function selectSubtype(type: PuzzleType) {
    setConfig((current) => ({
      ...current,
      puzzle_type: type,
      puzzle_wordle_answer: current.puzzle_wordle_answer ?? 'TEAM',
      puzzle_matching_pairs:
        current.puzzle_matching_pairs ?? [newMatchingPair(), newMatchingPair()],
      puzzle_crossword_words: current.puzzle_crossword_words ?? [],
    }))
  }

  return (
    <Card className="border-border/80 space-y-6 bg-card p-6 shadow-sm">
      <div>
        <Label>Puzzle type</Label>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {SUBTYPES.map(({ type, name, description, icon: Icon, upcoming }) => {
            const active = selected === type && !upcoming
            return (
              <button
                key={type}
                type="button"
                disabled={upcoming}
                onClick={() => selectSubtype(type)}
                className={`relative rounded-xl border p-4 text-left transition-colors ${
                  active
                    ? 'border-[#FFC107] bg-[#FFC107]/10'
                    : 'border-border/80 bg-background hover:border-[#FFC107]/60'
                } disabled:cursor-not-allowed disabled:opacity-65`}
              >
                {upcoming ? (
                  <span className="absolute top-2 right-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                    Upcoming
                  </span>
                ) : null}
                <Icon className="mb-3 size-6" />
                <p className="font-semibold">{name}</p>
                <p className="text-muted-foreground mt-1 text-xs">{description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {selected === 'wordle' ? (
        <div className="space-y-3">
          <div>
            <Label htmlFor="puzzle-wordle-answer">Answer</Label>
            <p className="text-muted-foreground mt-1 text-xs">
              One word, 3–12 letters. Teams can guess as many times as they need.
            </p>
          </div>
          <Input
            id="puzzle-wordle-answer"
            value={config.puzzle_wordle_answer ?? ''}
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
            className="max-w-sm bg-background text-lg font-bold uppercase tracking-[0.2em]"
            placeholder="TEAM"
            onChange={(event) =>
              setConfig((current) => ({
                ...current,
                puzzle_wordle_answer: event.target.value.replace(/[^\p{L}]/gu, '').toLocaleUpperCase(),
              }))
            }
          />
          <p className="text-muted-foreground text-xs">
            {Array.from(config.puzzle_wordle_answer ?? '').length || 0} letters · first guess earns
            the maximum, then each extra guess removes 10% of the remaining score.
          </p>
        </div>
      ) : null}

      {selected === 'matching' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Label>Matching pairs</Label>
              <p className="text-muted-foreground mt-1 text-xs">
                Add 2–12 pairs. Each incorrect match costs 5% of the maximum score.
              </p>
            </div>
            {pairs.length < 12 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setConfig((current) => ({
                    ...current,
                    puzzle_matching_pairs: [
                      ...(current.puzzle_matching_pairs ?? pairs),
                      newMatchingPair(),
                    ],
                  }))
                }
              >
                <Plus className="mr-1 size-4" /> Add pair
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-muted-foreground grid grid-cols-[1fr_1fr_2.5rem] gap-2 px-1 text-xs font-semibold uppercase tracking-wide">
              <span>Left</span>
              <span>Matches with</span>
              <span />
            </div>
            {pairs.map((pair, index) => (
              <div key={pair.id} className="grid grid-cols-[1fr_1fr_2.5rem] gap-2">
                <Input
                  value={pair.left}
                  maxLength={100}
                  className="bg-background"
                  placeholder={`Left ${index + 1}`}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      puzzle_matching_pairs: (current.puzzle_matching_pairs ?? pairs).map((item) =>
                        item.id === pair.id ? { ...item, left: event.target.value } : item,
                      ),
                    }))
                  }
                />
                <Input
                  value={pair.right}
                  maxLength={100}
                  className="bg-background"
                  placeholder={`Right ${index + 1}`}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      puzzle_matching_pairs: (current.puzzle_matching_pairs ?? pairs).map((item) =>
                        item.id === pair.id ? { ...item, right: event.target.value } : item,
                      ),
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={pairs.length <= 2}
                  aria-label={`Remove pair ${index + 1}`}
                  onClick={() =>
                    setConfig((current) => ({
                      ...current,
                      puzzle_matching_pairs: (current.puzzle_matching_pairs ?? pairs).filter(
                        (item) => item.id !== pair.id,
                      ),
                    }))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {selected === 'crossword' ? (
        <CrosswordEditor config={config} setConfig={setConfig} />
      ) : null}
    </Card>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- validation is shared by new/edit pages
export { validatePuzzleConfig }
