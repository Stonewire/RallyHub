import { Check, MessageCircle, Pause, Play, Plus, Minus, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { FacilitatorButton, FacilitatorButtonLarge } from '@/components/admin/FacilitatorButton'
import { BingoClipPlayer } from '@/components/live/BingoClipPlayer'
import { DisplayPreviewFrame } from '@/components/live/DisplayPreviewFrame'
import {
  FacilitatorChatBubble,
  FacilitatorChatDrawer,
  useFacilitatorChatUnread,
} from '@/components/live/FacilitatorChatDrawer'
import { SubmissionDetailModal } from '@/components/live/SubmissionDetailModal'
import { LivePanelShell } from '@/components/layout/LivePanelShell'
import { useNotification } from '@/contexts/notification-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { useBingoRun } from '@/hooks/use-bingo-run'
import { useLiveTimer } from '@/hooks/use-live-timer'
import { useChatMessages, useFacilitatorPresence, useLiveEvent } from '@/hooks/use-live-event'
import { activateBingoRun } from '@/lib/activate-bingo-run'
import { bingoTrackPlaybackUrl } from '@/lib/bingo-playback'
import { scoreBingoBonusRound } from '@/lib/bingo-bonus-scoring'
import {
  bingoPrimaryAction,
  bingoSongProgress,
  parseBingoGameConfig,
} from '@/lib/bingo-facilitator'
import { advanceBingoTrack } from '@/lib/bingo-round-advance'
import { restartBingoRun } from '@/lib/restart-bingo-run'
import { scoreBingoRound } from '@/lib/bingo-scoring'
import {
  FACILITATOR_NAME_KEY,
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
} from '@/lib/live-event'
import { getEventLinks } from '@/lib/event-links'
import { createThrottledTimerSync } from '@/lib/live-timer-sync'
import type { GameConfig } from '@/types/game-config'
import { supabase } from '@/lib/supabase'
import { uploadAsset } from '@/lib/storage'
import type { Tables } from '@/types/helpers'

const ANNOUNCEMENT_MS = 60_000

export function FacilitatorEventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [name, setName] = useState(() => localStorage.getItem(FACILITATOR_NAME_KEY) ?? '')
  const [namePrompt, setNamePrompt] = useState(!localStorage.getItem(FACILITATOR_NAME_KEY))
  const { bundle, loading, error, updateState, updateTeam, resetEvent } =
    useLiveEvent(eventId)
  const { messages, sendMessage } = useChatMessages(eventId)
  const others = useFacilitatorPresence(eventId, name || null)
  const annClearRef = useRef<number | undefined>(undefined)

  const [announcement, setAnnouncement] = useState('')
  const [claimSlot, setClaimSlot] = useState<Tables<'teams'> | null>(null)
  const [claimName, setClaimName] = useState('')
  const [claimPhoto, setClaimPhoto] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [subTab, setSubTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [stateError, setStateError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [selectedSub, setSelectedSub] = useState<Tables<'submissions'> | null>(null)
  const [breakHalted, setBreakHalted] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatTeamId, setChatTeamId] = useState<string | null>(null)
  const [audioPlayNonce, setAudioPlayNonce] = useState(0)
  const bingoStateRef = useRef('waiting')
  const { notify } = useNotification()
  const chatUnread = useFacilitatorChatUnread(messages, chatOpen)

  const stages = useMemo(
    () => (bundle ? parseStages(bundle.event.stages_config) : []),
    [bundle],
  )
  const stage = bundle ? currentStage(stages, bundle.state.current_stage_index) : null
  const state = bundle?.state

  const isQuizStage = stage?.type === 'quiz'

  const bingoRunQuery = useBingoRun(
    eventId,
    stage?.type === 'bingo' ? bundle?.state.current_stage_index : undefined,
  )

  async function patchState(patch: Parameters<typeof updateState>[0]) {
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
      void activateBingoRun(eventId, next.gameId, index).catch((err) => {
        setStateError(err instanceof Error ? err.message : 'Could not start bingo')
      })
      patch.bingo_state = 'waiting'
      patch.current_question_index = 0
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

  const timerDisplay = useLiveTimer(
    state?.timer_seconds ?? 0,
    Boolean(state?.timer_running),
    (next, stillRunning) => timerSyncRef.current(next, stillRunning),
  )

  const quizTimerDisplay = useLiveTimer(
    state ? quizTimerSeconds(state) : 0,
    state ? quizTimerRunning(state) : false,
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
    const timerDone = quizTimerRunning(state) && quizTimerDisplay <= 0
    if (!timerDone && !allAnswered) return

    const key = `${state.current_stage_index}-${state.current_question_index}-reveal`
    if (quizAutoRevealKey.current === key) return
    quizAutoRevealKey.current = key

    void (async () => {
      try {
        await scoreCurrentQuizQuestion(
          quizGame,
          question,
          bundle.submissions,
          bundle.teams,
          updateTeam,
        )
        await updateState({ quiz_timer_running: false, quiz_state: 'revealed' })
      } catch {
        quizAutoRevealKey.current = ''
      }
    })()
  }, [bundle, state, quizTimerDisplay, updateTeam, updateState])

  const breakSeconds =
    stage?.type === 'break'
      ? breakDurationSeconds(stage, state?.break_timer_seconds)
      : (state?.break_timer_seconds ?? 0)

  const breakDisplay = useLiveTimer(
    breakSeconds,
    Boolean(state?.break_timer_running),
    (next, stillRunning) => breakSyncRef.current(next, stillRunning),
  )

  if (namePrompt) {
    return (
      <LivePanelShell title="Facilitator" titleCentered>
        <Card className="border-border/80 mx-auto w-full max-w-sm space-y-4 bg-card p-6 shadow-sm">
          <Label htmlFor="facilitator-name">Your name</Label>
          <Input
            id="facilitator-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-background"
          />
          <Button
            disabled={!name.trim()}
            onClick={() => {
              localStorage.setItem(FACILITATOR_NAME_KEY, name.trim())
              setNamePrompt(false)
            }}
          >
            Continue
          </Button>
        </Card>
      </LivePanelShell>
    )
  }

  if (loading || !bundle || !state) {
    return (
      <LivePanelShell title="Facilitator" titleCentered>
        <p className="text-muted-foreground text-center text-sm">
          {loading ? 'Loading…' : (error ?? 'Event not found')}
        </p>
      </LivePanelShell>
    )
  }

  const { event, organization, teams, games, submissions } = bundle
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
    await supabase
      .from('submissions')
      .update({ status: 'approved', points_awarded: points })
      .eq('id', sub.id)
    const team = teams.find((t) => t.id === sub.team_id)
    if (team) {
      await updateTeam(sub.team_id, { score: team.score + points })
    }
    notify(`Approved +${points} pts`)
  }

  async function rejectSubmission(id: string) {
    await supabase.from('submissions').update({ status: 'rejected' }).eq('id', id)
    notify('Submission rejected')
  }

  async function handleResetEvent() {
    const ok = window.confirm(
      'Reset this event?\n\n' +
        'All scores and submissions will be deleted. Team slots will be empty again ' +
        '(anyone can claim a spot). Stages and games stay the same.\n\n' +
        'This cannot be undone.',
    )
    if (!ok) return
    setResetting(true)
    setStateError(null)
    try {
      await resetEvent()
      notify('Event reset')
    } catch (err) {
      setStateError(err instanceof Error ? err.message : 'Reset failed')
      notify('Event reset failed')
    } finally {
      setResetting(false)
    }
  }

  async function saveClaim() {
    if (!claimSlot) return
    setUploading(true)
    try {
      let photoUrl: string | null = claimSlot.photo_url
      if (claimPhoto && eventId) {
        photoUrl = await uploadAsset(
          'game-assets',
          `${eventId}/teams/${claimSlot.id}/${Date.now()}`,
          claimPhoto,
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
    if (!quizGame || !question) return
    await scoreCurrentQuizQuestion(
      quizGame,
      question,
      submissions,
      teams,
      updateTeam,
    )
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
    }
    quizAutoRevealKey.current = ''
    const next = liveState.current_question_index + 1
    if (next >= questions.length) {
      await patchState({ quiz_state: 'results', quiz_timer_running: false })
      return
    }
    startQuizQuestion(next)
  }

  async function restartQuiz() {
    if (!stage?.gameId) return
    const quizSubs = submissions.filter(
      (s) => s.game_id === stage.gameId && isQuizSubmission(s.media_type),
    )
    for (const sub of quizSubs) {
      const pts = sub.points_awarded ?? 0
      if (pts > 0 && sub.status === 'approved') {
        const team = teams.find((t) => t.id === sub.team_id)
        if (team) {
          await updateTeam(sub.team_id, {
            score: Math.max(0, team.score - pts),
          })
        }
      }
      await supabase.from('submissions').delete().eq('id', sub.id)
    }
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
  const tracks = bingoGame ? bingoTracks(bingoGame) : []
  const bingoPlayOrder = bingoRunQuery.data?.playOrder ?? []
  const bingoPlayIndex = liveState.current_question_index
  const playTrackId = bingoPlayOrder[bingoPlayIndex]
  const track = playTrackId
    ? tracks.find((t) => t.id === playTrackId) ?? tracks[bingoPlayIndex]
    : tracks[bingoPlayIndex]
  const bingoGameId = stage?.type === 'bingo' ? stage.gameId : undefined
  const bingoConfig = bingoGame ? parseBingoGameConfig(bingoGame.config) : {}
  bingoStateRef.current = liveState.bingo_state

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

  async function revealCurrentBingoSong() {
    if (!stage?.gameId || !eventId || !bingoRunQuery.data) return
    const trackId = bingoPlayOrder[bingoPlayIndex]
    if (!trackId) {
      await patchState({ bingo_state: 'revealed' })
      return
    }
    await scoreBingoRound({
      eventId,
      gameId: stage.gameId,
      runId: bingoRunQuery.data.id,
      trackId,
      gameConfig: bingoConfig,
    })
    await patchState({ bingo_state: 'revealed' })
  }

  async function playCurrentBingoSong() {
    await patchState({ bingo_state: 'playing' })
    setAudioPlayNonce((n) => n + 1)
  }

  async function nextBingoSong() {
    if (!stage?.gameId || !eventId) return
    const nextIndex = await advanceBingoTrack({
      eventId,
      gameId: stage.gameId,
      runId: bingoRunQuery.data?.id,
      playOrder: bingoPlayOrder,
      currentIndex: bingoPlayIndex,
      scoreCurrent: false,
    })
    await patchState({
      current_question_index: nextIndex,
      bingo_state: 'playing',
    })
    setAudioPlayNonce((n) => n + 1)
  }

  const songsStarted =
    bingoPlayIndex > 0 ||
    liveState.bingo_state === 'playing' ||
    liveState.bingo_state === 'revealed'

  const bingoPrimary = bingoPrimaryAction({
    bingoState: liveState.bingo_state,
    playIndex: bingoPlayIndex,
    playOrderLength: bingoPlayOrder.length,
    songsStarted,
  })

  async function runBingoPrimary() {
    if (!bingoPrimary) return
    if (bingoPrimary.action === 'play') await playCurrentBingoSong()
    else if (bingoPrimary.action === 'reveal') await revealCurrentBingoSong()
    else if (bingoPrimary.action === 'next') await nextBingoSong()
    else if (bingoPrimary.action === 'end') {
      await patchState({ bingo_state: 'ended' })
      notify('Bingo round complete')
    }
  }

  return (
    <LivePanelShell
      title={event.name}
      titleCentered
      subtitle={
        others.length > 0 ? (
          <span>Also viewing: {others.map((o) => o.name).join(', ')}</span>
        ) : undefined
      }
    >
      <div className="mb-4 flex justify-center">
        <StatusIndicator
          status={event.status as 'active' | 'ready' | 'draft' | 'archived'}
        />
        <span className="text-muted-foreground ml-2 text-sm capitalize">
          {event.status}
        </span>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="border-border/80 overflow-hidden bg-card shadow-sm">
            <DisplayPreviewFrame displayUrl={displayUrl} />
          </Card>

          <Card className="border-border/80 grid gap-4 bg-card p-4 shadow-sm sm:grid-cols-2">
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

          <Card className="border-border/80 bg-card p-4 shadow-sm">
            <p className="mb-2 text-sm font-medium">Stages</p>
            <div className="flex flex-wrap gap-2">
              {stages.map((s, i) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant={state.current_stage_index === i ? 'secondary' : 'outline'}
                  onClick={() => selectStage(i)}
                >
                  Stage {i + 1}
                </Button>
              ))}
            </div>
          </Card>

          <label className="flex items-center gap-2 px-1 text-sm">
            <input
              type="checkbox"
              checked={state.show_scores}
              onChange={(e) => void patchState({ show_scores: e.target.checked })}
            />
            Show scores on display
          </label>

          <Card className="border-border/80 space-y-3 bg-card p-4 shadow-sm">
            <Label>Announcement</Label>
            <p className="text-muted-foreground text-xs">
              Send a message to the display, participants, or both. Clears after 1 minute.
            </p>
            <Input
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
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void clearAnnouncement()}
                >
                  <X className="size-4" />
                  Clear
                </Button>
              </div>
            ) : null}
          </Card>

          <Card className="border-border/80 max-h-[40vh] space-y-3 overflow-auto bg-card p-4 shadow-sm">
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

          <Card className="border-destructive/40 bg-card space-y-3 p-4 shadow-sm">
            <p className="text-sm font-medium">Reset event</p>
            <p className="text-muted-foreground text-xs">
              Clear all scores, submissions, and team claims. Stages and games are kept.
              Teams can claim slots and play challenges again from scratch.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
              disabled={resetting}
              onClick={() => void handleResetEvent()}
            >
              <RotateCcw className="size-4" />
              {resetting ? 'Resetting…' : 'Reset event'}
            </Button>
          </Card>
        </div>

        <Card className="border-border/80 bg-card p-4 shadow-sm">
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
                      (s.media_type === 'photo' || s.media_type === 'video') &&
                      s.status !== 'cancelled',
                  )
                  .map((sub) => {
                    const team = teams.find((t) => t.id === sub.team_id)
                    const game = games.find((g) => g.id === sub.game_id)
                    return (
                      <li key={sub.id}>
                        <button
                          type="button"
                          className="border-border/80 hover:bg-muted/30 flex w-full gap-3 rounded-lg border p-2 text-left transition-colors"
                          onClick={() => setSelectedSub(sub)}
                        >
                          {sub.media_url ? (
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
                            <p className="text-muted-foreground text-xs capitalize">
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
                    {a.id === question.correctAnswerId ? (
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
                {bingoRunQuery.data
                  ? `Run active · ${bingoRunQuery.data.playOrder.length} songs in script`
                  : 'No bingo run — switch to this stage to activate'}
              </p>
              <p className="text-muted-foreground text-sm font-medium tabular-nums">
                {bingoSongProgress(bingoPlayIndex, bingoPlayOrder.length)}
              </p>
              {liveState.bingo_state === 'revealed' && track ? (
                <p className="font-semibold">
                  {track.title} — {track.artist}
                </p>
              ) : liveState.bingo_state === 'playing' ? (
                <p className="text-muted-foreground text-sm">Clip playing — title hidden on display</p>
              ) : null}
              {track && liveState.bingo_state === 'playing' ? (
                <BingoClipPlayer
                  src={bingoTrackPlaybackUrl(track)}
                  playKey={`${track.id}-${bingoPlayIndex}-${audioPlayNonce}`}
                  autoPlay
                  onEnded={() => {
                    if (bingoStateRef.current === 'playing') {
                      void revealCurrentBingoSong()
                    }
                  }}
                />
              ) : null}
              {liveState.bingo_state !== 'bonus' &&
              liveState.bingo_state !== 'bonus_revealed' &&
              bingoPrimary ? (
                <FacilitatorButton
                  size="sm"
                  disabled={!track && bingoPrimary.action === 'play'}
                  onClick={() => void runBingoPrimary()}
                >
                  {bingoPrimary.label}
                </FacilitatorButton>
              ) : null}
              {bingoMarkedTeams.length > 0 ? (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs">Marked this round</p>
                  <ul className="text-sm">
                    {bingoMarkedTeams.map((n) => (
                      <li key={n}>{n}</li>
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
                  void restartBingoRun(eventId, stage.gameId, liveState.current_stage_index)
                    .then(() => {
                      notify('Bingo run restarted')
                      void patchState({
                        current_question_index: 0,
                        bingo_state: 'waiting',
                        bingo_bonus_id: null,
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
      </div>

      <FacilitatorChatBubble
        unreadCount={chatUnread}
        onClick={() => {
          setChatOpen(true)
          if (!chatTeamId) {
            const latest = [...messages].reverse().find((m) => m.team_id)
            if (latest?.team_id) setChatTeamId(latest.team_id)
          }
        }}
      />
      <FacilitatorChatDrawer
        open={chatOpen}
        onOpenChange={setChatOpen}
        activeTeamId={chatTeamId}
        onActiveTeamIdChange={setChatTeamId}
        messages={messages}
        teams={teams}
        onSend={async (text, teamId) => {
          await sendMessage(name, text, teamId)
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
          <Card className="border-border/80 w-full max-w-md space-y-4 bg-card p-6 shadow-lg">
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
              <Button variant="outline" onClick={() => setClaimSlot(null)}>
                Cancel
              </Button>
              <Button disabled={uploading} onClick={() => void saveClaim()}>
                Save
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </LivePanelShell>
  )
}
