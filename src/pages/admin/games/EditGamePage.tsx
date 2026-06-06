import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { MusicBingoEditor } from '@/components/games/MusicBingoEditor'
import { QuizEditor } from '@/components/games/QuizEditor'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GAME_TYPE_LABELS, useGame, useUpdateGame } from '@/hooks/use-games'
import { uploadGameFile } from '@/lib/game-upload'
import { useOrganizationId } from '@/hooks/use-organization-id'
import type { GameType } from '@/types/database'
import type { GameConfig } from '@/types/game-config'

export function AdminGameEditPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const organizationId = useOrganizationId()
  const gameQuery = useGame(gameId)
  const updateGame = useUpdateGame(organizationId)

  const [hydrated, setHydrated] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [config, setConfig] = useState<GameConfig>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!gameQuery.data || hydrated) return
    const g = gameQuery.data
    setName(g.name)
    setDescription(g.description ?? '')
    setCoverUrl(g.cover_url)
    setConfig((g.config as GameConfig) ?? {})
    setHydrated(true)
  }, [gameQuery.data, hydrated])

  if (!organizationId) {
    return (
      <AdminPageShell title="Edit game" backTo="/admin/games" backLabel="Back to games">
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  if (gameQuery.isLoading || !hydrated) {
    return (
      <AdminPageShell title="Edit game" backTo="/admin/games" backLabel="Back to games">
        <QueryLoading rows={6} />
      </AdminPageShell>
    )
  }

  if (gameQuery.isError || !gameQuery.data) {
    return (
      <AdminPageShell title="Edit game" backTo="/admin/games" backLabel="Back to games">
        <QueryError message={gameQuery.error?.message ?? 'Game not found'} />
      </AdminPageShell>
    )
  }

  const gameType = gameQuery.data.type as GameType
  const tracks = config.tracks ?? []

  async function handleSave() {
    if (!gameId || !name.trim()) {
      setError('Game name is required.')
      return
    }
    if (gameType === 'music_bingo' && tracks.length < 5) {
      setError('Music bingo needs at least 5 tracks.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateGame.mutateAsync({
        gameId,
        patch: {
          name: name.trim(),
          description: description || null,
          cover_url: coverUrl,
          config,
        },
      })
      navigate('/admin/games', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminPageShell
      title={`Edit ${GAME_TYPE_LABELS[gameType]}`}
      subtitle={gameQuery.data.name}
      backTo="/admin/games"
      backLabel="Back to games"
      actions={
        <>
          <AccentButton type="button" disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save changes'}
          </AccentButton>
        </>
      }
    >
      {error ? (
        <p className="text-destructive mb-4 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-8">
        <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <Label>Game name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background"
            />
          </div>
        </Card>

        {gameType === 'quiz' ? (
          <QuizEditor
            config={config}
            setConfig={setConfig}
            onUploadQuestionPhoto={async (questionId, file) => {
              const url = await uploadGameFile(organizationId, `quiz/q-${questionId}`, file)
              setConfig((c) => ({
                ...c,
                questions: (c.questions ?? []).map((q) =>
                  q.id === questionId ? { ...q, photoUrl: url } : q,
                ),
              }))
            }}
          />
        ) : null}

        {gameType === 'music_bingo' ? (
          <MusicBingoEditor
            config={config}
            setConfig={setConfig}
            organizationId={organizationId}
            coverUrl={coverUrl}
            setCoverUrl={setCoverUrl}
          />
        ) : null}

        {gameType === 'photo' || gameType === 'video' ? (
          <Card className="border-border/80 bg-muted/30 p-4 text-sm text-muted-foreground">
            Photo and video games are edited on the create flow for now. Re-create or contact
            support for asset changes.
          </Card>
        ) : null}
      </div>

      <FormSaveFooter onSave={() => void handleSave()} saving={saving} label="Save changes" />
    </AdminPageShell>
  )
}
