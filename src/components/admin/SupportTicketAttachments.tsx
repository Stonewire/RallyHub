import { IconAttachment } from '@/components/icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { signedAttachmentUrl } from '@/lib/storage'
import type { SupportTicketAttachment } from '@/types/database'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Attachments on a support ticket.
 *
 * The bucket is private, so there is no URL to render up front. Each link mints
 * a short-lived signed URL when it is clicked, which also means a link that sits
 * on screen for an hour cannot be copied out and shared as a permanent one.
 */
export function SupportTicketAttachments({
  attachments,
}: {
  attachments: SupportTicketAttachment[] | null | undefined
}) {
  const { t } = useTranslation('admin')
  const [error, setError] = useState<string | null>(null)

  if (!attachments?.length) return null

  async function open(attachment: SupportTicketAttachment) {
    setError(null)
    try {
      const url = await signedAttachmentUrl(attachment.path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError(t('support.attachmentOpenFailed'))
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        {t('support.attachments')}
      </p>
      <ul className="space-y-1">
        {attachments.map((attachment) => (
          <li key={attachment.path}>
            <button
              type="button"
              onClick={() => open(attachment)}
              className="text-foreground hover:text-nm-yellow flex items-center gap-1.5 text-xs underline-offset-2 hover:underline"
            >
              <IconAttachment className="size-3.5 shrink-0" />
              <span className="max-w-64 truncate">{attachment.name}</span>
              <span className="text-muted-foreground">{formatSize(attachment.size)}</span>
            </button>
          </li>
        ))}
      </ul>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
