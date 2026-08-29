import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconChevronDown } from '@/components/icons'
import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { useGames } from '@/hooks/use-games'
import { copyGameFile } from '@/lib/game-upload'
import { quizQuestions } from '@/lib/live-event'
import type { QuizQuestion } from '@/types/game-config'

/**
 * Copies questions from another of the org's quizzes into the one being edited.
 *
 * Rumen writes several quizzes that share questions and was retyping them. The
 * copies are independent from the moment they land: new ids for the question
 * and every answer, a duplicated copy of any attached photo or audio, and no
 * reference back to the quiz they came from, so editing one quiz never reaches
 * into another. Round membership is dropped too (rounds belong to the quiz
 * that defined them); imported questions arrive in the round the organiser was
 * adding to.
 */
export function QuizImportQuestionsModal({
  organizationId,
  currentGameId,
  onClose,
  onImport,
}: {
  organizationId: string
  /** Omitted when the quiz has not been saved yet, so nothing is excluded. */
  currentGameId?: string | null
  onClose: () => void
  onImport: (questions: QuizQuestion[]) => void
}) {
  const { t } = useTranslation('admin')
  const gamesQuery = useGames(organizationId)
  const [openGameId, setOpenGameId] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [copying, setCopying] = useState(false)

  const quizzes = useMemo(
    () =>
      (gamesQuery.data ?? []).filter(
        (game) => game.type === 'quiz' && game.id !== currentGameId,
      ),
    [gamesQuery.data, currentGameId],
  )

  const openQuestions = useMemo(() => {
    const game = quizzes.find((g) => g.id === openGameId)
    if (!game) return []
    return quizQuestions(game)
  }, [quizzes, openGameId])

  /** Keys are scoped per source quiz, so picks survive browsing between them. */
  function keyFor(gameId: string, questionId: string) {
    return `${gameId}:${questionId}`
  }

  const pickedHere = openQuestions.filter((q) =>
    picked.has(keyFor(openGameId ?? '', q.id)),
  ).length
  const allPickedHere = openQuestions.length > 0 && pickedHere === openQuestions.length

  function toggle(questionId: string) {
    if (!openGameId) return
    const key = keyFor(openGameId, questionId)
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAll() {
    if (!openGameId) return
    setPicked((current) => {
      const next = new Set(current)
      for (const q of openQuestions) {
        const key = keyFor(openGameId, q.id)
        if (allPickedHere) next.delete(key)
        else next.add(key)
      }
      return next
    })
  }

  async function confirm() {
    setCopying(true)
    const copies: QuizQuestion[] = []
    for (const game of quizzes) {
      const questions = quizQuestions(game)
      for (const q of questions) {
        if (!picked.has(keyFor(game.id, q.id))) continue
        // Fresh ids all the way down: the copy must not share identity with
        // the original, or editing one quiz would look like editing both.
        const answers = q.answers.map((a) => ({ ...a, id: crypto.randomUUID() }))
        const correct = q.answers.findIndex((a) => a.id === q.correctAnswerId)
        const id = crypto.randomUUID()
        copies.push({
          ...q,
          id,
          answers,
          correctAnswerId: answers[correct >= 0 ? correct : 0]?.id ?? '',
          roundId: null,
          // Attached media is stored under the question id and overwritten in
          // place on re-upload, so a shared URL is not a copy. Duplicate the
          // object; if that fails, keep pointing at the original rather than
          // losing the attachment, since a shared file still plays.
          mediaUrl: q.mediaUrl
            ? await copyGameFile(q.mediaUrl, organizationId, `quiz/q-${id}`).catch(() => null) ??
              q.mediaUrl
            : q.mediaUrl,
        })
      }
    }
    setCopying(false)
    onImport(copies)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <Card className="flex max-h-[85dvh] w-full max-w-2xl flex-col gap-4 overflow-hidden p-5">
        <div>
          <h2 className="text-foreground text-lg font-bold">
            {t('games.quiz.importTitle')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('games.quiz.importSubtitle')}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {gamesQuery.isLoading ? (
            <QueryLoading />
          ) : gamesQuery.isError ? (
            <QueryError message={t('games.quiz.importLoadFailed')} />
          ) : quizzes.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('games.quiz.importNoQuizzes')}</p>
          ) : (
            <div className="space-y-2">
              {quizzes.map((game) => {
                const open = openGameId === game.id
                const questions = open ? openQuestions : []
                const count = quizQuestions(game).length
                return (
                  <div key={game.id} className="border-border/70 rounded-lg border">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                      aria-expanded={open}
                      onClick={() => setOpenGameId(open ? null : game.id)}
                    >
                      <IconChevronDown
                        className={`size-4 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
                      />
                      <span className="text-foreground flex-1 truncate text-sm font-semibold">
                        {game.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {t('games.quiz.importQuestionCount', { count })}
                      </span>
                    </button>
                    {open ? (
                      <div className="border-border/70 space-y-1 border-t px-3 py-2">
                        {questions.length === 0 ? (
                          <p className="text-muted-foreground py-1 text-sm">
                            {t('games.quiz.importQuizEmpty')}
                          </p>
                        ) : (
                          <>
                            <label className="flex cursor-pointer items-center gap-2 py-1">
                              <input
                                type="checkbox"
                                className="accent-primary size-4 rounded"
                                checked={allPickedHere}
                                onChange={toggleAll}
                              />
                              <span className="text-sm font-semibold">
                                {t('games.quiz.importSelectAll')}
                              </span>
                            </label>
                            {questions.map((q, i) => (
                              <label
                                key={q.id}
                                className="flex cursor-pointer items-start gap-2 py-1"
                              >
                                <input
                                  type="checkbox"
                                  className="accent-primary mt-0.5 size-4 rounded"
                                  checked={picked.has(keyFor(game.id, q.id))}
                                  onChange={() => toggle(q.id)}
                                />
                                <span className="text-sm">
                                  {q.text.trim() ||
                                    t('games.quiz.questionNumber', { number: i + 1 })}
                                </span>
                              </label>
                            ))}
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <NeoButton
            type="button"
            variant="accent"
            size="sm"
            disabled={picked.size === 0 || copying}
            onClick={() => void confirm()}
          >
            {t('games.quiz.importAddSelected', { count: picked.size })}
          </NeoButton>
        </div>
      </Card>
    </div>
  )
}
