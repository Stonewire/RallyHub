// Presentational modal/dialog components extracted from FacilitatorEventPage
// (ENG1). Each is a leaf: it renders markup and calls back into the page, which
// still owns all state and handlers. No behaviour change.
import { EventActivityLog } from '@/components/admin/EventActivityLog'
import { NeoButton, NeoCard } from '@/components/neo-minimal'
import { Input } from '@/components/ui/input'
import { downscalePhoto } from '@/lib/challenge-camera'
import type { Tables } from '@/types/helpers'

export function TeamClaimModal({
  slot,
  name,
  onNameChange,
  onPhotoChange,
  onColorChange,
  uploading,
  onCancel,
  onSave,
}: {
  slot: Tables<'teams'> | null
  name: string
  onNameChange: (value: string) => void
  onPhotoChange: (file: File | null) => void
  onColorChange: (color: string) => void
  uploading: boolean
  onCancel: () => void
  onSave: () => void
}) {
  if (!slot) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <NeoCard className="max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto p-6 shadow-lg">
        <h3 className="font-semibold">Team slot {slot.slot_number}</h3>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Team name"
          className="bg-background"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) {
              onPhotoChange(null)
              return
            }
            void downscalePhoto(f).then((blob) =>
              onPhotoChange(new File([blob], f.name, { type: blob.type || f.type })),
            )
          }}
        />
        <input
          type="color"
          value={slot.color ?? '#888888'}
          onChange={(e) => onColorChange(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <NeoButton variant="surface" onClick={onCancel}>
            Cancel
          </NeoButton>
          <NeoButton variant="primary" disabled={uploading} onClick={onSave}>
            Save
          </NeoButton>
        </div>
      </NeoCard>
    </div>
  )
}

export function ResetTeamModal({
  team,
  resetting,
  onCancel,
  onConfirm,
}: {
  team: Tables<'teams'> | null
  resetting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!team) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="reset-team-title"
    >
      <NeoCard className="w-full max-w-md space-y-4 p-6 shadow-lg">
        <h3 id="reset-team-title" className="font-semibold">
          Reset team slot {team.slot_number}?
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Clears{' '}
          <span className="text-foreground font-medium">
            {team.name?.trim() || 'this team'}
          </span>
          , removes their photo, and sets score to 0. The slot becomes available for someone
          new to join.
        </p>
        <div className="flex justify-end gap-2">
          <NeoButton variant="surface" disabled={resetting} onClick={onCancel}>
            Cancel
          </NeoButton>
          <NeoButton variant="destructive" disabled={resetting} onClick={onConfirm}>
            {resetting ? 'Resetting…' : 'Reset team'}
          </NeoButton>
        </div>
      </NeoCard>
    </div>
  )
}

export function EventLogModal({
  open,
  eventId,
  onClose,
}: {
  open: boolean
  eventId: string | undefined
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <NeoCard
        className="max-h-[85dvh] w-full max-w-2xl space-y-4 overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Event log</h3>
          <NeoButton variant="surface" onClick={onClose}>
            Close
          </NeoButton>
        </div>
        {eventId ? <EventActivityLog eventId={eventId} /> : null}
      </NeoCard>
    </div>
  )
}
