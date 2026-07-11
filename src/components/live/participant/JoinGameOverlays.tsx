// Presentational overlays extracted from JoinGameView (ENG2). Each is a leaf:
// it renders markup and calls back into JoinGameView, which still owns all
// state and handlers. No behaviour change.
import type { FormEvent } from 'react'
import { X } from 'lucide-react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Tables } from '@/types/helpers'

export function ParticipantChatOverlay({
  open,
  messages,
  accent,
  text,
  onTextChange,
  onSend,
  onClose,
}: {
  open: boolean
  messages: Tables<'chat_messages'>[]
  accent: string
  text: string
  onTextChange: (value: string) => void
  onSend: () => void
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/15 p-4 text-white">
        <span className="font-semibold">Chat with facilitator</span>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>
      <ul className="flex-1 space-y-2 overflow-auto p-4 text-white">
        {messages.map((m) => (
          <li key={m.id} className="text-sm">
            <span className="font-medium" style={{ color: accent }}>
              {m.sender}:{' '}
            </span>
            {m.message}
          </li>
        ))}
      </ul>
      <div className="flex gap-2 border-t border-white/15 p-4">
        <input
          className="xp-field flex-1 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-base text-white placeholder:text-white/50"
          placeholder="Message…"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
        />
        <LiveAccentButton accentColor={accent} onClick={onSend}>
          Send
        </LiveAccentButton>
      </div>
    </div>
  )
}

export function ParticipantAnnouncementOverlay({
  announcement,
  accent,
  onDismiss,
}: {
  announcement: string | null | undefined
  accent: string
  onDismiss: () => void
}) {
  if (!announcement) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6">
      <Card className="xp-card max-w-md space-y-4 p-6 text-center">
        <p className="text-lg">{announcement}</p>
        <LiveAccentButton accentColor={accent} onClick={onDismiss}>
          Dismiss
        </LiveAccentButton>
      </Card>
    </div>
  )
}

export function ParticipantExitDialog({
  open,
  mode,
  passwordValue,
  onPasswordChange,
  error,
  verifying,
  accent,
  onCancel,
  onSubmit,
}: {
  open: boolean
  mode: 'team' | 'tablet'
  passwordValue: string
  onPasswordChange: (value: string) => void
  error: string | null
  verifying: boolean
  accent: string
  onCancel: () => void
  onSubmit: (e: FormEvent) => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-dialog-title"
    >
      <Card className="w-full max-w-sm space-y-4 bg-card p-6 shadow-lg">
        <h3 id="exit-dialog-title" className="font-semibold">
          {mode === 'tablet' ? 'Return to events' : 'Leave team'}
        </h3>
        <p className="text-muted-foreground text-sm">
          Enter the tablet password to continue.
        </p>
        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            type="password"
            autoComplete="current-password"
            className="xp-field w-full rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-base text-white placeholder:text-white/50"
            placeholder="Password"
            value={passwordValue}
            onChange={(e) => onPasswordChange(e.target.value)}
            autoFocus
          />
          {error ? (
            <p className="text-destructive text-sm" role="alert">{error}</p>
          ) : null}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white hover:bg-white/10"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={verifying || !passwordValue.trim()}
              style={{ backgroundColor: accent, color: 'white' }}
            >
              {verifying ? 'Checking…' : 'Continue'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
