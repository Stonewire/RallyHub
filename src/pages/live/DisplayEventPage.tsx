import confetti from 'canvas-confetti'
import { Volume2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { BingoWinCelebration } from '@/components/live/BingoWinCelebration'
import { BrandBackground } from '@/components/live/BrandBackground'
import { PoweredByRallyHub } from '@/components/live/PoweredByRallyHub'
import { ClientBrandingStyle } from '@/components/branding/ClientBrandingStyle'
import { DemoOverlay } from '@/components/live/DemoOverlay'
import { EventNotLiveScreen } from '@/components/live/EventNotLiveScreen'
import { DisplayPodium } from '@/components/live/DisplayPodium'
import { DisplayShell } from '@/components/live/DisplayShell'
import { Leaderboard } from '@/components/live/Leaderboards'
import { QuizResultsPanel } from '@/components/live/QuizResultsPanel'
import { useLiveTimer } from '@/hooks/use-live-timer'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useLiveEvent } from '@/hooks/use-live-event'
import { setLiveParticipantMode } from '@/lib/supabase'
import { parseAnnouncedWinnerIds } from '@/lib/bingo-cell-match'
import { createThrottledTimerSync } from '@/lib/live-timer-sync'
import { playEventWinnerSequence, installAudioUnlock, resetEventWinnerAudioGuard, unlockAudioFromUserGesture } from '@/lib/sounds'
import { winnerSoundEnabled } from '@/lib/winner-sound'
import {
  currentStage,
  breakDurationSeconds,
  displayTextClass,
  displayTextColorForEvent,
  formatBreakTimer,
  formatTimer,
  isEventLive,
  logoForEvent,
  parseStages,
  quizQuestions,
  quizLeaderboard,
  quizSubmissionMediaType,
  quizTimerRunning,
  quizTimerSeconds,
} from '@/lib/live-event'
import {
  roundIndexForQuestion,
  roundIntroDisplay,
  quizRoundForQuestionIndex,
} from '@/lib/quiz-rounds'

/** Match celebration.mp3 length so confetti runs for the full song on display. */
const EVENT_WINNER_CONFETTI_MS = 185_000

type DisplayEventPageProps = {
  /** When true, skip the tap-to-enable sound gate (facilitator iframe preview). */
  embedded?: boolean
}

