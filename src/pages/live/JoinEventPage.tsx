import { MessageCircle, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useChatMessages, useLiveEvent } from '@/hooks/use-live-event'
import {
  PARTICIPANT_TEAM_KEY,
  bingoCardTitles,
  bingoTracks,
  brandColorsForEvent,
  currentStage,
  formatTimer,
  gamePointsLabel,
  logoForEvent,
  parseStages,
  quizQuestions,
} from '@/lib/live-event'
import { supabase } from '@/lib/supabase'
import { uploadAsset } from '@/lib/storage'
import type { Tables } from '@/types/helpers'
import type { GameConfig } from '@/types/game-config'

function teamKey(eventId: string) {
  return `${PARTICIPANT_TEAM_KEY}_${eventId}`
}

export function JoinEventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { bundle, loading, error, updateTeam } = useLiveEvent(eventId)
  const { messages, sendMessage } = useChatMessages(eventId)

  const [teamId, setTeamId] = useState<string | null>(() =>
    eventId ? localStorage.getItem(teamKey(eventId)) : null,
  )
  const [claimSlot, setClaimSlot] = useState<Tables<'teams'> | null>(null)
  const [claimName, setClaimName] = useState('')
  const [claimPhoto, setClaimPhoto] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatText, setChatText] = useState('')
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState<Tables<'games'> | null>(null)
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null)
  const [quizLocked, setQuizLocked] = useState(false)
  const [bingoPick, setBingoPick] = useState<number | null>(null)

  const stages = useMemo(
    () => (bundle ? parseStages(bundle.event.stages_config) : []),
    [bundle],
  )
  const stage = bundle ? currentStage(stages, bundle.state.current_stage_index) : null
  const myTeam = bundle?.teams.find((t) => t.id === teamId) ?? null

  useEffect(() => {
    if (!bundle?.state.announcement) return
    const t = bundle.state.announcement_target
    if (t === 'participants' || t === 'both') {
      setAnnouncement(bundle.state.announcement)
    }
  }, [bundle?.state.announcement, bundle?.state.updated_at])

  useEffect(() => {
    if (!quizAnswer || quizLocked) return
    const left = Math.min(5, bundle?.state.timer_seconds ?? 0)
    if (left <= 0) {
      setQuizLocked(true)
      return
    }
    const id = window.setTimeout(() => setQuizLocked(true), left * 1000)
    return () => window.clearTimeout(id)
  }, [quizAnswer, quizLocked, bundle?.state.timer_seconds])

  if (loading || !bundle) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {loading ? 'Loading…' : (error ?? 'Event not found')}
      </div>
    )
  }

  const { event, organization, state, teams, games, submissions } = bundle
  const logo = logoForEvent(event, organization)
  const colors = brandColorsForEvent(event, organization)

  async function claimTeam() {
    if (!claimSlot || !eventId) return
    setUploading(true)
    try {
      let photoUrl: string | null = null
      if (claimPhoto) {
        photoUrl = await uploadAsset(
          'game-assets',
          `${eventId}/teams/${claimSlot.id}/${Date.now()}`,
          claimPhoto,
        )
      }
      await updateTeam(claimSlot.id, {
        name: claimName.trim(),
        photo_url: photoUrl,
        status: 'active',
      })
      localStorage.setItem(teamKey(eventId), claimSlot.id)
      setTeamId(claimSlot.id)
      setClaimSlot(null)
    } finally {
      setUploading(false)
    }
  }

  async function submitMedia(game: Tables<'games'>, file: File, type: string) {
    if (!teamId || !eventId) return
    const url = await uploadAsset(
      'game-assets',
      `${eventId}/submissions/${teamId}/${Date.now()}`,
      file,
    )
    await supabase.from('submissions').insert({
      event_id: eventId,
      team_id: teamId,
      game_id: game.id,
      media_url: url,
      media_type: type,
      status: 'pending',
    })
    setSelectedGame(null)
  }

  async function submitQuizAnswer(answerId: string, gameId: string) {
    if (!teamId || !eventId || quizLocked) return
    setQuizAnswer(answerId)
    await supabase.from('submissions').insert({
      event_id: eventId,
      team_id: teamId,
      game_id: gameId,
      media_url: answerId,
      media_type: 'quiz',
      status: 'pending',
    })
  }

  async function submitBingo(square: number, gameId: string) {
    if (!teamId || !eventId) return
    setBingoPick(square)
    await supabase.from('submissions').insert({
      event_id: eventId,
      team_id: teamId,
      game_id: gameId,
      media_url: String(square),
      media_type: 'bingo',
      status: 'pending',
    })
  }

  if (!teamId || !myTeam) {
    return (
      <div className="bg-background min-h-screen p-4">
        {logo ? (
          <img src={logo} alt="" className="mx-auto mb-4 max-h-16 object-contain" />
        ) : null}
        <h1 className="mb-6 text-center text-2xl font-bold">{event.name}</h1>
        <div className="mx-auto grid max-w-lg gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              disabled={Boolean(team.name?.trim())}
              className="border-border flex flex-col items-center gap-2 rounded-xl border p-4 disabled:opacity-60"
              onClick={() => !team.name?.trim() && setClaimSlot(team)}
            >
              <div
                className="size-10 rounded-full"
                style={{ background: team.color ?? '#888' }}
              />
              {team.photo_url && team.name ? (
                <img src={team.photo_url} alt="" className="size-12 rounded-full object-cover" />
              ) : null}
              <span className="font-medium">
                {team.name?.trim() || 'Available'}
              </span>
            </button>
          ))}
        </div>
        {claimSlot ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Card className="w-full max-w-sm space-y-4 p-6">
              <h3 className="font-semibold">Join team {claimSlot.slot_number}</h3>
              <Input value={claimName} onChange={(e) => setClaimName(e.target.value)} placeholder="Team name" />
              <input type="file" accept="image/*" capture="environment" onChange={(e) => setClaimPhoto(e.target.files?.[0] ?? null)} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setClaimSlot(null)}>Cancel</Button>
                <Button disabled={uploading || !claimName.trim()} onClick={() => void claimTeam()}>
                  Join
                </Button>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    )
  }

  const mySubs = submissions.filter((s) => s.team_id === teamId)
  const openGameIds = stage?.type === 'open' ? (stage.gameIds ?? []) : []
  const openGames = games.filter((g) => openGameIds.includes(g.id))

  let main: ReactNode

  if (event.status === 'archived') {
    main = (
      <div className="space-y-4 p-4">
        <h2 className="text-xl font-bold">Game over</h2>
        <ul>
          {[...teams]
            .filter((t) => t.name)
            .sort((a, b) => b.score - a.score)
            .map((t, i) => (
              <li key={t.id} className="flex justify-between py-2">
                <span>
                  #{i + 1} {t.name}
                </span>
                <span>{t.score}</span>
              </li>
            ))}
        </ul>
      </div>
    )
  } else if (event.status !== 'active') {
    main = (
      <p className="p-8 text-center text-muted-foreground">
        The game will start soon…
      </p>
    )
  } else if (stage?.type === 'open') {
    if (selectedGame) {
      const done = mySubs.some(
        (s) => s.game_id === selectedGame.id && s.status !== 'rejected',
      )
      main = (
        <div className="space-y-4 p-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedGame(null)}>
            ← Back
          </Button>
          <h2 className="text-xl font-bold">{selectedGame.name}</h2>
          <p className="text-sm text-muted-foreground">{selectedGame.description}</p>
          {done ? (
            <p className="text-green-600">Submitted ✓</p>
          ) : selectedGame.type === 'photo' ? (
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void submitMedia(selectedGame, f, 'photo')
              }}
            />
          ) : selectedGame.type === 'video' ? (
            <input
              type="file"
              accept="video/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const max = (selectedGame.config as GameConfig)?.timer_seconds ?? 120
                const vid = document.createElement('video')
                vid.preload = 'metadata'
                vid.onloadedmetadata = () => {
                  if (vid.duration > max) {
                    window.alert(`Video must be ${max} seconds or less`)
                    return
                  }
                  void submitMedia(selectedGame, f, 'video')
                }
                vid.src = URL.createObjectURL(f)
              }}
            />
          ) : null}
        </div>
      )
    } else {
      main = (
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {openGames.map((g) => {
            const done = mySubs.some((s) => s.game_id === g.id && s.status === 'approved')
            return (
              <button
                key={g.id}
                type="button"
                className="border-border rounded-xl border p-3 text-left"
                onClick={() => setSelectedGame(g)}
              >
                {g.cover_url ? (
                  <img src={g.cover_url} alt="" className="mb-2 aspect-video w-full rounded object-cover" />
                ) : null}
                <p className="font-semibold">{g.name}</p>
                <p className="text-xs text-muted-foreground">{gamePointsLabel(g)}</p>
                {done ? <span className="text-xs text-green-600">Done ✓</span> : null}
              </button>
            )
          })}
        </div>
      )
    }
  } else if (stage?.type === 'quiz' && stage.gameId) {
    const game = games.find((g) => g.id === stage.gameId)
    const q = game ? quizQuestions(game)[state.current_question_index] : null
    const existing = mySubs.find(
      (s) => s.media_type === 'quiz' && s.game_id === stage.gameId,
    )
    if (state.quiz_state === 'revealed' && q && existing) {
      const ok = existing.media_url === q.correctAnswerId
      main = (
        <div className="space-y-4 p-4">
          <p className={ok ? 'text-green-600' : 'text-red-600'}>
            {ok ? 'Correct!' : 'Incorrect'}
          </p>
          <p className="text-sm">Score: {myTeam.score}</p>
        </div>
      )
    } else if (quizLocked || existing) {
      main = (
        <p className="p-8 text-center">Waiting for next question…</p>
      )
    } else if (q) {
      main = (
        <div className="space-y-4 p-4">
          <p className="text-lg font-semibold">{q.text}</p>
          <p className="font-mono text-sm">{formatTimer(state.timer_seconds)}</p>
          {q.answers.map((a) => (
            <Button
              key={a.id}
              className="h-auto w-full py-4 text-left"
              variant={quizAnswer === a.id ? 'secondary' : 'outline'}
              onClick={() => void submitQuizAnswer(a.id, stage.gameId!)}
            >
              {a.text}
            </Button>
          ))}
        </div>
      )
    }
  } else if (stage?.type === 'bingo' && stage.gameId) {
    const game = games.find((g) => g.id === stage.gameId)
    const tracks = game ? bingoTracks(game) : []
    const titles = teamId && game ? bingoCardTitles(teamId, tracks) : []
    const revealed = state.bingo_state === 'revealed'
    main = (
      <div className="grid grid-cols-5 gap-1 p-2">
        {titles.map((title, i) => {
          const sub = mySubs.find((s) => s.media_type === 'bingo' && s.media_url === String(i))
          let cls = 'bg-muted'
          if (revealed && sub) cls = sub.status === 'approved' ? 'bg-green-500/30' : 'bg-red-500/30'
          else if (revealed) cls = 'bg-muted/50'
          else if (bingoPick === i) cls = 'bg-primary/20'
          return (
            <button
              key={i}
              type="button"
              disabled={revealed}
              className={`aspect-square p-1 text-[9px] leading-tight ${cls}`}
              onClick={() => void submitBingo(i, stage.gameId!)}
            >
              {title}
            </button>
          )
        })}
      </div>
    )
  } else if (stage?.type === 'break') {
    main = (
      <div className="p-8 text-center">
        <p className="text-2xl font-bold">{stage.message}</p>
        <p className="mt-4 font-mono text-4xl">
          {formatTimer(state.break_timer_seconds ?? (stage.durationMinutes ?? 5) * 60)}
        </p>
      </div>
    )
  } else {
    main = <p className="p-8 text-center text-muted-foreground">Stand by…</p>
  }

  return (
    <div className="bg-background min-h-screen pb-20" style={{ ['--brand' as string]: colors[2] }}>
      <header
        className="sticky top-0 z-10 border-b px-4 py-3"
        style={{ background: `linear-gradient(180deg, ${colors[0]}22, transparent)` }}
      >
        {logo ? <img src={logo} alt="" className="mx-auto mb-2 max-h-10" /> : null}
        <h1 className="text-center text-lg font-bold">{event.name}</h1>
        <div className="mt-2 flex justify-between text-sm">
          <span>{myTeam.name}</span>
          <span className="font-bold tabular-nums">{myTeam.score} pts</span>
        </div>
      </header>
      {main}
      <Button
        className="fixed bottom-4 right-4 rounded-full shadow-lg"
        size="icon"
        onClick={() => setChatOpen(true)}
      >
        <MessageCircle className="size-5" />
      </Button>
      {chatOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b p-4">
            <span className="font-semibold">Chat</span>
            <Button variant="ghost" size="icon" onClick={() => setChatOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>
          <ul className="flex-1 overflow-auto p-4 space-y-2">
            {messages.map((m) => (
              <li key={m.id} className="text-sm">
                <span className="font-medium">{m.sender}: </span>
                {m.message}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 border-t p-4">
            <Input value={chatText} onChange={(e) => setChatText(e.target.value)} />
            <Button
              onClick={() => {
                void sendMessage(myTeam.name ?? 'Team', chatText, teamId)
                setChatText('')
              }}
            >
              Send
            </Button>
          </div>
        </div>
      ) : null}
      {announcement ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <Card className="max-w-md space-y-4 p-6 text-center">
            <p className="text-lg">{announcement}</p>
            <Button onClick={() => setAnnouncement(null)}>Dismiss</Button>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
