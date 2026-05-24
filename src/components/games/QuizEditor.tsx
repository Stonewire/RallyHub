import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { GameConfig, QuizQuestion, QuizRound } from '@/types/game-config'

function newId() {
  return crypto.randomUUID()
}

function emptyQuestion(roundId?: string): QuizQuestion {
  const answers = [1, 2, 3, 4].map((n) => ({
    id: newId(),
    text: `Answer ${n}`,
  }))
  return {
    id: newId(),
    text: '',
    answers,
    correctAnswerId: answers[0].id,
    roundId: roundId ?? null,
  }
}

function QuestionCard({
  q,
  index,
  onUpdate,
  onRemove,
  onUploadPhoto,
  dragProps,
}: {
  q: QuizQuestion
  index: number
  onUpdate: (patch: Partial<QuizQuestion>) => void
  onRemove: () => void
  onUploadPhoto: (file: File) => void
  dragProps?: {
    draggable: boolean
    onDragStart: () => void
    onDragEnd: () => void
  }
}) {
  return (
    <Card
      className="border-border/80 space-y-3 p-4"
      draggable={dragProps?.draggable}
      onDragStart={dragProps?.onDragStart}
      onDragEnd={dragProps?.onDragEnd}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          {dragProps ? <GripVertical className="size-4 shrink-0 cursor-grab" /> : null}
          Question {index + 1}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      <Input
        placeholder="Question text"
        value={q.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        className="bg-background"
      />
      {q.answers.map((a, ai) => (
        <div key={a.id} className="flex items-center gap-2">
          <input
            type="radio"
            name={`correct-${q.id}`}
            checked={q.correctAnswerId === a.id}
            onChange={() => onUpdate({ correctAnswerId: a.id })}
          />
          <Input
            value={a.text}
            placeholder={`Answer ${ai + 1}`}
            onChange={(e) =>
              onUpdate({
                answers: q.answers.map((ans) =>
                  ans.id === a.id ? { ...ans, text: e.target.value } : ans,
                ),
              })
            }
            className="bg-background flex-1"
          />
        </div>
      ))}
      <div className="space-y-2">
        <Label className="text-xs">Question photo (optional)</Label>
        {q.photoUrl ? (
          <img src={q.photoUrl} alt="" className="size-20 rounded-lg object-cover" />
        ) : null}
        <Input
          type="file"
          accept="image/*"
          className="max-w-xs"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUploadPhoto(file)
          }}
        />
      </div>
    </Card>
  )
}

type QuizEditorProps = {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
  onUploadQuestionPhoto: (questionId: string, file: File) => Promise<void>
}

