import { Check, Pause, Play, Plus, Minus, RotateCcw, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { DisplayPreviewFrame } from '@/components/live/DisplayPreviewFrame'
import { LivePanelShell } from '@/components/layout/LivePanelShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { useLiveTimer } from '@/hooks/use-live-timer'
import { useFacilitatorPresence, useLiveEvent } from '@/hooks/use-live-event'
import {
  FACILITATOR_NAME_KEY,
  bingoTracks,
  currentStage,
  breakDurationSeconds,
  formatBreakTimer,
  formatTimer,
  parseStages,
  quizQuestions,
} from '@/lib/live-event'
import { getEventLinks } from '@/lib/event-links'
import { createThrottledTimerSync } from '@/lib/live-timer-sync'
import type { GameConfig } from '@/types/game-config'
import { supabase } from '@/lib/supabase'
import { uploadAsset } from '@/lib/storage'
import type { Tables } from '@/types/helpers'

const ANNOUNCEMENT_MS = 60_000

export function FacilitatorEventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [name, setName] = useState(() => localStorage.getItem(FACILITATOR_NAME_KEY) ?? '')
  const [namePrompt, setNamePrompt] = useState(!localStorage.getItem(FACILITATOR_NAME_KEY))
  const { bundle, loading, error, updateState, updateTeam } = useLiveEvent(eventId)
  const others = useFacilitatorPresence(eventId, name || null)
  const annClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [announcement, setAnnouncement] = useState('')
  const [claimSlot, setClaimSlot] = useState<Tables<'teams'> | null>(null)
  const [claimName, setClaimName] = useState('')
  const [claimPhoto, setClaimPhoto] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [subTab, setSubTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [stateError, setStateError] = useState<string | null>(null)

  const stages = useMemo(
    () => (bundle ? parseStages(bundle.event.stages_config) : []),
    [bundle],
  )
  const stage = bundle ? currentStage(stages, bundle.state.current_stage_index) : null
  const state = bundle?.state

  const isQuizStage = stage?.type === 'quiz'

  async function patchState(patch: Parameters<typeof updateState>[0]) {
    try {
      setStateError(null)
      await updateState(patch)
    } catch (err) {
      setStateError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  function selectStage(index: number) {
    const next = stages[index]
    const patch: Parameters<typeof updateState>[0] = {
      current_stage_index: index,
    }
    if (next?.type === 'break') {
      patch.break_timer_seconds = breakDurationSeconds(next, null)
      patch.break_timer_running = false
    }
    void patchState(patch)
  }

  const timerSyncRef = useRef(
    createThrottledTimerSync((next, stillRunning) => {
      void patchState({ timer_seconds: next, timer_running: stillRunning })
    }),
  )

  const breakSyncRef = useRef(
    createThrottledTimerSync((next, stillRunning) => {
      void patchState({
        break_timer_seconds: next,
        break_timer_running: stillRunning,
      })
    }),
  )

  const timerDisplay = useLiveTimer(
    state?.timer_seconds ?? 0,
    Boolean(state?.timer_running),
    (next, stillRunning) => timerSyncRef.current(next, stillRunning),
  )

  const breakSeconds =
    stage?.type === 'break'
      ? breakDurationSeconds(stage, state?.break_timer_seconds)
      : (state?.break_timer_seconds ?? 0)

  const breakDisplay = useLiveTimer(
    breakSeconds,
    Boolean(state?.break_timer_running),
    (next, stillRunning) => breakSyncRef.current(next, stillRunning),
  )

  if (namePrompt) {
    return (
      <LivePanelShell title="Facilitator" titleCentered>
        <Card className="border-border/80 mx-auto w-full max-w-sm space-y-4 bg-card p-6 shadow-sm">
          <Label htmlFor="facilitator-name">Your name</Label>
          <Input
            id="facilitator-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-background"
          />
          <Button
            disabled={!name.trim()}
            onClick={() => {
              localStorage.setItem(FACILITATOR_NAME_KEY, name.trim())
              setNamePrompt(false)
            }}
          >
            Continue
          </Button>
        </Card>
      </LivePanelShell>
    )
  }

  if (loading || !bundle || !state) {
    return (
      <LivePanelShell title="Facilitator" titleCentered>
        <p className="text-muted-foreground text-center text-sm">
          {loading ? 'Loading…' : (error ?? 'Event not found')}
        </p>
      </LivePanelShell>
    )
  }

  const { event, organization, teams, games, submissions } = bundle
  const displayUrl = eventId
    ? getEventLinks(eventId, organization).display
    : ''

  const filteredSubs = submissions.filter((s) => {
    if (subTab === 'all') return true
    return s.status === subTab
  })

  async function clearAnnouncement() {
    if (annClearRef.current) {
      window.clearTimeout(annClearRef.current)
      annClearRef.current = null
    }
    await patchState({ announcement: null, announcement_target: null })
  }

  function sendAnnouncement(target: 'display' | 'participants' | 'both') {
    if (annClearRef.current) window.clearTimeout(annClearRef.current)
    void patchState({
      announcement,
      announcement_target: target,
      updated_at: new Date().toISOString(),
    })
    annClearRef.current = window.setTimeout(() => {
      void clearAnnouncement()
    }, ANNOUNCEMENT_MS)
  }

  async function approveSubmission(sub: Tables<'submissions'>) {
    const game = games.find((g) => g.id === sub.game_id)
    if (!game) return
    let points = game.points_static ?? 0
    if (game.points_type === 'range') {
      const raw = window.prompt(
        `Points (${game.points_min}–${game.points_max})`,
        String(game.points_max ?? 0),
      )
      if (raw == null) return
      points = Number(raw)
    }
    await supabase
      .from('submissions')
      .update({ status: 'approved', points_awarded: points })
      .eq('id', sub.id)
    const team = teams.find((t) => t.id === sub.team_id)
    if (team) {
      await updateTeam(sub.team_id, { score: team.score + points })
    }
  }

  async function rejectSubmission(id: string) {
    await supabase.from('submissions').update({ status: 'rejected' }).eq('id', id)
  }

  async function saveClaim() {
    if (!claimSlot) return
    setUploading(true)
    try {
      let photoUrl: string | null = claimSlot.photo_url
      if (claimPhoto && eventId) {
        photoUrl = await uploadAsset(
          'game-assets',
          `${eventId}/teams/${claimSlot.id}/${Date.now()}`,
          claimPhoto,
        )
      }
      await updateTeam(claimSlot.id, {
        name: claimName.trim() || null,
        photo_url: photoUrl,
        status: 'active',
      })
      setClaimSlot(null)
      setClaimName('')
      setClaimPhoto(null)
    } finally {
      setUploading(false)
    }
  }

  const quizGame = stage?.type === 'quiz' && stage.gameId
    ? games.find((g) => g.id === stage.gameId)
    : null
  const questions = quizGame ? quizQuestions(quizGame) : []
  const question = questions[state.current_question_index]
  const quizConfig = (quizGame?.config ?? {}) as GameConfig
  const questionSeconds = quizConfig.timer_seconds ?? 20
  const namedTeams = teams.filter((t) => t.name?.trim())
  const quizAnsweredTeamIds = new Set(
    submissions
      .filter((s) => s.media_type === 'quiz' && s.game_id === stage?.gameId)
      .map((s) => s.team_id),
  )

  function startQuizQuestion(index: number) {
    const sec = questionSeconds
    void patchState({
      current_question_index: index,
      quiz_state: 'waiting',
      timer_seconds: sec,
      timer_running: true,
    })
  }

  const bingoGame = stage?.type === 'bingo' && stage.gameId
    ? games.find((g) => g.id === stage.gameId)
    : null
  const tracks = bingoGame ? bingoTracks(bingoGame) : []
  const track = tracks[state.current_question_index]
  const bingoTeams = submissions
    .filter((s) => s.media_type === 'bingo' && s.game_id === stage?.gameId)
    .map((s) => teams.find((t) => t.id === s.team_id)?.name)
    .filter(Boolean)

  return (
    <LivePanelShell
      title={event.name}
      titleCentered
      subtitle={
        others.length > 0 ? (
          <span>Also viewing: {others.map((o) => o.name).join(', ')}</span>
        ) : undefined
      }
    >
      <div className="mb-4 flex justify-center">
        <StatusIndicator
          status={event.status as 'active' | 'ready' | 'draft' | 'archived'}
        />
        <span className="text-muted-foreground ml-2 text-sm capitalize">
          {event.status}
        </span>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="border-border/80 overflow-hidden bg-card shadow-sm">
            <DisplayPreviewFrame displayUrl={displayUrl} />
          </Card>

          {!isQuizStage ? (
          <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm">
            <p className="font-mono text-3xl tabular-nums">{formatTimer(timerDisplay)}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void patchState({ timer_running: !state.timer_running })
                }
              >
                {state.timer_running ? <Pause className="size-4" /> : <Play className="size-4" />}
                {state.timer_running ? 'Pause' : 'Start'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void patchState({ timer_seconds: state.timer_seconds + 900 })
                }
              >
                <Plus className="size-4" /> 15m
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void patchState({
                    timer_seconds: Math.max(0, state.timer_seconds - 900),
                  })
                }
              >
                <Minus className="size-4" /> 15m
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.show_timer_on_display}
                onChange={(e) =>
                  void patchState({ show_timer_on_display: e.target.checked })
                }
              />
              Show timer on display
            </label>
          </Card>
          ) : (
          <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm">
            <p className="text-muted-foreground text-sm">Question timer</p>
            <p className="font-mono text-3xl tabular-nums">{formatTimer(timerDisplay)}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void patchState({ timer_running: !state.timer_running })
                }
              >
                {state.timer_running ? <Pause className="size-4" /> : <Play className="size-4" />}
                {state.timer_running ? 'Pause' : 'Start'}
              </Button>
            </div>
          </Card>
          )}

          {stateError ? (
            <p className="text-destructive px-1 text-sm">{stateError}</p>
          ) : null}

          <Card className="border-border/80 bg-card p-4 shadow-sm">
            <p className="mb-2 text-sm font-medium">Stages</p>
            <div className="flex flex-wrap gap-2">
              {stages.map((s, i) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant={state.current_stage_index === i ? 'secondary' : 'outline'}
                  onClick={() => selectStage(i)}
                >
                  Stage {i + 1}
                </Button>
              ))}
            </div>
          </Card>

          <label className="flex items-center gap-2 px-1 text-sm">
            <input
              type="checkbox"
              checked={state.show_scores}
              onChange={(e) => void patchState({ show_scores: e.target.checked })}
            />
            Show scores on display
          </label>

          <Card className="border-border/80 max-h-[40vh] space-y-3 overflow-auto bg-card p-4 shadow-sm">
            <p className="font-medium">Teams</p>
            <ul className="space-y-2">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className="border-border/80 flex items-center gap-3 rounded-lg border p-2"
                >
                  <span className="text-muted-foreground w-6 text-sm">{team.slot_number}</span>
                  <div
                    className="size-6 shrink-0 rounded-full"
                    style={{ background: team.color ?? '#888' }}
                  />
                  {team.photo_url ? (
                    <img src={team.photo_url} alt="" className="size-8 rounded-full object-cover" />
                  ) : null}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left text-sm font-medium"
                    onClick={() => {
                      setClaimSlot(team)
                      setClaimName(team.name ?? '')
                    }}
                  >
                    {team.name?.trim() || 'Available'}
                  </button>
                  <span className="text-sm tabular-nums">{team.score}</span>
                  <select
                    className="border-input bg-background rounded border px-1 text-xs"
                    value={team.status}
                    onChange={(e) =>
                      void updateTeam(team.id, { status: e.target.value })
                    }
                  >
                    <option value="idle">idle</option>
                    <option value="active">active</option>
                    <option value="stopped">stopped</option>
                  </select>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="border-border/80 space-y-3 bg-card p-4 shadow-sm">
            <Label>Announcement</Label>
            <Input
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              className="bg-background"
            />
            <div className="flex flex-wrap gap-2">
              {(['display', 'participants', 'both'] as const).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant="outline"
                  onClick={() => sendAnnouncement(t)}
                >
                  {t === 'display' ? 'Display' : t === 'participants' ? 'Participants' : 'Both'}
                </Button>
              ))}
            </div>
            {state.announcement ? (
              <div className="border-border/80 flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground line-clamp-2 flex-1">
                  Live: {state.announcement}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void clearAnnouncement()}
                >
                  <X className="size-4" />
                  Clear
                </Button>
              </div>
            ) : null}
            <p className="text-muted-foreground text-xs">
              Clears automatically after 1 minute, or use Clear.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void patchState({
                    winner_reveal_stage: Math.min(2, state.winner_reveal_stage + 1),
                  })
                }
              >
                Reveal Winner ({state.winner_reveal_stage}/2)
              </Button>
              {state.winner_reveal_stage > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void patchState({ winner_reveal_stage: 0 })}
                >
                  <RotateCcw className="size-4" />
                  Reset winner
                </Button>
              ) : null}
            </div>
          </Card>
        </div>

        <Card className="border-border/80 bg-card p-4 shadow-sm">
          {!stage || stage.type === 'open' ? (
            <>
              <div className="mb-3 flex gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={subTab === t ? 'secondary' : 'outline'}
                    onClick={() => setSubTab(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
              <ul className="max-h-[70vh] space-y-3 overflow-auto">
                {filteredSubs
                  .filter((s) => s.media_type === 'photo' || s.media_type === 'video')
                  .map((sub) => {
                    const team = teams.find((t) => t.id === sub.team_id)
                    const game = games.find((g) => g.id === sub.game_id)
                    return (
                      <li key={sub.id} className="border-border/80 flex gap-3 rounded-lg border p-2">
                        {sub.media_url ? (
                          sub.media_type === 'video' ? (
                            <video src={sub.media_url} className="size-16 rounded object-cover" />
                          ) : (
                            <img src={sub.media_url} alt="" className="size-16 rounded object-cover" />
                          )
                        ) : null}
                        <div className="flex-1 text-sm">
                          <p className="font-medium">{team?.name ?? 'Team'}</p>
                          <p className="text-muted-foreground">{game?.name}</p>
                        </div>
                        {sub.status === 'pending' ? (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => void approveSubmission(sub)}>
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void rejectSubmission(sub.id)}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs capitalize">{sub.status}</span>
                        )}
                      </li>
                    )
                  })}
              </ul>
            </>
          ) : stage.type === 'quiz' && question ? (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Q {state.current_question_index + 1} / {questions.length} · {questionSeconds}s
              </p>
              <p className="text-lg font-semibold">{question.text}</p>
              <ul className="space-y-2 text-sm">
                {question.answers.map((a) => (
                  <li
                    key={a.id}
                    className="border-border/80 rounded-lg border px-3 py-2"
                  >
                    {a.text}
                    {a.id === question.correctAnswerId ? (
                      <span className="text-muted-foreground ml-2 text-xs">(correct)</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const next = Math.min(
                      questions.length - 1,
                      state.current_question_index + 1,
                    )
                    startQuizQuestion(next)
                  }}
                >
                  Next Question
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const next = Math.min(
                      questions.length - 1,
                      state.current_question_index + 1,
                    )
                    void patchState({
                      current_question_index: next,
                      quiz_state: 'waiting',
                    })
                  }}
                >
                  Skip
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void patchState({
                      timer_running: false,
                      quiz_state: 'revealed',
                    })
                  }
                >
                  Show Answer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startQuizQuestion(state.current_question_index)}
                >
                  Restart question
                </Button>
              </div>
              <ul className="space-y-1 text-sm">
                {namedTeams.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    {quizAnsweredTeamIds.has(t.id) ? (
                      <Check className="text-foreground size-4 shrink-0" />
                    ) : (
                      <span className="size-4 shrink-0" />
                    )}
                    <span>{t.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : stage.type === 'bingo' ? (
            <div className="space-y-4">
              <p className="font-semibold">
                {track ? `${track.title} — ${track.artist}` : 'No track'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void patchState({
                      current_question_index: Math.min(
                        tracks.length - 1,
                        state.current_question_index + 1,
                      ),
                      bingo_state: 'waiting',
                    })
                  }
                >
                  Next Track
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void patchState({ bingo_state: 'revealed' })}
                >
                  Reveal
                </Button>
              </div>
              <ul className="text-sm">{bingoTeams.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          ) : stage.type === 'break' ? (
            <div className="space-y-4">
              <p className="text-lg">{stage.message}</p>
              <p className="font-mono text-2xl tabular-nums">{formatBreakTimer(breakDisplay)}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void patchState({
                      break_timer_running: !state.break_timer_running,
                    })
                  }
                >
                  {state.break_timer_running ? (
                    <>
                      <Pause className="size-4" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="size-4" /> Start
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void patchState({
                      break_timer_seconds: breakDurationSeconds(stage, null),
                      break_timer_running: true,
                    })
                  }}
                >
                  Start
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      {claimSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="border-border/80 w-full max-w-md space-y-4 bg-card p-6 shadow-lg">
            <h3 className="font-semibold">Team slot {claimSlot.slot_number}</h3>
            <Input
              value={claimName}
              onChange={(e) => setClaimName(e.target.value)}
              placeholder="Team name"
              className="bg-background"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setClaimPhoto(e.target.files?.[0] ?? null)}
            />
            <input
              type="color"
              value={claimSlot.color ?? '#888888'}
              onChange={(e) => void updateTeam(claimSlot.id, { color: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setClaimSlot(null)}>
                Cancel
              </Button>
              <Button disabled={uploading} onClick={() => void saveClaim()}>
                Save
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </LivePanelShell>
  )
}
