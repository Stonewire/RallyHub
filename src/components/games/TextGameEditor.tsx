import { Plus, Trash2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'

import { FlipSwitch } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { newGameId } from '@/lib/game-upload'
import type { GameConfig, QuizAnswer, TextAnswerMode } from '@/types/game-config'

function defaultOptions(): QuizAnswer[] {
  const a1 = { id: newGameId(), text: 'Answer 1' }
  const a2 = { id: newGameId(), text: 'Answer 2' }
  return [a1, a2]
}

export function TextGameEditor({
  config,
  setConfig,
  judged = false,
}: {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
  /** Range points mean a facilitator scores the answer, so nothing is required. */
  judged?: boolean
}) {
  const mode: TextAnswerMode = config.text_answer_mode ?? 'type_text'
  const correctAnswers = config.text_correct_answers ?? ['']
  const options = config.text_options ?? defaultOptions()
  const correctAnswerId =
    config.text_correct_answer_id ?? options[0]?.id ?? ''

  function setMode(next: TextAnswerMode) {
    setConfig((c) => {
      const opts = c.text_options ?? defaultOptions()
      return {
        ...c,
        text_answer_mode: next,
        text_correct_answers: c.text_correct_answers ?? [''],
        text_options: opts,
        text_correct_answer_id: c.text_correct_answer_id ?? opts[0]?.id,
      }
    })
  }

  return (
    <Card className="border-border/80 space-y-5 bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start gap-8">
        <FlipSwitch
          caption="Game style"
          offValue="type_text"
          onValue="choose_answer"
          offLabel="Type"
          onLabel="Choose"
          value={mode}
          onChange={(next) => setMode(next)}
        />
        <FlipSwitch
          caption="Approval"
          offValue="auto"
          onValue="review"
          offLabel="Auto"
          onLabel="Review"
          value={config.text_approval_mode === 'auto' ? 'auto' : 'review'}
          onChange={(next) =>
            setConfig((c) => ({ ...c, text_approval_mode: next }))
          }
        />
      </div>
      <p className="text-muted-foreground text-xs">
        {config.text_approval_mode === 'auto'
          ? 'Auto: answers are checked and scored the moment a team submits. An exact match scores the full points, anything else scores zero.'
          : 'Review: every answer waits for a facilitator to score it.'}
      </p>

      {mode === 'type_text' ? (
        <div className="space-y-3">
          <div>
            <Label>{judged ? 'Answer notes (optional)' : 'Correct answers'}</Label>
            <p className="text-muted-foreground mt-1 text-xs">
              {judged
                ? 'This game is judged: teams type a free answer and the facilitator awards points inside the range. Anything you add here is shown to the facilitator as a guide, not checked automatically.'
                : 'Teams type their answer. Capital letters, lowercase, numbers, and symbols must match exactly when the facilitator checks submissions.'}
            </p>
          </div>
          {correctAnswers.map((answer, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={answer}
                placeholder={`Correct answer ${i + 1}`}
                onChange={(e) =>
                  setConfig((c) => {
                    const list = [...(c.text_correct_answers ?? [''])]
                    list[i] = e.target.value
                    return { ...c, text_correct_answers: list }
                  })
                }
                className="bg-background"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={correctAnswers.length <= 1}
                onClick={() =>
                  setConfig((c) => {
                    const list = [...(c.text_correct_answers ?? [''])]
                    list.splice(i, 1)
                    return { ...c, text_correct_answers: list }
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setConfig((c) => ({
                ...c,
                text_correct_answers: [...(c.text_correct_answers ?? ['']), ''],
              }))
            }
          >
            <Plus className="mr-1 size-4" />
            Add answer
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label>Answer options (2–6)</Label>
            <p className="text-muted-foreground mt-1 text-xs">
              Teams pick one option. Mark the correct answer for facilitator reference.
            </p>
          </div>
          {options.map((opt, i) => (
            <div key={opt.id} className="flex items-center gap-2">
              <input
                type="radio"
                name="text-correct-answer"
                checked={correctAnswerId === opt.id}
                onChange={() =>
                  setConfig((c) => ({ ...c, text_correct_answer_id: opt.id }))
                }
              />
              <Input
                value={opt.text}
                placeholder={`Option ${i + 1}`}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    text_options: (c.text_options ?? options).map((o) =>
                      o.id === opt.id ? { ...o, text: e.target.value } : o,
                    ),
                  }))
                }
                className="bg-background"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={options.length <= 2}
                onClick={() =>
                  setConfig((c) => {
                    const list = [...(c.text_options ?? options)]
                    const idx = list.findIndex((o) => o.id === opt.id)
                    if (idx < 0) return c
                    list.splice(idx, 1)
                    const nextCorrect =
                      c.text_correct_answer_id === opt.id
                        ? list[0]?.id ?? ''
                        : c.text_correct_answer_id
                    return {
                      ...c,
                      text_options: list,
                      text_correct_answer_id: nextCorrect,
                    }
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {options.length < 6 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setConfig((c) => ({
                  ...c,
                  text_options: [
                    ...(c.text_options ?? options),
                    { id: newGameId(), text: `Option ${options.length + 1}` },
                  ],
                }))
              }
            >
              <Plus className="mr-1 size-4" />
              Add option
            </Button>
          ) : null}
        </div>
      )}
    </Card>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- validation helper for TextGameEditor's config shape
export function validateTextGameConfig(
  config: GameConfig,
  /** Range points mean the facilitator scores the answer, so nothing is required. */
  judged = false,
): string | null {
  const mode = config.text_answer_mode ?? 'type_text'
  if (mode === 'type_text') {
    if (judged) return null
    const answers = (config.text_correct_answers ?? []).filter((a) => a.length > 0)
    if (answers.length === 0) return 'Add at least one correct answer.'
    return null
  }
  const options = config.text_options ?? []
  if (options.length < 2 || options.length > 6) {
    return 'Choose-answer games need between 2 and 6 options.'
  }
  if (options.some((o) => !o.text.trim())) {
    return 'Every answer option needs text.'
  }
  // A judged game still needs its options (they are what the team picks from),
  // but there is no right answer to mark.
  if (judged) return null
  if (!config.text_correct_answer_id) {
    return 'Mark the correct answer option.'
  }
  if (!options.some((o) => o.id === config.text_correct_answer_id)) {
    return 'Mark the correct answer option.'
  }
  return null
}
