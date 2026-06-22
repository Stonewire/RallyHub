import JSZip from 'jszip'

import { supabase } from '@/lib/supabase'

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

function extFromUrl(url: string, fallback: string): string {
  const path = url.split('?')[0] ?? ''
  const m = path.match(/\.([a-z0-9]+)$/i)
  return m?.[1] ?? fallback
}

function safe(name: string): string {
  return (name || 'item').replace(/[^\w.-]+/g, '_')
}

/** Minimal CSV from an array of flat objects. Keys are unioned across rows. */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const cols = Array.from(
    rows.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k))
      return set
    }, new Set()),
  )
  const cell = (v: unknown): string => {
    if (v == null) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = cols.join(',')
  const body = rows.map((r) => cols.map((c) => cell(r[c])).join(',')).join('\n')
  return `${header}\n${body}\n`
}

/**
 * Download a full data export for a client org: a CSV per table (org, events,
 * teams, submissions, games, invoices, support tickets, activity log) plus all
 * media (team photos, submission photos/videos, org logo) under media/.
 * #1 — lets a super-admin preserve everything before deleting the client.
 */
export async function downloadClientPackage(organizationId: string): Promise<void> {
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single()
  if (orgErr || !org) throw new Error('Client not found')

  const [eventsRes, gamesRes, invoicesRes, ticketsRes] = await Promise.all([
    supabase.from('events').select('*').eq('organization_id', organizationId),
    supabase.from('games').select('*').eq('organization_id', organizationId),
    supabase.from('invoices').select('*').eq('organization_id', organizationId),
    supabase.from('support_tickets').select('*').eq('organization_id', organizationId),
  ])

  const events = eventsRes.data ?? []
  const eventIds = events.map((e) => e.id)

  const [teamsRes, subsRes, logRes] = await Promise.all([
    eventIds.length
      ? supabase.from('teams').select('*').in('event_id', eventIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    eventIds.length
      ? supabase.from('submissions').select('*').in('event_id', eventIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    supabase
      .from('event_activity_log')
      .select('*')
      .eq('organization_id', organizationId),
  ])

  const teams = (teamsRes.data ?? []) as Record<string, unknown>[]
  const submissions = (subsRes.data ?? []) as Record<string, unknown>[]

  const zip = new JSZip()
  const data = zip.folder('data')!
  data.file('organization.csv', toCsv([org as Record<string, unknown>]))
  data.file('events.csv', toCsv(events as Record<string, unknown>[]))
  data.file('teams.csv', toCsv(teams))
  data.file('submissions.csv', toCsv(submissions))
  data.file('games.csv', toCsv((gamesRes.data ?? []) as Record<string, unknown>[]))
  data.file('invoices.csv', toCsv((invoicesRes.data ?? []) as Record<string, unknown>[]))
  data.file('support_tickets.csv', toCsv((ticketsRes.data ?? []) as Record<string, unknown>[]))
  data.file('activity_log.csv', toCsv((logRes.data ?? []) as Record<string, unknown>[]))

  const media = zip.folder('media')!
  const teamsFolder = media.folder('team-photos')!
  const subsFolder = media.folder('submissions')!

  if (org.logo_url) {
    const blob = await fetchBlob(org.logo_url)
    if (blob) media.file(`logo.${extFromUrl(org.logo_url, 'png')}`, blob)
  }

  for (const team of teams) {
    const photo = team.photo_url as string | null
    if (!photo) continue
    const blob = await fetchBlob(photo)
    if (blob) {
      teamsFolder.file(`${safe(String(team.name ?? team.id))}.${extFromUrl(photo, 'jpg')}`, blob)
    }
  }

  for (const sub of submissions) {
    const url = sub.media_url as string | null
    const mediaType = sub.media_type as string | null
    if (!url || (mediaType && mediaType.startsWith('quiz')) || url === 'claim') continue
    const blob = await fetchBlob(url)
    if (!blob) continue
    const ext = mediaType === 'video' ? extFromUrl(url, 'webm') : extFromUrl(url, 'jpg')
    subsFolder.file(`${safe(String(sub.id))}.${ext}`, blob)
  }

  const out = await zip.generateAsync({ type: 'blob' })
  const link = URL.createObjectURL(out)
  const a = document.createElement('a')
  a.href = link
  a.download = `${safe(org.name)}-data-export.zip`
  a.click()
  URL.revokeObjectURL(link)
}
