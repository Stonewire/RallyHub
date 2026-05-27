import { Check, LogOut, MessageCircle, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { BrandBackground } from '@/components/live/BrandBackground'
import { QuizResultsPanel } from '@/components/live/QuizResultsPanel'
import { PhotoChallengeCapture } from '@/components/live/PhotoChallengeCapture'
import { VideoChallengeCapture } from '@/components/live/VideoChallengeCapture'
import {
  WinnerRevealPanel,
  eventRankedTeams,
} from '@/components/live/WinnerRevealPanel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  NotificationAccentSync,
  useNotification,
} from '@/contexts/notification-context'
import { useBingoRun, useBingoTeamCard } from '@/hooks/use-bingo-run'
import type { LiveEventBundle } from '@/lib/live-event'
import {
  bingoCellLabels,
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
  submissionsAllowed,
  STANDBY_ACCENT,
  quizTimerRunning,
  quizTimerSeconds,
  textOnAccent,
  parseStages,
  quizQuestions,
  quizLeaderboard,
  quizSubmissionMediaType,
  activeSubmissionForGame,
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
  const bingoRunQuery = useBingoRun(
    event.id,
    stage?.type === 'bingo' ? state.current_stage_index : undefined,
  )
  const bingoCardQuery = useBingoTeamCard(bingoRunQuery.data?.id, teamId)
  const colors = brandColorsForEvent(event, organization)
  const accent = colors[2]
  const onAccent = textOnAccent(accent)
  const logo = logoForEvent(event, organization)

  const [selectedGame, setSelectedGame] = useState<Tables<'games'> | null>(null)
  const [captureFile, setCaptureFile] = useState<File | null>(null)
  const [capturePreview, setCapturePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null)
  const [quizChangeLeft, setQuizChangeLeft] = useState<number | null>(null)
  const [quizLocked, setQuizLocked] = useState(false)
  const quizChangeDeadlineRef = useRef<number | null>(null)
  const [bingoPick, setBingoPick] = useState<number | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const { notify } = useNotification()
  const [chatText, setChatText] = useState('')

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
  const canSubmit = submissionsAllowed(state)

  const quizRunning =
    stage?.type === 'quiz' &&
    quizTimerRunning(state) &&
    (state.quiz_state === 'active' || state.quiz_state === 'waiting')

  const quizTimerDisplay = useLiveTimer(
    quizTimerSeconds(state),
    Boolean(quizRunning),
    () => {},
  )

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.team_id == null || m.team_id === teamId),
    [messages, teamId],
  )

  const quizGame = stage?.type === 'quiz' && stage.gameId
    ? games.find((g) => g.id === stage.gameId)
    : null
  const quizQs = quizGame ? quizQuestions(quizGame) : []
  const currentQuizQ = quizQs[state.current_question_index]

  useEffect(() => {
    quizChangeDeadlineRef.current = null
    setQuizAnswer(null)
    setQuizLocked(false)
    setQuizChangeLeft(null)
  }, [state.current_question_index, stage?.gameId, state.quiz_state])

  useEffect(() => {
    if (stage?.type !== 'quiz' || !stage.gameId || !currentQuizQ) return
    if (state.quiz_state !== 'active') return
    const mediaType = quizSubmissionMediaType(currentQuizQ.id)
    const existing = mySubs.find(
      (s) => s.media_type === mediaType && s.game_id === stage.gameId,
    )
    if (existing?.media_url) {
      setQuizAnswer(existing.media_url)
    }
  }, [stage?.type, stage?.gameId, mySubs, state.quiz_state, currentQuizQ?.id])

  useEffect(() => {
    if (!quizAnswer || quizChangeDeadlineRef.current == null) return
    const tick = () => {
      const left = Math.ceil(
        (quizChangeDeadlineRef.current! - Date.now()) / 1000,
      )
      if (left <= 0) {
        setQuizLocked(true)
        setQuizChangeLeft(null)
      } else {
        setQuizChangeLeft(left)
      }
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [quizAnswer])

  useEffect(() => {
    if (state.quiz_state === 'revealed' || state.quiz_state === 'results') {
      setQuizLocked(true)
      setQuizChangeLeft(null)
    }
  }, [state.quiz_state])

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
        notify('Incorrect password')
        return
      }
      if (exitMode === 'tablet' && onExitToTablet) {
        onExitToTablet()
      } else {
        onExitTeam()
      }
    } catch {
      notify('Could not verify password')
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

  const seenApprovedIds = useRef<Set<string> | null>(null)
  const lastRejectedId = useRef<string | null>(null)
  useEffect(() => {
    const mine = submissions.filter(
      (s) =>
        s.team_id === teamId &&
        s.status === 'approved' &&
        s.points_awarded != null,
    )
    if (seenApprovedIds.current === null) {
      seenApprovedIds.current = new Set(mine.map((s) => s.id))
      return
    }
    for (const s of mine) {
      if (seenApprovedIds.current.has(s.id)) continue
      seenApprovedIds.current.add(s.id)
      const game = games.find((g) => g.id === s.game_id)
      if (!game || game.type === 'quiz' || game.type === 'music_bingo') continue
      notify(`+${s.points_awarded} pts — ${game.name}`)
    }
  }, [submissions, teamId, games, notify])

  useEffect(() => {
    const rejected = submissions
      .filter((s) => s.team_id === teamId && s.status === 'rejected')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    if (!rejected || rejected.id === lastRejectedId.current) return
    const game = games.find((g) => g.id === rejected.game_id)
    if (!game || game.type === 'quiz' || game.type === 'music_bingo') return
    lastRejectedId.current = rejected.id
    notify(`${game.name} was not approved`)
  }, [submissions, teamId, games, notify])

  async function submitOpenGame() {
    if (!selectedGame || !captureFile || !event.id) return
    if (!canSubmit) {
      notify('This event is now closed')
      return
    }
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
      notify('Submitted — waiting for approval')
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

  async function submitQuizAnswer(answerId: string, gameId: string, questionId: string) {
    if (quizLocked || state.quiz_state !== 'active') return
    if (quizChangeDeadlineRef.current == null) {
      const windowSec = Math.min(5, Math.max(0, quizTimerDisplay))
      quizChangeDeadlineRef.current = Date.now() + windowSec * 1000
    }
    const mediaType = quizSubmissionMediaType(questionId)
    const existing = mySubs.find(
      (s) => s.media_type === mediaType && s.game_id === gameId,
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
        media_type: mediaType,
        status: 'pending',
      })
    }
    setQuizAnswer(answerId)
    playSubmitSound()
  }

  async function cancelPendingSubmission(subId: string) {
    setCancelling(true)
    try {
      await supabase.from('submissions').update({ status: 'cancelled' }).eq('id', subId)
      notify('Submission cancelled')
      setSelectedGame(null)
      setCaptureFile(null)
      setSubmitDone(false)
    } finally {
      setCancelling(false)
    }
  }

  async function submitBingoSquare(index: number, gameId: string) {
    if (state.bingo_state === 'revealed') return
    setBingoPick(index)
    const existing = mySubs.find(
      (s) =>
        s.media_type === 'bingo' &&
        s.game_id === gameId &&
        s.media_url === String(index),
    )
    if (existing) {
      await supabase.from('submissions').delete().eq('id', existing.id)
      setBingoPick(null)
      return
    }
    await supabase.from('submissions').insert({
      event_id: event.id,
      team_id: teamId,
      game_id: gameId,
      media_url: String(index),
      media_type: 'bingo',
      status: 'pending',
    })
  }

  const showMainHeader = !selectedGame && state.winner_reveal_stage < 1

  const header = showMainHeader ? (
    <header className="mb-6 flex flex-col items-center gap-2 px-2 pt-10 text-center sm:pt-12">
      {logo ? (
        <img
          src={logo}
          alt=""
          className="max-h-14 max-w-[200px] object-contain drop-shadow-md"
        />
      ) : null}
      <h1 className="text-xl font-bold drop-shadow-sm sm:text-2xl">{event.name}</h1>
      {stage?.type === 'quiz' && stage.gameId ? (
        state.quiz_state === 'results' ? (
          <p className="rounded-full bg-black/30 px-4 py-1 text-sm font-semibold tabular-nums">
            {quizLeaderboard(bundle.teams, submissions, stage.gameId).find(
              (e) => e.team.id === teamId,
            )?.quizPoints ?? 0}{' '}
            quiz pts
          </p>
        ) : state.quiz_state === 'active' && quizRunning ? (
          <p className="rounded-full bg-black/30 px-4 py-1 text-sm font-mono font-semibold tabular-nums">
            {formatTimer(quizTimerDisplay)}
          </p>
        ) : null
      ) : (
        <p className="rounded-full bg-black/30 px-4 py-1 text-sm font-semibold tabular-nums">
          {team.score} points
        </p>
      )}
    </header>
  ) : null

  let body: ReactNode

  const eventRanked = eventRankedTeams(bundle.teams)

  if (state.winner_reveal_stage >= 1) {
    body = (
      <WinnerRevealPanel
        stage={state.winner_reveal_stage as 1 | 2}
        ranked={eventRanked}
        myTeamId={teamId}
      />
    )
  } else if (!live) {
    body = (
      <p className="px-6 py-16 text-center text-lg font-medium opacity-90">
        Event starting soon…
      </p>
    )
  } else if (live && !canSubmit && stage?.type === 'open') {
    body = (
      <p className="px-6 py-16 text-center text-lg font-semibold opacity-95">
        This event is now closed. Submissions are no longer accepted.
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
      const latestSub = activeSubmissionForGame(mySubs, selectedGame.id)
      const pending = latestSub?.status === 'pending'
      const locked =
        latestSub?.status === 'approved' || latestSub?.status === 'rejected'

      body = (
        <div className="mx-auto flex h-[calc(100dvh-3rem)] max-w-lg flex-col px-3 pt-2 pb-4">
          <Button
            variant="outline"
            size="sm"
            className="mb-3 w-fit shrink-0 border-white/40 bg-black/30 px-4 py-2 font-semibold shadow-md backdrop-blur-sm hover:bg-black/50"
            onClick={() => {
              setSelectedGame(null)
              setCaptureFile(null)
              setSubmitDone(false)
            }}
          >
            ← Back
          </Button>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            <h2 className="shrink-0 text-lg font-bold leading-tight sm:text-xl">
              {selectedGame.name}
            </h2>
            <p className="shrink-0 text-xs opacity-80 sm:text-sm">
              {gamePointsDisplay(selectedGame)}
              {selectedGame.description ? ` · ${selectedGame.description}` : ''}
            </p>
            {!canSubmit ? (
              <p
                className="shrink-0 text-center text-sm font-semibold"
                style={{ color: accent }}
              >
                Event closed — no new submissions
              </p>
            ) : null}
          <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto">
          {pending ? (
            <div className="space-y-3 text-center">
              <p className="text-lg font-semibold" style={{ color: accent }}>
                Submission pending approval
              </p>
              {latestSub?.media_url ? (
                latestSub.media_type === 'video' ? (
                  <video
                    src={latestSub.media_url}
                    controls
                    className="w-full rounded-lg opacity-90"
                  />
                ) : (
                  <img
                    src={latestSub.media_url}
                    alt=""
                    className="w-full rounded-lg opacity-90"
                  />
                )
              ) : null}
              <Button
                className="w-full border-white/30 bg-white/10 text-white"
                variant="outline"
                disabled={cancelling}
                onClick={() =>
                  latestSub && void cancelPendingSubmission(latestSub.id)
                }
              >
                {cancelling ? 'Cancelling…' : 'Cancel Submission'}
              </Button>
              <p className="text-xs text-white/60">
                Cancel to retake this challenge from scratch
              </p>
            </div>
          ) : submitDone ? (
            <p className="text-center text-lg font-semibold" style={{ color: accent }}>
              Submitted! Waiting for approval…
            </p>
          ) : capturePreview ? (
            <div className="space-y-4">
              {selectedGame.type === 'video' ? (
                <video
                  key={capturePreview}
                  controls
                  playsInline
                  preload="auto"
                  className="w-full rounded-lg bg-black"
                >
                  <source
                    src={capturePreview}
                    type={captureFile?.type || 'video/mp4'}
                  />
                </video>
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
                <LiveAccentButton
                  className="flex-1"
                  accentColor={accent}
                  disabled={submitting}
                  onClick={() => void submitOpenGame()}
                >
                  {submitting ? 'Submitting…' : 'Submit'}
                </LiveAccentButton>
              </div>
            </div>
          ) : locked ? (
            <p className="text-center opacity-70">
              This challenge is closed ({latestSub?.status})
            </p>
          ) : !canSubmit ? null : (
            <>
              {selectedGame.type === 'video' ? (
                <VideoChallengeCapture
                  config={selectedGame.config as GameConfig}
                  accentColor={accent}
                  disabled={submitting}
                  onFileReady={setCaptureFile}
                />
              ) : (
                <PhotoChallengeCapture
                  accentColor={accent}
                  disabled={submitting}
                  onFileReady={setCaptureFile}
                />
              )}
            </>
          )}
          </div>
          </div>
        </div>
      )
    } else {
      body = (
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 px-4 pb-24">
          {openGames.map((g) => {
            const sub = activeSubmissionForGame(mySubs, g.id)
            const approved = sub?.status === 'approved'
            const rejected = sub?.status === 'rejected'
            const pending = sub?.status === 'pending'
            const locked = approved || rejected
            return (
              <button
                key={g.id}
                type="button"
                disabled={locked || !canSubmit}
                className={`relative flex min-h-[120px] flex-col justify-between rounded-xl p-4 text-left shadow-md transition-transform ${
                  locked
                    ? 'cursor-not-allowed opacity-50'
                    : pending
                      ? 'ring-2 ring-white/40'
                      : 'active:scale-[0.98]'
                }`}
                style={{ backgroundColor: accent, color: onAccent }}
                onClick={() => !locked && setSelectedGame(g)}
              >
                {approved ? (
                  <Check className="absolute top-2 right-2 size-6 opacity-80" />
                ) : rejected ? (
                  <X className="absolute top-2 right-2 size-6 opacity-80" />
                ) : null}
                <span className="line-clamp-2 font-bold leading-snug pr-6">{g.name}</span>
                <span className="mt-2 text-sm font-medium opacity-90">
                  {gamePointsDisplay(g)}
                </span>
                {pending ? (
                  <span className="mt-1 text-xs font-semibold">Pending…</span>
                ) : approved ? (
                  <span className="mt-1 text-xs font-semibold">Approved</span>
                ) : rejected ? (
                  <span className="mt-1 text-xs font-semibold">Rejected</span>
                ) : null}
              </button>
            )
          })}
        </div>
      )
    }
  } else if (stage?.type === 'quiz' && stage.gameId) {
    const game = quizGame
    const q = currentQuizQ
    const existing = q
      ? mySubs.find(
          (s) =>
            s.media_type === quizSubmissionMediaType(q.id) &&
            s.game_id === stage.gameId,
        )
      : undefined
    const maxSec = (game?.config as GameConfig)?.timer_seconds ?? 20
    const timerPct =
      maxSec > 0
        ? Math.min(100, (quizTimerDisplay / maxSec) * 100)
        : 0

    if (state.quiz_state === 'results') {
      body = (
        <QuizResultsPanel
          title="Your quiz results"
          entries={quizLeaderboard(bundle.teams, submissions, stage.gameId)}
          highlightTeamId={teamId}
        />
      )
    } else if (state.quiz_state === 'ended' && quizGame) {
      body = (
        <div className="mx-auto max-w-lg px-6 py-20 text-center">
          <p className="text-2xl font-bold">Quiz has ended</p>
          <p className="mt-3 text-white/70">Thanks for playing!</p>
        </div>
      )
    } else if (
      (state.quiz_state === 'idle' || state.quiz_state === 'waiting') &&
      quizGame
    ) {
      body = (
        <div className="mx-auto max-w-lg px-6 py-20 text-center">
          <p className="text-lg text-white/80">Get ready for</p>
          <p className="mt-3 text-3xl font-bold text-white">{quizGame.name}</p>
          <p className="mt-2 text-xl font-semibold text-white">Quiz</p>
          <p className="text-muted-foreground mt-8 text-sm text-white/50">
            Waiting for the facilitator to start…
          </p>
        </div>
      )
    } else if (state.quiz_state === 'revealed' && q) {
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
    } else if (q && state.quiz_state === 'active') {
      body = (
        <div className="mx-auto max-w-lg px-4 pb-24">
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-black/30">
            <div
              className="h-full transition-all duration-1000"
              style={{ width: `${timerPct}%`, backgroundColor: accent }}
            />
          </div>
          <p className="mb-1 text-center text-xs text-white/70">
            {formatTimer(quizTimerDisplay)} remaining
          </p>
          <h2 className="mb-6 text-center text-lg font-bold leading-snug">{q.text}</h2>
          <div className="space-y-3">
            {q.answers.map((a) => {
              const selected = quizAnswer === a.id
              const faded = quizLocked && !selected
              const revealed = state.quiz_state === 'revealed'
              const isCorrect = a.id === q.correctAnswerId
              let cls =
                'w-full rounded-xl px-4 py-4 text-left text-sm font-semibold transition-colors '
              let style: CSSProperties | undefined
              if (revealed) {
                if (isCorrect) cls += 'bg-green-600/90 text-white ring-2 ring-green-300'
                else if (selected) cls += 'bg-red-600/90 text-white'
                else cls += 'bg-white/10 text-white/50'
              } else if (selected) {
                cls += 'ring-2 ring-white/40'
                style = {
                  backgroundColor: STANDBY_ACCENT,
                  color: textOnAccent(STANDBY_ACCENT),
                }
              } else if (faded) {
                cls += 'cursor-not-allowed bg-white/10 text-white/40'
              } else {
                cls += 'bg-white/15 text-white hover:bg-white/25'
              }
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={quizLocked}
                  className={cls}
                  style={style}
                  onClick={() => void submitQuizAnswer(a.id, stage.gameId!, q.id)}
                >
                  {a.text}
                </button>
              )
            })}
          </div>
          {quizChangeLeft != null && !quizLocked ? (
            <div
              className="mt-4 rounded-xl px-4 py-3 text-center"
              style={{ backgroundColor: `${accent}33` }}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-white/80">
                Change answer
              </p>
              <p
                className="font-mono text-3xl font-bold tabular-nums"
                style={{ color: accent }}
              >
                {quizChangeLeft}s
              </p>
            </div>
          ) : null}
        </div>
      )
    }
  } else if (stage?.type === 'bingo' && stage.gameId) {
    const game = games.find((g) => g.id === stage.gameId)
    const tracks = game ? bingoTracks(game) : []
    const titles = bingoCardQuery.data
      ? bingoCellLabels(bingoCardQuery.data)
      : bingoCardTitles(teamId, tracks)
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
            else if (bingoPick === i) cls = 'font-semibold'
            const pickStyle =
              bingoPick === i && !revealed
                ? {
                    backgroundColor: STANDBY_ACCENT,
                    color: textOnAccent(STANDBY_ACCENT),
                  }
                : undefined
            return (
              <button
                key={i}
                type="button"
                disabled={revealed}
                className={`aspect-square p-0.5 text-[8px] leading-tight ${cls}`}
                style={pickStyle}
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
    <BrandBackground
      event={event}
      organization={organization}
      variant="default"
      className="flex min-h-dvh flex-col"
    >
      <NotificationAccentSync color={accent} />
      {!selectedGame ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="fixed top-3 left-3 z-40 size-10 rounded-lg border-white/35 bg-black/35 text-inherit shadow-md backdrop-blur-sm hover:bg-black/55"
          onClick={() => void handleExitTeam()}
          aria-label={exitMode === 'tablet' ? 'Exit to events' : 'Leave team'}
        >
          <LogOut className="size-4" />
        </Button>
      ) : null}
      {header}
      <div className="flex-1 min-h-0">{body}</div>
      <Button
        className="fixed bottom-4 right-4 size-12 rounded-full shadow-lg hover:brightness-95"
        size="icon"
        style={{ backgroundColor: accent, color: onAccent }}
        onClick={() => setChatOpen(true)}
      >
        <MessageCircle className="size-5" />
      </Button>
      {chatOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/15 p-4 text-white">
            <span className="font-semibold">Chat with facilitator</span>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={() => setChatOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <ul className="flex-1 space-y-2 overflow-auto p-4 text-white">
            {visibleMessages.map((m) => (
              <li key={m.id} className="text-sm">
                <span className="font-medium" style={{ color: accent }}>
                  {m.sender}:{' '}
                </span>
                {m.message}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 border-t border-white/15 p-4">
            <input
              className="flex-1 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50"
              placeholder="Message…"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
            />
            <LiveAccentButton
              accentColor={accent}
              onClick={() => {
                onSendMessage(chatText)
                setChatText('')
              }}
            >
              Send
            </LiveAccentButton>
          </div>
        </div>
      ) : null}
      {announcement ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6">
          <Card className="max-w-md space-y-4 p-6 text-center">
            <p className="text-lg">{announcement}</p>
            <LiveAccentButton accentColor={accent} onClick={onDismissAnnouncement}>
              Dismiss
            </LiveAccentButton>
          </Card>
        </div>
      ) : null}
    </BrandBackground>
  )
}
