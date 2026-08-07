import { Check, Download, MessageCircle, Pause, Play, Plus, Minus, RotateCcw, ScrollText, ShoppingBag, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { FacilitatorButton, FacilitatorButtonLarge } from '@/components/admin/FacilitatorButton'
import { FacilitatorToggle } from '@/components/admin/FacilitatorToggle'
import { FACILITATOR_CHAT_SENDER } from '@/lib/chat-notifications'
import { readableTextOn } from '@/lib/hex-color'
import { FilterChips } from '@/components/admin/FilterChips'
import { SegmentedPill } from '@/components/neo-minimal/SegmentedPill'
import { BingoClipPlayer, type BingoClipPlayerHandle } from '@/components/live/BingoClipPlayer'
import { DisplayPreviewFrame } from '@/components/live/DisplayPreviewFrame'
import { DemoOverlay } from '@/components/live/DemoOverlay'
import {
  FacilitatorChatBubble,
  FacilitatorChatDrawer,
  useFacilitatorChatInbox,
} from '@/components/live/FacilitatorChatDrawer'
import { SubmissionDetailModal } from '@/components/live/SubmissionDetailModal'
import { TeamQuestProgressModal } from '@/components/live/TeamQuestProgressModal'
import {
  EventLogModal,
  ResetTeamModal,
  TeamClaimModal,
} from '@/components/live/facilitator/FacilitatorModals'
import { questGamesForEvent, teamQuestProgress } from '@/lib/quest-progress'
import {
  DEFAULT_WINNER_SOUND_TARGETS,
  parseWinnerSoundTargets,
  WINNER_SOUND_SURFACES,
  winnerSoundEnabled,
  type WinnerSoundSurface,
} from '@/lib/winner-sound'
import { FacilitatorPanelShell } from '@/components/layout/FacilitatorPanelShell'
import { NeoButton, NeoInput, NeoStatusBadge } from '@/components/neo-minimal'
import { useInstallAction } from '@/components/pwa/use-install-action'
import type { NeoStatusBadgeTone } from '@/components/neo-minimal/NeoStatusBadge'
import { useNotification } from '@/contexts/notification-context'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useBingoRun, type BingoRunRow } from '@/hooks/use-bingo-run'
import { useLiveTimer } from '@/hooks/use-live-timer'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useChatMessages, useFacilitatorPresence, useLiveEvent } from '@/hooks/use-live-event'
import { useEventInventoryPurchases } from '@/hooks/use-inventory'
import { activateBingoRun } from '@/lib/activate-bingo-run'
import {
  countClaimedTeams,
  demoTeamSlots,
  DEMO_MAX_TEAMS,
  isEventDemoStatus,
} from '@/lib/event-demo'
import { incrementTeamScore } from '@/lib/increment-team-score'
import { publishSubmissionChange, publishLiveBundleReload } from '@/lib/live-broadcast'
import { bingoTrackPlaybackUrl, fetchMusicTracksForGame } from '@/lib/bingo-playback'
import {
  isLastQuestionInRound,
  quizRoundForQuestionIndex,
} from '@/lib/quiz-rounds'
import { shouldAutoRevealQuizQuestion } from '@/lib/quiz-auto-reveal'
import { quizQuestionSeconds } from '@/lib/quiz-timing'
import {
  bingoSongProgress,
  parseBingoGameConfig,
} from '@/lib/bingo-facilitator'
import { advanceBingoTrack } from '@/lib/bingo-round-advance'
import { parseAnnouncedWinnerIds, parseRevealedTrackIds } from '@/lib/bingo-cell-match'
import { restartBingoRun } from '@/lib/restart-bingo-run'
import { scoreBingoRound } from '@/lib/bingo-scoring'
import {
  expectedTextAnswerLabel,
  isOpenStageSubmissionMediaType,
  puzzleSubmissionStatLabel,
  textAnswerVerdict,
  textSubmissionDisplayLabel,
  type TextAnswerVerdict,
} from '@/lib/text-game'
import { profileDisplayName } from '@/lib/auth-routes'
import {
  bingoTracks,
  currentStage,
  breakDurationSeconds,
  formatBreakTimer,
  formatTimer,
  parseStages,
  quizTimerRunning,
  quizTimerSeconds,
  quizQuestions,
  quizSubmissionMediaType,
  scoreCurrentQuizQuestion,
  revealQuizAnswer,
  isEventLive,
} from '@/lib/live-event'
import { gameTypeTagClass } from '@/lib/game-type-styles'
import { bingoRunRowFromActivation, normalizeBingoPlayOrder } from '@/lib/bingo-run-cache'
import { getEventLinks } from '@/lib/event-links'
import { queryKeys } from '@/lib/query-keys'
import { createThrottledTimerSync } from '@/lib/live-timer-sync'
import { logEventActivity } from '@/lib/event-log'
import {
  playAnnouncementSound,
  playNewMessageSound,
  playNewSubmissionSound,
  playEventWinnerSequence,
  playBingoWinJingle,
  installAudioUnlock,
  unlockAudioFromUserGesture,
  isSoundsMuted,
  setSoundsMuted,
} from '@/lib/sounds'
import type { GameConfig, MusicTrack } from '@/types/game-config'
import { setLiveParticipantMode, supabase } from '@/lib/supabase'
import { uploadAsset } from '@/lib/storage'
import type { Tables, TablesUpdate } from '@/types/helpers'

const ANNOUNCEMENT_MS = 60_000

/** Team states borrow the events list's badge tones. */
const TEAM_STATUS_TONE: Record<string, string> = {
  active: 'active',
  idle: 'draft',
  stopped: 'archived',
}

// UI-1: parse a typed countdown — plain number = minutes, otherwise mm:ss / hh:mm:ss.
/**
 * Short label for the kind of submission on a review card.
 *
 * Prefers the game's own type; falls back to the submission's media_type for
 * rows whose game has since been removed from the event. Quiz answers arrive
 * as "quiz:<questionId>", so the prefix is what matters, not the whole string.
 */
function gameTypeLabel(
  gameType: string | null | undefined,
  mediaType: string | null | undefined,
): string {
  const key = gameType ?? (mediaType ?? '').split(':')[0]
  switch (key) {
    case 'photo':
      return 'Photo'
    case 'video':
      return 'Video'
    case 'text':
      return 'Text'
    case 'quiz':
      return 'Quiz'
    case 'music_bingo':
    case 'bingo':
      return 'Bingo'
    case 'puzzle':
      return 'Puzzle'
    default:
      return 'Other'
  }
}

/**
 * The answer a text game counts as correct, for the review card.
 *
 * Null for a judged game, which deliberately has no right answer. Multiple
 * accepted answers are joined so the facilitator sees the whole set rather than
 * only the first one a team might have matched.
 */
/** How a text answer compares with the game's reference answer, as a chip. */
const TEXT_VERDICT_CHIP: Record<
  Exclude<TextAnswerVerdict, 'unknown'>,
  { label: string; className: string }
> = {
  correct: { label: '✓ Matches', className: 'bg-emerald-600 text-white' },
  close: {
    label: '≈ Matches except case/spaces',
    className: 'bg-amber-500 text-black',
  },
  wrong: { label: '✗ Does not match', className: 'bg-rose-600 text-white' },
}

function parseTimerInput(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  if (/^\d+$/.test(t)) return Number(t) * 60
  const parts = t.split(':').map((p) => p.trim())
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null
  return parts.map(Number).reduce((acc, n) => acc * 60 + n, 0)
}

