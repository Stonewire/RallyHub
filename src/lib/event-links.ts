export type EventLinkKey = 'facilitator' | 'display' | 'join'

export type EventLinks = Record<EventLinkKey, string>

export const EVENT_LINK_LABELS: Record<EventLinkKey, string> = {
  facilitator: 'Facilitator',
  display: 'Display',
  join: 'Join',
}

export function getEventLinks(eventId: string): EventLinks {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
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
