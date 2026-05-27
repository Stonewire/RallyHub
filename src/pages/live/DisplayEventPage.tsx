import confetti from 'canvas-confetti'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { BrandBackground } from '@/components/live/BrandBackground'
import { DisplayPodium } from '@/components/live/DisplayPodium'
import { DisplayShell } from '@/components/live/DisplayShell'
import { Leaderboard } from '@/components/live/Leaderboards'
import { QuizResultsPanel } from '@/components/live/QuizResultsPanel'
import { useLiveTimer } from '@/hooks/use-live-timer'
import { useLiveEvent } from '@/hooks/use-live-event'
import { createThrottledTimerSync } from '@/lib/live-timer-sync'
import {
  STANDBY_ACCENT,
  bingoTracks,
  currentStage,
  breakDurationSeconds,
  displayTextClass,
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
  const textClass = displayTextClass(event)
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
      <p
        className={`animate-pulse text-center font-display text-4xl font-bold md:text-6xl ${textClass}`}
      >
        It is time to announce the winners…
      </p>
    )
  } else if (state.winner_reveal_stage === 2) {
    body = <DisplayPodium event={event} teams={teams} />
  } else if (event.status !== 'active') {
    body = (
      <p className={`text-center font-display text-3xl font-bold opacity-80 ${textClass}`}>
        Event starting soon…
      </p>
    )
  } else if (!stage || stage.type === 'open') {
    body = (
      <Leaderboard
        teams={teams}
        showScores={state.show_scores}
        layout={layout}
        textClass={textClass}
      />
    )
  } else if (stage.type === 'quiz' && state.quiz_state === 'ended' && quizGame) {
    body = (
      <div className={`text-center ${textClass}`}>
        <p className="font-display text-4xl font-bold md:text-6xl">Quiz has ended</p>
        <p className="mt-4 text-xl opacity-80">Thanks for playing!</p>
      </div>
    )
  } else if (
    stage.type === 'quiz' &&
    (state.quiz_state === 'idle' || state.quiz_state === 'waiting') &&
    quizGame
  ) {
    body = (
      <div className={`text-center ${textClass}`}>
        <p className="font-display text-2xl font-bold opacity-80 md:text-4xl">
          Get ready for
        </p>
        <p
          className="font-display mt-4 text-4xl font-bold md:text-6xl"
          style={{ color: STANDBY_ACCENT }}
        >
          {quizGame.name}
        </p>
        <p className="font-display mt-2 text-2xl font-bold opacity-90 md:text-4xl">
          Quiz
        </p>
      </div>
    )
  } else if (stage.type === 'quiz' && state.quiz_state === 'results' && stage.gameId) {
    body = (
      <QuizResultsPanel
        title="Quiz leaderboard"
        entries={quizResultsEntries}
        large
      />
    )
  } else if (
    stage.type === 'quiz' &&
    question &&
    (state.quiz_state === 'active' || state.quiz_state === 'revealed')
  ) {
    body = (
      <div className={`w-full max-w-4xl text-center ${textClass}`}>
        <h2 className="font-display mb-6 text-3xl font-bold leading-tight md:text-5xl lg:text-6xl">
          {question.text}
        </h2>
        {state.quiz_state === 'active' && state.timer_running ? (
          <p className="font-display mb-8 text-6xl font-bold tabular-nums md:text-8xl">
            {formatTimer(timerDisplay)}
          </p>
        ) : null}
        <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
          {question.answers.map((a) => {
            const revealed = state.quiz_state === 'revealed'
            const correct = a.id === question.correctAnswerId
            const anySelected = quizSubs.some((s) => s.media_url === a.id)
            let cls =
              'rounded-2xl px-6 py-5 font-display text-lg font-semibold md:text-xl '
            if (revealed) {
              if (correct) cls += 'bg-green-600/90 text-white ring-2 ring-green-300'
              else if (anySelected) cls += 'bg-red-600/90 text-white'
              else cls += 'bg-white/15 text-white/50 backdrop-blur-sm'
            } else if (anySelected) {
              cls += 'ring-2 ring-white/40'
            } else {
              cls += 'bg-white/15 backdrop-blur-sm'
            }
            return (
              <div
                key={a.id}
                className={cls}
                style={
                  !revealed && anySelected
                    ? { backgroundColor: STANDBY_ACCENT, color: '#3E3D3E' }
                    : undefined
                }
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
                <li
                  key={s.id}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                    ok ? 'bg-green-600/80 text-white' : 'bg-red-600/80 text-white'
                  }`}
                >
                  {team.name}
                </li>
              )
            }
            return (
              <li
                key={s.id}
                className="rounded-full bg-white/15 px-4 py-1.5 text-sm backdrop-blur-sm"
              >
                {team.name}
              </li>
            )
          })}
        </ul>
      </div>
    )
  } else if (stage.type === 'bingo') {
    body = (
      <div className={`flex flex-col items-center justify-center ${textClass}`}>
        <div className="mb-12 flex h-32 items-end justify-center gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="w-3 animate-pulse rounded-t bg-white/60"
              style={{
                height: `${20 + Math.sin(Date.now() / 200 + i) * 40}px`,
              }}
            />
          ))}
        </div>
        {state.bingo_state === 'revealed' && track ? (
          <>
            <p className="font-display text-4xl font-bold md:text-6xl">{track.title}</p>
            <p className="mt-2 font-display text-2xl opacity-70 md:text-4xl">
              {track.artist}
            </p>
            <ul className="mt-8 flex flex-wrap justify-center gap-2">
              {bingoSubs.map((s) => {
                const team = teams.find((t) => t.id === s.team_id)
                const ok = s.status === 'approved'
                return team?.name ? (
                  <li
                    key={s.id}
                    className={`rounded-full px-3 py-1 text-sm ${
                      ok ? 'bg-green-600/80' : 'bg-red-600/80'
                    }`}
                  >
                    {team.name}
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
      <div className={`flex flex-col items-center justify-center text-center ${textClass}`}>
        <p className="font-display text-4xl font-bold md:text-6xl lg:text-7xl">
          {stage.message ?? 'Break time'}
        </p>
        <p className="font-display mt-10 text-7xl font-bold tabular-nums md:text-9xl">
          {formatBreakTimer(breakDisplay)}
        </p>
      </div>
    )
  } else {
    body = (
      <Leaderboard
        teams={teams}
        showScores={state.show_scores}
        layout={layout}
        textClass={textClass}
      />
    )
  }

  const showHeaderTimer =
    state.show_timer_on_display &&
    !isQuizStage &&
    stage?.type !== 'break' &&
    state.quiz_state !== 'results' &&
    state.winner_reveal_stage < 1

  const headerTimer = showHeaderTimer ? (
    <span
      className={`font-display text-2xl font-bold tabular-nums md:text-3xl ${
        textClass === 'text-black' ? 'text-black/80' : 'text-white/90'
      }`}
    >
      {formatTimer(timerDisplay)}
    </span>
  ) : null

  return (
    <BrandBackground
      event={event}
      organization={organization}
      variant={variant}
      className={embed ? 'h-screen overflow-hidden' : undefined}
    >
      <DisplayShell logo={logo} title={event.name} headerRight={headerTimer}>
        {body}
      </DisplayShell>
      {showAnnouncement ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-8">
          <p className="font-display max-w-4xl text-center text-3xl font-bold text-white md:text-5xl">
            {state.announcement}
          </p>
        </div>
      ) : null}
    </BrandBackground>
  )
}
