import { LogOut, MessageCircle, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'

import { BingoBonusPanel } from '@/components/live/BingoBonusPanel'
import { BingoCardCellLabel } from '@/components/live/BingoCardCellLabel'
import { BingoWinCelebration } from '@/components/live/BingoWinCelebration'
import { DemoOverlay } from '@/components/live/DemoOverlay'
import { GameUnavailableFallback } from '@/components/live/GameUnavailableFallback'
import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { OpenGameChallengeCard } from '@/components/live/OpenGameChallengeCard'
import { OpenGameChallengeReview } from '@/components/live/OpenGameChallengeReview'
import { OpenGameSubmittingScreen } from '@/components/live/OpenGameSubmittingScreen'
import { OpenGameTextChallenge } from '@/components/live/OpenGameTextChallenge'
import { BrandBackground } from '@/components/live/BrandBackground'
import { QuizResultsPanel } from '@/components/live/QuizResultsPanel'
import { ChallengeMediaCaptureFlow } from '@/components/live/ChallengeMediaCaptureFlow'
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
import { useIncomingChatAlerts } from '@/hooks/use-chat-notifications'
import { useBingoRun, useBingoTeamCard } from '@/hooks/use-bingo-run'
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
import {
  encodeBingoBonusSubmission,
  parseBingoBonusSubmission,
} from '@/lib/bingo-submission-url'
import type { LiveEventBundle } from '@/lib/live-event'
import {
  bingoBonusChallenge,
  bingoBonusMediaType,
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
import { supabase } from '@/lib/supabase'
import {
  CHALLENGE_VIDEO_FRAME_CLASS,
  CHALLENGE_VIDEO_MEDIA_CLASS,
} from '@/lib/challenge-camera'
import { uploadAsset } from '@/lib/storage'
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
  const onAccent = textOnAccent(accent)
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
  const [bonusAnswerId, setBonusAnswerId] = useState<string | null>(null)
  const [bonusCaptureFile, setBonusCaptureFile] = useState<File | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
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
  const quizQs = quizGame ? quizQuestions(quizGame) : []
  const currentQuizQ = quizQs[state.current_question_index]

  useEffect(() => {
    // Reset only when the question (or game) changes — NOT on quiz_state
    // transitions. Including quiz_state here wiped the player's selection the
    // instant the facilitator revealed, causing a wrong-answer flash. Locking on
    // reveal/results is handled by the dedicated effect below.
    quizChangeDeadlineRef.current = null
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

  // F8: bonus reveal sound on the player (correct/wrong), mirroring the quiz.
  const lastBonusRevealKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (state.bingo_state !== 'bonus_revealed') {
      if (state.bingo_state !== 'bonus') lastBonusRevealKeyRef.current = null
      return
    }
    const game =
      stage?.type === 'bingo' && stage.gameId
        ? games.find((g) => g.id === stage.gameId)
        : null
    const challenge = game ? bingoBonusChallenge(game, state.bingo_bonus_id) : null
    if (!challenge?.correctAnswerId) return
    const key = String(state.bingo_bonus_id)
    if (lastBonusRevealKeyRef.current === key) return
    lastBonusRevealKeyRef.current = key
    const mine = mySubs.find((s) => s.media_type === bingoBonusMediaType(challenge.id))
    const myAnswer = mine ? parseBingoBonusSubmission(mine.media_url).answerId : null
    if (myAnswer === challenge.correctAnswerId) playQuizCorrectSound()
    else playQuizWrongSound()
  }, [state.bingo_state, state.bingo_bonus_id, stage?.type, stage?.gameId, games, mySubs])

  function beginOpenSubmit() {
    flushSync(() => {
      setSubmitting(true)
      setCaptureActive(false)
    })
  }

  function finishOpenSubmitSuccess() {
    playSubmitSound()
    notify('Submitted — waiting for approval')
    flushSync(() => {
      setSelectedGame(null)
      setCaptureActive(false)
      setSubmitting(false)
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
    beginOpenSubmit()
    try {
      const { data, error } = await supabase
        .from('submissions')
        .insert({
          event_id: event.id,
          team_id: teamId,
          game_id: game.id,
          media_url: mediaUrl,
          media_type: 'text',
          status: 'pending',
        })
        .select()
        .single()
      if (error) throw error
      if (data) {
        // Update our own view immediately so the screen never waits on the
        // broadcast fan-out (which can silently fall back to a slow REST call
        // when the channel isn't in a joined state — see markBingoCell for the
        // same pattern). The DB write above is what actually matters; the
        // broadcast is best-effort for other devices only.
        mergeOwnSubmission('INSERT', data)
        void publishSubmissionChange(event.id, 'INSERT', data)
      }
      finishOpenSubmitSuccess()
    } catch {
      notify("Couldn't submit — tap to retry")
      setSubmitting(false)
    }
  }

  async function submitOpenGame(file: File, game: Tables<'games'>) {
    if (!event.id) return
    if (!canSubmit) {
      notify('This event is now closed')
      return
    }
    beginOpenSubmit()
    try {
      const url = await uploadAsset(
        'game-assets',
        `${event.id}/submissions/${teamId}/${Date.now()}${game.type === 'video' ? '.mp4' : '.jpg'}`,
        file,
        { mediaKind: game.type === 'video' ? 'video' : 'photo' },
      )
      const { data, error } = await supabase
        .from('submissions')
        .insert({
          event_id: event.id,
          team_id: teamId,
          game_id: game.id,
          media_url: url,
          media_type: game.type === 'video' ? 'video' : 'photo',
          status: 'pending',
        })
        .select()
        .single()
      if (error) throw error
      if (data) {
        mergeOwnSubmission('INSERT', data)
        void publishSubmissionChange(event.id, 'INSERT', data)
      }
      finishOpenSubmitSuccess()
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes('must be')
          ? err.message
          : "Couldn't submit — tap to retry"
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

  async function submitBingoBonusAnswer(
    answerId: string,
    gameId: string,
    challengeId: string,
    challenge: { mediaType: 'photo' | 'video' },
    proofFile?: File | null,
  ) {
    if (state.bingo_state !== 'bonus') return
    if (challenge.mediaType === 'photo' || challenge.mediaType === 'video') {
      if (!proofFile) {
        notify('Add a photo or video first')
        return
      }
    }
    setSubmitting(true)
    try {
      let proofUrl: string | null = null
      if (proofFile) {
        proofUrl = await uploadAsset(
          'game-assets',
          `${event.organization_id}/bingo-bonus/${crypto.randomUUID()}-${proofFile.name}`,
          proofFile,
          { mediaKind: challenge.mediaType === 'video' ? 'video' : 'photo' },
        )
      }
      const mediaUrl = encodeBingoBonusSubmission(answerId, proofUrl)
      const mediaType = bingoBonusMediaType(challengeId)
      const existing = mySubs.find(
        (s) => s.media_type === mediaType && s.game_id === gameId,
      )
      const { data: bonusRow, error } = existing
        ? await supabase
            .from('submissions')
            .update({ media_url: mediaUrl })
            .eq('id', existing.id)
            .select()
            .single()
        : await supabase
            .from('submissions')
            .insert({
              event_id: event.id,
              team_id: teamId,
              game_id: gameId,
              media_url: mediaUrl,
              media_type: mediaType,
              status: 'pending',
            })
            .select()
            .single()
      if (error) throw error
      if (bonusRow) {
        mergeOwnSubmission(existing ? 'UPDATE' : 'INSERT', bonusRow)
        void publishSubmissionChange(
          event.id,
          existing ? 'UPDATE' : 'INSERT',
          bonusRow,
        )
      }
      setBonusCaptureFile(null)
      playSubmitSound()
      notify('Bonus answer submitted')
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes('must be')
          ? err.message
          : "Couldn't submit bonus answer — tap to retry"
      notify(msg)
    } finally {
      setSubmitting(false)
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
    <header className="mb-4 flex flex-col items-center gap-1.5 px-2 pt-4 text-center sm:pt-5">
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
      const locked =
        latestSub?.status === 'approved' || latestSub?.status === 'rejected'

      body = (
        <div className="mx-auto w-full max-w-lg px-3 pt-1">
          {!submitting ? (
            <Button
              variant="outline"
              size="sm"
              className="mb-3 w-fit border-white/40 bg-black/30 px-4 py-2 font-semibold shadow-md backdrop-blur-sm hover:bg-black/50"
              onClick={() => {
                setSelectedGame(null)
                setCaptureActive(false)
              }}
            >
              ← Back
            </Button>
          ) : null}
          {!canSubmit ? (
            <p
              className="mb-3 text-center text-sm font-semibold"
              style={{ color: accent }}
            >
              Event closed — no new submissions
            </p>
          ) : null}
          {submitting ? (
            <OpenGameSubmittingScreen accentColor={accent} />
          ) : pending && latestSub ? (
            <OpenGameChallengeReview
              game={activeOpenGame}
              submission={latestSub}
              accentColor={accent}
              cancelling={cancelling}
              onCancel={() => void cancelPendingSubmission(latestSub.id)}
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
              pointsLabel={gamePointsDisplay(activeOpenGame)}
              coverUrl={activeOpenGame.cover_url}
              accentColor={accent}
              mediaType={activeOpenGame.type === 'video' ? 'video' : 'photo'}
              config={
                activeOpenGame.type === 'video'
                  ? (activeOpenGame.config as GameConfig)
                  : undefined
              }
              disabled={submitting}
              onCaptureActiveChange={setCaptureActive}
              onFileReady={(file) => void submitOpenGame(file, activeOpenGame)}
            />
          )}
        </div>
      )
    } else {
      body = (
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 px-4">
          {openGames.map((g) => {
            const sub = activeSubmissionForGame(mySubs, g.id)
            return (
              <OpenGameChallengeCard
                key={g.id}
                game={g}
                submissionStatus={sub?.status}
                accentColor={accent}
                onAccentColor={onAccent}
                canSubmit={canSubmit}
                onSelect={() => setSelectedGame(g)}
              />
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
    } else if (state.quiz_state === 'round_intro' && quizGame) {
      const round = quizRoundForQuestionIndex(quizGame, state.current_question_index)
      const q = quizQuestions(quizGame)[state.current_question_index]
      const intro = round
        ? roundIntroDisplay(round, roundIndexForQuestion(quizGame, q))
        : { title: 'NEXT ROUND', subtitle: '' }
      body = (
        <div className="mx-auto max-w-lg px-6 py-20 text-center">
          <p className="font-sans text-4xl font-bold md:text-5xl">{intro.title}</p>
          {intro.subtitle ? (
            <p className="mt-4 text-2xl font-semibold opacity-90 md:text-3xl">{intro.subtitle}</p>
          ) : null}
          <p className="text-muted-foreground mt-8 text-sm text-white/50">
            Waiting for the facilitator to start…
          </p>
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
      // correctAnswerId is redacted from the live game bundle; the facilitator
      // broadcasts it via event_state.quiz_correct_answer_id at reveal time.
      const correctAnswerId = state.quiz_correct_answer_id
      const answerKnown = Boolean(correctAnswerId)
      const myAnswerId = existing?.media_url ?? quizAnswer
      const ok = answerKnown && myAnswerId === correctAnswerId
      body = (
        <div className="mx-auto max-w-lg px-4">
          {answerKnown ? (
            <p className={`mb-4 text-center text-lg font-bold ${ok ? 'text-green-400' : 'text-red-400'}`}>
              {ok ? 'Correct!' : 'Incorrect'}
            </p>
          ) : (
            <p className="mb-4 text-center text-lg font-bold text-white/80">
              Answer locked in — revealing…
            </p>
          )}
          <div className="space-y-2">
            {q.answers.map((a) => {
              const isCorrect = answerKnown && a.id === correctAnswerId
              const isMine = a.id === myAnswerId
              let cls = 'xp-quiz-option rounded-xl px-4 py-3 text-sm font-medium '
              let style: CSSProperties | undefined
              if (isCorrect) {
                cls += 'bg-green-600/80 ring-2 ring-green-300'
              } else if (answerKnown && isMine && !isCorrect) {
                cls += 'bg-red-600/70'
              } else if (isMine) {
                cls += 'ring-2 ring-white/40'
                style = { backgroundColor: STANDBY_ACCENT, color: textOnAccent(STANDBY_ACCENT) }
              } else {
                cls += 'bg-white/15'
              }
              return (
                <div key={a.id} className={cls} style={style}>
                  {a.text}
                </div>
              )
            })}
          </div>
        </div>
      )
    } else if (q && state.quiz_state === 'active') {
      body = (
        <div className="mx-auto max-w-lg px-4">
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
                'xp-quiz-option w-full px-4 py-4 text-left text-sm font-semibold transition-colors '
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
              className="xp-glass-panel mt-4 rounded-xl px-4 py-3 text-center"
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
    } else {
      body = <GameUnavailableFallback />
    }
  } else if (stage?.type === 'bingo' && stage.gameId) {
    const game = games.find((g) => g.id === stage.gameId)
    if (!game) {
      body = <GameUnavailableFallback />
    } else {
    const bonusChallenge = game
      ? bingoBonusChallenge(game, state.bingo_bonus_id)
      : null
    const bonusRevealed = state.bingo_state === 'bonus_revealed'
    const bonusActive = state.bingo_state === 'bonus' || bonusRevealed

    if (bonusChallenge && bonusActive) {
      const mediaType = bingoBonusMediaType(bonusChallenge.id)
      const existing = mySubs.find(
        (s) => s.media_type === mediaType && s.game_id === stage.gameId,
      )
      const parsed = parseBingoBonusSubmission(existing?.media_url ?? null)
      const locked = bonusRevealed || Boolean(existing)
      const needsMedia =
        bonusChallenge.mediaType === 'photo' || bonusChallenge.mediaType === 'video'
      body = (
        <div className="mx-auto max-w-lg px-4">
          <BingoBonusPanel
            challenge={bonusChallenge}
            accentColor={accent}
            revealed={bonusRevealed}
            selectedAnswerId={bonusAnswerId}
            locked={locked}
            existingAnswerId={parsed.answerId || null}
            onSelect={(answerId) => setBonusAnswerId(answerId)}
          />
          {parsed.mediaProofUrl && bonusRevealed ? (
            bonusChallenge.mediaType === 'video' ? (
              <div className={`mt-4 ${CHALLENGE_VIDEO_FRAME_CLASS}`}>
                <video
                  src={parsed.mediaProofUrl}
                  controls
                  className={CHALLENGE_VIDEO_MEDIA_CLASS}
                />
              </div>
            ) : (
              <img
                src={parsed.mediaProofUrl}
                alt=""
                className="mt-4 w-full rounded-lg"
              />
            )
          ) : null}
          {!locked && needsMedia ? (
            <div className="mt-4">
              <ChallengeMediaCaptureFlow
                title={game?.name ?? 'Bonus challenge'}
                description={
                  bonusChallenge.mediaType === 'video'
                    ? 'Record a short video as proof for your bonus answer.'
                    : 'Take a photo as proof for your bonus answer.'
                }
                pointsLabel={game ? gamePointsDisplay(game) : 'Bonus'}
                coverUrl={game?.cover_url}
                accentColor={accent}
                mediaType={bonusChallenge.mediaType === 'video' ? 'video' : 'photo'}
                config={(game?.config as GameConfig) ?? {}}
                disabled={submitting}
                onCaptureActiveChange={setCaptureActive}
                onFileReady={setBonusCaptureFile}
              />
            </div>
          ) : null}
          {!locked && bonusAnswerId ? (
            <LiveAccentButton
              accentColor={accent}
              className="mt-6 w-full"
              disabled={submitting || (needsMedia && !bonusCaptureFile)}
              onClick={() =>
                void submitBingoBonusAnswer(
                  bonusAnswerId,
                  stage.gameId!,
                  bonusChallenge.id,
                  bonusChallenge,
                  bonusCaptureFile,
                )
              }
            >
              Submit bonus answer
            </LiveAccentButton>
          ) : null}
        </div>
      )
    } else if (!bingoRunQuery.data && !bingoCardQuery.data) {
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
          <p className="xp-glass-panel shrink-0 rounded-full bg-black/30 px-3 py-1 text-sm font-semibold tabular-nums">
            {team.score} pts
          </p>
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
  const winnerTeam = winnerTeamId
    ? bundle.teams.find((t) => t.id === winnerTeamId)
    : null
  const announcedWinnerIds = parseAnnouncedWinnerIds(state.bingo_announced_winner_ids)
  // Only celebrate after a confirmed win announcement (revealed round + announced
  // id), not from stale winner fields during play/start transitions.
  const showWinner =
    Boolean(winnerTeam) &&
    winnerTeamId != null &&
    winnerTeamId !== dismissedWinnerId &&
    announcedWinnerIds.includes(winnerTeamId) &&
    state.bingo_state === 'revealed'

  const showChatFab = !chatOpen && !captureActive && !selectedGame

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
      className={
        showChatFab
          ? 'pt-3 pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))]'
          : 'pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]'
      }
    >
      <NotificationAccentSync color={accent} />
      {showWinner && winnerTeam && typeof document !== 'undefined'
        ? createPortal(
            <BingoWinCelebration
              key={winnerTeamId}
              teamName={winnerTeam.name ?? 'Team'}
              teamColor={winnerTeam.color}
              mine={winnerTeamId === teamId}
              onDismiss={() => setDismissedWinnerId(winnerTeamId)}
            />,
            document.body,
          )
        : null}
      {!selectedGame && !chatOpen
        ? createPortal(
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="experience-scope fixed right-4 bottom-4 z-[9999] size-10 rounded-lg border-white/35 bg-black/35 text-inherit shadow-md backdrop-blur-sm hover:bg-black/55"
              onClick={() => void handleExitTeam()}
              aria-label={exitMode === 'tablet' ? 'Exit to events' : 'Leave team'}
            >
              <LogOut className="size-4" />
            </Button>,
            document.body,
          )
        : null}
      {header}
      <div className="w-full">{body}</div>
      {typeof document !== 'undefined' && !chatOpen && !captureActive
        ? createPortal(
            <div
              className="fixed left-4 z-[9999]"
              style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              <Button
                type="button"
                className="xp-interactive relative size-12 rounded-full shadow-lg hover:brightness-95"
                size="icon"
                style={{ backgroundColor: accent, color: onAccent }}
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
              className="xp-field flex-1 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-base text-white placeholder:text-white/50"
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
          <Card className="xp-card max-w-md space-y-4 p-6 text-center">
            <p className="text-lg">{announcement}</p>
            <LiveAccentButton accentColor={accent} onClick={onDismissAnnouncement}>
              Dismiss
            </LiveAccentButton>
          </Card>
        </div>
      ) : null}
      {exitDialogOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-dialog-title"
        >
          <Card className="w-full max-w-sm space-y-4 bg-card p-6 shadow-lg">
            <h3 id="exit-dialog-title" className="font-semibold">
              {exitMode === 'tablet' ? 'Return to events' : 'Leave team'}
            </h3>
            <p className="text-muted-foreground text-sm">
              Enter the tablet password to continue.
            </p>
            <form className="space-y-3" onSubmit={(e) => void handleExitPasswordSubmit(e)}>
              <input
                type="password"
                autoComplete="current-password"
                className="xp-field w-full rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-base text-white placeholder:text-white/50"
                placeholder="Password"
                value={exitPasswordValue}
                onChange={(e) => setExitPasswordValue(e.target.value)}
                autoFocus
              />
              {exitPasswordError ? (
                <p className="text-destructive text-sm" role="alert">{exitPasswordError}</p>
              ) : null}
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => setExitDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={exitVerifying || !exitPasswordValue.trim()}
                  style={{ backgroundColor: accent, color: 'white' }}
                >
                  {exitVerifying ? 'Checking…' : 'Continue'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
      <DemoOverlay enabled={event.status === 'demo'} />
    </BrandBackground>
  )
}