export function QuizEditor({
  config,
  setConfig,
  onUploadQuestionPhoto,
}: QuizEditorProps) {
  const questions = config.questions ?? []
  const rounds = config.rounds ?? []
  const [dragQuestionId, setDragQuestionId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    roundId: string | null
    index: number
  } | null>(null)

  const enableRounds = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        setConfig((c) => ({
          ...c,
          rounds_enabled: false,
          questions: (c.questions ?? []).map((q) => ({ ...q, roundId: null })),
        }))
        return
      }

      const round1Id = newId()
      const qs = (config.questions ?? []).map((q) => ({ ...q, roundId: round1Id }))
      setConfig((c) => ({
        ...c,
        rounds_enabled: true,
        rounds: [{ id: round1Id, name: 'Round 1', questionIds: qs.map((q) => q.id) }],
        questions: qs,
      }))
    },
    [config.questions, setConfig],
  )

  function addRound() {
    const id = newId()
    const name = `Round ${(rounds.length || 0) + 1}`
    setConfig((c) => ({
      ...c,
      rounds: [...(c.rounds ?? []), { id, name, questionIds: [] }],
    }))
  }

  function addQuestion(roundId: string | null) {
    const q = emptyQuestion(roundId ?? undefined)
    setConfig((c) => {
      const nextQuestions = [...(c.questions ?? []), q]
      const nextRounds =
        roundId && c.rounds_enabled
          ? (c.rounds ?? []).map((r) =>
              r.id === roundId
                ? { ...r, questionIds: [...r.questionIds, q.id] }
                : r,
            )
          : c.rounds
      return { ...c, questions: nextQuestions, rounds: nextRounds }
    })
  }

  function removeQuestion(id: string) {
    setConfig((c) => ({
      ...c,
      questions: (c.questions ?? []).filter((q) => q.id !== id),
      rounds: (c.rounds ?? []).map((r) => ({
        ...r,
        questionIds: r.questionIds.filter((qid) => qid !== id),
      })),
    }))
  }

  function reorderInRound(
    roundId: string | null,
    fromId: string,
    toIndex: number,
  ) {
    setConfig((c) => {
      const allQs = [...(c.questions ?? [])]
      const inRound = allQs.filter((q) =>
        roundId ? q.roundId === roundId : !q.roundId,
      )
      const fromIdx = inRound.findIndex((q) => q.id === fromId)
      if (fromIdx < 0) return c
      const [moved] = inRound.splice(fromIdx, 1)
      inRound.splice(toIndex, 0, moved)

      const other = allQs.filter((q) =>
        roundId ? q.roundId !== roundId : Boolean(q.roundId),
      )
      const merged = roundId
        ? [...other, ...inRound]
        : [...inRound, ...other.filter((q) => q.roundId)]

      const rounds: QuizRound[] = (c.rounds ?? []).map((r) =>
        r.id === roundId
          ? { ...r, questionIds: inRound.map((q) => q.id) }
          : r,
      )

      return { ...c, questions: merged, rounds }
    })
  }

  function moveQuestionToRound(questionId: string, targetRoundId: string | null) {
    setConfig((c) => {
      const qs = (c.questions ?? []).map((q) =>
        q.id === questionId ? { ...q, roundId: targetRoundId } : q,
      )
      const rounds = (c.rounds ?? []).map((r) => ({
        ...r,
        questionIds: qs.filter((q) => q.roundId === r.id).map((q) => q.id),
      }))
      return { ...c, questions: qs, rounds }
    })
  }

  function handleDrop(roundId: string | null, toIndex: number) {
    if (!dragQuestionId) return
    const q = questions.find((x) => x.id === dragQuestionId)
    if (!q) return
    if (q.roundId !== roundId) {
      moveQuestionToRound(dragQuestionId, roundId)
    }
    reorderInRound(roundId, dragQuestionId, toIndex)
    setDragQuestionId(null)
    setDropTarget(null)
  }

  function renderQuestionList(roundId: string | null, title?: string) {
    const list = questions.filter((q) =>
      roundId ? q.roundId === roundId : !q.roundId,
    )

    return (
      <div className="space-y-3">
        {title ? (
          <h4 className="text-foreground text-sm font-semibold">{title}</h4>
        ) : null}
        {list.map((q, i) => (
          <div
            key={q.id}
            onDragOver={(e) => {
              e.preventDefault()
              setDropTarget({ roundId, index: i })
            }}
            onDrop={(e) => {
              e.preventDefault()
              handleDrop(roundId, i)
            }}
          >
            <QuestionCard
              q={q}
              index={i}
              onUpdate={(patch) =>
                setConfig((c) => ({
                  ...c,
                  questions: (c.questions ?? []).map((x) =>
                    x.id === q.id ? { ...x, ...patch } : x,
                  ),
                }))
              }
              onRemove={() => removeQuestion(q.id)}
              onUploadPhoto={(file) => void onUploadQuestionPhoto(q.id, file)}
              dragProps={{
                draggable: true,
                onDragStart: () => setDragQuestionId(q.id),
                onDragEnd: () => {
                  setDragQuestionId(null)
                  setDropTarget(null)
                },
              }}
            />
          </div>
        ))}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDropTarget({ roundId, index: list.length })
          }}
          onDrop={(e) => {
            e.preventDefault()
            handleDrop(roundId, list.length)
          }}
          className={
            dropTarget?.roundId === roundId && dropTarget.index === list.length
              ? 'ring-[#FFCB03]/50 rounded-lg ring-2'
              : ''
          }
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => addQuestion(roundId)}
          >
            <Plus className="size-4" />
            New question
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>General timer (seconds)</Label>
        <Input
          type="number"
          value={config.timer_seconds ?? 20}
          onChange={(e) =>
            setConfig((c) => ({ ...c, timer_seconds: Number(e.target.value) }))
          }
          className="bg-background max-w-[8rem]"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={Boolean(config.rounds_enabled)}
          onChange={(e) => enableRounds(e.target.checked)}
        />
        Enable rounds
      </label>

      {config.rounds_enabled ? (
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addRound}>
              <Plus className="size-4" />
              Add round
            </Button>
          </div>
          {(rounds.length ? rounds : [{ id: newId(), name: 'Round 1', questionIds: [] }]).map(
            (round) => (
              <Card key={round.id} className="border-border/80 space-y-4 bg-card p-5 shadow-sm">
                <Input
                  value={round.name}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      rounds: (c.rounds ?? []).map((r) =>
                        r.id === round.id ? { ...r, name: e.target.value } : r,
                      ),
                    }))
                  }
                  className="bg-background max-w-xs font-semibold"
                />
                {renderQuestionList(round.id, undefined)}
              </Card>
            ),
          )}
        </div>
      ) : (
        renderQuestionList(null)
      )}
    </div>
  )
}
