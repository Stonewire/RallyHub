import { IconChevronDown, IconGrip, IconPlus, IconTrash } from '@/components/icons'
import { useState, type Dispatch, type SetStateAction } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SegmentedPill } from '@/components/neo-minimal'
import { mediaAccept, questionMedia } from '@/lib/quiz-media'
import type { GameConfig, QuizQuestion, QuizRound, QuizMediaKind } from '@/types/game-config'

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
  onUploadMedia,
  dragProps,
}: {
  q: QuizQuestion
  index: number
  onUpdate: (patch: Partial<QuizQuestion>) => void
  onRemove: () => void
  onUploadMedia: (file: File) => Promise<string>
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
          {dragProps ? <IconGrip className="size-4 shrink-0 cursor-grab" /> : null}
          Question {index + 1}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove}>
          <IconTrash className="size-4" />
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
      <QuestionMedia q={q} onUpdate={onUpdate} onUploadMedia={onUploadMedia} />
    </Card>
  )
}


/**
 * What a question carries besides its text.
 *
 * Photo and audio are uploaded, video is a YouTube link, but all three end up as
 * a URL, so the pill only changes how the field is filled in. Switching kind
 * clears the old URL, since an image link is not an audio clip.
 */
function QuestionMedia({
  q,
  onUpdate,
  onUploadMedia,
}: {
  q: QuizQuestion
  onUpdate: (patch: Partial<QuizQuestion>) => void
  onUploadMedia: (file: File) => Promise<string>
}) {
  const { kind, url } = questionMedia(q)
  const [busy, setBusy] = useState(false)

  /** Length of an uploaded clip, so the question's timer can allow for it. */
  function measureDuration(file: File): Promise<number | null> {
    return new Promise((resolve) => {
      const element = document.createElement(kind === 'audio' ? 'audio' : 'video')
      const objectUrl = URL.createObjectURL(file)
      element.preload = 'metadata'
      element.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(Number.isFinite(element.duration) ? Math.ceil(element.duration) : null)
      }
      element.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(null)
      }
      element.src = objectUrl
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Label className="shrink-0 text-xs">Attach</Label>
        <SegmentedPill
          size="sm"
          className="w-64"
          aria-label={`Media for question ${q.text || 'question'}`}
          options={[
            { value: 'none', label: 'None' },
            { value: 'photo', label: 'Photo' },
            { value: 'video', label: 'Video' },
            { value: 'audio', label: 'Audio' },
          ]}
          value={kind}
          onChange={(next) =>
            onUpdate({
              mediaKind: next as QuizMediaKind,
              mediaUrl: null,
              // photoUrl is the legacy field; clearing it stops an old image
              // reappearing once the kind changes.
              photoUrl: null,
            })
          }
        />
      </div>

      {kind === 'video' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={url ?? ''}
            placeholder="https://youtube.com/…"
            className="bg-background min-w-0 flex-1"
            onChange={(event) => onUpdate({ mediaUrl: event.target.value.trim() || null })}
          />
          {/* A linked video cannot be measured from here, and the question's
              timer adds this on so teams are not watching on their own time. */}
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-xs">Length</Label>
            <Input
              type="number"
              min={0}
              value={q.mediaDurationSeconds ?? ''}
              placeholder="sec"
              className="bg-background w-20"
              onChange={(event) =>
                onUpdate({
                  mediaDurationSeconds: event.target.value
                    ? Math.max(0, Number(event.target.value))
                    : null,
                })
              }
            />
          </div>
        </div>
      ) : kind !== 'none' ? (
        <Input
          type="file"
          accept={mediaAccept(kind)}
          disabled={busy}
          className="max-w-xs"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            setBusy(true)
            try {
              const [mediaUrl, mediaDurationSeconds] = await Promise.all([
                onUploadMedia(file),
                measureDuration(file),
              ])
              onUpdate({ mediaUrl, mediaDurationSeconds })
            } finally {
              setBusy(false)
            }
          }}
        />
      ) : null}

      {url && kind === 'photo' ? (
        <img src={url} alt="" className="max-h-32 rounded-lg object-contain" />
      ) : null}
      {url && kind === 'audio' ? <audio src={url} controls className="h-8 w-full max-w-xs" /> : null}
      {url && kind === 'video' ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-primary block text-xs underline"
        >
          Open the video to check it
        </a>
      ) : null}
    </div>
  )
}

type QuizEditorProps = {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
  onUploadQuestionPhoto: (questionId: string, file: File) => Promise<string>
  /**
   * Raised by a round's delete button. The parent decides what happens to the
   * questions first, so this component never destroys them itself.
   */
  onDeleteRound?: (roundId: string) => void
}

