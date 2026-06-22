import JSZip from 'jszip'

import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

function extFromUrl(url: string, fallback: string) {
  const path = url.split('?')[0] ?? ''
  const m = path.match(/\.([a-z0-9]+)$/i)
  return m?.[1] ?? fallback
}

export async function downloadEventPackage(eventId: string): Promise<void> {
  const { data: event, error: eErr } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single()
  if (eErr || !event) throw new Error('Event not found')

  const [teamsRes, subsRes, egRes] = await Promise.all([
    supabase.from('teams').select('*').eq('event_id', eventId).order('slot_number'),
    supabase.from('submissions').select('*').eq('event_id', eventId),
    supabase.from('event_games').select('game_id').eq('event_id', eventId),
  ])

  if (teamsRes.error) throw teamsRes.error
  if (subsRes.error) throw subsRes.error
  if (egRes.error) throw egRes.error

  const teams = teamsRes.data ?? []
  const submissions = subsRes.data ?? []
  const gameIds = (egRes.data ?? []).map((r) => r.game_id)

  let games: Tables<'games'>[] = []
  if (gameIds.length > 0) {
    const { data, error } = await supabase.from('games').select('*').in('id', gameIds)
    if (error) throw error
    games = data ?? []
  }

  const zip = new JSZip()
  const mediaFolder = zip.folder('media')!
  const teamsFolder = zip.folder('teams')!

  for (const team of teams) {
    if (team.photo_url) {
      const blob = await fetchBlob(team.photo_url)
      if (blob) {
        teamsFolder.file(
          `${team.slot_number}-${(team.name ?? 'team').replace(/[^\w-]+/g, '_')}.${extFromUrl(team.photo_url, 'jpg')}`,
          blob,
        )
      }
    }
  }

  for (const sub of submissions) {
    if (!sub.media_url || sub.media_type?.startsWith('quiz')) continue
    const blob = await fetchBlob(sub.media_url)
    if (!blob) continue
    const team = teams.find((t) => t.id === sub.team_id)
    const game = games.find((g) => g.id === sub.game_id)
    const base = `${team?.name ?? sub.team_id}-${game?.name ?? sub.game_id}-${sub.status}`
    const ext =
      sub.media_type === 'video'
        ? extFromUrl(sub.media_url, 'webm')
        : extFromUrl(sub.media_url, 'jpg')
    mediaFolder.file(`${base.replace(/[^\w.-]+/g, '_')}.${ext}`, blob)
  }

  // The branded PDF report is deferred until we build the real one. For now the
  // package is photos + videos, plus quiz/bingo log data (which has no
  // downloadable media) so those results aren't lost.
  const hasQuizOrBingo = games.some(
    (g) => g.type === 'quiz' || g.type === 'music_bingo',
  )
  if (hasQuizOrBingo) {
    const { data: log } = await supabase
      .from('event_activity_log')
      .select('created_at, actor_type, actor_name, action, details')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    const ranking = [...teams]
      .filter((t) => t.name?.trim())
      .sort((a, b) => b.score - a.score)
      .map((t, i) => ({ rank: i + 1, team: t.name, score: t.score }))

    const results = submissions
      .filter((s) => {
        const g = games.find((gg) => gg.id === s.game_id)
        return g?.type === 'quiz' || g?.type === 'music_bingo'
      })
      .map((s) => {
        const g = games.find((gg) => gg.id === s.game_id)
        return {
          team: teams.find((t) => t.id === s.team_id)?.name ?? s.team_id,
          game: g?.name ?? s.game_id,
          type: g?.type,
          status: s.status,
          points: s.points_awarded ?? 0,
        }
      })

    zip.file(
      'quiz-bingo-log.json',
      JSON.stringify(
        {
          event: event.name,
          exported_at: new Date().toISOString(),
          ranking,
          quiz_bingo_results: results,
          activity_log: log ?? [],
        },
        null,
        2,
      ),
    )
  }

  const out = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(out)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.name.replace(/[^\w.-]+/g, '_')}-export.zip`
  a.click()
  URL.revokeObjectURL(url)
}
