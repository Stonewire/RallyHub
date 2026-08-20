import { IconUpload } from '@/components/icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AccentButton } from '@/components/admin/AccentButton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth-context'
import { useInsertMusicCatalog } from '@/hooks/use-music-catalog'
import { readAudioDuration } from '@/lib/audio-metadata'
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
  const { t } = useTranslation('admin')
  const { user } = useAuth()
  const insertCatalog = useInsertMusicCatalog(organizationId)
  const [licenseOk, setLicenseOk] = useState(false)
  const [pending, setPending] = useState<PendingTrack[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function isAudioFile(file: File): boolean {
    if (file.type.startsWith('audio/')) return true
    return /\.(mp3|m4a|aac|wav|flac|ogg)$/i.test(file.name)
  }

  function onFilesSelected(files: FileList | null) {
    if (!files?.length) return
    const next: PendingTrack[] = []
    for (const file of Array.from(files)) {
      if (!isAudioFile(file)) continue
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
    if (next.length === 0) {
      setError(t('games.music.unsupportedFiles'))
      return
    }
    setError(null)
    setPending((p) => [...p, ...next])
  }

  const uploadBlockers: string[] = []
  if (!licenseOk) uploadBlockers.push(t('games.music.blockerUsageRights'))

  async function confirmUpload() {
    if (!licenseOk) {
      setError(t('games.music.confirmRightsError'))
      return
    }
    if (pending.length === 0) return
    setUploading(true)
    setError(null)
    const gameTracks: MusicTrack[] = []
    try {
      for (const item of pending) {
        const duration = await readAudioDuration(item.file).catch(() => 0)
        // The library stores the full track. Clips are cut per game, from the
        // organiser's in point if they set one, so nothing is generated here.
        const audioUrl = await uploadAsset(
          'game-assets',
          `${organizationId}/catalog/${crypto.randomUUID()}-full-${item.file.name}`,
          item.file,
        )
        const row = await insertCatalog.mutateAsync({
          organization_id: organizationId,
          artist: item.artist.trim() || 'Unknown',
          title: item.title.trim() || item.file.name,
          audio_url: audioUrl,
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
          clipUrl: row.clip_url,
        })
      }
      onTracksReady(gameTracks)
      setPending([])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('games.music.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm">
      <div>
        <h3 className="text-foreground font-semibold">{t('games.music.uploadMusic')}</h3>
        <p className="text-muted-foreground text-sm">{t('games.music.uploadHelp')}</p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={licenseOk}
          onChange={(e) => setLicenseOk(e.target.checked)}
        />
        <span>{t('games.music.licenseConfirm')}</span>
      </label>

      <label className="border-border/80 hover:bg-muted/30 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6">
        <IconUpload className="text-muted-foreground size-8" />
        <span className="text-sm font-medium">{t('games.music.dropFiles')}</span>
        <input
          type="file"
          accept="audio/*,.mp3,.m4a,.wav"
          multiple
          className="hidden"
          onChange={(e) => {
            onFilesSelected(e.target.files)
            e.target.value = ''
          }}
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
                placeholder={t('games.music.artist')}
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
                placeholder={t('games.music.title')}
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
                  <span className="text-amber-600"> · {t('games.music.pleaseVerify')}</span>
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
        <div className="space-y-2">
          {uploadBlockers.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              {t('games.music.beforeUploading', {
                items: uploadBlockers.join(` ${t('games.music.and')} `),
              })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <AccentButton
              type="button"
              disabled={uploading}
              onClick={() => void confirmUpload()}
            >
              {uploading
                ? t('games.uploading')
                : t('games.music.addCountToGame', { count: pending.length })}
            </AccentButton>
            <Button type="button" variant="outline" onClick={() => setPending([])}>
              {t('games.clear')}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
