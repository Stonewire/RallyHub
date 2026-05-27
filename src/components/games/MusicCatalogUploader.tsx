import { Upload } from 'lucide-react'
import { useState } from 'react'

import { AccentButton } from '@/components/admin/AccentButton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth-context'
import { useInsertMusicCatalog } from '@/hooks/use-music-catalog'
import { readAudioDuration, suggestClipStart } from '@/lib/audio-metadata'
import { extractAudioClipWav } from '@/lib/extract-audio-clip'
import { parseAudioFilename } from '@/lib/parse-audio-filename'
import { uploadAsset } from '@/lib/storage'
import type { MusicTrack } from '@/types/game-config'

type PendingTrack = {
  key: string
  file: File
  artist: string
  title: string
  confidence: number
  needsReview: boolean
}

type MusicCatalogUploaderProps = {
  organizationId: string
  onTracksReady: (tracks: MusicTrack[]) => void
}

export function MusicCatalogUploader({
  organizationId,
  onTracksReady,
}: MusicCatalogUploaderProps) {
  const { user } = useAuth()
  const insertCatalog = useInsertMusicCatalog(organizationId)
  const [licenseOk, setLicenseOk] = useState(false)
  const [pending, setPending] = useState<PendingTrack[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onFilesSelected(files: FileList | null) {
    if (!files?.length) return
    const next: PendingTrack[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|m4a|wav)$/i)) continue
      const parsed = parseAudioFilename(file.name)
      next.push({
        key: `${file.name}-${file.size}`,
        file,
        artist: parsed.artist,
        title: parsed.title,
        confidence: parsed.confidence,
        needsReview: parsed.confidence < 0.5,
      })
    }
    setPending((p) => [...p, ...next])
  }

  async function confirmUpload() {
    if (!licenseOk) {
      setError('Confirm you have rights to use these recordings.')
      return
    }
    if (pending.length === 0) return
    setUploading(true)
    setError(null)
    const gameTracks: MusicTrack[] = []
    try {
      for (const item of pending) {
        const duration = await readAudioDuration(item.file).catch(() => 0)
        const clipStart = suggestClipStart(duration)
        const clipDuration = 30
        const audioUrl = await uploadAsset(
          'game-assets',
          `${organizationId}/catalog/${crypto.randomUUID()}-full-${item.file.name}`,
          item.file,
        )
        const clipBlob = await extractAudioClipWav(item.file, clipStart, clipDuration)
        const clipFile = new File([clipBlob], `clip-${item.file.name}.wav`, {
          type: 'audio/wav',
        })
        const clipUrl = await uploadAsset(
          'game-assets',
          `${organizationId}/catalog/${crypto.randomUUID()}-clip-${item.file.name}.wav`,
          clipFile,
        )
        const row = await insertCatalog.mutateAsync({
          organization_id: organizationId,
          artist: item.artist.trim() || 'Unknown',
          title: item.title.trim() || item.file.name,
          audio_url: audioUrl,
          clip_url: clipUrl,
          clip_start_seconds: 0,
          clip_duration_seconds: clipDuration,
          duration_seconds: duration || null,
          source_filename: item.file.name,
          parse_confidence: item.confidence,
          license_confirmed_at: new Date().toISOString(),
          license_confirmed_by: user?.id ?? null,
        })
        gameTracks.push({
          id: row.id,
          title: row.title,
          artist: row.artist,
          audioUrl: row.audio_url,
          clipUrl: row.clip_url ?? clipUrl,
          clipStartSeconds: 0,
          clipDurationSeconds: clipDuration,
        })
      }
      onTracksReady(gameTracks)
      setPending([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm">
      <div>
        <h3 className="text-foreground font-semibold">Upload playlist (MP3)</h3>
        <p className="text-muted-foreground text-sm">
          We match filenames like &quot;Artist - Title.mp3&quot;. Low-confidence rows need a quick
          review. Each track gets a dedicated 30-second clip for live bingo.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={licenseOk}
          onChange={(e) => setLicenseOk(e.target.checked)}
        />
        <span>
          I confirm our organization has the rights to use these recordings in live events.
        </span>
      </label>

      <label className="border-border/80 hover:bg-muted/30 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6">
        <Upload className="text-muted-foreground size-8" />
        <span className="text-sm font-medium">Drop MP3 files or click to browse</span>
        <input
          type="file"
          accept="audio/*,.mp3"
          multiple
          className="hidden"
          onChange={(e) => onFilesSelected(e.target.files)}
        />
      </label>

      {pending.length > 0 ? (
        <ul className="max-h-64 space-y-2 overflow-auto">
          {pending.map((item) => (
            <li
              key={item.key}
              className="border-border/80 grid gap-2 rounded-lg border p-2 sm:grid-cols-2"
            >
              <Input
                value={item.artist}
                placeholder="Artist"
                className="bg-background h-8 text-sm"
                onChange={(e) =>
                  setPending((list) =>
                    list.map((x) =>
                      x.key === item.key ? { ...x, artist: e.target.value } : x,
                    ),
                  )
                }
              />
              <Input
                value={item.title}
                placeholder="Title"
                className="bg-background h-8 text-sm"
                onChange={(e) =>
                  setPending((list) =>
                    list.map((x) =>
                      x.key === item.key ? { ...x, title: e.target.value } : x,
                    ),
                  )
                }
              />
              <p className="text-muted-foreground col-span-full truncate text-xs">
                {item.file.name}
                {item.needsReview ? (
                  <span className="text-amber-600"> · please verify</span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {pending.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <AccentButton
            type="button"
            disabled={uploading || !licenseOk}
            onClick={() => void confirmUpload()}
          >
            {uploading ? 'Uploading…' : `Add ${pending.length} to game`}
          </AccentButton>
          <Button type="button" variant="outline" onClick={() => setPending([])}>
            Clear
          </Button>
        </div>
      ) : null}
    </Card>
  )
}
