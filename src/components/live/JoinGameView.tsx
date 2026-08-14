import { LogOut, MessageCircle, QrCode, ShoppingBag } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'

import { cameraProbeRequested } from '@/lib/challenge-camera'

import { BingoCardCellLabel } from '@/components/live/BingoCardCellLabel'
import { BingoWinCelebration } from '@/components/live/BingoWinCelebration'
import { DemoOverlay } from '@/components/live/DemoOverlay'
import { GameUnavailableFallback } from '@/components/live/GameUnavailableFallback'
import {
  OrderSentOverlay,
  ParticipantAnnouncementOverlay,
  ParticipantChatOverlay,
  ParticipantExitDialog,
} from '@/components/live/participant/JoinGameOverlays'
import { OpenGameChallengeCard } from '@/components/live/OpenGameChallengeCard'
import { QuizQuestionMedia } from '@/components/live/QuizQuestionMedia'
import { questionMedia } from '@/lib/quiz-media'
import { QUIZ_ANSWER_CHANGE_SECONDS } from '@/lib/quiz-auto-reveal'
import { quizQuestionSeconds } from '@/lib/quiz-timing'
import { OpenGameChallengeReview } from '@/components/live/OpenGameChallengeReview'
import { EventStoreSheet } from '@/components/live/EventStoreSheet'
import { parseStoreConfig } from '@/lib/event-form-utils'
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
  nowMs,
  isLikelyNetworkError,
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
  stageGameBackdrop,
  displayTextColorForEvent,
  formatBreakTimer,
  formatClockTimer,
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
import { Outbox, PermanentSubmitError, type OutboxItem } from '@/lib/offline/outbox'
import { createOutboxPersistence } from '@/lib/offline/outbox-persistence'
import { getBlob } from '@/lib/offline/blob-cache'
import { downloadOfflineAnswerKeys } from '@/lib/offline/package'
import { isTextGame, resolveGameFromList } from '@/lib/text-game'
import {
  roundIndexForQuestion,
  roundIntroDisplay,
  quizRoundForQuestionIndex,
} from '@/lib/quiz-rounds'
import { useLiveTimer } from '@/hooks/use-live-timer'
import { LiveClock } from '@/components/live/LiveClock'
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
import { uploadParticipantAsset } from '@/lib/storage'
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

  // Capture a ?camprobe flag before routing can strip the query string; the
  // capture screens read the remembered flag later.
  useEffect(() => {
    cameraProbeRequested()
  }, [])

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
  // Since the outbox made submit return instantly, this never goes true and its
  // disable-guards are inert; kept as the seam for a future "sending" indicator.
  const [submitting, setSubmitting] = useState(false)
  // 0-100 while a photo/video upload reports progress, null otherwise.
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null)
  const [quizChangeLeft, setQuizChangeLeft] = useState<number | null>(null)
  const [quizLocked, setQuizLocked] = useState(false)
  const [dismissedWinnerId, setDismissedWinnerId] = useState<string | null>(null)
  const quizChangeDeadlineRef = useRef<number | null>(null)
  const [bingoPick, setBingoPick] = useState<number | null>(null)
  const bingoPickOptimisticRef = useRef<number | null | undefined>(undefined)
  const [chatOpen, setChatOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [storeOpen, setStoreOpen] = useState(false)
  const [storeView, setStoreView] = useState<'store' | 'orders'>('store')
  const [orderSentOpen, setOrderSentOpen] = useState(false)
  // The store shows only when the organiser configured one AND left
  // purchasing on, and the facilitator has not closed it live with the
  // Purchase items toggle. The printed-QR scan-to-buy flow is retired
  // (Rumen, 8 Aug) — the in-app store is the only way to buy.
  const hasStore = parseStoreConfig(event.store_config).length > 0
  const inventoryEnabled =
    hasStore && (event.inventory_enabled ?? true) && state.store_open !== false

  function openBuyItems() {
    setStoreView('store')
    setStoreOpen(true)
  }

  function openMyItems() {
    setStoreView('orders')
    setStoreOpen(true)
  }
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

  const breakSeconds =
    stage?.type === 'break'
      ? breakDurationSeconds(stage, state.break_timer_seconds)
      : (state.break_timer_seconds ?? 0)

  // Teams asked how long is left and had to look up at the room's screen. The
  // countdown follows the same "Timer on display" switch the display obeys, so
  // turning it off still hides it everywhere. Both countdowns render through
  // LiveClock so their 1Hz tick never re-renders this whole surface.
  const showEventTimer =
    Boolean(state.show_timer_on_display) &&
    stage?.type !== 'break' &&
    stage?.type !== 'welcome' &&
    stage?.type !== 'end' &&
    state.winner_reveal_stage < 1

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

  // --- Submission outbox (OFFLINE-1 Stage 1) --------------------------------
  // Every open submission goes through a background queue so submit returns to
  // the challenge list instantly; the upload + insert + score reconcile run
  // after. Online this just feels instant (no waiting on a video upload, CF4-4).
  // Stage 3 plugs persistence into the same queue so it survives going offline.
  const mergeOwnSubmissionRef = useRef(mergeOwnSubmission)
  mergeOwnSubmissionRef.current = mergeOwnSubmission

  const processOutboxItem = useCallback(async (item: OutboxItem) => {
    const payload = item.payload as {
      mediaType: 'text' | 'photo' | 'video'
      textValue?: string
      file?: File
      // A stable storage path decided at submit time, reused on every retry so a
      // re-upload OVERWRITES rather than orphaning a fresh object each attempt.
      objectPath?: string
    }
    let mediaUrl: string
    if (payload.mediaType === 'text') {
      mediaUrl = payload.textValue ?? ''
    } else {
      // In-memory File on the fast path; after a reload/offline the File was
      // moved to the Cache API, so reload it from the blob key.
      let file = payload.file
      if (!file && item.blobKey) {
        const blob = await getBlob(item.blobKey)
        if (blob) file = new File([blob], 'submission', { type: blob.type })
      }
      if (!file || !payload.objectPath) throw new PermanentSubmitError('Missing media file')
      const mediaKind = payload.mediaType === 'video' ? 'video' : 'photo'
      try {
        // Mint a fresh signed URL and upload to the fixed path on every attempt,
        // so a late retry never fails on an expired token or leaks a duplicate.
        mediaUrl = await uploadParticipantAsset(item.eventId, payload.objectPath, file, {
          mediaKind,
        })
      } catch (err) {
        // A network failure is transient (keep it queued, retry); a size or
        // validation failure is permanent (drop it and tell the player).
        if (isLikelyNetworkError(err)) throw err
        throw new PermanentSubmitError(
          err instanceof Error ? err.message : 'Could not upload submission',
          { cause: err },
        )
      }
    }
    const { data, error } = await supabase
      .from('submissions')
      .insert({
        id: item.clientId,
        event_id: item.eventId,
        team_id: item.teamId,
        game_id: item.gameId,
        media_url: mediaUrl,
        media_type: payload.mediaType,
        status: 'pending',
      })
      .select()
      .single()
    if (error && error.code === '23505') {
      // The row already landed on an earlier attempt whose response we lost.
      // Reconcile the authoritative row (its real media_url + auto-approve
      // status/points) and re-broadcast so the facilitator is not missing it.
      const { data: existing } = await supabase
        .from('submissions')
        .select()
        .eq('id', item.clientId)
        .single()
      if (existing) {
        mergeOwnSubmissionRef.current('UPDATE', existing)
        void publishSubmissionChange(item.eventId, 'INSERT', existing)
      }
      return
    }
    if (error) {
      // A rejected insert (closed event, expired token, RLS, constraint) will
      // not succeed on retry: drop it and surface it, rather than loop forever.
      // Only a genuine network error is transient.
      if (isLikelyNetworkError(error)) throw error
      throw new PermanentSubmitError(
        error.message || 'Could not submit — the event may have closed',
        { cause: error },
      )
    }
    if (data) {
      mergeOwnSubmissionRef.current('UPDATE', data)
      void publishSubmissionChange(item.eventId, 'INSERT', data)
    }
  }, [])

  // useState's lazy initializer builds the outbox exactly once and hands back a
  // stable instance, without reading/writing a ref during render.
  const [outbox] = useState(
    () =>
      new Outbox({
        process: (item) => processOutboxItem(item),
        isOnline: () => navigator.onLine,
        persistence: createOutboxPersistence(event.id),
        onDropped: (item, err) => {
          mergeOwnSubmissionRef.current('DELETE', undefined, { id: item.clientId })
          notify(err instanceof Error ? err.message : 'Could not submit')
        },
        onSettled: (clientId) => setOpenSubmissionWrite(clientId, false),
      }),
  )

  // Once we are in as a team, pull the offline answer package in the background
  // (Stage 4 scores text and puzzles from it offline). Best-effort: the RPC
  // returns nothing without a valid team token, so this is safe to fire and a
  // failure just leaves offline scoring unavailable.
  useEffect(() => {
    if (!event.id) return
    void downloadOfflineAnswerKeys(event.id, new Date().toISOString())
  }, [event.id])

  // Rehydrate any submissions queued before a reload/offline/app-kill and drain
  // them. Runs once for this outbox instance.
  useEffect(() => {
    void outbox.start()
  }, [outbox])

  // Flush the queue whenever connectivity likely returns — a submit made during
  // a brief drop would otherwise sit until the next submit. kick() ignores the
  // backoff so a reconnect retries immediately rather than waiting it out.
  useEffect(() => {
    const kick = () => outbox.kick()
    window.addEventListener('online', kick)
    window.addEventListener('focus', kick)
    document.addEventListener('visibilitychange', kick)
    return () => {
      window.removeEventListener('online', kick)
      window.removeEventListener('focus', kick)
      document.removeEventListener('visibilitychange', kick)
    }
  }, [outbox])

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
  // Clamped like the facilitator panel: a stale index past the last question
  // (old run, edited-down quiz) must not drop players on the fallback screen.
  const currentQuizQ =
    quizQs[
      quizQs.length
        ? Math.min(Math.max(state.current_question_index, 0), quizQs.length - 1)
        : 0
    ]

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
    // iOS (Safari and Chrome) sometimes commits this update but never
    // presents the frame: the sound plays, the facilitator already has the
    // submission, and the player stares at the frozen capture screen until
    // the NEXT DOM change repaints it (8 Aug: 9-10s, unfrozen exactly when
    // the approval landed). Touching a compositor-affecting style forces a
    // present right now.
    requestAnimationFrame(() => {
      // A 1px throwaway node: enough DOM churn to make WebKit present the
      // pending frame, without re-layering the whole page like a body
      // transform would.
      const nudge = document.createElement('div')
      nudge.style.cssText =
        'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.01;pointer-events:none'
      document.body.appendChild(nudge)
      requestAnimationFrame(() => nudge.remove())
    })
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
    // Hand the submission to the outbox and return to the challenge list right
    // away. The insert + score reconcile happen in the background as the queue
    // drains (instantly while online). onSettled clears the Cancel guard.
    const optimistic = optimisticOpenSubmission(game, mediaUrl, 'text')
    setOpenSubmissionWrite(optimistic.id, true)
    mergeOwnSubmission('INSERT', optimistic)
    finishOpenSubmitOptimistically({ submitPressedAt, mediaType: 'text', gameId: game.id })
    await outbox.enqueue({
      clientId: optimistic.id,
      eventId: event.id,
      teamId,
      kind: 'open-submission',
      gameId: game.id,
      createdAt: optimistic.created_at,
      payload: { mediaType: 'text', textValue: mediaUrl },
    })
  }

  async function submitOpenGame(file: File, game: Tables<'games'>) {
    if (!event.id) return
    if (!canSubmit) {
      notify('This event is now closed')
      return
    }
    const submitPressedAt = nowMs()
    const mediaType = game.type === 'video' ? 'video' : 'photo'
    // Decide the storage path once, here, so every upload attempt (including a
    // retry after a dropped connection) writes to the same object rather than
    // minting a new one and orphaning the last. The signed URL itself is minted
    // fresh inside the outbox on each attempt, so it can never expire in queue.
    const objectPath = `${event.id}/submissions/${teamId}/${crypto.randomUUID()}${
      mediaType === 'video' ? '.mp4' : '.jpg'
    }`
    // Return to the challenge list immediately; the upload + insert run in the
    // background via the outbox (no more waiting on a video upload, CF4-4). The
    // pending card shows without media until the row reconciles.
    const optimistic = optimisticOpenSubmission(game, '', mediaType)
    setOpenSubmissionWrite(optimistic.id, true)
    mergeOwnSubmission('INSERT', optimistic)
    finishOpenSubmitOptimistically({ submitPressedAt, mediaType, gameId: game.id })
    await outbox.enqueue({
      clientId: optimistic.id,
      eventId: event.id,
      teamId,
      kind: 'open-submission',
      gameId: game.id,
      createdAt: optimistic.created_at,
      payload: { mediaType, file, objectPath },
    })
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
      {showEventTimer ? (
        <LiveClock
          seconds={state.timer_seconds ?? 0}
          running={Boolean(state.timer_running)}
          render={formatClockTimer}
          className="rounded-full bg-black/35 px-3 py-0.5 text-sm font-black tabular-nums backdrop-blur-sm"
        />
      ) : null}
      {stage?.type === 'quiz' && stage.gameId ? (
        state.quiz_state === 'results' ? (
          <p className="mt-2 text-[clamp(1.5rem,4.6vw,2.5rem)] leading-none font-black tabular-nums drop-shadow-lg sm:mt-4">
            {quizLeaderboard(bundle.teams, submissions, stage.gameId).find(
              (e) => e.team.id === teamId,
            )?.quizPoints ?? 0}
            <span className="ml-1.5 text-sm font-bold opacity-70">quiz pts</span>
          </p>
        ) : (
          // One slot, one size, always the same height: the verdict and the
          // change-answer window take turns in it and nothing below shifts.
          <p
            className={`mt-2 flex h-[clamp(2rem,5.5vw,3rem)] items-center text-[clamp(1.5rem,4.6vw,2.5rem)] leading-none font-black tabular-nums drop-shadow-lg sm:mt-4 ${
              state.quiz_state === 'revealed'
                ? quizWasCorrect
                  ? 'text-green-400'
                  : 'text-red-400'
                : ''
            }`}
            style={
              state.quiz_state === 'active' && quizChangeLeft != null && !quizLocked
                ? { color: accent }
                : undefined
            }
          >
            {state.quiz_state === 'revealed'
              ? quizWasCorrect
                ? 'Correct!'
                : quizMyAnswerId
                  ? 'Incorrect'
                  : 'Time up'
              : state.quiz_state === 'active' && quizChangeLeft != null && !quizLocked
                ? `Change answer · ${quizChangeLeft}s`
                : state.quiz_state === 'active' && quizRunning
                  ? formatTimer(quizTimerDisplay)
                  : ''}
          </p>
        )
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
  } else if (stage?.type === 'end') {
    // Placed above the game branches so ending replaces any game UI at once.
    // Winner reveal above still wins, so hosts can end first, reveal after.
    body = (
      <div className="xp-break-panel flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[clamp(0.8rem,3vw,1.1rem)] leading-none font-black tracking-[0.35em] uppercase opacity-60">
          Event ended
        </p>
        <p className="text-[clamp(1.25rem,5.5vw,2rem)] leading-tight font-black text-balance">
          {stage.message ?? 'Thanks for playing'}
        </p>
      </div>
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
  } else if (stage?.type === 'welcome') {
    body = (
      <div className="xp-break-panel flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[clamp(0.8rem,3vw,1.1rem)] leading-none font-black tracking-[0.35em] uppercase opacity-60">
          Welcome
        </p>
        <p className="text-[clamp(1.25rem,5.5vw,2rem)] leading-tight font-black text-balance">
          {stage.message ?? 'Welcome'}
        </p>
        <p className="text-[clamp(0.8rem,3.4vw,1rem)] font-medium opacity-70">
          Hang tight, the first game is about to begin.
        </p>
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
                  onClick={openBuyItems}
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
          {isPuzzleGame(activeOpenGame) ? (
            // A solved puzzle keeps its own board and result on screen. The
            // generic review card would replace all of it with one line.
            <PuzzleGamePlayer
              eventId={event.id}
              teamId={teamId}
              game={activeOpenGame}
              accentColor={accent}
              onSolvedAutoClose={() => setSelectedGame(null)}
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
          {/* Both or neither: with the store switched off (organiser or the
              facilitator's Purchase items toggle) My Items goes too — no
              items to look at, no button to puzzle over (CF6). */}
          {inventoryEnabled ? (
            <div className="mb-4 flex gap-3">
              <Button type="button" className="flex-1 gap-2 py-5 text-base font-bold shadow-lg" style={{ backgroundColor: accent, color: eventTextColor }} onClick={openBuyItems}>
                <QrCode className="size-5" /> Buy Items
              </Button>
              {hasStore ? (
                <Button
                  type="button"
                  className="text-nm-yellow flex-1 gap-2 border-none bg-black py-5 text-base font-bold shadow-lg hover:bg-black hover:brightness-110"
                  onClick={openMyItems}
                >
                  <ShoppingBag className="size-5" /> My Items
                </Button>
              ) : null}
            </div>
          ) : null}
          {/* Two up on a phone, three on a tablet, four on a computer: each
              step keeps the tiles near square instead of letterboxed. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
    // Matches what the facilitator started the question with, so the bar is
    // full at the start of a media question rather than already part spent.
    const maxSec = quizQuestionSeconds(
      (game?.config as GameConfig)?.timer_seconds ?? 20,
      q,
    )
    // Once an answer is in, the bar stops being the question's clock and
    // becomes the change window's: back to full, red, and five seconds long.
    const inChangeWindow =
      state.quiz_state === 'active' && quizChangeLeft != null && !quizLocked
    const timerPct = inChangeWindow
      ? Math.min(100, (quizChangeLeft / QUIZ_ANSWER_CHANGE_SECONDS) * 100)
      : maxSec > 0
        ? Math.min(100, (quizTimerDisplay / maxSec) * 100)
        : 0
    const timerBarColor = inChangeWindow ? '#EF4444' : accent
    const questionAttachment = questionMedia(q)
    const hasQuestionMedia =
      questionAttachment.kind !== 'none' && Boolean(questionAttachment.url)

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
        // On a laptop there is width to spend: the answers sit four across
        // and the media grows, rather than leaving the screen half empty.
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-2 pb-2 sm:pt-4 lg:max-w-5xl">
          <div className="mb-5 h-2 shrink-0 overflow-hidden rounded-full bg-black/30 sm:mb-6">
            <div
              className="h-full transition-all duration-1000"
              style={{ width: `${timerPct}%`, backgroundColor: timerBarColor }}
            />
          </div>
          {/* On a laptop a question with media reads side by side: the words
              on the left, the photo or clip on the right, which buys the media
              real size without pushing the answers off the screen. Stacked
              everywhere else. */}
          <div
            className={`flex min-h-0 flex-1 flex-col ${
              hasQuestionMedia ? 'lg:flex-row lg:items-center lg:gap-8' : ''
            }`}
          >
            {/* Two lines' worth of room whether or not this question needs it,
                so a long one does not push everything below it. */}
            <h2
              className={`flex min-h-[2.5em] shrink-0 items-center justify-center text-center text-[clamp(1.35rem,4vw,2.25rem)] leading-tight font-black text-balance ${
                hasQuestionMedia ? 'lg:flex-1' : ''
              }`}
            >
              {q.text}
            </h2>
            {/* Bounded by what the question and the answers leave, never more,
                so the screen still fits on a laptop. */}
            <div
              className={`flex max-h-[34svh] min-h-4 flex-1 items-center justify-center overflow-hidden py-3 ${
                hasQuestionMedia ? 'lg:max-h-full lg:flex-1' : 'lg:max-h-[40svh]'
              }`}
            >
              <div className="h-full w-full max-w-md lg:max-w-3xl">
                <QuizQuestionMedia question={q} accentColor={accent} textColor={eventTextColor} />
              </div>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-1 gap-2.5 sm:gap-3 lg:grid-cols-4">
            {q.answers.map((a) => {
              const selected = (quizMyAnswerId ?? quizAnswer) === a.id
              const faded = quizLocked && !selected
              const revealed = state.quiz_state === 'revealed'
              const isCorrect = a.id === quizCorrectAnswerId
              let cls =
                'xp-quiz-option flex w-full items-center px-5 py-3 text-left text-base font-bold transition-colors sm:py-3.5 md:text-lg lg:min-h-24 lg:justify-center lg:text-center '
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
      // Takes exactly what the shell leaves rather than guessing at the
      // viewport: the card is one screen, never a scroll.
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden px-2 pt-2 pb-2">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <div className="min-w-0 flex items-center gap-2">
            {logo ? (
              <img src={logo} alt="" className="h-6 w-auto max-w-[84px] object-contain" />
            ) : null}
            <p className="truncate text-base font-black sm:text-lg">{event.name}</p>
          </div>
          {state.bingo_state === 'revealed' ? (
            // Marking is briefly locked while the previous song is scored and
            // revealed. Explain the momentary no-op instead of making a tap
            // look as though the app failed to register it.
            <p className="shrink-0 animate-pulse text-xs font-bold sm:text-sm">
              Locking answers…
            </p>
          ) : null}
          {state.hide_team_points ? null : (
            <p className="shrink-0 text-lg font-black tabular-nums sm:text-xl">
              {team.score}
              <span className="ml-1 text-xs font-bold opacity-70">pts</span>
            </p>
          )}
        </div>
        {/* Capped on a phone: filling the whole height gave cells taller than
            they are wide, which reads as a list rather than a card. */}
        <div className="my-auto grid max-h-[62svh] min-h-0 flex-1 grid-cols-5 grid-rows-5 gap-1 sm:max-h-full sm:gap-1.5">
          {cellLabels.map((cell, i) => {
            const finalStatus = historicalByIndex.get(i)
            // Solid white with black text: a tinted cell read differently on
            // every event background, and a bingo card has to be legible at a
            // glance whatever is behind it.
            let cls = 'bg-white text-black'
            let disabled = !canMark
            if (finalStatus === 'approved') {
              cls = 'bg-green-600 text-white'
              disabled = true
            } else if (finalStatus === 'rejected') {
              cls = 'bg-red-600 text-white'
              disabled = true
            } else if (missedLockedIndices.has(i)) {
              // Played, on the card, never marked: grey, as the legend says.
              cls = 'bg-gray-400 text-gray-900'
              disabled = true
            }
            if (winningCells.has(i)) cls += ' ring-4 ring-[#FFC107]'
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
        <div className="mt-1.5 flex shrink-0 items-center justify-between px-1 text-[10px] font-semibold text-white/85 sm:text-xs">
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
      // Same three lines as the room's screen, scaled to a phone and sized to
      // fit without scrolling.
      <div className="xp-break-panel flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[clamp(0.8rem,3vw,1.1rem)] leading-none font-black tracking-[0.35em] uppercase opacity-60">
          Break
        </p>
        <p className="text-[clamp(1.25rem,5.5vw,2rem)] leading-tight font-black text-balance">
          {stage.message ?? 'Back shortly'}
        </p>
        <LiveClock
          seconds={breakSeconds}
          running={Boolean(state.break_timer_running)}
          render={formatBreakTimer}
          className="text-[clamp(3.5rem,18vw,6rem)] leading-[0.85] font-black tabular-nums drop-shadow-lg"
        />
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

  const showChatFab = !chatOpen && !captureActive && !selectedGame && !storeOpen

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
      gameBackdrop={stageGameBackdrop(stage, games)}
      fill
      className={`flex min-h-svh flex-col ${
        showChatFab
          ? 'pt-3 pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))]'
          : 'pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]'
      }`}
    >
      <NotificationAccentSync color={accent} />
      {/* The same celebration the room's screen plays, in its personal form:
          a winner's own phone had a plain black card with one word on it. */}
      {showWinner && typeof document !== 'undefined'
        ? createPortal(
            <BingoWinCelebration
              key={winnerTeamId}
              teamName={team.name ?? 'Your team'}
              teamColor={team.color}
              mine
              bonusPoints={
                stage?.type === 'bingo' && stage.gameId
                  ? (parseBingoGameConfig(
                      games.find((g) => g.id === stage.gameId)?.config,
                    ).bingo_line_points ?? 100)
                  : null
              }
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
      {header}
      <div className="flex w-full min-h-0 flex-1 flex-col">{body}</div>
      {storeOpen ? (
        <EventStoreSheet
          eventId={event.id}
          accentColor={accent}
          view={storeView}
          onClose={() => setStoreOpen(false)}
          onOrderPlaced={() => setOrderSentOpen(true)}
        />
      ) : null}
      {typeof document !== 'undefined' && !chatOpen && !captureActive
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
      <OrderSentOverlay
        open={orderSentOpen}
        accent={accent}
        onClose={() => setOrderSentOpen(false)}
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
