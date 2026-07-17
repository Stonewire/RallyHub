
import { getCurrentAppOrigin } from '@/lib/app-origin'

export type EventLinkKey = 'facilitator' | 'display' | 'join'

export const EVENT_LINK_ORDER: EventLinkKey[] = ['facilitator', 'display', 'join']

export type EventLinks = Record<EventLinkKey, string>

export const EVENT_LINK_LABELS: Record<EventLinkKey, string> = {
  facilitator: 'Facilitator',
  display: 'Display',
  join: 'Teams',
}

/**
 * Shareable event links. When the client slug (org subdomain) and event slug are
 * known, produce the pretty slug URLs (/client/events/event/{facilitator|display|
 * teams}); otherwise fall back to the always-valid /surface/:eventId URLs so a
 * missing slug never yields a broken link/QR.
 */
export function getEventLinks(
  eventId: string,
  opts?: { clientSlug?: string | null; eventSlug?: string | null },
): EventLinks {
  const base = getCurrentAppOrigin()
  const c = opts?.clientSlug?.trim()
  const e = opts?.eventSlug?.trim()

  if (c && e) {
    return {
      facilitator: `${base}/${c}/events/${e}/facilitator`,
      display: `${base}/${c}/events/${e}/display`,
      join: `${base}/${c}/events/${e}/teams`,
    }
  }

  return {
    facilitator: `${base}/facilitator/${eventId}`,
    display: `${base}/display/${eventId}`,
    join: `${base}/join/${eventId}`,
  }
}

export function qrCodeUrl(link: string, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(link)}`
}

export async function downloadQrPng(link: string, filename: string) {
  const res = await fetch(qrCodeUrl(link, 400))
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text)
}

async function loadImageUrl(url: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Image load failed'))
  })
  return img
}

async function loadQrImage(link: string, size: number): Promise<HTMLImageElement> {
  return loadImageUrl(qrCodeUrl(link, size))
}

export type EventLinksPdfBranding = {
  eventName: string
  logoUrl?: string | null
  primaryColor?: string
  accentColor?: string
}

export async function downloadAllEventQrsPdf(
  links: EventLinks,
  branding: EventLinksPdfBranding,
) {
  const w = 1200
  const h = 1700
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const primary = branding.primaryColor ?? '#3E3D3E'
  const accent = branding.accentColor ?? '#FFC107'

  ctx.fillStyle = '#f8f8f8'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = primary
  ctx.fillRect(0, 0, w, 140)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 42px Montserrat, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(branding.eventName, w / 2, 88)

  if (branding.logoUrl) {
    try {
      const logo = await loadImageUrl(branding.logoUrl)
      const lw = 100
      const lh = (logo.height / logo.width) * lw
      ctx.drawImage(logo, w / 2 - lw / 2, 160, lw, Math.min(lh, 80))
    } catch {
      /* skip */
    }
  }

  const qrSize = 280
  const cols = 3
  const gap = (w - cols * qrSize) / (cols + 1)
  const yBase = branding.logoUrl ? 280 : 220

  for (let i = 0; i < EVENT_LINK_ORDER.length; i++) {
    const key = EVENT_LINK_ORDER[i]
    const x = gap + i * (qrSize + gap)
    const qr = await loadQrImage(links[key], 320)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - 12, yBase - 12, qrSize + 24, qrSize + 80)
    ctx.drawImage(qr, x, yBase, qrSize, qrSize)
    ctx.fillStyle = primary
    ctx.font = 'bold 22px Montserrat, sans-serif'
    ctx.fillText(EVENT_LINK_LABELS[key], x + qrSize / 2, yBase + qrSize + 36)
    ctx.fillStyle = accent
    ctx.font = '14px monospace'
    const short = links[key].length > 42 ? `${links[key].slice(0, 40)}…` : links[key]
    ctx.fillText(short, x + qrSize / 2, yBase + qrSize + 58)
  }

  ctx.strokeStyle = accent
  ctx.lineWidth = 4
  ctx.strokeRect(24, 24, w - 48, h - 48)

  const dataUrl = canvas.toDataURL('image/png')
  // ENG4: loaded on demand so jspdf stays out of the main bundle.
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [w, h],
  })
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h)
  pdf.save(`${branding.eventName.replace(/[^\w.-]+/g, '_')}-event-qr-codes.pdf`)
}
