import { IconUpload } from '@/components/icons'
import { useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type AssetFieldProps = {
  label: string
  accept?: string
  /** Current asset URL, used for both the preview and the URL box. */
  preview: string | null
  onFile: (file: File | undefined) => void | Promise<void>
  /**
   * Called when a URL is typed or pasted instead of uploading. Omit to hide the
   * URL box, for assets that must be uploaded rather than linked.
   */
  onUrl?: (url: string | null) => void
  /** Placeholder for the URL box. */
  urlPlaceholder?: string
  /** Shows the large dashed preview panel from the design. */
  showPreviewPanel?: boolean
  previewLabel?: string
  /** Puts the thumbnail beside the upload button instead of under it. */
  inlinePreview?: boolean
}

/**
 * The design's asset control: a pill file button showing the chosen filename
 * (or "No File"), an optional "or paste a link" box beside it, and a preview.
 *
 * Replaces the two near-identical FileField copies that previously lived in
 * GameEditForm and MusicBingoEditor, neither of which supported pasting a URL
 * even though every asset row in the design offers it.
 */
export function AssetField({
  label,
  accept = 'image/*',
  preview,
  onFile,
  onUrl,
  urlPlaceholder = 'or paste an image link…',
  showPreviewPanel = false,
  previewLabel = 'Cover preview',
  inlinePreview = false,
}: AssetFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const isVideo = accept.startsWith('video')

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            setFileName(file?.name ?? null)
            void onFile(file)
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="border-input bg-background hover:bg-muted flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold"
        >
          <IconUpload className="size-3.5" />
          <span className="max-w-40 truncate">{fileName ?? 'No File'}</span>
        </button>
        {onUrl ? (
          <Input
            value={preview ?? ''}
            placeholder={urlPlaceholder}
            onChange={(event) => onUrl(event.target.value.trim() || null)}
            className="bg-background min-w-0 flex-1"
          />
        ) : null}
        {inlinePreview ? (
          <span className="border-border bg-muted/40 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border">
            {preview ? (
              <img src={preview} alt="" className="size-full object-contain" />
            ) : (
              <IconUpload className="text-muted-foreground size-3.5" />
            )}
          </span>
        ) : null}
      </div>

      {showPreviewPanel ? (
        <div
          className={cn(
            'bg-muted/40 text-muted-foreground flex min-h-56 items-center justify-center overflow-hidden rounded-md p-2 text-[10px] font-semibold tracking-wider uppercase',
          )}
        >
          {preview ? (
            isVideo ? (
              <video src={preview} className="max-h-72" controls />
            ) : (
              <img src={preview} alt="" className="max-h-72 object-contain" />
            )
          ) : (
            previewLabel
          )}
        </div>
      ) : preview && !inlinePreview ? (
        isVideo ? (
          <video src={preview} className="max-h-24 rounded-lg" controls />
        ) : (
          <img src={preview} alt="" className="size-20 rounded-lg object-cover" />
        )
      ) : null}
    </div>
  )
}