export function QuizEditor({
  config,
  setConfig,
  onUploadQuestionPhoto,
  onDeleteRound,
}: QuizEditorProps) {
  const questions = config.questions ?? []
  const rounds = config.rounds ?? []
  // Rounds start closed: a quiz with several rounds is unreadable otherwise.
  const [collapsedRounds, setCollapsedRounds] = useState<Record<string, boolean>>({})
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [dragQuestionId, setDragQuestionId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    roundId: string | null
    index: number
  } | null>(null)


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


  function toggleQuestionSelected(id: string) {
    setSelectedQuestions((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectedIn(roundId: string) {
    return questions.filter((q) => q.roundId === roundId && selectedQuestions.has(q.id))
  }

  function deleteSelected(roundId: string) {
    const ids = new Set(selectedIn(roundId).map((q) => q.id))
    if (ids.size === 0) return
    setConfig((c) => ({
      ...c,
      questions: (c.questions ?? []).filter((q) => !ids.has(q.id)),
      rounds: (c.rounds ?? []).map((r) => ({
        ...r,
        questionIds: r.questionIds.filter((qid) => !ids.has(qid)),
      })),
    }))
    setSelectedQuestions(new Set())
  }

  /**
   * Duplicate rather than copy: each clone needs its own id, and its answers do
   * too, or editing one would edit the other.
   */
  function duplicateSelected(roundId: string) {
    const chosen = selectedIn(roundId)
    if (chosen.length === 0) return
    const clones = chosen.map((q) => ({
      ...q,
      id: newId(),
      answers: q.answers.map((a) => ({ ...a, id: newId() })),
    }))
    // correctAnswerId points at an old answer id, so remap it per clone.
    clones.forEach((clone, index) => {
      const source = chosen[index]
      const position = source.answers.findIndex((a) => a.id === source.correctAnswerId)
      clone.correctAnswerId = position >= 0 ? clone.answers[position].id : ''
    })
    setConfig((c) => ({
      ...c,
      questions: [...(c.questions ?? []), ...clones],
      rounds: (c.rounds ?? []).map((r) =>
        r.id === roundId
          ? { ...r, questionIds: [...r.questionIds, ...clones.map((q) => q.id)] }
          : r,
      ),
    }))
    setSelectedQuestions(new Set())
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
            /* The list parts as a question passes: the row being dragged fades
               and a gap opens where it would land, so the destination is
               visible before the drop rather than only after it. */
            className={[
              'transition-[margin,opacity] duration-150',
              dragQuestionId === q.id ? 'opacity-40' : '',
              dropTarget?.roundId === roundId && dropTarget.index === i && dragQuestionId !== q.id
                ? 'mt-10'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onDragOver={(e) => {
              e.preventDefault()
              // Past the halfway line the gap belongs after this row, which is
              // what makes dragging downwards land where the pointer is.
              const box = e.currentTarget.getBoundingClientRect()
              const after = e.clientY - box.top > box.height / 2
              setDropTarget({ roundId, index: after ? i + 1 : i })
            }}
            onDrop={(e) => {
              e.preventDefault()
              handleDrop(roundId, dropTarget?.index ?? i)
            }}
          >
            <label className="mb-1 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={selectedQuestions.has(q.id)}
                onChange={() => toggleQuestionSelected(q.id)}
                aria-label={`Select question ${i + 1}`}
              />
              <span className="text-muted-foreground">Select</span>
            </label>
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
              onUploadMedia={(file) => onUploadQuestionPhoto(q.id, file)}
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
              ? 'ring-[#FFC107]/50 rounded-lg ring-2'
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
            <IconPlus className="size-4" />
            New question
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {config.rounds_enabled ? (
        <div className="space-y-8">
          {/* No Add round button: rounds come from the count in Primary
              settings, so there is one place that decides how many there are. */}
          {(rounds.length ? rounds : [{ id: newId(), name: 'Round 1', questionIds: [] }]).map(
            (round, roundIndex) => {
              const collapsed = collapsedRounds[round.id] ?? true
              const count = questions.filter((q) => q.roundId === round.id).length
              return (
                <Card key={round.id} className="border-border/80 space-y-4 bg-card p-5 shadow-sm">
                  {/* One line: which round it is, what it is called, what you can
                      do to it. The placeholder carries the instruction, so the
                      row needs no label of its own. */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      aria-expanded={!collapsed}
                      aria-label={`${collapsed ? 'Expand' : 'Collapse'} round ${roundIndex + 1}`}
                      onClick={() =>
                        setCollapsedRounds((current) => ({
                          ...current,
                          [round.id]: !collapsed,
                        }))
                      }
                      className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1.5 text-sm font-bold"
                    >
                      <IconChevronDown
                        className={`size-4 transition-transform ${collapsed ? '-rotate-90' : ''}`}
                      />
                      Round {roundIndex + 1}
                    </button>
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
                      placeholder="Enter a name for this round"
                      className="bg-background h-9 min-w-0 flex-1"
                    />
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {count} question{count === 1 ? '' : 's'}
                    </span>
                    {/* Bulk actions appear only with a selection, so the header
                        stays quiet until there is something to act on. */}
                    {!collapsed && count > 0 ? (
                      <label className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          aria-label={`Select every question in round ${roundIndex + 1}`}
                          checked={selectedIn(round.id).length === count}
                          onChange={(event) =>
                            setSelectedQuestions((current) => {
                              const next = new Set(current)
                              for (const q of questions.filter((x) => x.roundId === round.id)) {
                                if (event.target.checked) next.add(q.id)
                                else next.delete(q.id)
                              }
                              return next
                            })
                          }
                        />
                        Select all
                      </label>
                    ) : null}
                    {selectedIn(round.id).length > 0 ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => duplicateSelected(round.id)}
                        >
                          Duplicate {selectedIn(round.id).length}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-destructive shrink-0"
                          onClick={() => deleteSelected(round.id)}
                        >
                          Delete {selectedIn(round.id).length}
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive shrink-0"
                      aria-label={`Delete round ${roundIndex + 1}`}
                      onClick={() => onDeleteRound?.(round.id)}
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                  {collapsed ? null : renderQuestionList(round.id, undefined)}
                </Card>
              )
            },
          )}
        </div>
      ) : (
        renderQuestionList(null)
      )}
    </div>
  )
}
