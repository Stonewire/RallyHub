import { createPortal } from 'react-dom'

import { IconClose } from '@/components/icons'
import { BrandBackground } from '@/components/live/BrandBackground'
import { NeoButton } from '@/components/neo-minimal'
import type { DisplayLayout, DisplayTextColor } from '@/lib/live-event'
import type { EventTeam } from '@/types/game-config'
import type { Tables } from '@/types/helpers'

type EventPreviewModalProps = {
  open: boolean
  onClose: () => void
  name: string
  logoUrl: string | null
  brandColors: [string, string, string]
  brandingEnabled: boolean
  displayLayout: DisplayLayout
  displayTextColor: DisplayTextColor
  teams: EventTeam[]
}

/**
 * What the room and the players will actually see.
 *
 * Renders the real BrandBackground rather than a flat CSS gradient, so the
 * moving blobs in the preview are the same ones production draws. The frames
 * are a mock of the surfaces, not the live screens: running live-event code
 * against an unsaved draft would need an event row that does not exist yet.
 */
export function EventPreviewModal({
  open,
  onClose,
  name,
  logoUrl,
  brandColors,
  brandingEnabled,
  displayLayout,
  displayTextColor,
  teams,
}: EventPreviewModalProps) {
  if (!open) return null

  // BrandBackground reads brand fields off an event row. Nothing is saved yet,
  // so the draft is handed over in the same shape.
  const draftEvent = {
    brand_primary_color: brandingEnabled ? brandColors[0] : null,
    brand_secondary_color: brandingEnabled ? brandColors[1] : null,
    brand_accent_color: brandingEnabled ? brandColors[2] : null,
    display_text_color: displayTextColor,
  } as unknown as Tables<'events'>

  const shown = teams.slice(0, 5)

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Event preview"
      className="fixed inset-0 z-80 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-4xl rounded-lg p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-foreground text-sm font-bold">Event preview</h2>
            <p className="text-muted-foreground text-xs">
              {displayLayout === 'orbit_view' ? 'Orbit' : 'Rank list'} display,{' '}
              {displayTextColor} text.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="hover:bg-muted rounded-nm-md flex size-[26px] items-center justify-center"
          >
            <IconClose className="size-3.5" />
          </button>
        </div>

        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="min-w-0 flex-1">
            <BrandBackground
              contained
              event={draftEvent}
              organization={null}
              className="aspect-video w-full overflow-hidden rounded-lg"
            >
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="max-h-14 max-w-40 object-contain" />
                ) : null}
                <p className="text-xl font-black tracking-tight drop-shadow">
                  {name || 'Untitled event'}
                </p>
                <div
                  className={
                    displayLayout === 'orbit_view'
                      ? 'flex flex-wrap items-center justify-center gap-2'
                      : 'w-full max-w-xs space-y-1'
                  }
                >
                  {shown.map((team, index) =>
                    displayLayout === 'orbit_view' ? (
                      <span
                        key={team.id}
                        className="flex size-9 items-center justify-center rounded-full text-[10px] font-bold text-white shadow"
                        style={{ backgroundColor: team.color }}
                      >
                        {(team.name || `T${index + 1}`).slice(0, 2).toUpperCase()}
                      </span>
                    ) : (
                      <div
                        key={team.id}
                        className="flex items-center gap-2 rounded-md bg-black/20 px-2 py-1 text-left text-xs backdrop-blur-sm"
                      >
                        <span className="w-3 text-[10px] font-bold opacity-70">{index + 1}</span>
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="min-w-0 flex-1 truncate font-semibold">
                          {team.name || `Team ${index + 1}`}
                        </span>
                        <span className="font-bold tabular-nums opacity-80">
                          {(5 - index) * 120}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </BrandBackground>
            <p className="text-muted-foreground mt-1.5 text-center text-[10px]">Host / TV</p>
          </div>

          <div className="w-40 shrink-0">
            <BrandBackground
              contained
              event={draftEvent}
              organization={null}
              className="aspect-9/16 w-full overflow-hidden rounded-lg"
            >
              <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="max-h-8 max-w-24 object-contain" />
                ) : null}
                <p className="text-sm font-black tracking-tight drop-shadow">
                  {name || 'Untitled event'}
                </p>
                <span
                  className="mt-1 rounded-full px-3 py-1 text-[10px] font-bold text-white shadow"
                  style={{ backgroundColor: shown[0]?.color ?? brandColors[0] }}
                >
                  {shown[0]?.name || 'Team 1'}
                </span>
                <p className="text-[10px] opacity-75">Waiting for the next game…</p>
              </div>
            </BrandBackground>
            <p className="text-muted-foreground mt-1.5 text-center text-[10px]">Player</p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <NeoButton type="button" variant="surface" onClick={onClose}>
            Close
          </NeoButton>
        </div>
      </div>
    </div>,
    document.body,
  )
}
