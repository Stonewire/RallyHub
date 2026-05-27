import confetti from 'canvas-confetti'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { BrandBackground } from '@/components/live/BrandBackground'
import { Leaderboard } from '@/components/live/Leaderboards'
import { QuizResultsPanel } from '@/components/live/QuizResultsPanel'
import { useLiveTimer } from '@/hooks/use-live-timer'
import { useLiveEvent } from '@/hooks/use-live-event'
import { createThrottledTimerSync } from '@/lib/live-timer-sync'
import {
  bingoTracks,
  currentStage,
  breakDurationSeconds,
  formatBreakTimer,
  formatTimer,
  logoForEvent,
  parseStages,
  quizQuestions,
  quizLeaderboard,
  quizSubmissionMediaType,
} from '@/lib/live-event'

export function DisplayEventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [searchParams] = useSearchParams()
  const embed = searchParams.get('embed') === '1'
  const { bundle, loading, error, updateState } = useLiveEvent(eventId)

  const eventState = bundle?.state
  const stages = useMemo(
    () => (bundle ? parseStages(bundle.event.stages_config) : []),
    [bundle],
  )
  const stage = bundle ? currentStage(stages, bundle.state.current_stage_index) : null
  const isQuizStage = stage?.type === 'quiz'

  const timerSyncRef = useMemo(
    () =>
      createThrottledTimerSync((next, stillRunning) => {
        void updateState({ timer_seconds: next, timer_running: stillRunning })
      }),
    [updateState],
  )

  const breakSyncRef = useMemo(
    () =>
      createThrottledTimerSync((next, stillRunning) => {
        void updateState({
          break_timer_seconds: next,
          break_timer_running: stillRunning,
        })
      }),
    [updateState],
  )

  const timerDisplay = useLiveTimer(
    eventState?.timer_seconds ?? 0,
    Boolean(eventState?.timer_running),
    (next, stillRunning) => timerSyncRef(next, stillRunning),
  )

  const breakSeconds =
    stage?.type === 'break'
      ? breakDurationSeconds(stage, eventState?.break_timer_seconds)
      : (eventState?.break_timer_seconds ?? 0)

  const breakDisplay = useLiveTimer(
    breakSeconds,
    Boolean(eventState?.break_timer_running),
    (next, stillRunning) => breakSyncRef(next, stillRunning),
  )

  useEffect(() => {
    if (bundle?.state.winner_reveal_stage !== 2) return
    const end = Date.now() + 3000
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } })
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [bundle?.state.winner_reveal_stage])

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-white"
        style={{ backgroundColor: '#6f6f6f' }}
      >
        Loading…
      </div>
    )
  }

  if (error || !bundle) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-white"
        style={{ backgroundColor: '#6f6f6f' }}
      >
        {error ?? 'Event not found'}
      </div>
    )
  }

  const { event, organization, state, teams, games, submissions } = bundle
  const logo = logoForEvent(event, organization)
  const showAnnouncement =
    Boolean(state.announcement) &&
    (state.announcement_target === 'display' ||
      state.announcement_target === 'both')
  const variant =
    stage?.type === 'break'
      ? 'relaxed'
      : stage?.type === 'bingo'
        ? 'disco'
        : 'default'

  const ranked = [...teams].filter((t) => t.name).sort((a, b) => b.score - a.score)
  const layout =
    event.display_layout === 'orbit_view' ? 'orbit_view' : 'rank_list'

  const quizGame = stage?.type === 'quiz' && stage.gameId
    ? games.find((g) => g.id === stage.gameId)
    : null
  const questions = quizGame ? quizQuestions(quizGame) : []
  const question = questions[state.current_question_index]
  const quizSubs = submissions.filter(
    (s) =>
      s.game_id === stage?.gameId &&
      (s.media_type === 'quiz' ||
        (question && s.media_type === quizSubmissionMediaType(question.id))),
  )
  const quizResultsEntries =
    stage?.type === 'quiz' && stage.gameId
      ? quizLeaderboard(teams, submissions, stage.gameId)
      : []

  const bingoGame = stage?.type === 'bingo' && stage.gameId
    ? games.find((g) => g.id === stage.gameId)
    : null
  const tracks = bingoGame ? bingoTracks(bingoGame) : []
  const trackIdx = state.current_question_index
  const track = tracks[trackIdx]
  const bingoSubs = submissions.filter(
    (s) => s.media_type === 'bingo' && s.game_id === stage?.gameId,
  )

  let body: ReactNode

  if (state.winner_reveal_stage === 1) {
    body = (
      <p className="animate-pulse px-8 text-center text-4xl font-bold md:text-6xl">
        It is time to announce the winners…
      </p>
    )
  } else if (state.winner_reveal_stage === 2) {
    const podium = ranked.slice(0, 3)
    body = (
      <div className="flex w-full flex-col items-center gap-10 px-4 py-8">
        <div className="flex items-end justify-center gap-6">
          {podium.map((team, i) => (
            <div key={team.id} className="flex flex-col items-center gap-2">
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 120 - i * 20,
                  height: 120 - i * 20,
                  boxShadow: `0 0 0 6px ${team.color}`,
                }}
              >
                {team.photo_url ? (
                  <img src={team.photo_url} alt="" className="size-full rounded-full object-cover" />
                ) : (
                  <div className="size-full rounded-full" style={{ background: team.color ?? '#666' }} />
                )}
              </div>
              <span className="text-2xl font-bold">#{i + 1}</span>
              <span>{team.name}</span>
              <span className="text-lg text-white/80">{team.score} pts</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {ranked.slice(3).map((t) => (
            <div key={t.id} className="rounded-lg bg-white/10 px-3 py-2 text-sm">
              {t.name}: {t.score}
            </div>
          ))}
        </div>
      </div>
    )
  } else if (event.status !== 'active') {
    body = (
      <p className="text-center text-2xl text-white/80">
        Event starting soon…
      </p>
    )
  } else if (!stage || stage.type === 'open') {
    body = (
      <Leaderboard
        teams={teams}
        showScores={state.show_scores}
        layout={layout}
      />
    )
  } else if (stage.type === 'quiz' && state.quiz_state === 'results' && stage.gameId) {
    body = (
      <QuizResultsPanel
        title="Quiz leaderboard"
        entries={quizResultsEntries}
        large
      />
    )
  } else if (stage.type === 'quiz' && question) {
    body = (
      <div className="mx-auto max-w-4xl px-6 py-8 text-center">
        <h2 className="mb-8 text-3xl font-bold md:text-5xl">{question.text}</h2>
        {state.quiz_state === 'active' || state.timer_running ? (
          <div className="mb-8 text-5xl font-mono tabular-nums">
            {formatTimer(timerDisplay)}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {question.answers.map((a) => {
            const revealed = state.quiz_state === 'revealed'
            const correct = a.id === question.correctAnswerId
            return (
              <div
                key={a.id}
                className={`rounded-xl px-6 py-4 text-lg font-semibold ${
                  revealed && correct
                    ? 'bg-green-600/80'
                    : 'bg-white/15'
                }`}
              >
                {a.text}
              </div>
            )
          })}
        </div>
        <ul className="mt-8 flex flex-wrap justify-center gap-2">
          {quizSubs.map((s) => {
            const team = teams.find((t) => t.id === s.team_id)
            if (!team?.name) return null
            if (state.quiz_state === 'revealed') {
              const ok = s.media_url === question.correctAnswerId
              return (
                <li key={s.id} className="rounded-full bg-white/10 px-3 py-1 text-sm">
                  {team.name} {ok ? '✓' : '✗'}
                </li>
              )
            }
            return (
              <li key={s.id} className="rounded-full bg-white/10 px-3 py-1 text-sm">
                {team.name}
              </li>
            )
          })}
        </ul>
      </div>
    )
  } else if (stage.type === 'bingo') {
    body = (
      <div className="flex flex-col items-center justify-center px-6 py-16">
        <div className="mb-12 flex h-32 items-end justify-center gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="w-3 animate-pulse rounded-t bg-white/60"
              style={{
                height: `${20 + Math.sin(Date.now() / 200 + i) * 40}px`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>
        {state.bingo_state === 'revealed' && track ? (
          <>
            <p className="text-4xl font-bold">{track.title}</p>
            <p className="mt-2 text-2xl text-white/70">{track.artist}</p>
            <ul className="mt-8 flex flex-wrap justify-center gap-2">
              {bingoSubs.map((s) => {
                const team = teams.find((t) => t.id === s.team_id)
                const ok = s.status === 'approved'
                return team?.name ? (
                  <li key={s.id} className="rounded-full bg-white/10 px-3 py-1">
                    {team.name} {ok ? '✓' : '✗'}
                  </li>
                ) : null
              })}
            </ul>
          </>
        ) : null}
      </div>
    )
  } else if (stage.type === 'break') {
    body = (
      <div className="px-8 text-center">
        <p className="text-4xl font-bold md:text-6xl">{stage.message ?? 'Break time'}</p>
        <p className="mt-8 font-mono text-6xl tabular-nums">{formatBreakTimer(breakDisplay)}</p>
      </div>
    )
  } else {
    body = <Leaderboard teams={teams} showScores={state.show_scores} layout={layout} />
  }

  const showHeaderTimer =
    state.show_timer_on_display &&
    !isQuizStage &&
    stage?.type !== 'break' &&
    state.quiz_state !== 'results'

  return (
    <BrandBackground
      event={event}
      organization={organization}
      variant={variant}
      className={embed ? 'h-screen overflow-hidden' : undefined}
    >
      <header className="relative flex items-start justify-between px-6 pt-6">
        <div className="flex flex-1 flex-col items-center">
          {logo ? (
            <img
              src={logo}
              alt=""
              className="mb-4 max-h-20 max-w-[240px] object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
            />
          ) : null}
          <h1 className="text-center text-3xl font-bold drop-shadow-md md:text-5xl">
            {event.name}
          </h1>
        </div>
        {showHeaderTimer ? (
          <div className="font-mono text-2xl tabular-nums text-white/90">
            {formatTimer(timerDisplay)}
          </div>
        ) : (
          <div className="w-24" />
        )}
      </header>
      <main className={embed ? 'h-[calc(100vh-8rem)] overflow-hidden' : 'min-h-[70vh]'}>
        {body}
      </main>
      {showAnnouncement ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-8">
          <p className="max-w-4xl text-center text-3xl font-bold md:text-5xl">
            {state.announcement}
          </p>
        </div>
      ) : null}
    </BrandBackground>
  )
}
