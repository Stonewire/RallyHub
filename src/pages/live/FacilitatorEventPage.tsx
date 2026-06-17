import { Check, MessageCircle, Pause, Play, Plus, Minus, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { FacilitatorButton, FacilitatorButtonLarge } from '@/components/admin/FacilitatorButton'
import { BingoClipPlayer, type BingoClipPlayerHandle } from '@/components/live/BingoClipPlayer'
import { DisplayPreviewFrame } from '@/components/live/DisplayPreviewFrame'
import { DemoOverlay } from '@/components/live/DemoOverlay'
import {
  FacilitatorChatBubble,
  FacilitatorChatDrawer,
  useFacilitatorChatInbox,
} from '@/components/live/FacilitatorChatDrawer'
import { SubmissionDetailModal } from '@/components/live/SubmissionDetailModal'
import { FacilitatorPanelShell } from '@/components/layout/FacilitatorPanelShell'
import { NeoButton, NeoCard, NeoInput, NeoLabel } from '@/components/neo-minimal'
import { useNotification } from '@/contexts/notification-context'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { StatusIndicator } from '@/components/ui/status-indicator'
import type { RallyStatusTone } from '@/components/ui/status-indicator'
import { useBingoRun, type BingoRunRow } from '@/hooks/use-bingo-run'
import { useLiveTimer } from '@/hooks/use-live-timer'
import { useChatMessages, useFacilitatorPresence, useLiveEvent } from '@/hooks/use-live-event'
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
import { scoreBingoBonusRound } from '@/lib/bingo-bonus-scoring'
import {
  bingoSongProgress,
  parseBingoGameConfig,
} from '@/lib/bingo-facilitator'
import { advanceBingoTrack } from '@/lib/bingo-round-advance'
import { parseAnnouncedWinnerIds, parseRevealedTrackIds } from '@/lib/bingo-cell-match'
import { restartBingoRun } from '@/lib/restart-bingo-run'
import { scoreBingoRound } from '@/lib/bingo-scoring'
import { isOpenStageSubmissionMediaType, textSubmissionDisplayLabel } from '@/lib/text-game'
import { profileDisplayName } from '@/lib/auth-routes'
import {
  bingoBonusChallenges,
  bingoBonusChallenge,
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
  isQuizSubmission,
  scoreCurrentQuizQuestion,
  isEventLive,
} from '@/lib/live-event'
import { bingoRunRowFromActivation, normalizeBingoPlayOrder } from '@/lib/bingo-run-cache'
import { getEventLinks } from '@/lib/event-links'
import { queryKeys } from '@/lib/query-keys'
import { createThrottledTimerSync } from '@/lib/live-timer-sync'
import {
  playAnnouncementSound,
  playNewMessageSound,
  playNewSubmissionSound,
  installAudioUnlock,
  unlockAudioFromUserGesture,
} from '@/lib/sounds'
import type { GameConfig, MusicTrack } from '@/types/game-config'
import { setLiveParticipantMode, supabase } from '@/lib/supabase'
import { uploadAsset } from '@/lib/storage'
import type { Tables, TablesUpdate } from '@/types/helpers'

const ANNOUNCEMENT_MS = 60_000

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
  const { messages, chatHistoryReady, sendMessage } = useChatMessages(eventId)
  const others = useFacilitatorPresence(eventId, name || null)
  const annClearRef = useRef<number | undefined>(undefined)

  const [announcement, setAnnouncement] = useState('')
  const [claimSlot, setClaimSlot] = useState<Tables<'teams'> | null>(null)
  const [resetConfirmTeam, setResetConfirmTeam] = useState<Tables<'teams'> | null>(null)
  const [resettingTeam, setResettingTeam] = useState(false)
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
  const [bingoTracksLive, setBingoTracksLive] = useState<MusicTrack[]>([])
  const bingoAudioRef = useRef<BingoClipPlayerHandle | null>(null)
  // True while a bingo win has halted auto-progression (cleared when facilitator continues).
  const bingoWinHaltRef = useRef(false)
  const { notify } = useNotification()
  const queryClient = useQueryClient()

  const playTeamChatSound = useCallback(() => {
    playNewMessageSound()
  }, [])

  const { totalUnread: chatUnread, unreadByTeamId } = useFacilitatorChatInbox(
    messages,
    name,
    chatOpen,
    chatTeamId,
    chatHistoryReady,
    playTeamChatSound,
  )

  useEffect(() => {
    installAudioUnlock('operational')
  }, [])

  const controlsLiveRef = useRef(false)

  const stages = useMemo(
    () => (bundle ? parseStages(bundle.event.stages_config) : []),
    [bundle],
  )
  const stage = bundle ? currentStage(stages, bundle.state.current_stage_index) : null
  const state = bundle?.state
  const liveSubmissions = bundle?.submissions ?? []
  const bingoStageGameId =
    stage?.type === 'bingo' && stage.gameId ? stage.gameId : undefined
  const bingoGameForTracks = bingoStageGameId
    ? bundle?.games.find((g) => g.id === bingoStageGameId)
    : null

  useEffect(() => {
    if (!bingoStageGameId || !bingoGameForTracks) {
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

  async function patchState(patch: Parameters<typeof updateState>[0]) {
    if (!controlsLiveRef.current) return
    try {
      setStateError(null)
      await updateState(patch)
    } catch (err) {
      setStateError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  function selectStage(index: number) {
    const next = stages[index]
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
    createThrottledTimerSync((next, stillRunning) => {
      void patchState({ timer_seconds: next, timer_running: stillRunning })
    }),
  )

  const quizTimerSyncRef = useRef(
    createThrottledTimerSync((next, stillRunning) => {
      void patchState({ quiz_timer_seconds: next, quiz_timer_running: stillRunning })
    }),
  )

  const breakSyncRef = useRef(
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
    void patchState({ submissions_open: false })
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
    const named = bundle.teams.filter((t) => t.name?.trim())
    const allAnswered =
      named.length > 0 &&
      named.every((t) =>
        bundle.submissions.some(
          (s) =>
            s.team_id === t.id &&
            s.game_id === st.gameId &&
            (s.media_type === mediaType || s.media_type === 'quiz'),
        ),
      )
    const timerExpired = quizTimerDisplay <= 0
    if (!timerExpired && !allAnswered) return

    const key = `${state.current_stage_index}-${state.current_question_index}-reveal`
    if (quizAutoRevealKey.current === key) return
    quizAutoRevealKey.current = key

    void (async () => {
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
      try {
        await updateState({ quiz_timer_running: false, quiz_state: 'revealed' })
      } catch {
        quizAutoRevealKey.current = ''
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

  useEffect(() => {
    const pendingCount = liveSubmissions
      .filter(
        (s) =>
          s.status === 'pending' &&
          isOpenStageSubmissionMediaType(s.media_type),
      )
      .length
    if (pendingSubmissionCountRef.current === 0) {
      pendingSubmissionCountRef.current = pendingCount
      return
    }
    if (pendingCount > pendingSubmissionCountRef.current) {
      playNewSubmissionSound()
    }
    pendingSubmissionCountRef.current = pendingCount
  }, [liveSubmissions])

  if (loading || !bundle || !state) {
    return (
      <FacilitatorPanelShell title="Facilitator" titleCentered>
        <p className="text-muted-foreground text-center text-sm">
          {loading ? 'Loading…' : (error ?? 'Event not found')}
        </p>
      </FacilitatorPanelShell>
    )
  }

  const { event, organization, teams: eventTeams, games, submissions } = bundle
  controlsLiveRef.current = isEventLive(event)
  const teams = (
    isEventDemoStatus(event.status) ? demoTeamSlots(eventTeams) : eventTeams
  ).filter((team): team is Tables<'teams'> => Boolean(team?.id))
  const liveState = state
  const displayUrl = eventId
    ? getEventLinks(eventId, organization).display
    : ''

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
          `${eventId}/teams/${claimSlot.id}/${Date.now()}`,
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
    } finally {
      setUploading(false)
    }
  }

  async function resetTeamSlot(team: Tables<'teams'>) {
    setResettingTeam(true)
    try {
      await updateTeam(team.id, {
        name: null,
        photo_url: null,
        score: 0,
        status: 'idle',
      })
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
  const questionSeconds = quizConfig.timer_seconds ?? 20
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
    const sec = questionSeconds
    void patchState({
      current_question_index: index,
      quiz_state: 'active',
      quiz_timer_seconds: sec,
      quiz_timer_running: true,
    })
  }

  async function revealQuizAnswers() {
    if (!quizGame || !question || !eventId) return
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
    await patchState({ quiz_timer_running: false, quiz_state: 'revealed' })
    quizAutoRevealKey.current = `${liveState.current_stage_index}-${liveState.current_question_index}-reveal`
  }

  async function skipQuizQuestion() {
    quizAutoRevealKey.current = ''
    const next = liveState.current_question_index + 1
    if (next >= questions.length) {
      await patchState({
        quiz_state: 'results',
        quiz_timer_running: false,
      })
      return
    }
    await patchState({
      current_question_index: next,
      quiz_state: 'active',
      quiz_timer_seconds: questionSeconds,
      quiz_timer_running: true,
    })
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
    if (!stage?.gameId) return
    const quizSubs = submissions.filter(
      (s) => s.game_id === stage.gameId && isQuizSubmission(s.media_type),
    )
    const totalsByTeam = new Map<string, number>()
    for (const sub of quizSubs) {
      const pts = sub.points_awarded ?? 0
      if (pts > 0 && sub.status === 'approved') {
        totalsByTeam.set(sub.team_id, (totalsByTeam.get(sub.team_id) ?? 0) + pts)
      }
    }
    for (const [teamId, total] of totalsByTeam) {
      await incrementTeamScore(teamId, -total, eventId)
    }
    for (const sub of quizSubs) {
      await supabase.from('submissions').delete().eq('id', sub.id)
    }
    if (eventId) await publishLiveBundleReload(eventId)
    await patchState({
      current_question_index: 0,
      quiz_state: 'idle',
      quiz_timer_seconds: questionSeconds,
      quiz_timer_running: false,
    })
    notify('Quiz reset')
  }

  async function finishQuiz() {
    quizAutoRevealKey.current = ''
    await patchState({ quiz_state: 'ended', quiz_timer_running: false })
    notify('Quiz finished for all screens')
  }

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
    ? tracks.find((t) => t.id === playTrackId) ?? tracks[bingoPlayIndex]
    : tracks[bingoPlayIndex]
  const trackPlaybackUrl = track ? bingoTrackPlaybackUrl(track) : ''
  const nextTrackForCrossfade = (() => {
    const nextId = bingoPlayOrder[bingoPlayIndex + 1]
    if (!nextId) return undefined
    const nextTrack = tracks.find((t) => t.id === nextId) ?? tracks[bingoPlayIndex + 1]
    return nextTrack ? bingoTrackPlaybackUrl(nextTrack) : undefined
  })()
  const showBingoPlayer =
    stage?.type === 'bingo' &&
    liveState.bingo_state !== 'bonus' &&
    liveState.bingo_state !== 'bonus_revealed'
  const bingoGameId = stage?.type === 'bingo' ? stage.gameId : undefined
  const bingoConfig = bingoGame ? parseBingoGameConfig(bingoGame.config) : {}
  const bingoMarkedTeams = (() => {
    if (!bingoGameId) return [] as string[]
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
    return [...ids]
      .map((id) => teams.find((t) => t.id === id)?.name)
      .filter(Boolean) as string[]
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
    if (!id) return trackList[index] ?? null
    return trackList.find((t) => t.id === id) ?? trackList[index] ?? null
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
    bingoWinHaltRef.current = false

    const player = bingoAudioRef.current
    if (!player?.isMounted()) {
      notify('Audio player is not mounted — switch to bingo stage and try again')
      return
    }

    void player.primeAudioContext()

    const syncUrl = trackPlaybackUrl || resolvePlaybackUrlForIndex(effectiveBingoRun, bingoPlayIndex)
    if (syncUrl) {
      void player.playFromUserGesture(syncUrl).then((played) => {
        if (played) {
          void patchState({ bingo_state: 'playing', bingo_revealed_track_ids: [] })
          void patchWinnerFieldsSafe({ bingo_winner_team_id: null })
        } else {
          notify('Could not start playback — check console for details')
        }
      })
      return
    }

    void (async () => {
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

    const result = await scoreBingoRound({
      eventId,
      gameId: stage.gameId,
      runId: scoringRunId,
      trackId: currentTrackId,
      gameConfig: bingoConfig,
    })

    // Core reveal uses only existing columns and must always succeed so the
    // round advances and the participant's green/red/grey states show.
    const prev = parseRevealedTrackIds(liveState.bingo_revealed_track_ids)
    const revealed = prev.includes(currentTrackId) ? prev : [...prev, currentTrackId]
    await patchState({
      bingo_state: 'revealed',
      bingo_revealed_track_ids: revealed,
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
        await patchState(writePatch)
        if (winnerName) notify(`🏆 Bingo! ${winnerName} won — game paused`)
      } catch (err) {
        console.error('Failed to write bingo winner fields (non-fatal)', err)
        if (winnerName) notify(`🏆 Bingo! ${winnerName} won — game paused`)
      }
    }
    return true
  }

  async function handleBingoNextClick(opts?: { skipCrossfade?: boolean; skipScore?: boolean }) {
    if (bingoAdvancing) return
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
      } else if (!opts?.skipCrossfade && nextUrl && liveState.bingo_state !== 'playing') {
        await player.playFromUserGesture(nextUrl)
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
    } finally {
      setBingoAdvancing(false)
    }
  }

  async function handleBingoLockAndReveal() {
    if (bingoAdvancing) return
    if (liveState.bingo_state !== 'playing') return
    setBingoAdvancing(true)
    try {
      await lockAndRevealBingoRound()
    } finally {
      setBingoAdvancing(false)
    }
  }

  async function autoAdvanceBingoSong() {
    if (bingoAdvancing) return
    if (bingoWinHaltRef.current) return
    if (liveState.bingo_state !== 'revealed' && liveState.bingo_state !== 'playing') return
    await handleBingoNextClick({ skipCrossfade: true, skipScore: true })
  }

  return (
    <>
      <FacilitatorPanelShell
      title={event.name}
      titleCentered
      subtitle={
        others.length > 0 ? (
          <span>Also viewing: {others.map((o) => o.name).join(', ')}</span>
        ) : undefined
      }
    >
      <div className="mb-4 flex justify-center">
        <StatusIndicator status={event.status as RallyStatusTone} />
        <span className="text-muted-foreground ml-2 text-sm capitalize">
          {event.status === 'demo' ? 'Demo' : event.status}
        </span>
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

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="neo-card border-border/80 overflow-hidden bg-card shadow-sm">
            <DisplayPreviewFrame displayUrl={displayUrl} />
          </Card>

          <fieldset
            disabled={!controlsLive}
            className="min-w-0 space-y-4 border-0 p-0"
          >
          <Card className="neo-card border-border/80 grid gap-4 bg-card p-4 shadow-sm sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">Event countdown on display</p>
              <p className="font-mono text-3xl tabular-nums">{formatTimer(timerDisplay)}</p>
              <div className="flex flex-wrap gap-2">
                <FacilitatorButton
                  size="sm"
                  onClick={() =>
                    void patchState({ timer_running: !state.timer_running })
                  }
                >
                  {state.timer_running ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {state.timer_running ? 'Pause' : 'Start'}
                </FacilitatorButton>
                <FacilitatorButton
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void patchState({ timer_seconds: state.timer_seconds + 900 })
                  }
                >
                  <Plus className="size-4" /> 15m
                </FacilitatorButton>
                <FacilitatorButton
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void patchState({
                      timer_seconds: Math.max(0, state.timer_seconds - 900),
                    })
                  }
                >
                  <Minus className="size-4" /> 15m
                </FacilitatorButton>
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={state.show_timer_on_display}
                    onChange={(e) =>
                      void patchState({ show_timer_on_display: e.target.checked })
                    }
                  />
                  Show timer on display
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={state.show_scores}
                    onChange={(e) => void patchState({ show_scores: e.target.checked })}
                  />
                  Show scores on display
                </label>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-2">
              <p className="text-muted-foreground text-xs">
                Run the winner ceremony on display and team phones
              </p>
              <FacilitatorButtonLarge
                className="w-full"
                onClick={() =>
                  void patchState({
                    winner_reveal_stage: Math.min(2, state.winner_reveal_stage + 1),
                  })
                }
              >
                Reveal Winner ({state.winner_reveal_stage}/2)
              </FacilitatorButtonLarge>
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
          </Card>

          {stateError ? (
            <p className="text-destructive px-1 text-sm">{stateError}</p>
          ) : null}

          <Card className="neo-card border-border/80 bg-card p-4 shadow-sm">
            <p className="mb-2 text-sm font-medium">Stages</p>
            <div className="flex flex-wrap gap-2">
              {stages.map((s, i) =>
                s?.id ? (
                  <NeoButton
                    key={s.id}
                    size="sm"
                    variant={state.current_stage_index === i ? 'primary' : 'surface'}
                    onClick={() => selectStage(i)}
                  >
                    Stage {i + 1}
                  </NeoButton>
                ) : null,
              )}
            </div>
          </Card>

          <Card className="neo-card border-border/80 space-y-3 bg-card p-4 shadow-sm">
            <NeoLabel>Announcement</NeoLabel>
            <p className="text-muted-foreground text-xs">
              Send a message to the display, participants, or both. Clears after 1 minute.
            </p>
            <NeoInput
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              className="bg-background"
            />
            <div className="flex flex-wrap gap-2">
              {(['display', 'participants', 'both'] as const).map((t) => (
                <FacilitatorButton
                  key={t}
                  size="sm"
                  variant="outline"
                  onClick={() => sendAnnouncement(t)}
                >
                  {t === 'display' ? 'Display' : t === 'participants' ? 'Participants' : 'Both'}
                </FacilitatorButton>
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

          <Card className="neo-card border-border/80 max-h-[40vh] space-y-3 overflow-auto bg-card p-4 shadow-sm">
            <p className="font-medium">Teams</p>
            <p className="text-muted-foreground text-xs">
              Tap a slot to set name/photo. Scores update when you approve submissions.
            </p>
            <ul className="space-y-2">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className="border-border/80 flex items-center gap-3 rounded-lg border p-2"
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
                  <select
                    className="border-input bg-background rounded border px-1 text-xs"
                    value={team.status}
                    onChange={(e) =>
                      void updateTeam(team.id, { status: e.target.value })
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
          </fieldset>

        </div>

        <fieldset disabled={!controlsLive} className="min-w-0 border-0 p-0">
        <Card className="neo-card border-border/80 bg-card p-4 shadow-sm">
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
                    const statusBadgeClass =
                      sub.status === 'approved'
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : sub.status === 'rejected'
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : 'bg-yellow-100 text-yellow-900 border-yellow-300'
                    return (
                      <li key={sub.id}>
                        <button
                          type="button"
                          className="border-border/80 hover:bg-muted/30 flex w-full gap-3 rounded-lg border p-2 text-left transition-colors"
                          onClick={() => setSelectedSub(sub)}
                        >
                          {sub.media_type === 'text' ? (
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
                            <p
                              className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass}`}
                            >
                              {sub.status}
                            </p>
                          </div>
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </>
          ) : stage.type === 'quiz' && question ? (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Q {state.current_question_index + 1} / {questions.length} · {questionSeconds}s
              </p>
              <p className="text-lg font-semibold">{question.text}</p>
              <ul className="space-y-2 text-sm">
                {question.answers.map((a) => (
                  <li
                    key={a.id}
                    className="border-border/80 rounded-lg border px-3 py-2"
                  >
                    {a.text}
                    {state.quiz_state === 'revealed' && a.id === question.correctAnswerId ? (
                      <span className="text-muted-foreground ml-2 text-xs">(correct)</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
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
              </div>
              <ul className="space-y-1 text-sm">
                {namedTeams.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    {quizAnsweredTeamIds.has(t.id) ? (
                      <Check className="text-foreground size-4 shrink-0" />
                    ) : (
                      <span className="size-4 shrink-0" />
                    )}
                    <span>{t.name}</span>
                  </li>
                ))}
              </ul>
              {state.quiz_state === 'active' || state.quiz_state === 'revealed' ? (
                <Card className="border-border/80 bg-muted/20 p-6 text-center shadow-inner">
                  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                    Question timer
                  </p>
                  <p className="font-mono text-5xl font-bold tabular-nums md:text-6xl">
                    {formatTimer(quizTimerDisplay)}
                  </p>
                </Card>
              ) : null}
            </div>
          ) : stage.type === 'bingo' ? (
            <div className="space-y-4">
              {bingoGame && bingoBonusChallenges(bingoGame).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium uppercase">
                    Bonus challenges
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {bingoBonusChallenges(bingoGame).map((ch) => (
                      <Button
                        key={ch.id}
                        size="sm"
                        variant={
                          state.bingo_bonus_id === ch.id ? 'secondary' : 'outline'
                        }
                        disabled={
                          state.bingo_state === 'bonus' ||
                          state.bingo_state === 'bonus_revealed'
                        }
                        onClick={() =>
                          void patchState({
                            bingo_state: 'bonus',
                            bingo_bonus_id: ch.id,
                          })
                        }
                      >
                        {ch.question.slice(0, 36)}
                        {ch.question.length > 36 ? '…' : ''}
                      </Button>
                    ))}
                  </div>
                  {state.bingo_state === 'bonus' || state.bingo_state === 'bonus_revealed' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={state.bingo_state === 'bonus_revealed'}
                        onClick={() => {
                          const ch = bingoBonusChallenge(bingoGame, state.bingo_bonus_id)
                          if (!ch || !stage.gameId || !eventId) return
                          void scoreBingoBonusRound({
                            eventId,
                            gameId: stage.gameId,
                            challengeId: ch.id,
                            correctAnswerId: ch.correctAnswerId,
                          }).then(() =>
                            void patchState({ bingo_state: 'bonus_revealed' }),
                          )
                        }}
                      >
                        Reveal bonus answers
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          void patchState({
                            bingo_state: 'waiting',
                            bingo_bonus_id: null,
                          })
                        }
                      >
                        End bonus — back to bingo
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <p className="text-muted-foreground text-xs">
                {effectiveBingoRun
                  ? `Run active · ${bingoPlayOrder.length} songs in script`
                  : bingoRunQuery.isLoading
                    ? 'Loading bingo run…'
                    : 'No bingo run — switch to this stage to activate'}
              </p>
              <p className="text-muted-foreground text-sm font-medium tabular-nums">
                {bingoSongProgress(bingoPlayIndex, bingoPlayOrder.length)}
              </p>
              {track && liveState.bingo_state === 'playing' ? (
                <p className="font-semibold">
                  Now playing: {track.title} — {track.artist}
                </p>
              ) : null}
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
                <div className="rounded-md border border-yellow-400 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
                  🏆 Bingo! <strong>{teams.find((t) => t.id === liveState.bingo_winner_team_id)?.name ?? 'A team'}</strong> won — game paused. Press Continue to keep playing.
                </div>
              ) : null}
              {liveState.bingo_state !== 'bonus' &&
              liveState.bingo_state !== 'bonus_revealed' ? (
                <div className="flex flex-wrap gap-2">
                  <FacilitatorButton
                    size="sm"
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
                  </FacilitatorButton>
                </div>
              ) : null}
              {bingoMarkedTeams.length > 0 ? (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs">Marked this round</p>
                  <ul className="text-sm">
                    {bingoMarkedTeams.map((n) => (
                      <li key={n} className="flex items-center gap-1.5">
                        <Check className="size-3.5 text-green-600" />
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <FacilitatorButton
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!eventId || !stage.gameId) return
                  const ok = window.confirm(
                    'Restart bingo for this stage? New cards and play order. Clears all marks for this game.',
                  )
                  if (!ok) return
                  const gameId = stage.gameId
                  const stageIndex = liveState.current_stage_index
                  void restartBingoRun(eventId, gameId, stageIndex)
                    .then((result) => {
                      // Refresh the facilitator's run to the NEW run id + play order so
                      // scoring reads the same cards/run the participants now see.
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
              </FacilitatorButton>
            </div>
          ) : stage.type === 'break' ? (
            <div className="space-y-4">
              <p className="text-lg">{stage.message}</p>
              <p className="font-mono text-2xl tabular-nums">{formatBreakTimer(breakDisplay)}</p>
              <p className="text-muted-foreground text-xs">
                Start/pause the break timer. Stop freezes the countdown; Reset restores full
                duration.
              </p>
              <div className="flex flex-wrap gap-2">
                <FacilitatorButton
                  size="sm"
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
                </FacilitatorButton>
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
            </div>
          ) : null}
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
          await sendMessage(name.trim(), text, teamId)
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

      {claimSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <NeoCard className="max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto p-6 shadow-lg">
            <h3 className="font-semibold">Team slot {claimSlot.slot_number}</h3>
            <Input
              value={claimName}
              onChange={(e) => setClaimName(e.target.value)}
              placeholder="Team name"
              className="bg-background"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setClaimPhoto(e.target.files?.[0] ?? null)}
            />
            <input
              type="color"
              value={claimSlot.color ?? '#888888'}
              onChange={(e) => void updateTeam(claimSlot.id, { color: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <NeoButton variant="surface" onClick={() => setClaimSlot(null)}>
                Cancel
              </NeoButton>
              <NeoButton variant="primary" disabled={uploading} onClick={() => void saveClaim()}>
                Save
              </NeoButton>
            </div>
          </NeoCard>
        </div>
      ) : null}

      {resetConfirmTeam ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="reset-team-title"
        >
          <NeoCard className="w-full max-w-md space-y-4 p-6 shadow-lg">
            <h3 id="reset-team-title" className="font-semibold">
              Reset team slot {resetConfirmTeam.slot_number}?
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Clears{' '}
              <span className="text-foreground font-medium">
                {resetConfirmTeam.name?.trim() || 'this team'}
              </span>
              , removes their photo, and sets score to 0. The slot becomes available for someone
              new to join.
            </p>
            <div className="flex justify-end gap-2">
              <NeoButton
                variant="surface"
                disabled={resettingTeam}
                onClick={() => setResetConfirmTeam(null)}
              >
                Cancel
              </NeoButton>
              <NeoButton
                variant="destructive"
                disabled={resettingTeam}
                onClick={() => void resetTeamSlot(resetConfirmTeam)}
              >
                {resettingTeam ? 'Resetting…' : 'Reset team'}
              </NeoButton>
            </div>
          </NeoCard>
        </div>
      ) : null}
    </FacilitatorPanelShell>
      <DemoOverlay enabled={event.status === 'demo'} />
    </>
  )
}
