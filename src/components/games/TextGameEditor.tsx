import { IconPlus, IconTrash } from '@/components/icons'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'

import { SegmentedPill } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { newGameId } from '@/lib/game-upload'
import type { GameConfig, QuizAnswer, TextAnswerMode } from '@/types/game-config'

/** Four to start; the editor caps additions at MAX_OPTIONS. */
function defaultOptions(): QuizAnswer[] {
  return [1, 2, 3, 4].map((n) => ({ id: newGameId(), text: `Answer ${n}` }))
}

const MAX_OPTIONS = 6

export function TextGameEditor({
  config,
  setConfig,
  judged = false,
  section = 'designer',
}: {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
  /** Range points mean a facilitator scores the answer, so nothing is required. */
  judged?: boolean
  /** 'settings' renders the mode pills; 'designer' renders the answer editor. */
  section?: 'settings' | 'designer'
}) {
  const { t } = useTranslation('admin')
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

  // Rendered in two pieces: the mode pills sit in Primary settings on the left,
  // the answer editor in the Game designer card on the right.
  if (section === 'settings') {
    return (
      <div className="border-border mt-2 space-y-4 border-t pt-4">
        <div className="flex w-full items-center gap-3">
          <Label className="w-24 shrink-0">{t('games.gameStyle')}</Label>
          <SegmentedPill
            size="sm"
            className="flex-1"
            aria-label={t('games.gameStyle')}
            options={[
              { value: 'type_text', label: t('games.gameStyleTyping') },
              { value: 'choose_answer', label: t('games.gameStyleSelection') },
            ]}
            value={mode}
            onChange={(next) => setMode(next as typeof mode)}
          />
        </div>
        <div className="flex w-full items-center gap-3">
          <Label className="w-24 shrink-0">{t('games.approval')}</Label>
          <SegmentedPill
            size="sm"
            className="flex-1"
            aria-label={t('games.approval')}
            options={[
              { value: 'auto', label: t('games.approvalAuto') },
              { value: 'review', label: t('games.approvalReview') },
            ]}
            value={config.text_approval_mode === 'auto' ? 'auto' : 'review'}
            onChange={(next) =>
              setConfig((c) => ({ ...c, text_approval_mode: next as 'auto' | 'review' }))
            }
          />
        </div>
        <p className="text-muted-foreground text-xs">
          {config.text_approval_mode === 'auto'
            ? t('games.approvalAutoHint')
            : t('games.approvalReviewHint')}
        </p>
      </div>
    )
  }

  return (
    <>
      {mode === 'type_text' ? (
        <div className="space-y-3">
          <div>
            <Label>{judged ? t('games.answerNotes') : t('games.correctAnswers')}</Label>
            <p className="text-muted-foreground mt-1 text-xs">
              {judged ? t('games.answerNotesHint') : t('games.correctAnswersHint')}
            </p>
          </div>
          {correctAnswers.map((answer, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={answer}
                placeholder={t('games.correctAnswerPlaceholder', { index: i + 1 })}
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
                <IconTrash className="size-4" />
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
            <IconPlus className="mr-1 size-4" />
            {t('games.addAnswer')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label>{t('games.answerOptions')}</Label>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('games.answerOptionsHint')}
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
                placeholder={t('games.optionPlaceholder', { index: i + 1 })}
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
                <IconTrash className="size-4" />
              </Button>
            </div>
          ))}
          {options.length < MAX_OPTIONS ? (
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
              <IconPlus className="mr-1 size-4" />
              {t('games.addOption')}
            </Button>
          ) : null}
        </div>
      )}
    </>
  )
}

/** Returns an admin-namespace translation key for the first problem, or null. */
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
    if (answers.length === 0) return 'games.validation.addCorrectAnswer'
    return null
  }
  const options = config.text_options ?? []
  if (options.length < 2 || options.length > 6) {
    return 'games.validation.optionsRange'
  }
  if (options.some((o) => !o.text.trim())) {
    return 'games.validation.optionNeedsText'
  }
  // A judged game still needs its options (they are what the team picks from),
  // but there is no right answer to mark.
  if (judged) return null
  if (!config.text_correct_answer_id) {
    return 'games.validation.markCorrectOption'
  }
  if (!options.some((o) => o.id === config.text_correct_answer_id)) {
    return 'games.validation.markCorrectOption'
  }
  return null
}
