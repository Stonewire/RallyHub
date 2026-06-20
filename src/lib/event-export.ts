import JSZip from 'jszip'
import { jsPDF } from 'jspdf'

import { brandColorsForEvent, logoForEvent } from '@/lib/live-event'
import { fetchOrganizationTenantPublic } from '@/lib/organization-tenant'
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

  const org = await fetchOrganizationTenantPublic(event.organization_id)

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

  const [primary, secondary, accent] = brandColorsForEvent(event, org)
  const ranked = [...teams]
    .filter((t) => t.name?.trim())
    .sort((a, b) => b.score - a.score)

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 48
  let y = margin

  pdf.setFillColor(primary)
  pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), 72, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(22)
  pdf.text(event.name, margin, 48)

  y = 96
  pdf.setTextColor(40, 40, 40)
  pdf.setFontSize(11)
  pdf.text(`Event summary · ${new Date().toLocaleString()}`, margin, y)
  y += 28

  pdf.setFontSize(14)
  pdf.setTextColor(accent === '#FFC107' ? 120 : 0, 80, 80)
  pdf.text('Final ranking', margin, y)
  y += 20
  pdf.setFontSize(11)
  pdf.setTextColor(50, 50, 50)

  ranked.forEach((team, i) => {
    if (y > pdf.internal.pageSize.getHeight() - 60) {
      pdf.addPage()
      y = margin
    }
    pdf.text(`${i + 1}. ${team.name} — ${team.score} points`, margin, y)
    y += 16
  })

  y += 16
  pdf.setFontSize(14)
  pdf.setTextColor(60, 60, 60)
  pdf.text('Team breakdown', margin, y)
  y += 22

  for (const team of ranked) {
    if (y > pdf.internal.pageSize.getHeight() - 80) {
      pdf.addPage()
      y = margin
    }
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text(`${team.name} (${team.score} pts)`, margin, y)
    y += 16
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)

    const teamSubs = submissions.filter(
      (s) => s.team_id === team.id && s.status === 'approved',
    )
    if (teamSubs.length === 0) {
      pdf.text('No approved challenge submissions.', margin + 8, y)
      y += 14
    } else {
      for (const sub of teamSubs) {
        const game = games.find((g) => g.id === sub.game_id)
        const pts = sub.points_awarded ?? 0
        pdf.text(
          `• ${game?.name ?? 'Challenge'}: +${pts} pts (${sub.media_type ?? 'media'})`,
          margin + 8,
          y,
        )
        y += 14
      }
    }
    y += 10
  }

  pdf.setFontSize(9)
  pdf.setTextColor(120, 120, 120)
  pdf.text(
    `Branding: primary ${primary}, secondary ${secondary}, accent ${accent}`,
    margin,
    pdf.internal.pageSize.getHeight() - 32,
  )

  const logo = logoForEvent(event, org)
  if (logo) {
    try {
      const logoBlob = await fetchBlob(logo)
      if (logoBlob) {
        const reader = new FileReader()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = reject
          reader.readAsDataURL(logoBlob)
        })
        pdf.addImage(dataUrl, 'PNG', pdf.internal.pageSize.getWidth() - 100, 16, 56, 40)
      }
    } catch {
      /* optional logo */
    }
  }

  zip.file('event-summary.pdf', pdf.output('blob'))

  const out = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(out)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.name.replace(/[^\w.-]+/g, '_')}-export.zip`
  a.click()
  URL.revokeObjectURL(url)
}
