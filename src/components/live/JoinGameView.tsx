import { Camera, LogOut, MessageCircle, Video, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { AccentButton } from '@/components/admin/AccentButton'
import { BrandBackground } from '@/components/live/BrandBackground'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { LiveEventBundle } from '@/lib/live-event'
import {
  bingoCardTitles,
  bingoTracks,
  brandColorsForEvent,
  breakDurationSeconds,
  currentStage,
  formatBreakTimer,
  formatTimer,
  gamePointsDisplay,
  isEventLive,
  logoForEvent,
  parseStages,
  quizQuestions,
} from '@/lib/live-event'
import { useLiveTimer } from '@/hooks/use-live-timer'
import { createThrottledTimerSync } from '@/lib/live-timer-sync'
import { playSubmitSound } from '@/lib/sounds'
import { verifyTabletPassword } from '@/lib/tenant'
import { supabase } from '@/lib/supabase'
import { uploadAsset } from '@/lib/storage'
import type { GameConfig } from '@/types/game-config'
import type { Tables } from '@/types/helpers'

type JoinGameViewProps = {
  bundle: LiveEventBundle
  teamId: string
  team: Tables<'teams'>
  messages: Tables<'chat_messages'>[]
  onSendMessage: (text: string) => void
  announcement: string | null
  onDismissAnnouncement: () => void
  onExitTeam: () => void
  exitMode?: 'team' | 'tablet'
  tabletOrgSlug?: string
  onExitToTablet?: () => void
}

export function JoinGameView({
  bundle,
  teamId,
  team,
  messages,
  onSendMessage,
  announcement,
  onDismissAnnouncement,
  onExitTeam,
  exitMode = 'team',
  onExitToTablet,
}: JoinGameViewProps) {
  const { event, organization, state, games, submissions } = bundle
  const stages = useMemo(() => parseStages(event.stages_config), [event.stages_config])
  const stage = currentStage(stages, state.current_stage_index)
  const colors = brandColorsForEvent(event, organization)
  const accent = colors[2]
  const logo = logoForEvent(event, organization)

  const [selectedGame, setSelectedGame] = useState<Tables<'games'> | null>(null)
  const [captureFile, setCaptureFile] = useState<File | null>(null)
  const [capturePreview, setCapturePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null)
  const [quizChangeLeft, setQuizChangeLeft] = useState<number | null>(null)
  const [quizLocked, setQuizLocked] = useState(false)
  const [bingoPick, setBingoPick] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatText, setChatText] = useState('')
  const mediaRef = useRef<HTMLInputElement>(null)

  const breakSyncRef = useRef(
    createThrottledTimerSync(() => {
      /* display-only read; join does not write break timer */
    }),
  )

  const breakSeconds =
    stage?.type === 'break'
      ? breakDurationSeconds(stage, state.break_timer_seconds)
      : (state.break_timer_seconds ?? 0)

  const breakDisplay = useLiveTimer(
    breakSeconds,
    Boolean(state.break_timer_running),
    (next, stillRunning) => breakSyncRef.current(next, stillRunning),
  )

  const mySubs = submissions.filter((s) => s.team_id === teamId)
  const live = isEventLive(event)

  const quizRunning =
    stage?.type === 'quiz' &&
    state.timer_running &&
    state.quiz_state !== 'revealed'

  const quizTimerDisplay = useLiveTimer(
    state.timer_seconds,
    Boolean(quizRunning),
    () => {},
  )

  useEffect(() => {
    if (stage?.type !== 'quiz' || !stage.gameId) return
    const existing = mySubs.find(
      (s) => s.media_type === 'quiz' && s.game_id === stage.gameId,
    )
    if (existing?.media_url) {
      setQuizAnswer(existing.media_url)
      if (!quizRunning || state.quiz_state === 'revealed') {
        setQuizLocked(true)
      }
    }
  }, [stage?.type, stage?.gameId, mySubs, quizRunning, state.quiz_state])

  useEffect(() => {
    if (stage?.type !== 'bingo' || !stage.gameId) return
    const existing = mySubs.find(
      (s) => s.media_type === 'bingo' && s.game_id === stage.gameId,
    )
    if (existing?.media_url != null) {
      setBingoPick(Number(existing.media_url))
    }
  }, [stage?.type, stage?.gameId, mySubs])

  async function handleExitTeam() {
    if (!organization?.id) return
    const pw = window.prompt(
      exitMode === 'tablet'
        ? 'Tablet password to return to events'
        : 'Tablet password to leave this team',
    )
    if (pw == null) return
    try {
      const ok = await verifyTabletPassword(organization.id, pw)
      if (!ok) {
        window.alert('Incorrect password')
        return
      }
      if (exitMode === 'tablet' && onExitToTablet) {
        onExitToTablet()
      } else {
        onExitTeam()
      }
    } catch {
      window.alert('Could not verify password')
    }
  }

  useEffect(() => {
    if (!captureFile) {
      setCapturePreview(null)
      return
    }
    const url = URL.createObjectURL(captureFile)
    setCapturePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [captureFile])

  const lastApprovalId = useRef<string | null>(null)
  useEffect(() => {
    const approved = submissions
      .filter(
        (s) =>
          s.team_id === teamId &&
          s.status === 'approved' &&
          s.points_awarded != null,
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    if (!approved || approved.id === lastApprovalId.current) return
    lastApprovalId.current = approved.id
    const game = games.find((g) => g.id === approved.game_id)
    if (!game) return
    setToast(
      `Challenge ${game.name} earned ${approved.points_awarded} points`,
    )
    const t = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(t)
  }, [submissions, teamId, games])

  useEffect(() => {
    if (!quizAnswer || quizLocked) return
    const left = Math.min(5, quizTimerDisplay)
    if (left <= 0) {
      setQuizLocked(true)
      setQuizChangeLeft(null)
      return
    }
    setQuizChangeLeft(left)
    const id = window.setInterval(() => {
      setQuizChangeLeft((n) => {
        if (n == null || n <= 1) {
          setQuizLocked(true)
          return null
        }
        return n - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [quizAnswer, quizLocked, quizTimerDisplay])

  useEffect(() => {
    if (stage?.type !== 'quiz' || state.quiz_state === 'revealed') return
    if (quizRunning && quizTimerDisplay <= 0) {
      setQuizLocked(true)
      setQuizChangeLeft(null)
    }
  }, [stage?.type, state.quiz_state, quizRunning, quizTimerDisplay])

  async function submitOpenGame() {
    if (!selectedGame || !captureFile || !event.id) return
    setSubmitting(true)
    try {
      const url = await uploadAsset(
        'game-assets',
        `${event.id}/submissions/${teamId}/${Date.now()}`,
        captureFile,
      )
      await supabase.from('submissions').insert({
        event_id: event.id,
        team_id: teamId,
        game_id: selectedGame.id,
        media_url: url,
        media_type: selectedGame.type === 'video' ? 'video' : 'photo',
        status: 'pending',
      })
      playSubmitSound()
      setSubmitDone(true)
      window.setTimeout(() => {
        setSelectedGame(null)
        setCaptureFile(null)
        setSubmitDone(false)
      }, 1500)
    } finally {
      setSubmitting(false)
    }
  }

  async function submitQuizAnswer(answerId: string, gameId: string) {
    if (quizLocked) return
    const existing = mySubs.find(
      (s) => s.media_type === 'quiz' && s.game_id === gameId,
    )
    if (existing) {
      await supabase
        .from('submissions')
        .update({ media_url: answerId })
        .eq('id', existing.id)
    } else {
      await supabase.from('submissions').insert({
        event_id: event.id,
        team_id: teamId,
        game_id: gameId,
        media_url: answerId,
        media_type: 'quiz',
        status: 'pending',
      })
    }
    setQuizAnswer(answerId)
    playSubmitSound()
  }

  async function submitBingoSquare(index: number, gameId: string) {
    if (state.bingo_state === 'revealed') return
    setBingoPick(index)
    const existing = mySubs.find(
      (s) => s.media_type === 'bingo' && s.game_id === gameId,
    )
    if (existing) {
      await supabase
        .from('submissions')
        .update({ media_url: String(index) })
        .eq('id', existing.id)
    } else {
      await supabase.from('submissions').insert({
        event_id: event.id,
        team_id: teamId,
        game_id: gameId,
        media_url: String(index),
        media_type: 'bingo',
        status: 'pending',
      })
    }
  }

  const header = (
    <header className="mb-6 flex flex-col items-center gap-2 px-2 text-center">
      {logo ? (
        <img
          src={logo}
          alt=""
          className="max-h-14 max-w-[200px] object-contain drop-shadow-md"
        />
      ) : null}
      <h1 className="text-xl font-bold drop-shadow-sm sm:text-2xl">{event.name}</h1>
      <p className="rounded-full bg-black/30 px-4 py-1 text-sm font-semibold tabular-nums">
        {team.score} points
      </p>
    </header>
  )

  let body: ReactNode

  if (!live) {
    body = (
      <p className="px-6 py-16 text-center text-lg font-medium text-white/90">
        Event starting soon…
      </p>
    )
  } else if (event.status === 'archived') {
    body = (
      <div className="mx-auto max-w-md px-4 text-center">
        <h2 className="mb-4 text-2xl font-bold">Game over</h2>
        <ul className="space-y-2 text-left text-sm">
          {[...bundle.teams]
            .filter((t) => t.name)
            .sort((a, b) => b.score - a.score)
            .map((t, i) => (
              <li key={t.id} className="flex justify-between rounded-lg bg-black/20 px-3 py-2">
                <span>
                  #{i + 1} {t.name}
                </span>
                <span>{t.score}</span>
              </li>
            ))}
        </ul>
      </div>
    )
  } else if (stage?.type === 'open') {
    const openGameIds = stage.gameIds ?? []
    const openGames = games.filter((g) => openGameIds.includes(g.id))

    if (selectedGame) {
      const latestSub = mySubs
        .filter((s) => s.game_id === selectedGame.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]

      body = (
        <div className="mx-auto max-w-lg px-4 pb-24">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 text-white hover:bg-white/10"
            onClick={() => {
              setSelectedGame(null)
              setCaptureFile(null)
              setSubmitDone(false)
            }}
          >
            ← Back
          </Button>
          <h2 className="mb-2 text-xl font-bold">{selectedGame.name}</h2>
          <p className="mb-4 text-sm text-white/80">{selectedGame.description}</p>
          {selectedGame.cover_url ? (
            <img
              src={selectedGame.cover_url}
              alt=""
              className="mb-4 w-full rounded-lg object-cover"
            />
          ) : null}
          {selectedGame.type === 'video' &&
          (selectedGame.config as GameConfig)?.example_video_url ? (
            <video
              src={(selectedGame.config as GameConfig).example_video_url!}
              controls
              className="mb-4 w-full rounded-lg"
            />
          ) : null}
          {submitDone ? (
            <p className="text-center text-lg font-semibold text-[#FFCB03]">
              Submitted! Waiting for approval…
            </p>
          ) : capturePreview ? (
            <div className="space-y-4">
              {selectedGame.type === 'video' ? (
                <video src={capturePreview} controls className="w-full rounded-lg" />
              ) : (
                <img src={capturePreview} alt="" className="w-full rounded-lg" />
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-white/30 bg-white/10 text-white"
                  onClick={() => setCaptureFile(null)}
                >
                  Retake
                </Button>
                <AccentButton
                  className="flex-1"
                  disabled={submitting}
                  onClick={() => void submitOpenGame()}
                >
                  {submitting ? 'Submitting…' : 'Submit'}
                </AccentButton>
              </div>
            </div>
          ) : (
            <>
              <input
                ref={mediaRef}
                type="file"
                accept={selectedGame.type === 'video' ? 'video/*' : 'image/*'}
                capture={selectedGame.type === 'video' ? 'environment' : 'environment'}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (selectedGame.type === 'video') {
                    const max = (selectedGame.config as GameConfig)?.timer_seconds ?? 120
                    const vid = document.createElement('video')
                    vid.preload = 'metadata'
                    vid.onloadedmetadata = () => {
                      if (vid.duration > max) {
                        window.alert(`Video must be ${max} seconds or less`)
                        return
                      }
                      setCaptureFile(f)
                    }
                    vid.src = URL.createObjectURL(f)
                  } else {
                    setCaptureFile(f)
                  }
                }}
              />
              <AccentButton
                className="w-full"
                onClick={() => mediaRef.current?.click()}
              >
                {selectedGame.type === 'video' ? (
                  <>
                    <Video className="size-4" />
                    Record / upload video
                  </>
                ) : (
                  <>
                    <Camera className="size-4" />
                    Take photo
                  </>
                )}
              </AccentButton>
              {latestSub?.status === 'approved' ? (
                <p className="mt-2 text-center text-xs text-white/70">
                  Approved — you can submit again to improve
                </p>
              ) : null}
            </>
          )}
        </div>
      )
    } else {
      body = (
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 px-4 pb-24">
          {openGames.map((g) => {
            const sub = mySubs.find((s) => s.game_id === g.id)
            const done = sub?.status === 'approved'
            const pending = sub?.status === 'pending'
            return (
              <button
                key={g.id}
                type="button"
                className="flex min-h-[120px] flex-col justify-between rounded-xl p-4 text-left shadow-md transition-transform active:scale-[0.98]"
                style={{ backgroundColor: accent, color: '#3E3D3E' }}
                onClick={() => setSelectedGame(g)}
              >
                <span className="line-clamp-2 font-bold leading-snug">{g.name}</span>
                <span className="mt-2 text-sm font-medium opacity-90">
                  {gamePointsDisplay(g)}
                </span>
                {done ? (
                  <span className="mt-1 text-xs font-semibold">✓ Done</span>
                ) : pending ? (
                  <span className="mt-1 text-xs">Pending…</span>
                ) : null}
              </button>
            )
          })}
        </div>
      )
    }
  } else if (stage?.type === 'quiz' && stage.gameId) {
    const game = games.find((g) => g.id === stage.gameId)
    const q = game ? quizQuestions(game)[state.current_question_index] : null
    const existing = mySubs.find(
      (s) => s.media_type === 'quiz' && s.game_id === stage.gameId,
    )
    const maxSec = (game?.config as GameConfig)?.timer_seconds ?? 20
    const timerPct =
      maxSec > 0
        ? Math.min(100, (quizTimerDisplay / maxSec) * 100)
        : 0

    if (state.quiz_state === 'revealed' && q) {
      const ok = existing?.media_url === q.correctAnswerId
      body = (
        <div className="mx-auto max-w-lg px-4 pb-24">
          <p className={`mb-4 text-center text-lg font-bold ${ok ? 'text-green-400' : 'text-red-400'}`}>
            {ok ? 'Correct!' : 'Incorrect'}
          </p>
          <div className="space-y-2">
            {q.answers.map((a) => {
              const isCorrect = a.id === q.correctAnswerId
              const isMine = a.id === existing?.media_url
              let cls = 'bg-white/15'
              if (isCorrect) cls = 'bg-green-600/80 ring-2 ring-green-300'
              else if (isMine && !isCorrect) cls = 'bg-red-600/70'
              return (
                <div key={a.id} className={`rounded-xl px-4 py-3 text-sm font-medium ${cls}`}>
                  {a.text}
                </div>
              )
            })}
          </div>
        </div>
      )
    } else if (quizLocked || (existing && !quizAnswer)) {
      body = (
        <p className="py-16 text-center text-white/80">Answer locked — waiting…</p>
      )
    } else if (q) {
      body = (
        <div className="mx-auto max-w-lg px-4 pb-24">
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-black/30">
            <div
              className="h-full bg-[#FFCB03] transition-all duration-1000"
              style={{ width: `${timerPct}%` }}
            />
          </div>
          <p className="mb-1 text-center text-xs text-white/70">
            {formatTimer(quizTimerDisplay)} remaining
          </p>
          <h2 className="mb-6 text-center text-lg font-bold leading-snug">{q.text}</h2>
          <div className="space-y-3">
            {q.answers.map((a) => {
              const selected = quizAnswer === a.id
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={quizLocked}
                  className={`w-full rounded-xl px-4 py-4 text-left text-sm font-semibold transition-colors ${
                    selected
                      ? 'bg-[#FFCB03] text-[#3E3D3E]'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                  onClick={() => void submitQuizAnswer(a.id, stage.gameId!)}
                >
                  {a.text}
                </button>
              )
            })}
          </div>
          {quizChangeLeft != null ? (
            <p className="mt-4 text-center text-xs text-white/70">
              Change answer: {quizChangeLeft}s
            </p>
          ) : null}
        </div>
      )
    }
  } else if (stage?.type === 'bingo' && stage.gameId) {
    const game = games.find((g) => g.id === stage.gameId)
    const tracks = game ? bingoTracks(game) : []
    const titles = bingoCardTitles(teamId, tracks)
    const revealed = state.bingo_state === 'revealed'
    body = (
      <div className="mx-auto max-w-md px-2 pb-24">
        <div className="grid grid-cols-5 gap-1">
          {titles.map((title, i) => {
            const sub = mySubs.find(
              (s) => s.media_type === 'bingo' && s.media_url === String(i),
            )
            let cls = 'bg-white/20 text-white'
            if (revealed && sub)
              cls =
                sub.status === 'approved'
                  ? 'bg-green-500/80 text-white'
                  : 'bg-red-500/80 text-white'
            else if (revealed) cls = 'bg-white/10 text-white/50'
            else if (bingoPick === i) cls = 'bg-[#FFCB03]/90 text-[#3E3D3E]'
            return (
              <button
                key={i}
                type="button"
                disabled={revealed}
                className={`aspect-square p-0.5 text-[8px] leading-tight ${cls}`}
                onClick={() => void submitBingoSquare(i, stage.gameId!)}
              >
                {title}
              </button>
            )
          })}
        </div>
      </div>
    )
  } else if (stage?.type === 'break') {
    body = (
      <div className="px-6 py-12 text-center">
        <p className="text-2xl font-bold sm:text-4xl">{stage.message ?? 'Break'}</p>
        <p className="mt-8 font-mono text-5xl tabular-nums">{formatBreakTimer(breakDisplay)}</p>
      </div>
    )
  } else {
    body = <p className="py-16 text-center text-white/80">Stand by…</p>
  }

  return (
    <BrandBackground event={event} organization={organization} variant="default">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-40 size-7 rounded-full bg-black/20 text-white/40 hover:bg-black/40 hover:text-white/90"
        onClick={() => void handleExitTeam()}
        aria-label={exitMode === 'tablet' ? 'Exit to events' : 'Leave team'}
      >
        <LogOut className="size-3.5" />
      </Button>
      {header}
      {body}
      {toast ? (
        <div className="fixed top-4 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-lg bg-[#FFCB03] px-4 py-3 text-center text-sm font-semibold text-[#3E3D3E] shadow-lg">
          {toast}
        </div>
      ) : null}
      <Button
        className="fixed bottom-4 right-4 size-12 rounded-full bg-[#FFCB03] text-[#3E3D3E] shadow-lg hover:bg-[#e6b803]"
        size="icon"
        onClick={() => setChatOpen(true)}
      >
        <MessageCircle className="size-5" />
      </Button>
      {chatOpen ? (
        <div className="bg-background fixed inset-0 z-50 flex flex-col">
          <div className="border-border flex items-center justify-between border-b p-4">
            <span className="font-semibold">Chat with facilitator</span>
            <Button variant="ghost" size="icon" onClick={() => setChatOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>
          <ul className="flex-1 space-y-2 overflow-auto p-4">
            {messages.map((m) => (
              <li key={m.id} className="text-sm">
                <span className="font-medium">{m.sender}: </span>
                {m.message}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 border-t p-4">
            <input
              className="border-input bg-background flex-1 rounded-lg border px-3 py-2 text-sm"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
            />
            <AccentButton
              onClick={() => {
                onSendMessage(chatText)
                setChatText('')
              }}
            >
              Send
            </AccentButton>
          </div>
        </div>
      ) : null}
      {announcement ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6">
          <Card className="max-w-md space-y-4 p-6 text-center">
            <p className="text-lg">{announcement}</p>
            <AccentButton onClick={onDismissAnnouncement}>Dismiss</AccentButton>
          </Card>
        </div>
      ) : null}
    </BrandBackground>
  )
}
