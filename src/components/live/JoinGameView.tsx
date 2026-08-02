import { LogOut, MessageCircle, QrCode } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { BingoCardCellLabel } from '@/components/live/BingoCardCellLabel'
import { DemoOverlay } from '@/components/live/DemoOverlay'
import { GameUnavailableFallback } from '@/components/live/GameUnavailableFallback'
import {
  ParticipantAnnouncementOverlay,
  ParticipantChatOverlay,
  ParticipantExitDialog,
} from '@/components/live/participant/JoinGameOverlays'
import { ParticipantBingoNotice } from '@/components/live/participant/ParticipantBingoNotice'
import { InventoryQrScanner } from '@/components/live/participant/InventoryQrScanner'
import { OpenGameChallengeCard } from '@/components/live/OpenGameChallengeCard'
import { QuizQuestionMedia } from '@/components/live/QuizQuestionMedia'
import { DevQuizBar } from '@/components/live/DevQuizBar'
import { devQuizSteps } from '@/lib/dev-quiz-steps'
import { OpenGameChallengeReview } from '@/components/live/OpenGameChallengeReview'
import { OpenGameSubmittingScreen } from '@/components/live/OpenGameSubmittingScreen'
import { OpenGameTextChallenge } from '@/components/live/OpenGameTextChallenge'
import { PuzzleGamePlayer } from '@/components/live/PuzzleGamePlayer'
import { BrandBackground } from '@/components/live/BrandBackground'
import { QuizResultsPanel } from '@/components/live/QuizResultsPanel'
import { ChallengeMediaCaptureFlow } from '@/components/live/ChallengeMediaCaptureFlow'
import {
  WinnerRevealPanel,
  eventRankedTeams,
} from '@/components/live/WinnerRevealPanel'
import { Button } from '@/components/ui/button'
import {
  NotificationAccentSync,
  useNotification,
} from '@/contexts/notification-context'
import { useIncomingChatAlerts } from '@/hooks/use-chat-notifications'
import { useBingoRun, useBingoTeamCard } from '@/hooks/use-bingo-run'
import {
  DiagnosticReportedError,
  nowMs,
  reportClientIssue,
  reportClientTiming,
} from '@/lib/client-diagnostics'
import { queryKeys } from '@/lib/query-keys'
import { bingoCellDisplay } from '@/lib/bingo-engine'
import {
  missedBingoCellIndices,
  parseAnnouncedWinnerIds,
  parseRevealedTrackIds,
  resolveBingoSubmissionCellIndex,
} from '@/lib/bingo-cell-match'
import {
  approvedBingoCellIndices,
  bingoWinningHighlightCells,
  resolveBingoWinConfig,
} from '@/lib/bingo-lines'
import { parseBingoGameConfig } from '@/lib/bingo-facilitator'
import type { LiveEventBundle } from '@/lib/live-event'
import {
  bingoCardTitles,
  bingoTracks,
  brandColorsForEvent,
  breakDurationSeconds,
  currentStage,
  displayTextColorForEvent,
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
import { winnerSoundEnabled } from '@/lib/winner-sound'
import { isFacilitatorToTeamChatMessage } from '@/lib/chat-notifications'
import { applyLiveBundlePatch, publishSubmissionChange } from '@/lib/live-broadcast'
import { isTextGame, resolveGameFromList } from '@/lib/text-game'
import {
  roundIndexForQuestion,
  roundIntroDisplay,
  quizRoundForQuestionIndex,
} from '@/lib/quiz-rounds'
import { useLiveTimer } from '@/hooks/use-live-timer'
import { createThrottledTimerSync } from '@/lib/live-timer-sync'
import {
  playAnnouncementSound,
  playEventWinnerSequence,
  playNewMessageSound,
  playPushNotificationSound,
  playQuizCorrectSound,
  playQuizSelectSound,
  playQuizTimerWarningSound,
  playQuizWrongSound,
  playSubmitSound,
  installAudioUnlock,
  unlockAudioFromUserGesture,
  resetEventWinnerAudioGuard,
} from '@/lib/sounds'
import { verifyTabletPassword } from '@/lib/tenant'
import { isPuzzleGame } from '@/lib/puzzle-engine'
import { supabase } from '@/lib/supabase'
import {
  mintParticipantUpload,
  uploadParticipantAsset,
  uploadToMintedParticipantUrl,
  type MintedParticipantUpload,
} from '@/lib/storage'
import type { GameConfig } from '@/types/game-config'
import type { Tables } from '@/types/helpers'

type JoinGameViewProps = {
  bundle: LiveEventBundle
  setBundle: Dispatch<SetStateAction<LiveEventBundle | null>>
  teamId: string
  team: Tables<'teams'>
  messages: Tables<'chat_messages'>[]
  chatHistoryReady: boolean
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
  setBundle,
  teamId,
  team,
  messages,
  chatHistoryReady,
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
  const bingoCardQuery = useBingoTeamCard(
    event.id,
    bingoRunQuery.data?.id,
    teamId,
  )
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // When the facilitator starts (or restarts) bingo, the run + team cards are
  // created server-side and event_state.bingo_state flips via realtime. The run
  // and card live in separate React Query caches, so refetch them reactively the
  // moment the bingo state changes — otherwise the card only appears on refresh.
  useEffect(() => {
    if (stage?.type !== 'bingo') return
    void queryClient.invalidateQueries({
      queryKey: queryKeys.bingoRun(event.id, state.current_stage_index),
    })
    void queryClient.invalidateQueries({ queryKey: ['bingo-team-card'] })
  }, [
    state.bingo_state,
    state.current_stage_index,
    stage?.type,
    event.id,
    queryClient,
  ])

  const colors = brandColorsForEvent(event, organization)
  const accent = colors[2]
  // The event picks one text colour for its whole surface. Anything sitting on
  // the background rather than inside a filled control follows it.
  const eventTextColor = displayTextColorForEvent(event) === 'black' ? '#000000' : '#ffffff'
  const logo = logoForEvent(event, organization)

  const [selectedGame, setSelectedGame] = useState<Tables<'games'> | null>(null)
  const [captureActive, setCaptureActive] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null)
  const [quizChangeLeft, setQuizChangeLeft] = useState<number | null>(null)
  const [quizLocked, setQuizLocked] = useState(false)
  const [dismissedWinnerId, setDismissedWinnerId] = useState<string | null>(null)
  const quizChangeDeadlineRef = useRef<number | null>(null)
  const [bingoPick, setBingoPick] = useState<number | null>(null)
  const bingoPickOptimisticRef = useRef<number | null | undefined>(undefined)
  const [chatOpen, setChatOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [inventoryScannerOpen, setInventoryScannerOpen] = useState(false)
  // Organisers running an event without a physical item shop switch this off.
  const inventoryEnabled = event.inventory_enabled ?? true

  const handleInventoryItemScanned = useCallback((publicCode: string) => {
    setInventoryScannerOpen(false)
    navigate(`/inventory/item/${publicCode}`)
  }, [navigate, setInventoryScannerOpen])

  // Mint a signed upload URL when a photo/video challenge opens, moving the
  // authorization round trip out of the submit path. Key it by game id so one
  // challenge never consumes another challenge's URL. A null result falls back to
  // minting a fresh URL on submit.
  const openUploadPrefetchRef = useRef<{
    gameId: string
    promise: Promise<MintedParticipantUpload | null>
  } | null>(null)
  // Client-generated IDs let open-game submissions appear as pending as soon as
  // the database request is dispatched. The server remains authoritative: a
  // rejected write removes the optimistic row again. Track the short in-flight
  // window so Cancel cannot race an INSERT that has not acknowledged yet.
  const [openSubmissionWrites, setOpenSubmissionWrites] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [exitDialogOpen, setExitDialogOpen] = useState(false)
  const [exitPasswordValue, setExitPasswordValue] = useState('')
  const [exitPasswordError, setExitPasswordError] = useState<string | null>(null)
  const [exitVerifying, setExitVerifying] = useState(false)
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
  // Merge the player's own submission write into the local bundle immediately so a
  // bingo mark reads as settled without waiting for the broadcast echo (which anon
  // phones don't reliably receive). Reconciled by id when the echo / full reload lands.
  const mergeOwnSubmission = useCallback(
    (
      op: 'INSERT' | 'UPDATE' | 'DELETE',
      row?: Tables<'submissions'>,
      old?: { id: string },
    ) => {
      setBundle((b) => (b ? applyLiveBundlePatch(b, { kind: 'submission', op, row, old }) : b))
    },
    [setBundle],
  )
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
  const teamSenderName = (team.name ?? 'Team').trim()

  const incomingFacilitatorMessages = useMemo(
    () =>
      visibleMessages.filter((m) =>
        isFacilitatorToTeamChatMessage(m, teamId, teamSenderName),
      ),
    [visibleMessages, teamId, teamSenderName],
  )

  const playIncomingChatSound = useCallback(() => {
    playNewMessageSound()
  }, [])

  const unreadMessages = useIncomingChatAlerts(
    incomingFacilitatorMessages,
    chatOpen,
    chatHistoryReady,
    playIncomingChatSound,
  )

  // Prime the full audio pool on first interaction so realtime chat, push, and
  // winner sounds are not blocked by mobile autoplay policy.
  useEffect(() => {
    installAudioUnlock('full')
  }, [])

  const quizGame = stage?.type === 'quiz' && stage.gameId
    ? games.find((g) => g.id === stage.gameId)
    : null
  const quizQs = useMemo(() => (quizGame ? quizQuestions(quizGame) : []), [quizGame])
  const currentQuizQ = quizQs[state.current_question_index]

  // The correct answer is redacted from the live game payload and arrives on
  // event_state at reveal time; the question's own field is only populated in
  // the editor's preview.
  const quizCorrectAnswerId =
    state.quiz_correct_answer_id ?? currentQuizQ?.correctAnswerId ?? null
  const quizMyAnswerId =
    (currentQuizQ
      ? mySubs.find(
          (s) =>
            s.media_type === quizSubmissionMediaType(currentQuizQ.id) &&
            s.game_id === stage?.gameId,
        )?.media_url
      : null) ?? quizAnswer
  const quizWasCorrect =
    Boolean(quizCorrectAnswerId) && quizMyAnswerId === quizCorrectAnswerId

  // Development-only quiz driver (?devbar=1); see DevQuizBar.
  const devBarOn =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('devbar')
  const devSteps = useMemo(
    () => (devBarOn && quizQs.length > 0 ? devQuizSteps(quizQs) : []),
    [devBarOn, quizQs],
  )
  const [devStep, setDevStep] = useState(0)

  const goDevStep = useCallback(
    (next: number) => {
      const step = devSteps[Math.max(0, Math.min(next, devSteps.length - 1))]
      if (!step) return
      setDevStep(Math.max(0, Math.min(next, devSteps.length - 1)))
      setBundle((b) =>
        b
          ? {
              ...b,
              state: {
                ...b.state,
                quiz_state: step.quiz_state,
                current_question_index: step.question_index,
                quiz_correct_answer_id: step.correct_answer_id,
                winner_reveal_stage: step.winner_reveal_stage,
                quiz_timer_running: step.quiz_state === 'active',
                quiz_timer_seconds: quizTimerSeconds(b.state),
              },
            }
          : b,
      )
    },
    [devSteps, setBundle],
  )

  // In a real round the facilitator's console reveals by itself when the timer
  // ends or every team has locked in. The driver has no facilitator behind it,
  // so it mirrors that here: otherwise reviewing the quiz gives a false
  // impression of how many presses running one takes.
  useEffect(() => {
    if (!devBarOn) return
    const step = devSteps[devStep]
    if (step?.quiz_state !== 'active') return
    const timedOut = quizTimerDisplay <= 0
    if (!timedOut && !quizLocked) return
    const id = window.setTimeout(() => goDevStep(devStep + 1), 400)
    return () => window.clearTimeout(id)
  }, [devBarOn, devSteps, devStep, quizTimerDisplay, quizLocked, goDevStep])

  const restartDevTimer = useCallback(() => {
    setBundle((b) =>
      b
        ? {
            ...b,
            state: {
              ...b.state,
              quiz_timer_running: false,
              quiz_timer_seconds: quizTimerSeconds(b.state),
            },
          }
        : b,
    )
    // A tick later, so the countdown restarts from the top rather than
    // carrying on from where it had got to.
    window.setTimeout(
      () =>
        setBundle((b) =>
          b ? { ...b, state: { ...b.state, quiz_timer_running: true } } : b,
        ),
      50,
    )
  }, [setBundle])

  useEffect(() => {
    // Reset only when the question (or game) changes — NOT on quiz_state
    // transitions. Including quiz_state here wiped the player's selection the
    // instant the facilitator revealed, causing a wrong-answer flash. Locking on
    // reveal/results is handled by the dedicated effect below.
    quizChangeDeadlineRef.current = null
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets local quiz answer state when the question/game identity changes, see comment above
    setQuizAnswer(null)
    setQuizLocked(false)
    setQuizChangeLeft(null)
  }, [state.current_question_index, stage?.gameId])

  useEffect(() => {
    if (stage?.type !== 'quiz' || !stage.gameId || !currentQuizQ) return
    if (state.quiz_state !== 'active') return
    const mediaType = quizSubmissionMediaType(currentQuizQ.id)
    const existing = mySubs.find(
      (s) => s.media_type === mediaType && s.game_id === stage.gameId,
    )
    if (existing?.media_url) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local answer from the server's saved submission, a real external system
      setQuizAnswer(existing.media_url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately depends on the stable currentQuizQ.id, not the object reference, so this doesn't re-fire on incidental re-renders of the same question
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- locking the answer when the facilitator's realtime state reveals/finishes the quiz
      setQuizLocked(true)
      setQuizChangeLeft(null)
    }
  }, [state.quiz_state])

  useEffect(() => {
    if (state.quiz_state !== 'active') return
    if (quizTimerDisplay >= 5 || quizTimerDisplay <= 0) return
    playQuizTimerWarningSound()
  }, [quizTimerDisplay, state.quiz_state])

  useEffect(() => {
    if (stage?.type !== 'bingo' || !stage.gameId) return
    if (bingoPickOptimisticRef.current !== undefined) return
    const pending = mySubs
      .filter(
        (s) =>
          s.media_type === 'bingo' &&
          s.game_id === stage.gameId &&
          s.status === 'pending' &&
          s.media_url != null &&
          s.media_url !== 'claim',
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    if (!pending?.media_url) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local bingo pick from the server's pending submission, a real external system
      setBingoPick(null)
      return
    }
    const cells = bingoCardQuery.data
    if (cells?.length) {
      const idx = resolveBingoSubmissionCellIndex(pending.media_url, cells)
      setBingoPick(idx >= 0 ? idx : null)
      return
    }
    const n = Number(pending.media_url)
    setBingoPick(Number.isNaN(n) ? null : n)
  }, [stage?.type, stage?.gameId, mySubs, bingoCardQuery.data])

  useEffect(() => {
    if (stage?.type !== 'bingo') return
    bingoPickOptimisticRef.current = undefined
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets local bingo pick when the round/stage identity changes
    setBingoPick(null)
  }, [stage?.type, stage?.gameId, state.current_question_index, state.bingo_state])

  function handleExitTeam() {
    if (!organization?.id) return
    setExitPasswordValue('')
    setExitPasswordError(null)
    setExitDialogOpen(true)
  }

  async function handleExitPasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!organization?.id) return
    setExitVerifying(true)
    setExitPasswordError(null)
    try {
      const token = await verifyTabletPassword(organization.id, exitPasswordValue)
      if (!token) {
        setExitPasswordError('Incorrect password')
        return
      }
      setExitDialogOpen(false)
      if (exitMode === 'tablet' && onExitToTablet) {
        onExitToTablet()
      } else {
        onExitTeam()
      }
    } catch {
      setExitPasswordError('Could not verify password')
    } finally {
      setExitVerifying(false)
    }
  }

  const previousSubmissionStatusRef = useRef<Map<string, string>>(new Map())
  useEffect(() => {
    const mine = submissions.filter((s) => s.team_id === teamId)
    if (previousSubmissionStatusRef.current.size === 0) {
      previousSubmissionStatusRef.current = new Map(mine.map((s) => [s.id, s.status]))
      return
    }

    const nextStatusMap = new Map<string, string>()
    for (const s of mine) {
      const game = games.find((g) => g.id === s.game_id)
      const previous = previousSubmissionStatusRef.current.get(s.id)
      nextStatusMap.set(s.id, s.status)
      if (!previous) continue
      if (previous === 'pending' && s.status === 'approved' && game && game.type !== 'quiz') {
        playPushNotificationSound()
        if (game.type === 'music_bingo') notify(`+${s.points_awarded ?? 0} pts — Music bingo`)
        else notify(`+${s.points_awarded ?? 0} pts — ${game.name}`)
      }
      if (
        previous === 'pending' &&
        s.status === 'rejected' &&
        game &&
        game.type !== 'quiz' &&
        game.type !== 'music_bingo'
      ) {
        playPushNotificationSound()
        notify(`${game.name} was not approved`)
      }
    }
    previousSubmissionStatusRef.current = nextStatusMap
  }, [submissions, teamId, games, notify])

  const lastAnnouncementRef = useRef<string | null>(null)
  useEffect(() => {
    if (!announcement) {
      lastAnnouncementRef.current = null
      return
    }
    if (announcement !== lastAnnouncementRef.current) {
      lastAnnouncementRef.current = announcement
      playAnnouncementSound()
    }
  }, [announcement])

  const eventWinnerAudioKeyRef = useRef<string | null>(null)
  // Read sound routing inside the effect without depending on it, so routine
  // realtime patches don't re-run the effect and cut the song after ~1s.
  const winnerSoundTargetsRef = useRef(state.winner_sound_targets)
  // eslint-disable-next-line react-hooks/refs -- standard "keep ref fresh" idiom, see comment above
  winnerSoundTargetsRef.current = state.winner_sound_targets
  useEffect(() => {
    // The event winner reveal (winner_reveal_stage===2) is the facilitator's
    // final podium — it must play regardless of the current stage type. (Bingo
    // LINE wins are separate: they use BingoWinCelebration, not this reveal.)
    const stageNum = state.winner_reveal_stage ?? 0
    if (stageNum === 0) {
      eventWinnerAudioKeyRef.current = null
      resetEventWinnerAudioGuard()
      return
    }
    // Stage 1 is silent — no audio during the build-up.
    if (stageNum !== 2) return

    const revealKey = `${event.id}:winner-reveal:2`
    if (eventWinnerAudioKeyRef.current === revealKey) return
    eventWinnerAudioKeyRef.current = revealKey

    // Every player phone plays the fanfare when the facilitator routes the
    // winner sound to "Players" — not just the winning team's device.
    if (!winnerSoundEnabled(winnerSoundTargetsRef.current, 'players')) return
    const stopAudio = playEventWinnerSequence(revealKey)
    return () => stopAudio()
  }, [state.winner_reveal_stage, event.id])

  const lastQuizRevealKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (
      (state.quiz_state !== 'revealed' && state.quiz_state !== 'results') ||
      !currentQuizQ
    ) return
    const correctAnswerId = state.quiz_correct_answer_id
    if (!correctAnswerId) return
    const key = `${stage?.gameId ?? 'quiz'}:${state.current_question_index}`
    if (lastQuizRevealKeyRef.current === key) return
    lastQuizRevealKeyRef.current = key
    const myAnswerId =
      mySubs.find(
        (s) =>
          s.media_type === quizSubmissionMediaType(currentQuizQ.id) &&
          s.game_id === stage?.gameId,
      )?.media_url ?? quizAnswer
    if (myAnswerId === correctAnswerId) playQuizCorrectSound()
    else playQuizWrongSound()
  }, [state.quiz_state, state.quiz_correct_answer_id, currentQuizQ, mySubs, quizAnswer, stage?.gameId, state.current_question_index])

  // Authorize the participant upload as soon as a photo/video challenge opens,
  // while the participant is reading the brief or framing the shot.
  useEffect(() => {
    const g = selectedGame
    if (!event.id || !g || (g.type !== 'photo' && g.type !== 'video')) {
      openUploadPrefetchRef.current = null
      return
    }
    const path = `${event.id}/submissions/${teamId}/${Date.now()}${g.type === 'video' ? '.mp4' : '.jpg'}`
    openUploadPrefetchRef.current = {
      gameId: g.id,
      // Swallow errors: a failed prefetch must never surface to the participant —
      // submit falls back to a fresh mint.
      promise: mintParticipantUpload(event.id, path).catch(() => null),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key off the selected game id only; re-running on every realtime bundle/games update would re-mint needlessly
  }, [selectedGame?.id, event.id, teamId])

  function beginOpenSubmit() {
    flushSync(() => {
      setSubmitting(true)
      setCaptureActive(false)
    })
  }

  function finishOpenSubmitOptimistically(timing?: {
    submitPressedAt: number
    mediaType: 'text' | 'photo' | 'video'
    gameId: string
    uploadMs?: number
  }) {
    // Leave the loading screen before doing confirmation UI/audio work. On
    // mobile Safari this makes the local transition independent of delivery of
    // the Supabase INSERT response.
    const beforeFlush = nowMs()
    flushSync(() => {
      setSelectedGame(null)
      setCaptureActive(false)
      setSubmitting(false)
    })
    const afterFlush = nowMs()
    playSubmitSound()
    notify('Submitted — waiting for approval')
    if (!timing) return

    // The iOS mystery is the screen visibly lingering AFTER this function has
    // run. requestAnimationFrame measures how long the main thread takes to
    // come back to us: a blocked thread (long paintDelayMs) and an instant
    // callback with a still-frozen screen point at different culprits.
    const afterSideEffects = nowMs()
    requestAnimationFrame(() => {
      const paintDelayMs = Math.round(nowMs() - afterSideEffects)
      const totalMs = Math.round(nowMs() - timing.submitPressedAt)
      if (totalMs <= 1500 && paintDelayMs <= 400) return
      reportClientTiming('submit-timing', `slow submit close: ${totalMs}ms (paint +${paintDelayMs}ms)`, {
        eventId: event.id,
        teamId,
        extra: {
          mediaType: timing.mediaType,
          gameId: timing.gameId,
          uploadMs: timing.uploadMs ?? null,
          preFinishMs: Math.round(beforeFlush - timing.submitPressedAt),
          flushMs: Math.round(afterFlush - beforeFlush),
          soundNotifyMs: Math.round(afterSideEffects - afterFlush),
          paintDelayMs,
          totalMs,
        },
      })
    })
  }

  function optimisticOpenSubmission(
    game: Tables<'games'>,
    mediaUrl: string,
    mediaType: 'text' | 'photo' | 'video',
  ): Tables<'submissions'> {
    return {
      id: crypto.randomUUID(),
      event_id: event.id,
      team_id: teamId,
      game_id: game.id,
      media_url: mediaUrl,
      media_type: mediaType,
      status: 'pending',
      points_awarded: null,
      created_at: new Date().toISOString(),
    }
  }

  function setOpenSubmissionWrite(id: string, saving: boolean) {
    setOpenSubmissionWrites((current) => {
      const next = new Set(current)
      if (saving) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function submitTextGame(mediaUrl: string, game: Tables<'games'>) {
    if (!event.id) return
    if (!canSubmit) {
      notify('This event is now closed')
      return
    }
    if (!mediaUrl.length) {
      notify('Enter or choose an answer first')
      return
    }
    const submitPressedAt = nowMs()
    beginOpenSubmit()
    let optimistic: Tables<'submissions'> | null = null
    try {
      optimistic = optimisticOpenSubmission(game, mediaUrl, 'text')
      // Calling .then() starts the request now; the UI below does not await its
      // response. RLS and the participant-write trigger still validate the real
      // insert before the facilitator can ever receive it.
      const write = supabase
        .from('submissions')
        .insert({
          id: optimistic.id,
          event_id: event.id,
          team_id: teamId,
          game_id: game.id,
          media_url: mediaUrl,
          media_type: 'text',
          status: 'pending',
        })
        .select()
        .single()
        .then((result) => result)

      setOpenSubmissionWrite(optimistic.id, true)
      mergeOwnSubmission('INSERT', optimistic)
      try {
        finishOpenSubmitOptimistically({ submitPressedAt, mediaType: 'text', gameId: game.id })
      } catch (err) {
        const detail = reportClientIssue('text-submit', err, {
          eventId: event.id,
          teamId,
          extra: { gameId: game.id },
        })
        throw new DiagnosticReportedError(`Could not finish submitting (${detail})`, { cause: err })
      }

      const { data, error } = await write
      setOpenSubmissionWrite(optimistic.id, false)
      if (error) throw error
      if (data) {
        // Reconcile the client timestamp/defaults with the authoritative row;
        // matching by the client-generated id prevents any duplicate.
        mergeOwnSubmission('UPDATE', data)
        void publishSubmissionChange(event.id, 'INSERT', data)
      }
    } catch (err) {
      if (optimistic) {
        setOpenSubmissionWrite(optimistic.id, false)
        mergeOwnSubmission('DELETE', undefined, { id: optimistic.id })
        setSelectedGame(game)
      }
      const msg =
        err instanceof DiagnosticReportedError
          ? err.message
          : `Couldn't submit (${reportClientIssue('text-submit', err, {
              eventId: event.id,
              teamId,
              extra: { gameId: game.id },
            })}) — tap to retry`
      notify(msg)
      setSubmitting(false)
    }
  }

  async function submitOpenGame(file: File, game: Tables<'games'>) {
    if (!event.id) return
    if (!canSubmit) {
      notify('This event is now closed')
      return
    }
    const submitPressedAt = nowMs()
    beginOpenSubmit()
    let optimistic: Tables<'submissions'> | null = null
    try {
      const kind = game.type === 'video' ? 'video' : 'photo'
      // Consume the URL prefetched when this challenge opened. Null it out so a
      // retry mints fresh, and use the original mint+upload path if prefetch failed.
      const prefetch = openUploadPrefetchRef.current
      openUploadPrefetchRef.current = null
      const minted = prefetch && prefetch.gameId === game.id ? await prefetch.promise : null

      const uploadStartedAt = nowMs()
      let url: string
      try {
        url = minted
          ? await uploadToMintedParticipantUrl(minted, file, { mediaKind: kind })
          : await uploadParticipantAsset(
              event.id,
              `${event.id}/submissions/${teamId}/${crypto.randomUUID()}${game.type === 'video' ? '.mp4' : '.jpg'}`,
              file,
              { mediaKind: kind },
            )
      } catch (err) {
        const detail = reportClientIssue('submission-upload', err, {
          eventId: event.id,
          teamId,
          extra: { gameId: game.id, mediaType: kind },
        })
        throw new DiagnosticReportedError(`Could not upload submission (${detail})`, { cause: err })
      }
      const mediaType = game.type === 'video' ? 'video' : 'photo'
      optimistic = optimisticOpenSubmission(game, url, mediaType)
      const write = supabase
        .from('submissions')
        .insert({
          id: optimistic.id,
          event_id: event.id,
          team_id: teamId,
          game_id: game.id,
          media_url: url,
          media_type: mediaType,
          status: 'pending',
        })
        .select()
        .single()
        .then((result) => result)

      setOpenSubmissionWrite(optimistic.id, true)
      mergeOwnSubmission('INSERT', optimistic)
      finishOpenSubmitOptimistically({
        submitPressedAt,
        mediaType,
        gameId: game.id,
        uploadMs: Math.round(nowMs() - uploadStartedAt),
      })

      const { data, error } = await write
      setOpenSubmissionWrite(optimistic.id, false)
      if (error) throw error
      if (data) {
        mergeOwnSubmission('UPDATE', data)
        void publishSubmissionChange(event.id, 'INSERT', data)
      }
    } catch (err) {
      if (optimistic) {
        setOpenSubmissionWrite(optimistic.id, false)
        mergeOwnSubmission('DELETE', undefined, { id: optimistic.id })
        setSelectedGame(game)
      }
      const msg =
        err instanceof Error && err.message.includes('must be')
          ? err.message
          : err instanceof DiagnosticReportedError
            ? err.message
            : `Couldn't submit (${reportClientIssue('submission-upload', err, {
                eventId: event.id,
                teamId,
                extra: { gameId: game.id },
              })}) — tap to retry`
      notify(msg)
      setSubmitting(false)
    }
  }

  async function submitQuizAnswer(answerId: string, gameId: string, questionId: string) {
    if (quizLocked || state.quiz_state !== 'active') return
    // Belt-and-suspenders audio unlock on a real user tap, so later realtime
    // sounds (reveal correct/wrong, push) are not blocked by mobile autoplay.
    unlockAudioFromUserGesture('full')
    // Fire instantly on tap (before any state update / network) so the sound
    // lines up exactly with the visual selection.
    playQuizSelectSound()
    if (quizChangeDeadlineRef.current == null) {
      const windowSec = Math.min(5, Math.max(0, quizTimerDisplay))
      // eslint-disable-next-line react-hooks/purity -- this runs inside a tap handler, not render
      quizChangeDeadlineRef.current = Date.now() + windowSec * 1000
    }
    const mediaType = quizSubmissionMediaType(questionId)
    const existing = mySubs.find(
      (s) => s.media_type === mediaType && s.game_id === gameId,
    )
    const previousAnswer = existing?.media_url ?? quizAnswer
    setQuizAnswer(answerId)
    const { data: quizRow, error } = existing
      ? await supabase
          .from('submissions')
          .update({ media_url: answerId })
          .eq('id', existing.id)
          .select()
          .single()
      : await supabase
          .from('submissions')
          .insert({
            event_id: event.id,
            team_id: teamId,
            game_id: gameId,
            media_url: answerId,
            media_type: mediaType,
            status: 'pending',
          })
          .select()
          .single()
    if (error) {
      setQuizAnswer(previousAnswer)
      notify("Couldn't submit answer — tap to retry")
      return
    }
    if (quizRow) {
      mergeOwnSubmission(existing ? 'UPDATE' : 'INSERT', quizRow)
      void publishSubmissionChange(event.id, existing ? 'UPDATE' : 'INSERT', quizRow)
    }
  }

  async function cancelPendingSubmission(subId: string) {
    setCancelling(true)
    try {
      const { data: cancelledRow, error } = await supabase
        .from('submissions')
        .update({ status: 'cancelled' })
        .eq('id', subId)
        .select()
        .single()
      if (error) {
        notify("Couldn't cancel submission — try again")
        return
      }
      // Update our own view immediately (see submitTextGame) instead of waiting
      // on the broadcast; still fire it for other devices on broadcast-only
      // realtime, just not blocking this device's own UI on it.
      if (cancelledRow) {
        mergeOwnSubmission('UPDATE', cancelledRow)
        void publishSubmissionChange(event.id, 'UPDATE', cancelledRow)
      }
      notify('Submission cancelled')
      setSelectedGame(null)
      setCaptureActive(false)
    } finally {
      setCancelling(false)
    }
  }

  async function submitBingoSquare(index: number, gameId: string) {
    if (state.bingo_state !== 'playing') return
    const cells = bingoCardQuery.data
    if (!cells?.length) return
    const cardCells = cells
    const trackId = cardCells[index]?.trackId
    if (!trackId) return

    const lockedByHistory = mySubs.some(
      (s) =>
        s.media_type === 'bingo' &&
        s.game_id === gameId &&
        (s.status === 'approved' || s.status === 'rejected') &&
        resolveBingoSubmissionCellIndex(s.media_url ?? '', cardCells) === index,
    )
    if (lockedByHistory) return

    const existingPending = mySubs
      .filter(
        (s) =>
          s.media_type === 'bingo' &&
          s.game_id === gameId &&
          s.status === 'pending' &&
          s.media_url != null &&
          s.media_url !== 'claim',
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]

    const pendingIndex =
      existingPending?.media_url != null
        ? resolveBingoSubmissionCellIndex(existingPending.media_url, cardCells)
        : -1

    if (pendingIndex === index) {
      bingoPickOptimisticRef.current = null
      setBingoPick(null)
      const { error } = await supabase
        .from('submissions')
        .delete()
        .eq('id', existingPending!.id)
      bingoPickOptimisticRef.current = undefined
      if (error) {
        const idx = resolveBingoSubmissionCellIndex(
          existingPending!.media_url ?? '',
          cardCells,
        )
        setBingoPick(idx >= 0 ? idx : null)
        notify("Couldn't update selection — tap to retry")
      } else {
        mergeOwnSubmission('DELETE', undefined, { id: existingPending!.id })
        void publishSubmissionChange(event.id, 'DELETE', undefined, {
          id: existingPending!.id,
        })
      }
      return
    }

    bingoPickOptimisticRef.current = index
    setBingoPick(index)

    function revertBingoPick() {
      if (existingPending?.media_url) {
        const idx = resolveBingoSubmissionCellIndex(existingPending.media_url, cardCells)
        setBingoPick(idx >= 0 ? idx : null)
      } else {
        setBingoPick(null)
      }
    }

    try {
      if (existingPending) {
        const { data, error } = await supabase
          .from('submissions')
          .update({ media_url: String(index) })
          .eq('id', existingPending.id)
          .select()
          .single()
        if (error) {
          revertBingoPick()
          notify("Couldn't mark cell — tap to retry")
          return
        }
        if (data) {
          mergeOwnSubmission('UPDATE', data)
          void publishSubmissionChange(event.id, 'UPDATE', data)
        }
        return
      }

      const existingSameCell = mySubs.find(
        (s) =>
          s.media_type === 'bingo' &&
          s.game_id === gameId &&
          s.status === 'pending' &&
          resolveBingoSubmissionCellIndex(s.media_url ?? '', cardCells) === index,
      )
      if (existingSameCell) {
        bingoPickOptimisticRef.current = null
        setBingoPick(null)
        const { error } = await supabase
          .from('submissions')
          .delete()
          .eq('id', existingSameCell.id)
        if (error) {
          revertBingoPick()
          notify("Couldn't update selection — tap to retry")
        } else {
          mergeOwnSubmission('DELETE', undefined, { id: existingSameCell.id })
          void publishSubmissionChange(event.id, 'DELETE', undefined, {
            id: existingSameCell.id,
          })
        }
        return
      }

      const { data: bingoRow, error } = await supabase
        .from('submissions')
        .insert({
          event_id: event.id,
          team_id: teamId,
          game_id: gameId,
          media_url: String(index),
          media_type: 'bingo',
          status: 'pending',
        })
        .select()
        .single()
      if (error) {
        revertBingoPick()
        notify("Couldn't mark cell — tap to retry")
      } else if (bingoRow) {
        mergeOwnSubmission('INSERT', bingoRow)
        void publishSubmissionChange(event.id, 'INSERT', bingoRow)
      }
    } finally {
      bingoPickOptimisticRef.current = undefined
    }
  }

  const showMainHeader =
    !selectedGame && state.winner_reveal_stage < 1 && stage?.type !== 'bingo'

  const header = showMainHeader ? (
    <header className="relative mb-4 flex flex-col items-center gap-1.5 px-2 pt-4 text-center sm:pt-5">
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
        ) : state.quiz_state === 'revealed' ? (
          // The reveal happens on the question itself, so this slot carries
          // the verdict rather than a dead countdown.
          <p
            className={`mt-2 text-[clamp(1.6rem,5vw,2.75rem)] leading-none font-black drop-shadow-lg sm:mt-4 ${
              quizWasCorrect ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {quizWasCorrect ? 'Correct!' : quizMyAnswerId ? 'Incorrect' : 'Time up'}
          </p>
        ) : state.quiz_state === 'active' && quizChangeLeft != null && !quizLocked ? (
          // While the change window runs it replaces the countdown: it is the
          // only clock that still matters to a team that has answered.
          <span className="mt-2 flex flex-col items-center sm:mt-4">
            <span className="text-[11px] font-black tracking-[0.22em] uppercase opacity-70">
              Change answer
            </span>
            <span
              className="text-[clamp(1.9rem,6vw,3.25rem)] leading-none font-black tabular-nums drop-shadow-lg"
              style={{ color: accent }}
            >
              {quizChangeLeft}s
            </span>
          </span>
        ) : state.quiz_state === 'active' && quizRunning ? (
          // The countdown is the loudest thing on the screen while a question
          // is open, so it carries no chip and stands at full size.
          <p className="mt-2 text-[clamp(1.9rem,6vw,3.25rem)] leading-none font-black tabular-nums drop-shadow-lg sm:mt-4">
            {formatTimer(quizTimerDisplay)}
          </p>
        ) : null
      ) : null}

      {/* The running total belongs to the team, not to the screen it happens
          to be on, so it holds the same corner throughout. */}
      {state.hide_team_points ? null : (
        <p className="absolute top-2 right-3 text-lg leading-none font-black tabular-nums drop-shadow-sm sm:top-3">
          {team.score}
          <span className="ml-1 text-xs font-bold opacity-70">pts</span>
        </p>
      )}
    </header>
  ) : null

  let body: ReactNode

  const eventRanked = eventRankedTeams(bundle.teams)

  if (team.status === 'stopped') {
    // Facilitator paused this team — block all gameplay with a friendly note.
    body = (
      <div className="mx-auto max-w-sm px-6 py-16 text-center">
        <p className="text-2xl font-bold">Your game is paused</p>
        <p className="mt-3 text-base opacity-90">
          The event host has paused your team for a moment. Please check in with
          your host to get back in the game.
        </p>
      </div>
    )
  } else if (state.winner_reveal_stage >= 1) {
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
              <li key={t.id} className="xp-leaderboard-row flex justify-between bg-black/20 px-3 py-2">
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
    // Stage order = the organiser's drag-to-reorder order in the event editor.
    const openGames = openGameIds
      .map((id) => games.find((g) => g.id === id))
      .filter((g): g is (typeof games)[number] => g != null)
    const activeOpenGame = resolveGameFromList(games, selectedGame)

    if (openGameIds.length > 0 && openGames.length === 0 && !selectedGame) {
      body = <GameUnavailableFallback />
    } else if (activeOpenGame) {
      const latestSub = activeSubmissionForGame(mySubs, activeOpenGame.id)
      const pending = latestSub?.status === 'pending'
      const insertStillSaving = Boolean(
        latestSub && openSubmissionWrites.has(latestSub.id),
      )
      const locked =
        latestSub?.status === 'approved' || latestSub?.status === 'rejected'

      body = (
        <div className="w-full pt-1">
          {!submitting ? (
            // 1fr / auto / 1fr keeps the points dead centre whether or not
            // Buy Items is there, and pins the buttons to the screen edges.
            <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:px-4">
              {/* Black and yellow like the chat and exit buttons: app
                  furniture, not part of the event's palette. */}
              <Button
                size="sm"
                className="text-nm-yellow w-fit justify-self-start border-none bg-black px-4 py-2 font-semibold shadow-md hover:bg-black hover:brightness-110"
                onClick={() => {
                  setSelectedGame(null)
                  setCaptureActive(false)
                }}
              >
                ← Back
              </Button>
              <span
                className="text-lg leading-none font-black tabular-nums drop-shadow-sm sm:text-xl"
                style={{ color: accent }}
              >
                {gamePointsDisplay(activeOpenGame)}
              </span>
              {!captureActive && inventoryEnabled ? (
                <Button
                  type="button"
                  size="sm"
                  className="text-nm-yellow w-fit justify-self-end gap-2 border-none bg-black px-4 py-2 font-semibold shadow-md hover:bg-black hover:brightness-110"
                  onClick={() => setInventoryScannerOpen(true)}
                >
                  <QrCode className="size-4" /> Buy Items
                </Button>
              ) : (
                <span />
              )}
            </div>
          ) : null}
          {!canSubmit ? (
            <p
              className="mb-3 text-center text-sm font-semibold"
              style={{ color: accent }}
            >
              Event closed — no new submissions
            </p>
          ) : null}
          {/* Every challenge screen runs edge to edge and pads its own
              content, so covers behave the same on all of them. */}
          <div className="w-full">
          {submitting ? (
            <OpenGameSubmittingScreen accentColor={accent} />
          ) : isPuzzleGame(activeOpenGame) ? (
            // A solved puzzle keeps its own board and result on screen. The
            // generic review card would replace all of it with one line.
            <PuzzleGamePlayer
              eventId={event.id}
              teamId={teamId}
              game={activeOpenGame}
              accentColor={accent}
            />
          ) : pending && latestSub ? (
            <OpenGameChallengeReview
              game={activeOpenGame}
              submission={latestSub}
              accentColor={accent}
              cancelling={cancelling || insertStillSaving}
              onCancel={
                insertStillSaving
                  ? undefined
                  : () => void cancelPendingSubmission(latestSub.id)
              }
            />
          ) : locked && latestSub ? (
            <OpenGameChallengeReview
              game={activeOpenGame}
              submission={latestSub}
              accentColor={accent}
            />
          ) : !canSubmit ? null : isTextGame(activeOpenGame) ? (
            <OpenGameTextChallenge
              game={activeOpenGame}
              accentColor={accent}
              disabled={submitting}
              onSubmit={(answer) => void submitTextGame(answer, activeOpenGame)}
            />
          ) : (
            <ChallengeMediaCaptureFlow
              title={activeOpenGame.name}
              description={activeOpenGame.description}
              coverUrl={activeOpenGame.cover_url}
              accentColor={accent}
              mediaType={activeOpenGame.type === 'video' ? 'video' : 'photo'}
              config={activeOpenGame.config as GameConfig}
              disabled={submitting}
              eventId={event.id}
              onCaptureActiveChange={setCaptureActive}
              onFileReady={(file) => void submitOpenGame(file, activeOpenGame)}
            />
          )}
          </div>
        </div>
      )
    } else {
      body = (
        <div className="mx-auto max-w-2xl px-4 lg:max-w-4xl">
          {inventoryEnabled ? (
            <Button type="button" className="mb-4 w-full gap-2 py-5 text-base font-bold shadow-lg" style={{ backgroundColor: accent, color: eventTextColor }} onClick={() => setInventoryScannerOpen(true)}>
              <QrCode className="size-5" /> Buy Items
            </Button>
          ) : null}
          {/* Two up on a phone, three on a tablet, four on a computer: each
              step keeps the tiles near square instead of letterboxed. */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {openGames.map((g) => {
              const sub = activeSubmissionForGame(mySubs, g.id)
              return (
                <OpenGameChallengeCard
                  key={g.id}
                  game={g}
                  submissionStatus={sub?.status}
                  accentColor={accent}
                  textColor={eventTextColor}
                  canSubmit={canSubmit}
                  onSelect={() => setSelectedGame(g)}
                />
              )
            })}
          </div>
        </div>
      )
    }
  } else if (stage?.type === 'quiz' && stage.gameId) {
    const game = quizGame
    const q = currentQuizQ
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
    } else if (state.quiz_state === 'round_intro' && quizGame) {
      const round = quizRoundForQuestionIndex(quizGame, state.current_question_index)
      const q = quizQuestions(quizGame)[state.current_question_index]
      const intro = round
        ? roundIntroDisplay(round, roundIndexForQuestion(quizGame, q))
        : { title: 'NEXT ROUND', subtitle: '' }
      // The round's name is what the team is being told; its number is just
      // where they are in the quiz, so it sits above in small type.
      const introNameOnly =
        !intro.subtitle || intro.subtitle.toLocaleUpperCase() === intro.title
      body = (
        <div className="flex min-h-[70svh] flex-col items-center justify-center px-6 text-center">
          {!introNameOnly ? (
            <p className="text-sm font-black tracking-[0.28em] uppercase opacity-70 sm:text-base">
              {intro.title}
            </p>
          ) : null}
          <p className="mt-4 text-[clamp(2.25rem,9vw,5rem)] leading-[1.05] font-black text-balance drop-shadow-lg">
            {introNameOnly ? intro.title : intro.subtitle}
          </p>
          <p className="mt-10 animate-pulse text-sm font-semibold opacity-60">
            Waiting for the facilitator to start…
          </p>
        </div>
      )
    } else if (
      (state.quiz_state === 'idle' || state.quiz_state === 'waiting') &&
      quizGame
    ) {
      body = (
        // Nothing to do on this screen but look at it, so it fills the screen
        // and reads from across a table rather than sitting in a corner.
        <div className="flex min-h-[70svh] flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-black tracking-[0.28em] uppercase opacity-70 sm:text-base">
            Get ready for
          </p>
          <p className="mt-4 text-[clamp(2.25rem,9vw,5rem)] leading-[1.05] font-black text-balance drop-shadow-lg">
            {quizGame.name}
          </p>
          <p className="mt-5 text-lg font-black tracking-[0.28em] uppercase opacity-80 sm:text-xl">
            Quiz
          </p>
          <p className="mt-10 animate-pulse text-sm font-semibold opacity-60">
            Waiting for the facilitator to start…
          </p>
        </div>
      )
    } else if (q && (state.quiz_state === 'active' || state.quiz_state === 'revealed')) {
      body = (
        // The answers sit at the bottom of the screen: on a tablet held in two
        // hands that is where the thumbs already are, and the question above
        // has the room it needs to be read across a table.
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-2 pb-2 sm:pt-4">
          <div className="mb-5 h-2 shrink-0 overflow-hidden rounded-full bg-black/30 sm:mb-6">
            <div
              className="h-full transition-all duration-1000"
              style={{ width: `${timerPct}%`, backgroundColor: accent }}
            />
          </div>
          <h2 className="shrink-0 text-center text-[clamp(1.35rem,4vw,2.25rem)] leading-tight font-black text-balance">
            {q.text}
          </h2>
          {/* Whatever the question carries goes in the room between it and the
              answers, and gives way before the answers do. */}
          <div className="flex min-h-4 flex-1 items-center justify-center py-3">
            <QuizQuestionMedia question={q} accentColor={accent} />
          </div>
          <div className="shrink-0 space-y-2.5 sm:space-y-3">
            {q.answers.map((a) => {
              const selected = (quizMyAnswerId ?? quizAnswer) === a.id
              const faded = quizLocked && !selected
              const revealed = state.quiz_state === 'revealed'
              const isCorrect = a.id === quizCorrectAnswerId
              let cls =
                'xp-quiz-option w-full px-5 py-4 text-left text-base font-bold transition-colors sm:py-5 md:text-lg '
              let style: CSSProperties | undefined
              // Solid white answers: they are the one thing on this screen to
              // press, and a tinted panel over the event's own background read
              // as decoration rather than as a button.
              if (revealed) {
                if (isCorrect) cls += 'bg-green-600 text-white ring-2 ring-green-300'
                else if (selected) cls += 'bg-red-600 text-white'
                else cls += 'bg-white/35 text-black/50'
              } else if (selected) {
                cls += 'ring-2 ring-white/60'
                style = {
                  backgroundColor: STANDBY_ACCENT,
                  color: textOnAccent(STANDBY_ACCENT),
                }
              } else if (faded) {
                cls += 'cursor-not-allowed bg-white/45 text-black/45'
              } else {
                cls += 'bg-white text-black hover:bg-white/90'
              }
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={quizLocked || revealed}
                  className={cls}
                  style={style}
                  onClick={() => void submitQuizAnswer(a.id, stage.gameId!, q.id)}
                >
                  {a.text}
                </button>
              )
            })}
          </div>
        </div>
      )
    } else {
      body = <GameUnavailableFallback />
    }
  } else if (stage?.type === 'bingo' && stage.gameId) {
    const game = games.find((g) => g.id === stage.gameId)
    if (!game) {
      body = <GameUnavailableFallback />
    } else {
    if (!bingoRunQuery.data && !bingoCardQuery.data) {
      body = (
        <div className="mx-auto max-w-lg px-6 py-20 text-center">
          <p className="text-lg font-bold text-white">{game?.name ?? 'Music Bingo'}</p>
          <p className="mt-4 text-white/70">
            Waiting for the facilitator to start this round…
          </p>
        </div>
      )
    } else if (bingoRunQuery.data && !bingoCardQuery.isLoading && !bingoCardQuery.data) {
      body = (
        <div className="mx-auto max-w-lg px-6 py-20 text-center">
          <p className="text-lg font-bold text-white">{game?.name ?? 'Music Bingo'}</p>
          <p className="mt-6 text-white/70">
            This round started before you joined.
          </p>
          <p className="mt-2 text-white/50 text-sm">
            You'll be included in the next round!
          </p>
        </div>
      )
    } else {
    const tracks = game ? bingoTracks(game) : []
    const cellLabels = bingoCardQuery.data
      ? bingoCellDisplay(bingoCardQuery.data)
      : bingoCardTitles(teamId, tracks).map((title) => ({ title, artist: '' }))
    const roundActive = state.bingo_state === 'playing'
    const gameConfig = parseBingoGameConfig(game?.config)
    const winConfig = resolveBingoWinConfig(gameConfig)
    const cardCells = bingoCardQuery.data ?? []
    const historicalByIndex = new Map<number, 'approved' | 'rejected'>()
    for (const s of mySubs) {
      if (
        s.media_type !== 'bingo' ||
        s.game_id !== stage.gameId ||
        s.media_url == null ||
        s.media_url === 'claim'
      ) {
        continue
      }
      const idx = cardCells.length
        ? resolveBingoSubmissionCellIndex(s.media_url, cardCells)
        : Number(s.media_url)
      if (Number.isNaN(idx) || idx < 0) continue
      if (s.status === 'approved' || s.status === 'rejected') {
        historicalByIndex.set(idx, s.status)
      }
    }
    // Cells the participant selected whose result hasn't landed yet (still
    // pending). The reveal broadcasts the played track instantly but the
    // approved/rejected status arrives on the next bundle refetch, so without
    // this a just-selected cell briefly computes as "missed" (grey) before
    // settling to green/red. Treat these as selected, not missed.
    const pendingSelectedIndices = new Set<number>()
    for (const s of mySubs) {
      if (
        s.media_type !== 'bingo' ||
        s.game_id !== stage.gameId ||
        s.status !== 'pending' ||
        s.media_url == null ||
        s.media_url === 'claim'
      ) {
        continue
      }
      const idx = cardCells.length
        ? resolveBingoSubmissionCellIndex(s.media_url, cardCells)
        : Number(s.media_url)
      if (Number.isNaN(idx) || idx < 0) continue
      pendingSelectedIndices.add(idx)
    }

    const approvedIndices = approvedBingoCellIndices(mySubs, stage.gameId, cardCells)
    const winningCells = bingoWinningHighlightCells(approvedIndices, winConfig)
    const revealedTrackIds = parseRevealedTrackIds(state.bingo_revealed_track_ids)
    const missedLockedIndices = cardCells.length
      ? missedBingoCellIndices(cardCells, revealedTrackIds, historicalByIndex)
      : new Set<number>()
    // A cell the participant selected must never flash grey while its result is
    // still in flight — keep it as a selection until approved/rejected resolves.
    for (const idx of pendingSelectedIndices) missedLockedIndices.delete(idx)
    const canMark = roundActive
    body = (
      <div className="mx-auto h-[calc(100dvh-56px)] w-full max-w-5xl overflow-hidden px-2 pt-2 pb-2">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <div className="min-w-0 flex items-center gap-2">
            {logo ? (
              <img src={logo} alt="" className="h-6 w-auto max-w-[84px] object-contain" />
            ) : null}
            <p className="truncate text-sm font-semibold">{event.name}</p>
          </div>
          {state.bingo_state === 'revealed' ? (
            // Marking is briefly locked while the previous song is scored and
            // revealed. Explain the momentary no-op instead of making a tap
            // look as though the app failed to register it.
            <p className="xp-glass-panel shrink-0 animate-pulse rounded-full bg-black/30 px-3 py-1 text-xs font-medium">
              Locking answers…
            </p>
          ) : null}
          {state.hide_team_points ? null : (
            <p className="xp-glass-panel shrink-0 rounded-full bg-black/30 px-3 py-1 text-sm font-semibold tabular-nums">
              {team.score} pts
            </p>
          )}
        </div>
        <div className="grid h-[calc(100%-58px)] grid-cols-5 grid-rows-5 gap-1">
          {cellLabels.map((cell, i) => {
            const finalStatus = historicalByIndex.get(i)
            let cls = 'bg-white/20 text-white'
            let disabled = !canMark
            if (finalStatus === 'approved') {
              cls = 'bg-green-500/80 text-white'
              disabled = true
            } else if (finalStatus === 'rejected') {
              cls = 'bg-red-500/80 text-white'
              disabled = true
            } else if (missedLockedIndices.has(i)) {
              cls = 'bg-gray-500/70 text-white/90'
              disabled = true
            }
            if (winningCells.has(i)) cls += ' ring-2 ring-yellow-300'
            // Show the yellow selection both for the optimistic tap (during play)
            // and for a persisted pending selection (through reveal) so a chosen
            // cell goes straight from yellow to green/red — never grey. Once the
            // result lands (finalStatus set) green/red wins.
            const showSelected =
              finalStatus == null &&
              ((roundActive && bingoPick === i) || pendingSelectedIndices.has(i))
            const pickStyle = showSelected
              ? {
                  backgroundColor: STANDBY_ACCENT,
                  color: textOnAccent(STANDBY_ACCENT),
                }
              : undefined
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                className={`xp-bingo-cell flex h-full min-h-0 flex-col overflow-hidden px-0.5 py-0.5 text-center leading-tight ${cls}`}
                style={pickStyle}
                onClick={() => void submitBingoSquare(i, stage.gameId!)}
              >
                <BingoCardCellLabel title={cell.title} artist={cell.artist} />
              </button>
            )
          })}
        </div>
        <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-white/85 sm:text-xs">
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[#FFC107]" />Your selection</span>
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-green-500" />Correct</span>
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-red-500" />Wrong</span>
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-gray-500" />Missed</span>
        </div>
      </div>
    )
    }
    }
  } else if (stage?.type === 'break') {
    body = (
      <div className="xp-break-panel px-6 py-12 text-center">
        <p className="text-2xl font-bold sm:text-4xl">{stage.message ?? 'Break'}</p>
        <p className="mt-8 font-mono text-5xl tabular-nums">{formatBreakTimer(breakDisplay)}</p>
      </div>
    )
  } else {
    body = <p className="py-16 text-center text-white/80">Stand by…</p>
  }

  const winnerTeamId = state.bingo_winner_team_id ?? null
  const announcedWinnerIds = parseAnnouncedWinnerIds(state.bingo_announced_winner_ids)
  // Only the server-confirmed winning team sees the phone notice. Keeping this
  // authoritative avoids two close devices both declaring themselves the winner.
  const showWinner =
    winnerTeamId != null &&
    winnerTeamId === teamId &&
    winnerTeamId !== dismissedWinnerId &&
    announcedWinnerIds.includes(winnerTeamId) &&
    state.bingo_state === 'revealed'

  const showChatFab = !chatOpen && !captureActive && !selectedGame && !inventoryScannerOpen

  // Keep document scroll anchored at top when switching challenge views.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
    const scrollTop = () => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
    scrollTop()
    return () => {
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'auto'
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [selectedGame?.id, stage?.type, state.current_stage_index])

  return (
    <BrandBackground
      event={event}
      organization={organization}
      variant="default"
      fill
      className={`flex min-h-svh flex-col ${
        showChatFab
          ? 'pt-3 pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))]'
          : 'pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]'
      }`}
    >
      <NotificationAccentSync color={accent} />
      {showWinner && typeof document !== 'undefined'
        ? createPortal(
            <ParticipantBingoNotice
              key={winnerTeamId}
              onDismiss={() => setDismissedWinnerId(winnerTeamId)}
            />,
            document.body,
          )
        : null}
      {!selectedGame && !chatOpen && !inventoryScannerOpen
        ? createPortal(
            <Button
              type="button"
              variant="outline"
              size="icon"
              // Fixed black-and-yellow, not the event accent: these two are
              // app furniture, and on a dark accent they used to disappear.
              className="experience-scope xp-interactive text-nm-yellow fixed right-4 bottom-4 z-[9999] size-12 rounded-full border-none bg-black shadow-lg hover:bg-black hover:brightness-110"
              onClick={() => void handleExitTeam()}
              aria-label={exitMode === 'tablet' ? 'Exit to events' : 'Leave team'}
            >
              <LogOut className="size-4" />
            </Button>,
            document.body,
          )
        : null}
      {devBarOn && devSteps.length > 0 ? (
        <DevQuizBar
          steps={devSteps}
          index={devStep}
          onGo={goDevStep}
          onRestartTimer={restartDevTimer}
        />
      ) : null}
      {header}
      <div className="flex w-full min-h-0 flex-1 flex-col">{body}</div>
      {inventoryScannerOpen ? (
        <InventoryQrScanner
          onClose={() => setInventoryScannerOpen(false)}
          onItemScanned={handleInventoryItemScanned}
        />
      ) : null}
      {typeof document !== 'undefined' && !chatOpen && !captureActive && !inventoryScannerOpen
        ? createPortal(
            <div
              className="fixed left-4 z-[9999]"
              style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              <Button
                type="button"
                className="xp-interactive text-nm-yellow relative size-12 rounded-full bg-black shadow-lg hover:bg-black hover:brightness-110"
                size="icon"
                onClick={() => {
                  setChatOpen(true)
                }}
                aria-label="Open chat"
              >
                <MessageCircle className="size-5" />
                {unreadMessages > 0 ? (
                  <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                ) : null}
              </Button>
            </div>,
            document.body,
          )
        : null}
      <ParticipantChatOverlay
        open={chatOpen}
        messages={visibleMessages}
        accent={accent}
        text={chatText}
        onTextChange={setChatText}
        onSend={() => {
          onSendMessage(chatText)
          setChatText('')
        }}
        onClose={() => setChatOpen(false)}
      />
      <ParticipantAnnouncementOverlay
        announcement={announcement}
        accent={accent}
        onDismiss={onDismissAnnouncement}
      />
      <ParticipantExitDialog
        open={exitDialogOpen}
        mode={exitMode}
        passwordValue={exitPasswordValue}
        onPasswordChange={setExitPasswordValue}
        error={exitPasswordError}
        verifying={exitVerifying}
        accent={accent}
        onCancel={() => setExitDialogOpen(false)}
        onSubmit={(e) => void handleExitPasswordSubmit(e)}
      />
      <DemoOverlay enabled={event.status === 'demo'} />
    </BrandBackground>
  )
}