export function DisplayEventPage({ embedded: embeddedProp }: DisplayEventPageProps = {}) {
  const { eventId } = useParams<{ eventId: string }>()
  const [searchParams] = useSearchParams()
  const embedFromUrl = searchParams.get('embed') === '1'
  const embedded = embeddedProp ?? embedFromUrl

  // A standalone display is an anonymous surface. Force the anon role so a
  // logged-in session in the same browser doesn't run its requests as
  // `authenticated`. The embedded preview lives inside the facilitator panel and
  // must keep that session, so it is left untouched.
  if (!embedded) setLiveParticipantMode(true)
  useEffect(() => {
    if (embedded) return
    return () => setLiveParticipantMode(false)
  }, [embedded])

  const { bundle, loading, error } = useLiveEvent(eventId)
  useDocumentTitle('Display', bundle?.event?.name)

  const [dismissedWinnerId, setDismissedWinnerId] = useState<string | null>(null)
  // The display panel is a passive screen that may never be tapped again during
  // an event, so its audio would stay locked by the browser autoplay policy.
  // A one-time "tap to enable sound" gate primes the unlock so win celebration,
  // cheer, fireworks, and the celebration song can play later. Embedded previews
  // (facilitator iframe) skip the gate entirely — they don't need sound.
  const [soundEnabled, setSoundEnabled] = useState(false)
  const showSoundGate = !embedded && !soundEnabled

  useEffect(() => {
    if (!embedded) installAudioUnlock('full')
  }, [embedded])

  const eventState = bundle?.state
  const eventIsLive = Boolean(bundle && isEventLive(bundle.event))
  const stages = useMemo(
    () => (bundle ? parseStages(bundle.event.stages_config) : []),
    [bundle],
  )
  const stage = bundle && bundle.state
    ? currentStage(stages, bundle.state.current_stage_index)
    : null

  const timerSyncRef = useRef(
    createThrottledTimerSync(() => {
      /* display is read-only; facilitator persists timer state */
    }),
  )

  const breakSyncRef = useRef(
    createThrottledTimerSync(() => {
      /* display is read-only; facilitator persists timer state */
    }),
  )

  const quizTimerSyncRef = useRef(
    createThrottledTimerSync(() => {
      /* display is read-only; facilitator persists timer state */
    }),
  )

  const timerDisplay = useLiveTimer(
    eventIsLive ? (eventState?.timer_seconds ?? 0) : 0,
    eventIsLive && Boolean(eventState?.timer_running),
    (next, stillRunning) => timerSyncRef.current(next, stillRunning),
  )

  const quizTimerDisplay = useLiveTimer(
    eventIsLive && eventState ? quizTimerSeconds(eventState) : 0,
    eventIsLive && eventState ? quizTimerRunning(eventState) : false,
    (next, stillRunning) => quizTimerSyncRef.current(next, stillRunning),
  )

  const breakSeconds =
    stage?.type === 'break'
      ? breakDurationSeconds(stage, eventState?.break_timer_seconds)
      : (eventState?.break_timer_seconds ?? 0)

  const breakDisplay = useLiveTimer(
    eventIsLive ? breakSeconds : 0,
    eventIsLive && Boolean(eventState?.break_timer_running),
    (next, stillRunning) => breakSyncRef.current(next, stillRunning),
  )

  const eventWinnerAudioStageRef = useRef(0)

  // Latest bundle, read inside the winner effect without making it a dependency
  // (so routine realtime patches don't re-run the effect and cut the song).
  const bundleRef = useRef(bundle)
  // eslint-disable-next-line react-hooks/refs -- standard "keep ref fresh" idiom, see comment above
  bundleRef.current = bundle

  // Primitives that should actually (re)trigger the winner celebration.
  const winnerRevealStage = bundle?.state.winner_reveal_stage ?? 0
  const audioEventId = bundle?.event.id
  const audioEventLive = bundle ? isEventLive(bundle.event) : false

  // Overall event winner (Reveal Winner stage 2): winner announcement audio plays
  // on the standalone display only. Embedded facilitator preview skips audio.
  // IMPORTANT: depend only on the primitives below — depending on `bundle` made
  // every realtime patch re-run this effect, firing the cleanup's stopAudio() and
  // cutting the announcement after ~1s.
  useEffect(() => {
    if (embedded) return
    if (!audioEventId || !audioEventLive) return
    if (winnerRevealStage === 0) {
      eventWinnerAudioStageRef.current = 0
      resetEventWinnerAudioGuard()
      return
    }
    // Stage 1 is silent — no audio during the build-up.
    if (winnerRevealStage !== 2) return
    if (eventWinnerAudioStageRef.current >= 2) return
    eventWinnerAudioStageRef.current = 2

    const revealKey = `${audioEventId}:winner-reveal:2`
    // Confetti always runs; the celebration audio is gated by the facilitator's
    // winner sound routing.
    const stopAudio = winnerSoundEnabled(bundleRef.current?.state.winner_sound_targets, 'display')
      ? playEventWinnerSequence(revealKey)
      : () => {}

    const confettiEnd = Date.now() + EVENT_WINNER_CONFETTI_MS
    let rafId = 0
    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0 } })
      confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1 } })
      if (Date.now() < confettiEnd) rafId = requestAnimationFrame(frame)
    }
    frame()
    confetti({ particleCount: 140, spread: 100, startVelocity: 45, origin: { y: 0.5 } })
    const burst = window.setInterval(() => {
      confetti({ particleCount: 90, spread: 110, startVelocity: 42, origin: { y: 0.6 } })
    }, 1200)

    return () => {
      stopAudio()
      if (rafId) cancelAnimationFrame(rafId)
      window.clearInterval(burst)
    }
  }, [embedded, audioEventId, audioEventLive, winnerRevealStage])

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

  if (!isEventLive(event)) {
    return <EventNotLiveScreen event={event} organization={organization} />
  }

  const winnerTeamId = state.bingo_winner_team_id ?? null
  const winnerTeam = winnerTeamId ? teams.find((t) => t.id === winnerTeamId) : null
  const announcedWinnerIds = parseAnnouncedWinnerIds(state.bingo_announced_winner_ids)
  const showWinner =
    Boolean(winnerTeam) &&
    winnerTeamId != null &&
    winnerTeamId !== dismissedWinnerId &&
    announcedWinnerIds.includes(winnerTeamId) &&
    state.bingo_state === 'revealed'
  const logo = logoForEvent(event, organization, displayTextColorForEvent(event))
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
  const namedTeams = teams.filter((t) => t.name?.trim())
  const quizAnsweredTeamIds = new Set(quizSubs.map((s) => s.team_id))
  const quizResultsEntries =
    stage?.type === 'quiz' && stage.gameId
      ? quizLeaderboard(teams, submissions, stage.gameId)
      : []

  let body: ReactNode

  if (state.winner_reveal_stage === 1) {
    body = (
      <div className="xp-break-panel px-6 py-8">
        <p
          className={`animate-pulse text-center font-sans text-4xl font-bold md:text-6xl ${textClass}`}
        >
          It is time to announce the winners…
        </p>
      </div>
    )
  } else if (state.winner_reveal_stage === 2) {
    body = <DisplayPodium event={event} teams={teams} />
  } else if (!stage || stage.type === 'open' || stage.type === 'bingo') {
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
        <p className="font-sans text-4xl font-bold md:text-6xl">Quiz has ended</p>
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
        <p className="font-sans text-2xl font-bold opacity-80 md:text-4xl">
          Get ready for
        </p>
        <p className="font-sans mt-4 text-4xl font-bold md:text-6xl">
          {quizGame.name}
        </p>
        <p className="font-sans mt-2 text-2xl font-bold opacity-90 md:text-4xl">
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
    state.quiz_state === 'round_intro' &&
    quizGame
  ) {
    const round = quizRoundForQuestionIndex(quizGame, state.current_question_index)
    const intro = round
      ? roundIntroDisplay(
          round,
          roundIndexForQuestion(quizGame, question),
        )
      : { title: 'NEXT ROUND', subtitle: '' }
    body = (
      <div className={`text-center ${textClass}`}>
        <p className="font-sans text-5xl font-bold md:text-7xl lg:text-8xl">{intro.title}</p>
        {intro.subtitle ? (
          <p className="font-sans mt-6 text-3xl font-bold opacity-90 md:text-5xl">
            {intro.subtitle}
          </p>
        ) : null}
      </div>
    )
  } else if (
    stage.type === 'quiz' &&
    question &&
    (state.quiz_state === 'active' || state.quiz_state === 'revealed')
  ) {
    body = (
      <div className={`w-full max-w-4xl text-center ${textClass}`}>
        <h2 className="font-sans mb-6 text-3xl font-bold leading-tight md:text-5xl lg:text-6xl">
          {question.text}
        </h2>
        {state.quiz_state === 'active' && quizTimerRunning(state) ? (
          <p className="font-sans mb-8 text-6xl font-bold tabular-nums md:text-8xl">
            {formatTimer(quizTimerDisplay)}
          </p>
        ) : null}
        <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
          {question.answers.map((a) => {
            const revealed = state.quiz_state === 'revealed'
            const correct = a.id === state.quiz_correct_answer_id
            let cls =
              'xp-quiz-option rounded-2xl px-6 py-5 font-sans text-lg font-semibold md:text-xl '
            if (revealed) {
              // Only the correct answer is highlighted (green). What each team
              // picked is shown by the team names below, not by colouring options.
              if (correct) cls += 'bg-green-600/90 text-white ring-2 ring-green-300'
              else cls += 'bg-white/15 text-white/50 backdrop-blur-sm'
            } else {
              cls += 'bg-white/15 backdrop-blur-sm'
            }
            return (
              <div key={a.id} className={cls}>
                {a.text}
              </div>
            )
          })}
        </div>
        {state.quiz_state === 'active' ? (
          <div className="mt-8 space-y-3">
            <p className="text-lg font-semibold opacity-90 md:text-xl">
              {quizAnsweredTeamIds.size} of {namedTeams.length} teams answered
            </p>
            <ul className="flex flex-wrap justify-center gap-2">
              {namedTeams.map((team) => {
                const answered = quizAnsweredTeamIds.has(team.id)
                return (
                  <li
                    key={team.id}
                    className={`xp-results-row rounded-full px-4 py-1.5 text-sm font-medium ${
                      answered ? 'bg-white/25 text-white' : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {team.name}
                    {answered ? ' ✓' : ''}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <ul className="mt-8 flex flex-wrap justify-center gap-2">
            {quizSubs.map((s) => {
              const team = teams.find((t) => t.id === s.team_id)
              if (!team?.name) return null
              const ok = s.media_url === state.quiz_correct_answer_id
              return (
                <li
                  key={s.id}
                  className={`xp-results-row rounded-full px-4 py-1.5 text-sm font-medium ${
                    ok ? 'bg-green-600/80 text-white' : 'bg-red-600/80 text-white'
                  }`}
                >
                  {team.name}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  } else if (stage.type === 'break') {
    body = (
      <div className={`xp-break-panel flex flex-col items-center justify-center text-center ${textClass}`}>
        <p className="font-sans text-4xl font-bold md:text-6xl lg:text-7xl">
          {stage.message ?? 'Break time'}
        </p>
        <p className="font-sans mt-10 text-7xl font-bold tabular-nums md:text-9xl">
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
    stage?.type !== 'break' &&
    state.winner_reveal_stage < 1

  const headerTimer = showHeaderTimer ? (
    <span
      className={`font-sans text-2xl font-bold tabular-nums md:text-3xl ${
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
      className={embedded ? 'h-screen overflow-hidden' : undefined}
    >
      <ClientBrandingStyle org={organization} />
      <DisplayShell logo={logo} title={event.name} headerRight={headerTimer}>
        {body}
      </DisplayShell>
      <PoweredByRallyHub
        hidden={organization?.hide_platform_branding}
        position="bottom-right"
        theme={displayTextColorForEvent(event) === 'black' ? 'dark' : 'light'}
      />
      {showAnnouncement ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-8">
          <p className="font-sans max-w-4xl text-center text-3xl font-bold text-white md:text-5xl">
            {state.announcement}
          </p>
        </div>
      ) : null}
      {showWinner && winnerTeam ? (
        <BingoWinCelebration
          key={winnerTeamId}
          teamName={winnerTeam.name ?? 'Team'}
          teamColor={winnerTeam.color}
          onDismiss={() => setDismissedWinnerId(winnerTeamId)}
        />
      ) : null}
      {showSoundGate ? (
        <button
          type="button"
          onClick={() => {
            unlockAudioFromUserGesture('full')
            setSoundEnabled(true)
          }}
          className="fixed inset-0 z-[10050] flex flex-col items-center justify-center gap-6 bg-black/90 px-8 text-center text-white"
          aria-label="Tap to enable sound"
        >
          <Volume2 className="size-16 opacity-90" />
          <span className="font-sans text-3xl font-bold md:text-5xl">Tap to enable sound</span>
          <span className="max-w-xl text-base text-white/70 md:text-lg">
            Enable audio so the display can play the bingo celebration, cheers, and music
            during the event.
          </span>
          <span className="xp-interactive mt-2 rounded-full bg-white px-8 py-3 text-lg font-semibold text-black">
            Tap anywhere to continue
          </span>
        </button>
      ) : null}
      <DemoOverlay enabled={event.status === 'demo'} />
    </BrandBackground>
  )
}
