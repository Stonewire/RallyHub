import { Check, Copy, GripVertical, Pause, Play, Plus, Minus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { useEventTimerTick } from '@/hooks/use-event-timer'
import { useFacilitatorPresence, useLiveEvent } from '@/hooks/use-live-event'
import {
  FACILITATOR_NAME_KEY,
  bingoTracks,
  currentStage,
  formatTimer,
  parseStages,
  quizQuestions,
} from '@/lib/live-event'
import { supabase } from '@/lib/supabase'
import { uploadAsset } from '@/lib/storage'
import type { Tables } from '@/types/helpers'

export function FacilitatorEventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [name, setName] = useState(() => localStorage.getItem(FACILITATOR_NAME_KEY) ?? '')
  const [namePrompt, setNamePrompt] = useState(!localStorage.getItem(FACILITATOR_NAME_KEY))
  const { bundle, loading, error, updateState, updateTeam } = useLiveEvent(eventId)
  const others = useFacilitatorPresence(eventId, name || null)

  const [announcement, setAnnouncement] = useState('')
  const [claimSlot, setClaimSlot] = useState<Tables<'teams'> | null>(null)
  const [claimName, setClaimName] = useState('')
  const [claimPhoto, setClaimPhoto] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [subTab, setSubTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [copied, setCopied] = useState(false)
  const [previewPos, setPreviewPos] = useState({ x: 24, y: 80 })
  const [dragging, setDragging] = useState(false)

  const stages = useMemo(
    () => (bundle ? parseStages(bundle.event.stages_config) : []),
    [bundle],
  )
  const stage = bundle ? currentStage(stages, bundle.state.current_stage_index) : null

  useEventTimerTick(
    Boolean(bundle?.state.timer_running),
    bundle?.state.timer_seconds ?? 0,
    (next) => {
      if (bundle) void updateState({ timer_seconds: next })
    },
  )

  useEventTimerTick(
    Boolean(bundle?.state.break_timer_running),
    bundle?.state.break_timer_seconds ?? 0,
    (next) => {
      if (bundle) void updateState({ break_timer_seconds: next })
    },
  )

  if (namePrompt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm space-y-4 p-6">
          <h1 className="text-lg font-semibold">Facilitator</h1>
          <Label>Your name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
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
      </div>
    )
  }

  if (loading || !bundle) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {loading ? 'Loading…' : (error ?? 'Event not found')}
      </div>
    )
  }

  const { event, state, teams, games, submissions } = bundle
  const displayUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/display/${eventId}`
      : `/display/${eventId}`

  const filteredSubs = submissions.filter((s) => {
    if (subTab === 'all') return true
    return s.status === subTab
  })

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
      setUploadPct(0)
    }
  }

  const quizGame = stage?.type === 'quiz' && stage.gameId
    ? games.find((g) => g.id === stage.gameId)
    : null
  const questions = quizGame ? quizQuestions(quizGame) : []
  const question = questions[state.current_question_index]
  const quizTeams = submissions
    .filter((s) => s.media_type === 'quiz' && s.game_id === stage?.gameId)
    .map((s) => teams.find((t) => t.id === s.team_id)?.name)
    .filter(Boolean)

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
    <div className="bg-background min-h-screen p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <StatusIndicator
            status={event.status as 'active' | 'ready' | 'draft' | 'archived'}
            className="mt-1"
          />
        </div>
        {others.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            Also viewing: {others.map((o) => o.name).join(', ')}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="space-y-4 p-4">
            <p className="font-mono text-3xl tabular-nums">{formatTimer(state.timer_seconds)}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void updateState({ timer_running: !state.timer_running })
                }
              >
                {state.timer_running ? <Pause className="size-4" /> : <Play className="size-4" />}
                {state.timer_running ? 'Pause' : 'Start'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void updateState({ timer_seconds: state.timer_seconds + 900 })
                }
              >
                <Plus className="size-4" /> 15m
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void updateState({
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
                  void updateState({ show_timer_on_display: e.target.checked })
                }
              />
              Show timer on display
            </label>
          </Card>

          <Card className="p-4">
            <p className="mb-2 text-sm font-medium">Stages</p>
            <div className="flex flex-wrap gap-2">
              {stages.map((s, i) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant={state.current_stage_index === i ? 'secondary' : 'outline'}
                  onClick={() => void updateState({ current_stage_index: i })}
                >
                  Stage {i + 1}
                </Button>
              ))}
            </div>
          </Card>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.show_scores}
              onChange={(e) => void updateState({ show_scores: e.target.checked })}
            />
            Show scores on display
          </label>

          <Card className="space-y-3 p-4">
            <p className="font-medium">Teams</p>
            <ul className="space-y-2">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className="border-border flex items-center gap-3 rounded-lg border p-2"
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
                  <StatusIndicator
                    status={
                      team.status === 'active'
                        ? 'active'
                        : team.status === 'stopped'
                          ? 'archived'
                          : 'draft'
                    }
                  />
                  <select
                    className="text-xs"
                    value={team.status}
                    onChange={(e) =>
                      void updateTeam(team.id, {
                        status: e.target.value,
                      })
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

          <Card className="space-y-3 p-4">
            <Label>Announcement</Label>
            <Input
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
            />
            <div className="flex gap-2">
              {(['display', 'participants', 'both'] as const).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void updateState({
                      announcement,
                      announcement_target: t,
                      updated_at: new Date().toISOString(),
                    })
                  }
                >
                  {t === 'display' ? 'Display' : t === 'participants' ? 'Participants' : 'Both'}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() =>
                void updateState({
                  winner_reveal_stage: state.winner_reveal_stage >= 2 ? 0 : state.winner_reveal_stage + 1,
                })
              }
            >
              Reveal Winner ({state.winner_reveal_stage}/2)
            </Button>
          </Card>

          <div className="space-y-2">
            <Input readOnly value={displayUrl} className="font-mono text-xs" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(displayUrl)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copy display link
            </Button>
          </div>
        </div>

        <Card className="min-h-[320px] p-4">
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
              <ul className="max-h-[60vh] space-y-3 overflow-auto">
                {filteredSubs
                  .filter((s) => s.media_type === 'photo' || s.media_type === 'video')
                  .map((sub) => {
                    const team = teams.find((t) => t.id === sub.team_id)
                    const game = games.find((g) => g.id === sub.game_id)
                    return (
                      <li key={sub.id} className="flex gap-3 rounded-lg border p-2">
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
              <p className="text-sm text-muted-foreground">
                Q {state.current_question_index + 1} / {questions.length}
              </p>
              <p className="text-lg font-semibold">{question.text}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void updateState({
                      current_question_index: Math.min(
                        questions.length - 1,
                        state.current_question_index + 1,
                      ),
                      quiz_state: 'waiting',
                    })
                  }
                >
                  Next Question
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void updateState({
                      current_question_index: Math.min(
                        questions.length - 1,
                        state.current_question_index + 2,
                      ),
                    })
                  }
                >
                  Skip
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void updateState({ quiz_state: 'revealed' })}
                >
                  Show Answer
                </Button>
              </div>
              <ul className="text-sm">
                {quizTeams.map((n) => (
                  <li key={n}>{n}</li>
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
                    void updateState({
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
                <Button size="sm" variant="outline" onClick={() => void updateState({ bingo_state: 'revealed' })}>
                  Reveal
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void updateState({ bingo_state: 'finished' })}
                >
                  Finish
                </Button>
              </div>
              <ul className="text-sm">{bingoTeams.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          ) : stage.type === 'break' ? (
            <div className="space-y-4">
              <p className="text-lg">{stage.message}</p>
              <p className="font-mono text-2xl">
                {formatTimer(state.break_timer_seconds ?? (stage.durationMinutes ?? 5) * 60)}
              </p>
              <Button
                size="sm"
                onClick={() => {
                  const sec = (stage.durationMinutes ?? 5) * 60
                  void updateState({
                    break_timer_seconds: state.break_timer_seconds ?? sec,
                    break_timer_running: true,
                  })
                }}
              >
                Start break timer
              </Button>
            </div>
          ) : null}
        </Card>
      </div>

      <div
        className="border-border fixed z-40 overflow-hidden rounded-lg border bg-black shadow-xl"
        style={{
          left: previewPos.x,
          top: previewPos.y,
          width: 320,
          aspectRatio: '16/9',
        }}
      >
        <div
          className="bg-muted flex cursor-move items-center gap-1 px-2 py-1 text-xs"
          onMouseDown={() => setDragging(true)}
          onMouseUp={() => setDragging(false)}
          onMouseMove={(e) => {
            if (dragging) setPreviewPos({ x: e.clientX - 160, y: e.clientY - 12 })
          }}
        >
          <GripVertical className="size-3" />
          Display preview
        </div>
        <iframe title="Display" src={displayUrl} className="size-full border-0" />
      </div>

      {claimSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md space-y-4 p-6">
            <h3 className="font-semibold">Team slot {claimSlot.slot_number}</h3>
            <Input value={claimName} onChange={(e) => setClaimName(e.target.value)} placeholder="Team name" />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setClaimPhoto(e.target.files?.[0] ?? null)
                setUploadPct(0)
              }}
            />
            {uploading ? (
              <div className="bg-muted h-2 overflow-hidden rounded">
                <div className="bg-primary h-full transition-all" style={{ width: `${uploadPct || 50}%` }} />
              </div>
            ) : null}
            <input
              type="color"
              value={claimSlot.color ?? '#888888'}
              onChange={(e) => void updateTeam(claimSlot.id, { color: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setClaimSlot(null)}>
                Cancel
              </Button>
              <Button
                disabled={uploading || (claimPhoto != null && uploading)}
                onClick={() => void saveClaim()}
              >
                Save
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