export function FacilitatorEventPage() {
  // The facilitator acts via their authenticated session. Clear any participant
  // anon override left over from in-tab navigation off a join/display route.
  setLiveParticipantMode(false)

  const { eventId } = useParams<{ eventId: string }>()
  const { profile, user } = useAuth()
  const name =
    profileDisplayName(profile) ||
    user?.email?.split('@')[0] ||
    'Facilitator'
  const { bundle, loading, error, updateState, updateTeam } = useLiveEvent(eventId)
  const purchasesQuery = useEventInventoryPurchases(eventId)
  useDocumentTitle('Facilitator', bundle?.event?.name)
  const { messages, chatHistoryReady, sendMessage } = useChatMessages(eventId)
  const others = useFacilitatorPresence(eventId, name || null)
  const annClearRef = useRef<number | undefined>(undefined)

  const [announcement, setAnnouncement] = useState('')
  // UI-1: click the paused countdown to type a new duration, saved on demand.
  const [timerEdit, setTimerEdit] = useState<string | null>(null)
  const [claimSlot, setClaimSlot] = useState<Tables<'teams'> | null>(null)
  const [resetConfirmTeam, setResetConfirmTeam] = useState<Tables<'teams'> | null>(null)
  const [resettingTeam, setResettingTeam] = useState(false)
  const [progressTeam, setProgressTeam] = useState<Tables<'teams'> | null>(null)
  const [muted, setMuted] = useState(() => isSoundsMuted())
  // Installing from here pins the default manifest, whose start_url is `/`, and
  // the root already sends a facilitator to their event list. So the icon keeps
  // working after this event ends, unlike the URL it was created from.
  const install = useInstallAction()
  const [claimName, setClaimName] = useState('')
  const [claimPhoto, setClaimPhoto] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [subTab, setSubTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [stateError, setStateError] = useState<string | null>(null)
  const [selectedSub, setSelectedSub] = useState<Tables<'submissions'> | null>(null)
  const [breakHalted, setBreakHalted] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatTeamId, setChatTeamId] = useState<string | null>(null)
  const [audioPlayNonce, setAudioPlayNonce] = useState(0)
  const [bingoAdvancing, setBingoAdvancing] = useState(false)
  const [bingoRunOverride, setBingoRunOverride] = useState<BingoRunRow | null>(null)
  const [bingoRestartOpen, setBingoRestartOpen] = useState(false)
  const [bingoTracksLive, setBingoTracksLive] = useState<MusicTrack[]>([])
  const [logOpen, setLogOpen] = useState(false)
  const bingoAudioRef = useRef<BingoClipPlayerHandle | null>(null)
  // True while a bingo win has halted auto-progression (cleared when facilitator continues).
  const bingoWinHaltRef = useRef(false)
  // The audio crossfade can begin before scoring has finished. Keep the reveal
  // promise so auto-advance waits for its result instead of dropping the next
  // track transition while bingoBusyRef is still true.
  const bingoRevealPromiseRef = useRef<Promise<boolean> | null>(null)
  // Synchronous lock: bingoAdvancing is React state (updates async), so rapid
  // clicks slip past it and fire concurrent run activations/advances — which
  // create duplicate runs and a stale runId ("Failed to advance bingo run").
  // A ref flips synchronously, truly serialising presses.
  const bingoBusyRef = useRef(false)
  const { notify } = useNotification()
  const queryClient = useQueryClient()

  const playTeamChatSound = useCallback(() => {
    playNewMessageSound()
  }, [])

  const { totalUnread: chatUnread, unreadByTeamId } = useFacilitatorChatInbox(
    messages,
    FACILITATOR_CHAT_SENDER,
    chatOpen,
    chatTeamId,
    chatHistoryReady,
    playTeamChatSound,
  )

  useEffect(() => {
    installAudioUnlock('operational')
  }, [])

  // Log facilitator connection once on mount.
  useEffect(() => {
    if (!eventId || !name) return
    void logEventActivity({
      p_event_id: eventId,
      p_actor_type: 'facilitator',
      p_actor_name: name,
      p_action: 'facilitator_joined',
      p_actor_id: user?.id ?? null,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const controlsLiveRef = useRef(false)

  const stages = useMemo(
    () => (bundle ? parseStages(bundle.event.stages_config) : []),
    [bundle],
  )
  const stage = bundle ? currentStage(stages, bundle.state.current_stage_index) : null
  const state = bundle?.state
  const liveSubmissions = useMemo(() => bundle?.submissions ?? [], [bundle?.submissions])
  const livePurchases = useMemo(() => purchasesQuery.data ?? [], [purchasesQuery.data])
  const bingoStageGameId =
    stage?.type === 'bingo' && stage.gameId ? stage.gameId : undefined
  const bingoGameForTracks = bingoStageGameId
    ? bundle?.games.find((g) => g.id === bingoStageGameId)
    : null

  // P1-B1: pre-warm the bingo run as soon as the stage is selected, well before
  // Start is pressed. Without this, a brand-new bingo stage has no run row yet,
  // so the FIRST Start press has to await activateBingoRun() (a network round
  // trip) before it can call play() — by then the click is no longer
  // synchronous with the user gesture, so mobile browsers silently block
  // autoplay (see handleBingoStartClick's "press Start again" notify, which
  // was papering over exactly this). Activation is idempotent (returns the
  // existing run if there is one) and is pure network/DB work with no audio
  // involved, so doing it early is free. Placed above the loading/error early
  // return below so this hook always runs, keeping hook order stable.
  const bingoPrewarmedKeyRef = useRef<string | null>(null)
  useEffect(() => {
    const eventLive = Boolean(bundle && isEventLive(bundle.event))
    if (!eventLive || !bingoStageGameId || !eventId || !state) return
    const key = `${eventId}:${state.current_stage_index}:${bingoStageGameId}`
    if (bingoPrewarmedKeyRef.current === key) return
    bingoPrewarmedKeyRef.current = key
    // eslint-disable-next-line react-hooks/immutability -- ensureBingoRunReady is defined below (hoisted function declaration), deliberately: this effect must sit above the loading/error early return for stable hook order, but the function's own dependencies (effectiveBingoRun, bingoPlayOrder) are only meaningful once bundle data has loaded, so it's declared after that check. Re-verified live 2026-07-08.
    void ensureBingoRunReady().catch(() => {
      // Transient failure (e.g. a network blip) — allow a retry on the next
      // render; the Start button still falls back to activating lazily either way.
      if (bingoPrewarmedKeyRef.current === key) bingoPrewarmedKeyRef.current = null
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ensureBingoRunReady isn't memoized; adding it here would re-run this effect on every render instead of once per stage key (the ref guard above is the real gate)
  }, [bundle, bingoStageGameId, eventId, state])

  useEffect(() => {
    if (!bingoStageGameId || !bingoGameForTracks) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the track cache when leaving the bingo stage
      setBingoTracksLive([])
      return
    }
    setBingoTracksLive(bingoTracks(bingoGameForTracks))
    let cancelled = false
    void fetchMusicTracksForGame(eventId!, bingoStageGameId)
      .then((fresh) => {
        if (!cancelled && fresh.length > 0) setBingoTracksLive(fresh)
      })
      .catch(() => {
        // keep bundle tracks when fetch fails
      })
    return () => {
      cancelled = true
    }
  }, [bingoStageGameId, bingoGameForTracks, eventId])

  const isQuizStage = stage?.type === 'quiz'

  const bingoRunQuery = useBingoRun(
    eventId,
    stage?.type === 'bingo' ? bundle?.state.current_stage_index : undefined,
  )

  // When another facilitator restarts bingo the DB run gets a new id.
  // Clear the local override so this facilitator syncs to the new run.
  useEffect(() => {
    if (!bingoRunOverride) return
    const dbRun = bingoRunQuery.data
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to another facilitator's bingo restart, a real external (multi-client) event
    if (dbRun && dbRun.id !== bingoRunOverride.id) setBingoRunOverride(null)
  }, [bingoRunQuery.data, bingoRunOverride])

  async function patchState(patch: Parameters<typeof updateState>[0]) {
    if (!controlsLiveRef.current) return false
    try {
      setStateError(null)
      await updateState(patch)
      return true
    } catch (err) {
      setStateError(err instanceof Error ? err.message : 'Update failed')
      return false
    }
  }

  function selectStage(index: number) {
    const next = stages[index]
    if (eventId) {
      void logEventActivity({
        p_event_id: eventId,
        p_actor_type: 'facilitator',
        p_actor_name: name,
        p_action: 'stage_changed',
        p_actor_id: user?.id ?? null,
        p_details: { stage_index: index, stage_name: next?.name ?? null, stage_type: next?.type ?? null },
      })
    }
    const patch: Parameters<typeof updateState>[0] = {
      current_stage_index: index,
    }
    if (next?.type === 'break') {
      patch.break_timer_seconds = breakDurationSeconds(next, null)
      patch.break_timer_running = false
      setBreakHalted(false)
    }
    if (next?.type === 'quiz') {
      patch.quiz_state = 'idle'
      patch.quiz_correct_answer_id = null
      patch.quiz_timer_running = false
    }
    if (next?.type === 'bingo' && next.gameId && eventId) {
      setBingoRunOverride(null)
      void activateBingoRun(eventId, next.gameId, index)
        .then((result) => {
          const row = bingoRunRowFromActivation(eventId, next.gameId!, index, result)
          setBingoRunOverride(row)
          queryClient.setQueryData(queryKeys.bingoRun(eventId, index), row)
        })
        .catch((err) => {
          setStateError(err instanceof Error ? err.message : 'Could not start bingo')
        })
      patch.bingo_state = 'waiting'
      patch.current_question_index = 0
      patch.bingo_revealed_track_ids = []
      void patchWinnerFieldsSafe({
        bingo_winner_team_id: null,
        bingo_announced_winner_ids: [],
      })
    }
    void patchState(patch)
  }

  const timerSyncRef = useRef(
    // eslint-disable-next-line react-hooks/refs -- createThrottledTimerSync is a pure factory (no side effects at construction); useRef only keeps the first render's instance, later calls are thrown away harmlessly
    createThrottledTimerSync((next, stillRunning) => {
      void patchState({ timer_seconds: next, timer_running: stillRunning })
    }),
  )

  const quizTimerSyncRef = useRef(
    // eslint-disable-next-line react-hooks/refs -- see timerSyncRef above
    createThrottledTimerSync((next, stillRunning) => {
      void patchState({ quiz_timer_seconds: next, quiz_timer_running: stillRunning })
    }),
  )

  const breakSyncRef = useRef(
    // eslint-disable-next-line react-hooks/refs -- see timerSyncRef above
    createThrottledTimerSync((next, stillRunning) => {
      void patchState({
        break_timer_seconds: next,
        break_timer_running: stillRunning,
      })
    }),
  )

  const controlsLive = Boolean(bundle && isEventLive(bundle.event))

  const timerDisplay = useLiveTimer(
    state?.timer_seconds ?? 0,
    controlsLive && Boolean(state?.timer_running),
    (next, stillRunning) => timerSyncRef.current(next, stillRunning),
  )

  const quizTimerDisplay = useLiveTimer(
    state ? quizTimerSeconds(state) : 0,
    controlsLive && state ? quizTimerRunning(state) : false,
    (next, stillRunning) => quizTimerSyncRef.current(next, stillRunning),
  )

  const mainEventTimerRanRef = useRef(false)
  useEffect(() => {
    if (isQuizStage) return
    if (state?.timer_running) mainEventTimerRanRef.current = true
  }, [state?.timer_running, isQuizStage])

  useEffect(() => {
    if (!state || isQuizStage) return
    if (!mainEventTimerRanRef.current) return
    if (state.timer_running || state.timer_seconds > 0) return
    if (state.submissions_open === false) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-closing submissions when the main timer runs out, patchState's setState happens after an await
    void patchState({ submissions_open: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- patchState isn't memoized; the state-based guards above already make repeat firing a no-op, so adding it would only cause needless re-runs
  }, [state?.timer_seconds, state?.timer_running, isQuizStage, state])

  const quizAutoRevealKey = useRef('')

  useEffect(() => {
    if (!bundle || !state) {
      quizAutoRevealKey.current = ''
      return
    }
    if (state.quiz_state !== 'active') {
      quizAutoRevealKey.current = ''
      return
    }
    const st = currentStage(parseStages(bundle.event.stages_config), state.current_stage_index)
    if (st?.type !== 'quiz' || !st.gameId) return

    const quizGame = bundle.games.find((g) => g.id === st.gameId)
    const questions = quizGame ? quizQuestions(quizGame) : []
    const question = questions[state.current_question_index]
    if (!quizGame || !question) return

    const mediaType = quizSubmissionMediaType(question.id)
    const answersHere = bundle.submissions.filter(
      (s) =>
        s.game_id === st.gameId &&
        (s.media_type === mediaType || s.media_type === 'quiz'),
    )
    const named = bundle.teams.filter((t) => t.name?.trim())
    const allAnswered =
      named.length > 0 &&
      named.every((t) => answersHere.some((s) => s.team_id === t.id))
    // created_at is the team's FIRST answer, which is exactly when their
    // change window opened, so it is the right clock for the lock.
    const newestAnswerAt = answersHere.reduce(
      (latest, s) => Math.max(latest, Date.parse(s.created_at)),
      0,
    )
    const secondsSinceLastAnswer = newestAnswerAt
      ? (Date.now() - newestAnswerAt) / 1000
      : 0
    if (
      !shouldAutoRevealQuizQuestion({
        quizState: state.quiz_state,
        timerSeconds: quizTimerSeconds(state),
        timerRunning: quizTimerRunning(state),
        allAnswered,
        secondsSinceLastAnswer,
      })
    ) {
      return
    }

    const key = `${state.current_stage_index}-${state.current_question_index}-reveal`
    if (quizAutoRevealKey.current === key) return
    quizAutoRevealKey.current = key

    void (async () => {
      // Reveal server-side: question.correctAnswerId is redacted in the bundle,
      // so the real id must come from the DB (reveal_quiz_answer RPC). This also
      // locks answers (quiz_state='revealed') before scoring.
      try {
        await revealQuizAnswer(bundle.event.id, quizGame.id, question.id)
      } catch (err) {
        quizAutoRevealKey.current = ''
        console.error('[quiz] auto-reveal failed', err)
        return
      }
      try {
        await scoreCurrentQuizQuestion(bundle.event.id, quizGame, question)
      } catch (err) {
        console.error('[quiz] auto-reveal scoring failed', err)
        notify(
          err instanceof Error
            ? err.message
            : 'Quiz scoring failed — verify increment_team_score migration is applied',
        )
      }
    })()
  }, [bundle, state, quizTimerDisplay, updateState, notify])

  const breakSeconds =
    stage?.type === 'break'
      ? breakDurationSeconds(stage, state?.break_timer_seconds)
      : (state?.break_timer_seconds ?? 0)

  const breakDisplay = useLiveTimer(
    breakSeconds,
    controlsLive && Boolean(state?.break_timer_running),
    (next, stillRunning) => breakSyncRef.current(next, stillRunning),
  )

  const pendingSubmissionCountRef = useRef<number>(0)
  // #11: initialise the baseline ONCE. The old `=== 0` guard re-armed every time
  // pending dropped to 0, so the next submission after clearing the queue was
  // swallowed and played no sound (inconsistent cue).
  const submissionSoundReadyRef = useRef(false)

  useEffect(() => {
    const pendingCount = liveSubmissions
      .filter(
        (s) =>
          s.status === 'pending' &&
          isOpenStageSubmissionMediaType(s.media_type),
      )
      .length
    if (!submissionSoundReadyRef.current) {
      submissionSoundReadyRef.current = true
      pendingSubmissionCountRef.current = pendingCount
      return
    }
    if (pendingCount > pendingSubmissionCountRef.current) {
      playNewSubmissionSound()
    }
    pendingSubmissionCountRef.current = pendingCount
  }, [liveSubmissions])

  const purchaseCountRef = useRef(0)
  const purchaseSoundReadyRef = useRef(false)
  useEffect(() => {
    if (!purchasesQuery.isSuccess) return
    if (!purchaseSoundReadyRef.current) {
      purchaseSoundReadyRef.current = true
      purchaseCountRef.current = livePurchases.length
      return
    }
    if (livePurchases.length > purchaseCountRef.current) {
      playNewSubmissionSound()
    }
    purchaseCountRef.current = livePurchases.length
  }, [livePurchases, purchasesQuery.isSuccess])

  // Play the winner celebration on the facilitator device when 'facilitator' is a
  // chosen sound target and the reveal reaches its final stage.
  // NOTE: depend on PRIMITIVES only. winner_sound_targets is a jsonb array whose
  // reference changes on every event_state update; depending on it re-ran this
  // effect each tick and the cleanup stop() cut the announcement to ~1s.
  const facilitatorWinnerAudioRef = useRef(false)
  const facilitatorWinnerStopRef = useRef<(() => void) | null>(null)
  const winnerRevealStage = state?.winner_reveal_stage ?? 0
  const facilitatorWinnerEnabled = winnerSoundEnabled(
    state?.winner_sound_targets,
    'facilitator',
  )
  useEffect(() => {
    if (winnerRevealStage < 2 || !facilitatorWinnerEnabled) {
      facilitatorWinnerAudioRef.current = false
      // Only stop when the reveal is actually reset/cleared, not on every tick.
      facilitatorWinnerStopRef.current?.()
      facilitatorWinnerStopRef.current = null
      return
    }
    if (facilitatorWinnerAudioRef.current) return
    facilitatorWinnerAudioRef.current = true
    facilitatorWinnerStopRef.current = playEventWinnerSequence(
      `${eventId}:facilitator-winner:2`,
    )
  }, [winnerRevealStage, facilitatorWinnerEnabled, eventId])

  // Bingo line-win jingle plays on the facilitator tab only (removed from player
  // phones + display in BingoWinCelebration). Key off the PRIMITIVE winner id, not
  // bingo_state (which flips to 'revealed' every round). Fires once per distinct
  // winner and re-arms when the winner field resets to null.
  const lastBingoWinnerRef = useRef<string | null>(null)
  const bingoWinnerId = state?.bingo_winner_team_id ?? null
  useEffect(() => {
    if (!bingoWinnerId) {
      lastBingoWinnerRef.current = null
      return
    }
    if (lastBingoWinnerRef.current === bingoWinnerId) return
    lastBingoWinnerRef.current = bingoWinnerId
    playBingoWinJingle()
  }, [bingoWinnerId])

  if (loading || !bundle || !state) {
    return (
      <FacilitatorPanelShell title="Facilitator" titleCentered>
        <p className="text-muted-foreground text-center text-sm">
          {loading ? 'Loading…' : (error ?? 'Event not found')}
        </p>
      </FacilitatorPanelShell>
    )
  }

  const { event, teams: eventTeams, games, submissions } = bundle
  // eslint-disable-next-line react-hooks/refs -- standard "keep ref fresh" idiom
  controlsLiveRef.current = isEventLive(event)
  const teams = (
    isEventDemoStatus(event.status) ? demoTeamSlots(eventTeams) : eventTeams
  ).filter((team): team is Tables<'teams'> => Boolean(team?.id))
  const liveState = state
  // Internal iframe preview — always the direct /display/:eventId URL.
  const displayUrl = eventId ? getEventLinks(eventId).display : ''

  // Quest (open-stage) games drive the per-team progress fill + "View Quests" modal.
  const questGames = questGamesForEvent(stages, games)

  // Where the winner fanfare plays. Unset means the default rather than silence,
  // which is what the routing modal used to settle on its way out.
  const winnerSoundTargets =
    parseWinnerSoundTargets(liveState.winner_sound_targets) ?? DEFAULT_WINNER_SOUND_TARGETS

  function setWinnerSoundTarget(surface: WinnerSoundSurface, on: boolean) {
    // Toggling 'facilitator' on IS the user gesture that lets this device play
    // audio later, so prime it here rather than at reveal time.
    if (surface === 'facilitator' && on) unlockAudioFromUserGesture('full')
    const next = on
      ? [...winnerSoundTargets, surface]
      : winnerSoundTargets.filter((s) => s !== surface)
    void patchState({ winner_sound_targets: next })
  }

  function handleRevealWinnerClick() {
    if (liveState.winner_reveal_stage === 0 && eventId) {
      void logEventActivity({
        p_event_id: eventId,
        p_actor_type: 'facilitator',
        p_actor_name: name,
        p_action: 'winner_revealed',
        p_actor_id: user?.id ?? null,
      })
    }
    void patchState({
      winner_reveal_stage: Math.min(2, liveState.winner_reveal_stage + 1),
    })
  }

  const filteredSubs = submissions.filter((s) => {
    if (subTab === 'all') return true
    return s.status === subTab
  })

  async function clearAnnouncement() {
    if (annClearRef.current) {
      window.clearTimeout(annClearRef.current)
      annClearRef.current = undefined
    }
    await patchState({ announcement: null, announcement_target: null })
  }

  function sendAnnouncement(target: 'display' | 'participants' | 'both') {
    if (annClearRef.current) window.clearTimeout(annClearRef.current)
    playAnnouncementSound()
    void patchState({
      announcement,
      announcement_target: target,
      updated_at: new Date().toISOString(),
    })
    annClearRef.current = window.setTimeout(() => {
      void clearAnnouncement()
    }, ANNOUNCEMENT_MS)
  }

  async function approveSubmission(sub: Tables<'submissions'>, points: number) {
    if (!controlsLiveRef.current) return
    const game = games.find((g) => g.id === sub.game_id)
    if (!game) return
    if (game.points_type === 'range') {
      const min = game.points_min ?? 0
      const max = game.points_max ?? 0
      if (points < min || points > max) {
        notify(`Points must be ${min}–${max}`)
        return
      }
    }
    const { data, error } = await supabase
      .from('submissions')
      .update({ status: 'approved', points_awarded: points })
      .eq('id', sub.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle()
    if (error) {
      notify(error.message || 'Could not approve submission')
      return
    }
    if (!data) {
      notify('Submission already processed')
      return
    }
    if (eventId) {
      await publishSubmissionChange(eventId, 'UPDATE', data)
    }
    if (points > 0) {
      await incrementTeamScore(data.team_id, points, eventId)
    }
    if (eventId) {
      const team = bundle?.teams.find((t) => t.id === data.team_id)
      void logEventActivity({
        p_event_id: eventId,
        p_actor_type: 'facilitator',
        p_actor_name: name,
        p_action: 'submission_approved',
        p_actor_id: user?.id ?? null,
        p_details: { points, game_name: game.name, team_name: team?.name ?? null },
      })
    }
    notify(`Approved +${points} pts`)
  }

  async function rejectSubmission(id: string) {
    if (!controlsLiveRef.current) return
    const { data, error } = await supabase
      .from('submissions')
      .update({ status: 'rejected' })
      .eq('id', id)
      .select('*')
      .maybeSingle()
    if (error) {
      notify(error.message || 'Could not reject submission')
      return
    }
    if (data && eventId) {
      await publishSubmissionChange(eventId, 'UPDATE', data)
      const game = games.find((g) => g.id === data.game_id)
      const team = bundle?.teams.find((t) => t.id === data.team_id)
      void logEventActivity({
        p_event_id: eventId,
        p_actor_type: 'facilitator',
        p_actor_name: name,
        p_action: 'submission_rejected',
        p_actor_id: user?.id ?? null,
        p_details: { game_name: game?.name ?? null, team_name: team?.name ?? null },
      })
    }
    notify('Submission rejected')
  }

  async function saveClaim() {
    if (!controlsLiveRef.current) return
    if (!claimSlot) return
    if (
      isEventDemoStatus(event.status) &&
      !claimSlot.name?.trim() &&
      countClaimedTeams(eventTeams) >= DEMO_MAX_TEAMS
    ) {
      notify(`Demo events allow up to ${DEMO_MAX_TEAMS} teams.`)
      return
    }
    setUploading(true)
    try {
      let photoUrl: string | null = claimSlot.photo_url
      if (claimPhoto && eventId) {
        photoUrl = await uploadAsset(
          'game-assets',
          `${eventId}/teams/${claimSlot.id}/${Date.now()}.jpg`,
          claimPhoto,
          { mediaKind: 'photo' },
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
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save the team')
    } finally {
      setUploading(false)
    }
  }

  async function resetTeamSlot(team: Tables<'teams'>) {
    setResettingTeam(true)
    try {
      const { error: delErr } = await supabase
        .from('submissions')
        .delete()
        .eq('team_id', team.id)
      if (delErr) throw delErr

      await updateTeam(team.id, {
        name: null,
        photo_url: null,
        score: 0,
        status: 'idle',
      })
      // Broadcast a full reload so display and player panels see the cleared
      // submissions immediately (submission deletes are not individually patched).
      if (eventId) await publishLiveBundleReload(eventId)
      notify(`Team slot ${team.slot_number} cleared — available for a new team`)
      setResetConfirmTeam(null)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not reset team slot')
    } finally {
      setResettingTeam(false)
    }
  }

  const quizGame = stage?.type === 'quiz' && stage.gameId
    ? games.find((g) => g.id === stage.gameId)
    : null
  const questions = quizGame ? quizQuestions(quizGame) : []
  const question = questions[liveState.current_question_index]
  const quizConfig = (quizGame?.config ?? {}) as GameConfig
  const quizBaseSeconds = quizConfig.timer_seconds ?? 20
  // A question carrying media runs longer; see quizQuestionSeconds.
  const questionSeconds = quizQuestionSeconds(quizBaseSeconds, question)
  const namedTeams = teams.filter((t) => t.name?.trim())
  const currentQuizMediaType = question
    ? quizSubmissionMediaType(question.id)
    : null
  const quizAnsweredTeamIds = new Set(
    submissions
      .filter(
        (s) =>
          s.game_id === stage?.gameId &&
          (s.media_type === currentQuizMediaType || s.media_type === 'quiz'),
      )
      .map((s) => s.team_id),
  )

  function startQuizQuestion(index: number) {
    quizAutoRevealKey.current = ''
    // The question being started, not the one on screen now.
    const sec = quizQuestionSeconds(quizBaseSeconds, questions[index])
    void patchState({
      current_question_index: index,
      quiz_state: 'active',
      quiz_correct_answer_id: null,
      quiz_timer_seconds: sec,
      quiz_timer_running: true,
    })
  }

  async function revealQuizAnswers() {
    if (!quizGame || !question || !eventId) return
    // Reveal server-side (real correctAnswerId comes from the DB, not the
    // redacted bundle), then score.
    try {
      await revealQuizAnswer(eventId, quizGame.id, question.id)
    } catch (err) {
      console.error('[quiz] reveal failed', err)
      notify(err instanceof Error ? err.message : 'Quiz reveal failed')
      return
    }
    try {
      await scoreCurrentQuizQuestion(eventId, quizGame, question)
    } catch (err) {
      console.error('[quiz] reveal scoring failed', err)
      notify(
        err instanceof Error
          ? err.message
          : 'Quiz scoring failed — verify increment_team_score migration is applied',
      )
    }
    quizAutoRevealKey.current = `${liveState.current_stage_index}-${liveState.current_question_index}-reveal`
  }

  async function skipQuizQuestion() {
    quizAutoRevealKey.current = ''
    const idx = liveState.current_question_index
    const next = idx + 1
    if (next >= questions.length) {
      await patchState({ quiz_state: 'results', quiz_timer_running: false })
      return
    }
    if (quizConfig.rounds_enabled && quizGame && isLastQuestionInRound(quizGame, idx)) {
      await patchState({
        current_question_index: next,
        quiz_state: 'round_intro',
        quiz_timer_running: false,
      })
      return
    }
    startQuizQuestion(next)
  }

  async function goToNextQuestion() {
    if (liveState.quiz_state === 'active') {
      await revealQuizAnswers()
      return
    }
    if (liveState.quiz_state !== 'revealed') return

    quizAutoRevealKey.current = ''
    const idx = liveState.current_question_index
    const next = idx + 1
    if (next >= questions.length) {
      await patchState({ quiz_state: 'results', quiz_timer_running: false })
      return
    }
    if (
      quizConfig.rounds_enabled &&
      quizGame &&
      isLastQuestionInRound(quizGame, idx)
    ) {
      await patchState({
        current_question_index: next,
        quiz_state: 'round_intro',
        quiz_timer_running: false,
      })
      return
    }
    startQuizQuestion(next)
  }

  async function restartQuiz() {
    if (!stage?.gameId || !eventId) return
    // Reverse approved points + delete the game's submissions in one
    // transaction (P1-3b, quiz twin of the bingo restart RPC) — replaces the
    // client-memory sum + row-by-row delete that could go stale if an answer
    // landed mid-restart.
    const { error } = await supabase.rpc('restart_quiz_scores', {
      p_event_id: eventId,
      p_game_id: stage.gameId,
    })
    if (error) {
      notify(error.message)
      return
    }
    await publishLiveBundleReload(eventId)
    await patchState({
      current_question_index: 0,
      quiz_state: 'idle',
      quiz_timer_seconds: quizQuestionSeconds(quizBaseSeconds, questions[0]),
      quiz_timer_running: false,
    })
    notify('Quiz reset')
  }

  async function finishQuiz() {
    quizAutoRevealKey.current = ''
    await patchState({ quiz_state: 'ended', quiz_timer_running: false })
    notify('Quiz finished for all screens')
  }

  /* eslint-disable react-hooks/refs -- action closures here are deferred to a later onClick, not invoked during this render; the functions they call (startQuizQuestion/patchState/goToNextQuestion) happen to read refs, but only once actually clicked */
  function quizPrimaryButton(): { label: string; action: () => void } | null {
    if (liveState.quiz_state === 'results') return null
    if (liveState.quiz_state === 'round_intro') {
      const n = liveState.current_question_index + 1
      return {
        label: n === 1 ? 'Start Question 1' : `Start Question ${n}`,
        action: () => startQuizQuestion(liveState.current_question_index),
      }
    }
    if (liveState.quiz_state === 'idle' || liveState.quiz_state === 'waiting') {
      const n = liveState.current_question_index + 1
      return {
        label: n === 1 ? 'Start Question 1' : `Start Question ${n}`,
        action: () => startQuizQuestion(liveState.current_question_index),
      }
    }
    if (liveState.quiz_state === 'active' || liveState.quiz_state === 'revealed') {
      const isLast = liveState.current_question_index >= questions.length - 1
      if (isLast && liveState.quiz_state === 'revealed') {
        return {
          label: 'Reveal Quiz Results',
          action: () => void patchState({ quiz_state: 'results', quiz_timer_running: false }),
        }
      }
      if (
        liveState.quiz_state === 'revealed' &&
        quizConfig.rounds_enabled &&
        quizGame &&
        isLastQuestionInRound(quizGame, liveState.current_question_index)
      ) {
        const nextRound = quizRoundForQuestionIndex(
          quizGame,
          liveState.current_question_index + 1,
        )
        return {
          label: nextRound ? `Start ${nextRound.name}` : 'Start next round',
          action: () => void goToNextQuestion(),
        }
      }
      return {
        label: 'Next Question',
        action: () => void goToNextQuestion(),
      }
    }
    return null
  }
  /* eslint-enable react-hooks/refs */

  const quizPrimary = quizPrimaryButton()

  const bingoGame = stage?.type === 'bingo' && stage.gameId
    ? games.find((g) => g.id === stage.gameId)
    : null
  const tracks = bingoTracksLive.filter((t): t is MusicTrack => Boolean(t?.id))
  const effectiveBingoRun = bingoRunOverride ?? bingoRunQuery.data
  const bingoPlayOrder = normalizeBingoPlayOrder(effectiveBingoRun?.playOrder)
  const bingoPlayIndex = liveState.current_question_index
  const playTrackId = bingoPlayOrder[bingoPlayIndex]
  const track = playTrackId
    ? (tracks.find((t) => t.id === playTrackId) ?? null)
    : (tracks[bingoPlayIndex] ?? null)
  const trackPlaybackUrl = track ? bingoTrackPlaybackUrl(track) : ''
  const nextTrackForCrossfade = (() => {
    const nextId = bingoPlayOrder[bingoPlayIndex + 1]
    if (!nextId) return undefined
    const nextTrack = tracks.find((t) => t.id === nextId) ?? null
    return nextTrack ? bingoTrackPlaybackUrl(nextTrack) : undefined
  })()
  const showBingoPlayer = stage?.type === 'bingo'
  const bingoGameId = stage?.type === 'bingo' ? stage.gameId : undefined
  const bingoConfig = bingoGame ? parseBingoGameConfig(bingoGame.config) : {}
  /** Teams whose mark is in for the song currently playing. */
  const bingoMarkedTeamIds = (() => {
    if (!bingoGameId) return new Set<string>()
    const ids = new Set(
      submissions
        .filter(
          (s) =>
            s.media_type === 'bingo' &&
            s.game_id === bingoGameId &&
            s.status === 'pending' &&
            s.media_url != null &&
            s.media_url !== 'claim',
        )
        .map((s) => s.team_id),
    )
    return ids
  })()

  async function ensureBingoRunReady(): Promise<BingoRunRow | null> {
    if (!eventId || !stage?.gameId) return null
    if (bingoPlayOrder.length > 0 && effectiveBingoRun) return effectiveBingoRun
    const result = await activateBingoRun(
      eventId,
      stage.gameId,
      liveState.current_stage_index,
    )
    const row = bingoRunRowFromActivation(
      eventId,
      stage.gameId,
      liveState.current_stage_index,
      result,
    )
    flushSync(() => setBingoRunOverride(row))
    queryClient.setQueryData(
      queryKeys.bingoRun(eventId, liveState.current_stage_index),
      row,
    )
    return row
  }

  function resolveTrackForIndex(
    run: BingoRunRow | null | undefined,
    index: number,
    trackList: MusicTrack[] = tracks,
  ) {
    if (!trackList.length) return null
    const id = run?.playOrder[index]
    if (!id) return null
    return trackList.find((t) => t.id === id) ?? null
  }

  function resolvePlaybackUrlForIndex(
    run: BingoRunRow | null | undefined,
    index: number,
    trackList: MusicTrack[] = tracks,
  ): string {
    const t = resolveTrackForIndex(run, index, trackList)
    if (!t) return ''
    return bingoTrackPlaybackUrl(t)
  }

  function handleBingoStartClick() {
    if (bingoBusyRef.current) return
    bingoBusyRef.current = true
    bingoWinHaltRef.current = false
    // Prime celebration audio within this gesture so the facilitator-only bingo
    // win jingle can play later this round (incl. on iOS Safari and on auto-advance
    // wins, which have no gesture of their own).
    unlockAudioFromUserGesture('full')

    const player = bingoAudioRef.current
    if (!player?.isMounted()) {
      notify('Audio player is not mounted — switch to bingo stage and try again')
      bingoBusyRef.current = false
      return
    }

    void player.primeAudioContext()

    const syncUrl = trackPlaybackUrl || resolvePlaybackUrlForIndex(effectiveBingoRun, bingoPlayIndex)
    if (syncUrl) {
      setBingoAdvancing(true)
      void player.playFromUserGesture(syncUrl).then((played) => {
        if (played) {
          void patchState({ bingo_state: 'playing', bingo_revealed_track_ids: [] })
          void patchWinnerFieldsSafe({ bingo_winner_team_id: null })
        } else {
          notify('Could not start playback — check console for details')
        }
      }).finally(() => {
        setBingoAdvancing(false)
        bingoBusyRef.current = false
      })
      return
    }

    setBingoAdvancing(true)
    void (async () => {
      try {
        const run = await ensureBingoRunReady()
        let trackList = tracks
        let url = resolvePlaybackUrlForIndex(run, bingoPlayIndex, trackList)
        if (!url && stage?.gameId) {
          try {
            const fresh = await fetchMusicTracksForGame(eventId!, stage.gameId)
            if (fresh.length > 0) {
              trackList = fresh
              setBingoTracksLive(fresh)
              url = resolvePlaybackUrlForIndex(run, bingoPlayIndex, fresh)
            }
          } catch {
            // fall through to error below
          }
        }
        if (!url) {
          notify('No playable track URL — ensure MP3 clips are uploaded for this bingo game')
          return
        }
        const played = await player.playFromUserGesture(url)
        if (played) {
          await patchState({ bingo_state: 'playing', bingo_revealed_track_ids: [] })
          void patchWinnerFieldsSafe({ bingo_winner_team_id: null })
        } else notify('Run loaded — press Start again to play')
      } finally {
        setBingoAdvancing(false)
        bingoBusyRef.current = false
      }
    })()
  }

  // Winner-announcement columns are non-critical. A failure here (e.g. migration
  // not yet applied) must never revert or short-circuit scoring/reveal/advance.
  async function patchWinnerFieldsSafe(patch: TablesUpdate<'event_state'>) {
    try {
      await patchState(patch)
    } catch (err) {
      console.warn('[bingo] winner-field patch failed (non-fatal):', err)
    }
  }

  async function lockAndRevealBingoRound(): Promise<boolean> {
    if (!stage?.gameId || !eventId) return false
    if (liveState.bingo_state === 'revealed') return true
    const run = await ensureBingoRunReady()
    if (!run?.id) return false

    // Reconcile against the authoritative DB run (same source the participants read)
    // so a stale client-side run override can never make scoring read the wrong run.
    let scoringRunId = run.id
    let scoringPlayOrder = normalizeBingoPlayOrder(run.playOrder)
    const { data: dbRun } = await supabase
      .from('bingo_runs')
      .select('id, play_order')
      .eq('event_id', eventId)
      .eq('stage_index', liveState.current_stage_index)
      .maybeSingle()
    if (dbRun?.id) {
      scoringRunId = dbRun.id
      scoringPlayOrder = normalizeBingoPlayOrder(dbRun.play_order ?? run.playOrder)
    }

    const currentTrackId = scoringPlayOrder[bingoPlayIndex]
    if (!currentTrackId) return false

    // Close the selection window before reading pending marks. Previously the
    // phone stayed selectable while scoring had already taken its snapshot, so
    // a legitimate late tap could look accepted but miss the round.
    const prev = parseRevealedTrackIds(liveState.bingo_revealed_track_ids)
    const revealed = prev.includes(currentTrackId) ? prev : [...prev, currentTrackId]
    const locked = await patchState({
      bingo_state: 'revealed',
      bingo_revealed_track_ids: revealed,
    })
    if (!locked) throw new Error('Could not lock bingo selections')

    const result = await scoreBingoRound({
      eventId,
      gameId: stage.gameId,
      runId: scoringRunId,
      trackId: currentTrackId,
      gameConfig: bingoConfig,
    })

    // Winner announcement reads the scoring result afterward, best-effort only.
    const announced = parseAnnouncedWinnerIds(liveState.bingo_announced_winner_ids)
    const newWinnerId = result.winningTeamIds.find((id) => !announced.includes(id))
    if (newWinnerId) {
      // A win halts auto-progression and pauses audio so the celebration can play.
      // This works even if the winner columns (migration 017) are missing.
      bingoWinHaltRef.current = true
      try {
        bingoAudioRef.current?.pause()
      } catch {
        // pausing is best-effort
      }

      const winnerName = teams.find((t) => t.id === newWinnerId)?.name
      const writePatch = {
        bingo_winner_team_id: newWinnerId,
        bingo_announced_winner_ids: [...announced, newWinnerId],
      }
      try {
        const winnerWritten = await patchState(writePatch)
        if (!winnerWritten) throw new Error('Winner announcement state update failed')
        if (winnerName) notify(`🏆 Bingo! ${winnerName} won — game paused`)
      } catch (err) {
        console.error('Failed to write bingo winner fields (non-fatal)', err)
        if (winnerName) notify(`🏆 Bingo! ${winnerName} won — game paused`)
      }
    }
    return true
  }

  async function handleBingoNextClick(opts?: { skipCrossfade?: boolean; skipScore?: boolean }) {
    if (bingoBusyRef.current) return
    bingoBusyRef.current = true
    try {
    if (!stage?.gameId || !eventId) return
    const player = bingoAudioRef.current
    if (!player?.isMounted()) {
      notify('Audio player is not mounted')
      return
    }
    void player.primeAudioContext()
    const run = await ensureBingoRunReady()
    if (!run || normalizeBingoPlayOrder(run.playOrder).length === 0) {
      notify('Bingo run is not ready')
      return
    }
    setBingoAdvancing(true)
    try {
      // If a win previously halted the game, this press is the facilitator
      // choosing to continue: clear the halt + winner and proceed normally.
      const continuingPastWin = bingoWinHaltRef.current
      if (continuingPastWin) {
        bingoWinHaltRef.current = false
        void patchWinnerFieldsSafe({ bingo_winner_team_id: null })
      }

      if (!opts?.skipScore && liveState.bingo_state !== 'revealed') {
        await lockAndRevealBingoRound()
        if (bingoWinHaltRef.current && !continuingPastWin) {
          // A new winner was just detected on this press — halt and show the
          // celebration instead of advancing. Press again to continue.
          return
        }
      }

      const runOrder = normalizeBingoPlayOrder(run.playOrder)
      const atLastTrack = bingoPlayIndex >= runOrder.length - 1
      if (atLastTrack) {
        await patchState({ bingo_state: 'ended' })
        return
      }

      const nextTrack = resolveTrackForIndex(run, bingoPlayIndex + 1)
      const nextUrl = nextTrack ? bingoTrackPlaybackUrl(nextTrack) : ''

      if (!opts?.skipCrossfade && nextUrl) {
        await player.crossfadeTo(nextUrl, 4000)
      }

      const runId = run.id
      const nextIndex = await advanceBingoTrack({
        eventId,
        gameId: stage.gameId,
        runId,
        playOrder: runOrder,
        currentIndex: bingoPlayIndex,
        scoreCurrent: false,
      })
      await patchState({
        current_question_index: nextIndex,
        bingo_state: 'playing',
      })
      void patchWinnerFieldsSafe({ bingo_winner_team_id: null })
      if (!nextUrl) setAudioPlayNonce((n) => n + 1)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not score or advance the bingo round')
    } finally {
      setBingoAdvancing(false)
    }
    } finally {
      bingoBusyRef.current = false
    }
  }

  async function handleBingoLockAndReveal() {
    unlockAudioFromUserGesture('full')
    if (bingoRevealPromiseRef.current) return
    if (bingoBusyRef.current) return
    if (liveState.bingo_state !== 'playing') return
    bingoBusyRef.current = true
    setBingoAdvancing(true)
    const revealPromise = lockAndRevealBingoRound()
      .catch((err) => {
        notify(err instanceof Error ? err.message : 'Could not score or reveal the bingo round')
        return false
      })
      .finally(() => {
        setBingoAdvancing(false)
        bingoBusyRef.current = false
        bingoRevealPromiseRef.current = null
      })
    bingoRevealPromiseRef.current = revealPromise
    await revealPromise
  }

  async function autoAdvanceBingoSong() {
    // Lock/reveal starts one second before the crossfade. If it is still scoring
    // when the next audio deck starts, wait for that exact job. The old guard
    // returned here and permanently lost the only auto-advance callback.
    const revealPromise = bingoRevealPromiseRef.current
    if (revealPromise && !(await revealPromise)) return
    if (bingoWinHaltRef.current) return
    if (liveState.bingo_state !== 'revealed' && liveState.bingo_state !== 'playing') return
    // Score the finishing song so a completed card is detected and celebrated the
    // moment the song ends, without waiting for a manual Continue press. Scoring
    // only runs when not already 'revealed' (see handleBingoNextClick), and
    // bingoBusyRef guards against overlap with a manual reveal/advance.
    await handleBingoNextClick({ skipCrossfade: true, skipScore: true })
  }

  return (
    <>
      <FacilitatorPanelShell title="">
      {/* One slim utility row instead of a title, a centred status and a centred
          button pair. The event's name is already on the display preview a few
          pixels below, and the console needs the height. */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* StatusIndicator prints the label itself; the console used to print
              it a second time alongside, reading "Ready Ready". */}
          <NeoStatusBadge tone={event.status as NeoStatusBadgeTone}>
            {event.status === 'demo' ? 'Demo' : event.status}
          </NeoStatusBadge>
          {others.length > 0 ? (
            <span className="text-muted-foreground truncate text-xs">
              Also viewing: {others.map((o) => o.name).join(', ')}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {install.method ? (
            <FacilitatorButton size="sm" variant="outline" onClick={install.onClick}>
              <Download className="size-4" />
              Install
            </FacilitatorButton>
          ) : null}
          <FacilitatorButton size="sm" variant="outline" onClick={() => setLogOpen(true)}>
            <ScrollText className="size-4" />
            View Log
          </FacilitatorButton>
          <FacilitatorButton
            size="sm"
            variant="outline"
            onClick={() => {
              const next = !muted
              setSoundsMuted(next)
              setMuted(next)
            }}
            aria-pressed={muted}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            {muted ? 'Unmute' : 'Mute'}
          </FacilitatorButton>
        </div>
      </div>

      {!controlsLive ? (
        <p
          className="border-border/80 bg-muted/40 text-muted-foreground mb-4 rounded-lg border px-4 py-3 text-center text-sm"
          role="status"
        >
          {event.status === 'archived'
            ? 'This event has ended. Controls are disabled.'
            : 'This event is not live yet. Controls are disabled until the event is active.'}
        </p>
      ) : null}

      {/* Top row on its own so the display preview and the control card stretch
          to a shared height. The preview's height comes from its 16:9 box and
          the column width, so matching it any other way only holds at one
          window size. */}
      <div className="mb-6 grid items-stretch gap-6 lg:grid-cols-2">
        <Card className="neo-card border-border/80 gap-0 overflow-hidden border bg-card p-0 shadow-sm">
          <DisplayPreviewFrame displayUrl={displayUrl} />
        </Card>
        <fieldset disabled={!controlsLive} className="min-w-0 border-0 p-0">
          <Card className="neo-card border-border/80 grid h-full content-between gap-4 bg-card p-4 shadow-sm sm:grid-cols-2">
            <div className="flex flex-col items-center gap-2">
              {timerEdit != null ? (
                // UI-1: type minutes ("45") or mm:ss, then Save.
                <div className="flex flex-wrap items-center gap-2">
                  <NeoInput
                    value={timerEdit}
                    onChange={(e) => setTimerEdit(e.target.value)}
                    autoFocus
                    placeholder="minutes or mm:ss"
                    className="bg-background max-w-[9rem] font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setTimerEdit(null)
                      if (e.key === 'Enter') {
                        const secs = parseTimerInput(timerEdit)
                        if (secs == null) {
                          notify('Enter minutes (e.g. 45) or mm:ss')
                          return
                        }
                        void patchState({ timer_seconds: secs })
                        setTimerEdit(null)
                      }
                    }}
                  />
                  <FacilitatorButton
                    size="sm"
                    onClick={() => {
                      const secs = parseTimerInput(timerEdit)
                      if (secs == null) {
                        notify('Enter minutes (e.g. 45) or mm:ss')
                        return
                      }
                      void patchState({ timer_seconds: secs })
                      setTimerEdit(null)
                    }}
                  >
                    Save
                  </FacilitatorButton>
                  <FacilitatorButton
                    size="sm"
                    variant="outline"
                    onClick={() => setTimerEdit(null)}
                  >
                    Cancel
                  </FacilitatorButton>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={state.timer_running}
                  title={state.timer_running ? 'Pause to edit' : 'Click to set the countdown'}
                  className="block text-center font-mono text-3xl tabular-nums disabled:cursor-default"
                  onClick={() => setTimerEdit(String(Math.round(state.timer_seconds / 60)))}
                >
                  {formatTimer(timerDisplay)}
                </button>
              )}
              {/* One row: [-15] [play/pause icon] [+15]. */}
              <div className="flex items-center gap-2">
                <FacilitatorButton
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void patchState({
                      timer_seconds: Math.max(0, state.timer_seconds - 900),
                    })
                  }
                >
                  <Minus className="size-4" /> 15
                </FacilitatorButton>
                <FacilitatorButton
                  size="sm"
                  title={state.timer_running ? 'Pause' : 'Start'}
                  aria-label={state.timer_running ? 'Pause the countdown' : 'Start the countdown'}
                  onClick={() =>
                    void patchState({ timer_running: !state.timer_running })
                  }
                >
                  {state.timer_running ? <Pause className="size-4" /> : <Play className="size-4" />}
                </FacilitatorButton>
                <FacilitatorButton
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void patchState({ timer_seconds: state.timer_seconds + 900 })
                  }
                >
                  <Plus className="size-4" /> 15
                </FacilitatorButton>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-2">
              <FacilitatorButtonLarge className="w-full" onClick={handleRevealWinnerClick}>
                Reveal Winner ({state.winner_reveal_stage}/2)
              </FacilitatorButtonLarge>
              {/* Where the fanfare plays. These were behind a modal you had to
                  clear before the first reveal; now the answer is already on
                  screen and set before anyone presses anything. */}
              <div className="grid grid-cols-3 gap-1 pt-0.5">
                {WINNER_SOUND_SURFACES.map((surface) => (
                  <FacilitatorToggle
                    key={surface.id}
                    stacked
                    icon="sound"
                    label={surface.label}
                    checked={winnerSoundTargets.includes(surface.id)}
                    onChange={(next) => setWinnerSoundTarget(surface.id, next)}
                  />
                ))}
              </div>
              {state.winner_reveal_stage > 0 ? (
                <FacilitatorButton
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => void patchState({ winner_reveal_stage: 0 })}
                >
                  <RotateCcw className="size-4" />
                  Reset winner
                </FacilitatorButton>
              ) : null}
            </div>
            {/* UI-2: display toggles side by side, centred at the card bottom. */}
            <div className="border-border/60 space-y-3 border-t pt-3 sm:col-span-2">
              <div className="grid grid-cols-3 gap-2">
                <FacilitatorToggle
                  stacked
                  label="Timer on display"
                  checked={state.show_timer_on_display}
                  onChange={(next) => void patchState({ show_timer_on_display: next })}
                />
                <FacilitatorToggle
                  stacked
                  label="Scores on display"
                  checked={state.show_scores}
                  onChange={(next) => void patchState({ show_scores: next })}
                />
                <FacilitatorToggle
                  stacked
                  label="Hide points for teams"
                  checked={state.hide_team_points}
                  onChange={(next) => void patchState({ hide_team_points: next })}
                />
              </div>
              {/* Stages sit with the other things that change what the room is
                  looking at, rather than in a card of their own. */}
              <div className="border-border/60 mt-1 space-y-2 border-t pt-3">
                <SegmentedPill
                  aria-label="Stage"
                  size="sm"
                  options={stages
                    .map((s, i) =>
                      s?.id
                        ? {
                            value: String(i),
                            // The organiser named these; "Stage 3" tells the
                            // person running the room nothing about what is
                            // behind the tab.
                            label: s.name?.trim() || `Stage ${i + 1}`,
                          }
                        : null,
                    )
                    .filter((o): o is { value: string; label: string } => o !== null)}
                  value={String(state.current_stage_index)}
                  onChange={(next) => selectStage(Number(next))}
                />
              </div>
            </div>
          </Card>
        </fieldset>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <fieldset disabled={!controlsLive} className="min-w-0 space-y-4 border-0 p-0">
          {/* The message is the point, so it gets the full width and the send
              targets sit under it as one row of buttons rather than a label,
              a squeezed field and three loose outlines. */}
          <Card className="neo-card border-border/80 space-y-2.5 bg-card p-4 shadow-sm">
            <NeoInput
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              aria-label="Announcement"
              placeholder="Type your announcement here… clears after 1 minute"
              className="bg-background w-full"
            />
            {/* Same pill track as the stage selector, though each of these
                sends rather than selects, so none of them stays lit. */}
            <div className="bg-nm-slate-800 dark:bg-nm-slate-200 grid grid-cols-3 gap-1 rounded-full p-1">
              {(['display', 'participants', 'both'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="hover:bg-nm-yellow rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:text-black disabled:pointer-events-none dark:text-white"
                  onClick={() => sendAnnouncement(t)}
                >
                  {t === 'display' ? 'Display' : t === 'participants' ? 'Participants' : 'Both'}
                </button>
              ))}
            </div>
            {state.announcement ? (
              <div className="border-border/80 flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground line-clamp-2 flex-1">
                  Live: {state.announcement}
                </span>
                <NeoButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void clearAnnouncement()}
                >
                  <X className="size-4" />
                  Clear
                </NeoButton>
              </div>
            ) : null}
          </Card>

          <Card className="neo-card border-border/80 bg-card p-4 shadow-sm">
            <ul className="space-y-2">
              {teams.map((team) => {
                const claimed = Boolean(team.name?.trim())
                const prog =
                  questGames.length > 0 && claimed
                    ? teamQuestProgress(team.id, questGames, submissions)
                    : null
                return (
                <li
                  key={team.id}
                  className="border-border/80 relative flex flex-wrap items-center gap-3 overflow-hidden rounded-lg border p-2"
                  style={
                    prog
                      ? {
                          background: `linear-gradient(to right, rgba(34,197,94,0.22) ${prog.percent}%, transparent ${prog.percent}%)`,
                        }
                      : undefined
                  }
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
                    title={`Reset slot ${team.slot_number}`}
                    disabled={!controlsLive || !team.name?.trim()}
                    onClick={() => setResetConfirmTeam(team)}
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
                    title={`Chat with ${team.name?.trim() || `slot ${team.slot_number}`}`}
                    onClick={() => {
                      setChatTeamId(team.id)
                      setChatOpen(true)
                    }}
                  >
                    <MessageCircle className="size-4" />
                  </Button>
                  {/* Still a control, wearing the status badge the events list
                      uses so a team's state reads the same way an event's does. */}
                  <select
                    className={`neo-status-badge neo-status-badge--${TEAM_STATUS_TONE[team.status] ?? 'draft'} cursor-pointer appearance-none rounded-full border-0 px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase`}
                    value={team.status}
                    onChange={(e) =>
                      void updateTeam(team.id, { status: e.target.value })
                    }
                    aria-label="Team status"
                  >
                    <option value="idle">Idle</option>
                    <option value="active">Active</option>
                    <option value="stopped">Stopped</option>
                  </select>
                  {prog ? (
                    <div className="flex w-full items-center gap-2 pl-6">
                      <span className="text-muted-foreground text-xs font-medium tabular-nums">
                        {prog.doneCount}/{prog.total} Quests done
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-auto h-7 px-2 text-xs"
                        onClick={() => setProgressTeam(team)}
                      >
                        View Quests
                      </Button>
                    </div>
                  ) : null}
                </li>
                )
              })}
            </ul>
          </Card>
        </fieldset>

        <fieldset disabled={!controlsLive} className="min-w-0 space-y-4 border-0 p-0">
          {stateError ? (
            <p className="text-destructive px-1 text-sm">{stateError}</p>
          ) : null}

          {/* Whatever is running sits directly under the main control card, on
              the right, with the glow marking it as the live thing. */}
          {stage && stage.type !== 'open' ? (
            // Green glow marks the live stage controls so the eye lands here.
            // `relative` so the bingo stage can corner its Restart button.
            <Card className="neo-card relative border-green-500/70 bg-card p-4 shadow-[0_0_14px_2px_rgba(34,197,94,0.35)]">
              {stage.type === 'quiz' && question ? (
            <div className="space-y-3">
              {/* Controls first and centred: running the question matters more
                  than re-reading it, and the clock rides with them so nothing
                  below has to appear or disappear mid-question. */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {/* eslint-disable-next-line react-hooks/refs -- quizPrimary.action is a deferred onClick closure, not invoked here; see quizPrimaryButton above */}
                {quizPrimary ? (
                  <FacilitatorButton size="sm" onClick={quizPrimary.action}>
                    {quizPrimary.label}
                  </FacilitatorButton>
                ) : null}
                {state.quiz_state !== 'results' && state.quiz_state !== 'ended' ? (
                  <FacilitatorButton
                    size="sm"
                    variant="outline"
                    onClick={() => void skipQuizQuestion()}
                  >
                    Skip
                  </FacilitatorButton>
                ) : null}
                <FacilitatorButton
                  size="sm"
                  variant="outline"
                  onClick={() => void restartQuiz()}
                >
                  Restart Quiz
                </FacilitatorButton>
                {state.quiz_state === 'results' ? (
                  <FacilitatorButton size="sm" onClick={() => void finishQuiz()}>
                    Finish Quiz
                  </FacilitatorButton>
                ) : null}
                {/* Always rendered, so the row keeps its height whether or not
                    a question is running. */}
                <span
                  className={`ml-1 font-mono text-lg font-bold tabular-nums ${
                    state.quiz_state === 'active' || state.quiz_state === 'revealed'
                      ? ''
                      : 'opacity-30'
                  }`}
                  aria-label="Question timer"
                >
                  {formatTimer(
                    state.quiz_state === 'active' || state.quiz_state === 'revealed'
                      ? quizTimerDisplay
                      : questionSeconds,
                  )}
                </span>
              </div>

              <p className="text-muted-foreground text-center text-xs font-bold tracking-wide uppercase">
                Q {state.current_question_index + 1} / {questions.length}
              </p>
              <p className="text-center text-base font-bold text-balance">{question.text}</p>

              {/* Two by two rather than a stack: same information, half the card. */}
              <ul className="grid grid-cols-2 gap-2 text-sm">
                {question.answers.map((a) => (
                  <li
                    key={a.id}
                    className={`rounded-lg border px-2.5 py-1.5 ${
                      state.quiz_state === 'revealed' && a.id === question.correctAnswerId
                        ? 'border-green-500 bg-green-500/15 font-bold'
                        : 'border-border/80'
                    }`}
                  >
                    {a.text}
                  </li>
                ))}
              </ul>

              {/* Who has answered, side by side in each team's own colour. */}
              <div className="flex flex-wrap gap-1.5">
                {namedTeams.map((t) => {
                  const answered = quizAnsweredTeamIds.has(t.id)
                  return (
                    <span
                      key={t.id}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition-opacity ${
                        answered ? '' : 'opacity-35'
                      }`}
                      style={{
                        backgroundColor: t.color ?? '#666',
                        color: readableTextOn(t.color ?? '#666666'),
                      }}
                    >
                      {answered ? <Check className="size-3 shrink-0" /> : null}
                      {t.name}
                    </span>
                  )
                })}
              </div>

              {state.quiz_state === 'active' && namedTeams.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-center text-sm">
                  No teams have joined yet. Participants will not receive quiz answers until they
                  join.
                </p>
              ) : null}
            </div>
              ) : stage.type === 'bingo' ? (
            <div className="space-y-3">
              {/* The run's song count is already in the progress line below, so
                  the only thing worth saying up here is when there is no run. */}
              {!effectiveBingoRun ? (
                <p className="text-muted-foreground text-xs">
                  {bingoRunQuery.isLoading
                    ? 'Loading bingo run…'
                    : 'No bingo run. Switch to this stage to activate one.'}
                </p>
              ) : null}
              <div className="flex items-center justify-center">
                <p className="text-muted-foreground text-center text-xs font-bold tracking-wide uppercase tabular-nums">
                  {bingoSongProgress(bingoPlayIndex, bingoPlayOrder.length)}
                </p>
                <FacilitatorButton
                  size="sm"
                  variant="outline"
                  className="absolute top-3 right-3"
                  onClick={() => {
                    if (!eventId || !stage.gameId) return
                    setBingoRestartOpen(true)
                  }}
                >
                  Restart
                </FacilitatorButton>
              </div>
              {/* One fixed line, always rendered. It used to appear only while a
                  track was playing, so every changeover collapsed the card and
                  pushed everything below it up and back down again. */}
              <p className="flex min-h-[2.75rem] items-center justify-center text-center text-base font-bold text-balance">
                {track && liveState.bingo_state === 'playing'
                  ? `${track.title} — ${track.artist}`
                  : liveState.bingo_state === 'ended'
                    ? 'Run finished'
                    : 'Cueing the next song…'}
              </p>
              {showBingoPlayer ? (
                <BingoClipPlayer
                  ref={bingoAudioRef}
                  src={trackPlaybackUrl}
                  nextSrc={nextTrackForCrossfade}
                  playKey={`${playTrackId ?? 'track'}-${bingoPlayIndex}-${audioPlayNonce}`}
                  autoPlay={false}
                  crossfadeSeconds={4}
                  onLockAndReveal={() => void handleBingoLockAndReveal()}
                  onAutoAdvance={() => void autoAdvanceBingoSong()}
                  onPlaybackError={(message) => notify(`Audio playback failed: ${message}`)}
                />
              ) : null}

              {liveState.bingo_winner_team_id ? (
                <div className="rounded-lg border border-yellow-400 bg-yellow-50 px-3 py-2 text-center text-sm font-bold text-yellow-900">
                  🏆 Bingo! {teams.find((t) => t.id === liveState.bingo_winner_team_id)?.name ?? 'A team'} won. Press Continue to keep playing.
                </div>
              ) : null}
              <div className="flex flex-wrap justify-center gap-2">
                  <NeoButton
                    size="sm"
                    variant="accent"
                    disabled={
                      liveState.bingo_state === 'ended' ||
                      bingoAdvancing ||
                      (bingoPlayOrder.length === 0 && bingoRunQuery.isLoading)
                    }
                    onClick={() => {
                      if (
                        liveState.bingo_state === 'waiting' ||
                        liveState.bingo_state === 'active'
                      ) {
                        handleBingoStartClick()
                        return
                      }
                      void handleBingoNextClick()
                    }}
                  >
                    {liveState.bingo_state === 'waiting' || liveState.bingo_state === 'active'
                      ? 'Start'
                      : liveState.bingo_winner_team_id
                        ? 'Continue'
                        : 'Next Song'}
                  </NeoButton>
              </div>
              {/* Who has marked this round, in the same shape the quiz uses for
                  who has answered: every team present, lit when their mark is
                  in, so the row never changes length mid-song. */}
              {namedTeams.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {namedTeams.map((t) => {
                    const marked = bingoMarkedTeamIds.has(t.id)
                    return (
                      <span
                        key={t.id}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition-opacity ${
                          marked ? '' : 'opacity-35'
                        }`}
                        style={{
                          backgroundColor: t.color ?? '#666',
                          color: readableTextOn(t.color ?? '#666666'),
                        }}
                      >
                        {marked ? <Check className="size-3 shrink-0" /> : null}
                        {t.name}
                      </span>
                    )
                  })}
                </div>
              ) : null}

              {bingoRestartOpen && stage.gameId && eventId ? (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="bingo-restart-title"
                >
                  <Card className="border-border/80 w-full max-w-md space-y-4 bg-card p-6 shadow-lg">
                    <div className="space-y-2">
                      <h3 id="bingo-restart-title" className="text-foreground font-semibold">
                        Restart bingo run?
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Generates new cards and a new play order. Clears all marks and scores for this bingo game.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <NeoButton
                        type="button"
                        variant="surface"
                        onClick={() => setBingoRestartOpen(false)}
                      >
                        Cancel
                      </NeoButton>
                      <NeoButton
                        type="button"
                        variant="destructive"
                        onClick={() => {
                          setBingoRestartOpen(false)
                          if (!eventId || !stage.gameId) return
                          const gameId = stage.gameId
                          const stageIndex = liveState.current_stage_index
                          void restartBingoRun(eventId, gameId, stageIndex)
                            .then((result) => {
                              const row = bingoRunRowFromActivation(eventId, gameId, stageIndex, result)
                              flushSync(() => setBingoRunOverride(row))
                              queryClient.setQueryData(queryKeys.bingoRun(eventId, stageIndex), row)
                              void queryClient.invalidateQueries({
                                queryKey: queryKeys.bingoRun(eventId, stageIndex),
                              })
                              setAudioPlayNonce((n) => n + 1)
                              bingoWinHaltRef.current = false
                              notify('Bingo run restarted')
                              void patchState({
                                current_question_index: 0,
                                bingo_state: 'waiting',
                                bingo_bonus_id: null,
                                bingo_revealed_track_ids: [],
                              })
                              void patchWinnerFieldsSafe({
                                bingo_winner_team_id: null,
                                bingo_announced_winner_ids: [],
                              })
                          })
                          .catch((err) =>
                            notify(err instanceof Error ? err.message : 'Restart failed'),
                          )
                        }}
                      >
                        Restart bingo run
                      </NeoButton>
                    </div>
                  </Card>
                </div>
              ) : null}
            </div>
              ) : stage.type === 'break' ? (
            <div className="space-y-3">
              {/* What the room is reading, kept. The paragraph explaining what
                  Start and Stop do is not: the two buttons say it. */}
              {stage.message?.trim() ? (
                <p className="text-center text-base font-bold text-balance italic">
                  “{stage.message}”
                </p>
              ) : null}
              <div className="flex items-center justify-center gap-5">
                <div className="flex flex-wrap justify-center gap-2">
                <NeoButton
                  size="sm"
                  variant="accent"
                  disabled={breakHalted}
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
                </NeoButton>
                <FacilitatorButton
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (breakHalted) {
                      setBreakHalted(false)
                      void patchState({
                        break_timer_seconds: breakDurationSeconds(stage, null),
                        break_timer_running: false,
                      })
                    } else {
                      setBreakHalted(true)
                      void patchState({ break_timer_running: false })
                    }
                  }}
                >
                  {breakHalted ? (
                    <>
                      <RotateCcw className="size-4" /> Reset
                    </>
                  ) : (
                    'Stop'
                  )}
                </FacilitatorButton>
                </div>
                {/* The clock is the thing anyone glances at from across a room,
                    so it gets the size and the right-hand end of the row. */}
                <p className="shrink-0 font-mono text-4xl leading-none font-black tabular-nums">
                  {formatBreakTimer(breakDisplay)}
                </p>
              </div>
            </div>
              ) : null}
            </Card>
          ) : null}

          {!stage || stage.type === 'open' ? (
            // On a quest stage the review queue IS the live control, so it
            // wears the same green glow the other stages' controls wear.
            <Card className="neo-card border-green-500/70 bg-card p-4 shadow-[0_0_14px_2px_rgba(34,197,94,0.35)]">
            <>
              <FilterChips
                aria-label="Filter submissions"
                className="mb-3"
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
                value={subTab}
                onChange={setSubTab}
              />
              <ul className="max-h-[70vh] space-y-3 overflow-auto">
                {filteredSubs
                  .filter(
                    (s) =>
                      isOpenStageSubmissionMediaType(s.media_type) &&
                      s.status !== 'cancelled',
                  )
                  .map((sub) => {
                    const team = teams.find((t) => t.id === sub.team_id)
                    const game = games.find((g) => g.id === sub.game_id)
                    const expectedTextAnswer =
                      sub.media_type === 'text' && game
                        ? expectedTextAnswerLabel(game)
                        : null
                    const textVerdict: TextAnswerVerdict | null =
                      sub.media_type === 'text' && game
                        ? textAnswerVerdict(game, sub.media_url)
                        : null
                    // The app's own badge tones: solid, not a tinted outline.
                    const statusTone =
                      sub.status === 'approved'
                        ? 'active'
                        : sub.status === 'rejected'
                          ? 'attention'
                          : 'ready'
                    return (
                      <li key={sub.id}>
                        <button
                          type="button"
                          className="border-border/80 hover:bg-muted/30 flex w-full gap-3 rounded-lg border p-2 text-left transition-colors"
                          onClick={() => setSelectedSub(sub)}
                        >
                          {sub.media_type === 'puzzle' ? (
                            <div className="bg-muted flex size-16 shrink-0 flex-col items-center justify-center rounded p-1 text-center">
                              <span className="text-[10px] font-bold uppercase">Puzzle</span>
                              <span className="text-muted-foreground text-[9px] leading-tight">
                                {puzzleSubmissionStatLabel(sub.media_url)}
                              </span>
                            </div>
                          ) : sub.media_type === 'text' ? (
                            <div
                              className="bg-muted flex size-16 shrink-0 items-center justify-center rounded p-2 text-[10px] leading-tight"
                            >
                              <span className="line-clamp-4 break-all text-center">
                                {game
                                  ? textSubmissionDisplayLabel(game, sub.media_url)
                                  : sub.media_url}
                              </span>
                            </div>
                          ) : sub.media_url ? (
                            sub.media_type === 'video' ? (
                              <video
                                src={sub.media_url}
                                className="size-16 rounded object-cover"
                              />
                            ) : (
                              <img
                                src={sub.media_url}
                                alt=""
                                className="size-16 rounded object-cover"
                              />
                            )
                          ) : (
                            <div className="bg-muted size-16 shrink-0 rounded" />
                          )}
                          <div className="min-w-0 flex-1 text-sm">
                            <p className="font-medium">{team?.name ?? 'Team'}</p>
                            <p className="text-muted-foreground truncate">{game?.name}</p>
                            {/* The thumbnail alone does not say what kind of
                                submission this is: a video still and a photo
                                look identical at 64px, and text and puzzle
                                tiles read as grey boxes. */}
                            <span
                              className={`${gameTypeTagClass(game?.type ?? (sub.media_type ?? '').split(':')[0])} mt-1 mr-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white`}
                            >
                              {gameTypeLabel(game?.type, sub.media_type)}
                            </span>
                            {/* Marking a text answer means comparing it with
                                the right one, and an automatically marked game
                                never reaches the review modal where the
                                reference used to live. The verdict chip does
                                the comparing: two long near-identical options
                                are impossible to tell apart by eye on a card
                                (Camilleri event, 7 Aug 2026). */}
                            {textVerdict && textVerdict !== 'unknown' ? (
                              <span
                                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${TEXT_VERDICT_CHIP[textVerdict].className}`}
                              >
                                {TEXT_VERDICT_CHIP[textVerdict].label}
                              </span>
                            ) : null}
                            {expectedTextAnswer ? (
                              <p className="text-muted-foreground text-xs">
                                Expected:{' '}
                                <span className="text-foreground font-semibold">
                                  {expectedTextAnswer}
                                </span>
                              </p>
                            ) : null}
                            <NeoStatusBadge tone={statusTone} className="mt-1">
                              {sub.status}
                            </NeoStatusBadge>
                            {sub.media_type === 'puzzle' && sub.points_awarded !== null ? (
                              <span className="text-muted-foreground ml-2 text-xs font-semibold">
                                +{sub.points_awarded} pts
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </>
            </Card>
          ) : null}
          <Card className="neo-card border-border/80 bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="size-4 text-amber-500" />
                <p className="font-medium">Purchases</p>
              </div>
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
                {livePurchases.length}
              </span>
            </div>
            {purchasesQuery.isLoading ? (
              <p className="text-muted-foreground text-sm">Loading purchases…</p>
            ) : purchasesQuery.isError ? (
              <p className="text-destructive text-sm">Could not load purchases.</p>
            ) : livePurchases.length === 0 ? (
              <p className="text-muted-foreground text-sm">No purchases yet.</p>
            ) : (
              <ul className="max-h-[32vh] space-y-2 overflow-auto">
                {livePurchases.map((purchase) => {
                  const team = teams.find((row) => row.id === purchase.team_id)
                  return (
                    <li
                      key={purchase.id}
                      className="border-border/80 flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="bg-amber-100 text-amber-900 flex size-9 shrink-0 items-center justify-center rounded-full">
                        <ShoppingBag className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium">{team?.name?.trim() || 'Team'}</p>
                        <p className="text-muted-foreground truncate">
                          {purchase.item_name}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums">{purchase.points_cost} pts</p>
                        <p className="text-muted-foreground text-xs">
                          {new Intl.DateTimeFormat(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(purchase.created_at))}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </fieldset>
      </div>

      <FacilitatorChatBubble
        unreadCount={chatUnread}
        disabled={!controlsLive}
        onClick={() => {
          setChatTeamId(null)
          setChatOpen(true)
        }}
      />
      <FacilitatorChatDrawer
        open={chatOpen}
        onOpenChange={setChatOpen}
        activeTeamId={chatTeamId}
        onActiveTeamIdChange={setChatTeamId}
        messages={messages}
        teams={teams}
        unreadByTeamId={unreadByTeamId}
        sendDisabled={!controlsLive}
        onSend={async (text, teamId) => {
          if (!controlsLive) return
          unlockAudioFromUserGesture('operational')
          // Teams talk to "the facilitator", not to whichever staff member
          // happens to be holding the console. Presence still uses the real
          // name so facilitators can see each other.
          await sendMessage(FACILITATOR_CHAT_SENDER, text, teamId)
        }}
      />

      {selectedSub ? (
        <SubmissionDetailModal
          sub={selectedSub}
          teamName={
            teams.find((t) => t.id === selectedSub.team_id)?.name ?? 'Team'
          }
          gameName={
            games.find((g) => g.id === selectedSub.game_id)?.name ?? 'Game'
          }
          game={games.find((g) => g.id === selectedSub.game_id)}
          pointsType={
            games.find((g) => g.id === selectedSub.game_id)?.points_type ?? 'static'
          }
          pointsMin={games.find((g) => g.id === selectedSub.game_id)?.points_min ?? null}
          pointsMax={games.find((g) => g.id === selectedSub.game_id)?.points_max ?? null}
          pointsStatic={
            games.find((g) => g.id === selectedSub.game_id)?.points_static ?? null
          }
          onClose={() => setSelectedSub(null)}
          onApprove={(points) => approveSubmission(selectedSub, points)}
          onReject={() => rejectSubmission(selectedSub.id)}
        />
      ) : null}

      {progressTeam
        ? (() => {
            const prog = teamQuestProgress(progressTeam.id, questGames, submissions)
            return (
              <TeamQuestProgressModal
                team={progressTeam}
                items={prog.items}
                doneCount={prog.doneCount}
                total={prog.total}
                onClose={() => setProgressTeam(null)}
                onOpenSubmission={(sub) => {
                  setProgressTeam(null)
                  setSelectedSub(sub)
                }}
              />
            )
          })()
        : null}

      <TeamClaimModal
        slot={claimSlot}
        name={claimName}
        onNameChange={setClaimName}
        onPhotoChange={setClaimPhoto}
        onColorChange={(color) => {
          if (claimSlot) void updateTeam(claimSlot.id, { color })
        }}
        uploading={uploading}
        onCancel={() => setClaimSlot(null)}
        onSave={() => void saveClaim()}
      />

      <ResetTeamModal
        team={resetConfirmTeam}
        resetting={resettingTeam}
        onCancel={() => setResetConfirmTeam(null)}
        onConfirm={() => {
          if (resetConfirmTeam) void resetTeamSlot(resetConfirmTeam)
        }}
      />

      <EventLogModal open={logOpen} eventId={eventId} onClose={() => setLogOpen(false)} />
      {install.guide}
    </FacilitatorPanelShell>
      <DemoOverlay enabled={event.status === 'demo'} />
    </>
  )
}
