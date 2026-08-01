import { IconEye } from '@/components/icons'
import type { Dispatch, SetStateAction } from 'react'

import { AssetField } from '@/components/games/AssetField'
import { BrandColourPicker } from '@/components/admin/BrandColourPicker'
import { FlipSwitch, NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import type { GameConfig } from '@/types/game-config'

const COLOUR_FIELDS = [
  { key: 'primary_color', label: 'Primary' },
  { key: 'secondary_color', label: 'Secondary' },
  { key: 'accent_color', label: 'Accent' },
] as const

const DEFAULT_COLOURS: Record<(typeof COLOUR_FIELDS)[number]['key'], string> = {
  primary_color: '#3e3d3e',
  secondary_color: '#6f6f6f',
  accent_color: '#ffc107',
}

type BackgroundDesignerProps = {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
  /** Uploads a background file and returns its public URL. */
  onUploadBackground: (file: File) => Promise<string>
  /** Game name, shown in the live preview. */
  gameName: string
  /** Opens the full preview modal. */
  onOpenPreview?: () => void
  /** Second line in the preview, e.g. a sample question. */
  previewSubtitle?: string
}

/**
 * The design's Background Designer: an Image vs Colours switch, the matching
 * controls, and a live 16:9 plus 9:16 preview of what players and the room
 * will actually see.
 *
 * The design shows four colour swatches; the config carries three
 * (primary/secondary/accent) and nothing consumes a fourth, so a fourth is not
 * invented here. Logged in the work plan.
 */
export function BackgroundDesigner({
  config,
  setConfig,
  onUploadBackground,
  gameName,
  onOpenPreview,
  previewSubtitle,
}: BackgroundDesignerProps) {
  // Stored, with the old derivation as the fallback so games saved before
  // background_mode existed keep the appearance they already had.
  const usingImage = config.background_mode
    ? config.background_mode === 'image'
    : Boolean(config.background_url)

  const colours = COLOUR_FIELDS.map(({ key, label }) => ({
    key,
    label,
    value: config[key] ?? DEFAULT_COLOURS[key],
  }))

  const previewStyle = usingImage
    ? {
        backgroundImage: `url(${config.background_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        backgroundImage: `linear-gradient(135deg, ${colours[1].value}, ${colours[0].value})`,
      }

  const title = gameName.trim() || 'Untitled game'

  return (
    <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-foreground text-sm font-bold">Background Designer</h3>
        <FlipSwitch
          offValue="image"
          onValue="colours"
          offLabel="Image"
          onLabel="Colours"
          value={usingImage ? 'image' : 'colours'}
          onChange={(next) =>
            // The upload survives the switch, so the organiser can compare the
            // two and settle on one without having to re-upload the image.
            setConfig((c) => ({ ...c, background_mode: next }))
          }
        />
      </div>

      {usingImage ? (
        <AssetField
          label="Background image"
          preview={config.background_url ?? null}
          onFile={async (file) => {
            if (!file) return
            const url = await onUploadBackground(file)
            setConfig((c) => ({ ...c, background_url: url, background_mode: 'image' }))
          }}
          onUrl={(url) =>
            setConfig((c) => ({ ...c, background_url: url, background_mode: 'image' }))
          }
        />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {colours.map(({ key, label, value }) => (
            <BrandColourPicker
              key={key}
              id={`bg-${key}`}
              label={label}
              value={value}
              onChange={(hex) => setConfig((c) => ({ ...c, [key]: hex }))}
            />
          ))}
        </div>
      )}

      <div>
        <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
          Live preview
        </p>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div
              className="flex aspect-video items-center justify-center rounded-md p-3 text-center"
              style={previewStyle}
            >
              <div>
                <p className="text-sm font-bold text-white drop-shadow">{title}</p>
                {previewSubtitle ? (
                  <p className="text-[11px] text-white/90 drop-shadow">{previewSubtitle}</p>
                ) : null}
              </div>
            </div>
            <p className="text-muted-foreground mt-1 text-center text-[10px]">Host / TV</p>
          </div>
          <div className="w-20 shrink-0">
            <div
              className="flex aspect-9/16 items-center justify-center rounded-md p-2 text-center"
              style={previewStyle}
            >
              <p className="text-[9px] font-bold text-white drop-shadow">{title}</p>
            </div>
            <p className="text-muted-foreground mt-1 text-center text-[10px]">Player</p>
          </div>
        </div>
      </div>

      {onOpenPreview ? (
        <NeoButton
          type="button"
          variant="surface"
          size="sm"
          className="w-full"
          onClick={onOpenPreview}
        >
          <IconEye className="size-3.5" aria-hidden />
          Click to preview
        </NeoButton>
      ) : null}
    </Card>
  )
}
