import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import {
  IconClose,
  IconMusicBingo,
  IconPhoto,
  IconPuzzle,
  IconQuiz,
  IconText,
  IconVideo,
} from '@/components/icons'
import type { GameType } from '@/types/database'
import { orgPath } from '@/lib/org-path'
import { useOptionalTenant } from '@/contexts/tenant-context'

/** Reading order asked for: photo, video, puzzle, then text, quiz, bingo. */
const NEW_GAME_TYPES: { type: GameType; labelKey: string; icon: typeof IconPhoto }[] = [
  { type: 'photo', labelKey: 'games.newType.photo', icon: IconPhoto },
  { type: 'video', labelKey: 'games.newType.video', icon: IconVideo },
  { type: 'puzzle', labelKey: 'games.newType.puzzle', icon: IconPuzzle },
  { type: 'text', labelKey: 'games.newType.text', icon: IconText },
  { type: 'quiz', labelKey: 'games.newType.quiz', icon: IconQuiz },
  { type: 'music_bingo', labelKey: 'games.newType.bingo', icon: IconMusicBingo },
]

type NewGameTypeModalProps = {
  open: boolean
  onClose: () => void
}

/**
 * The game type picker, floating over whatever the organiser was looking at
 * rather than taking them to a page of its own. Picking a type goes straight
 * to the editor, so the choice costs one click instead of a screen.
 */
export function NewGameTypeModal({ open, onClose }: NewGameTypeModalProps) {
  const { t } = useTranslation('admin')
  const navigate = useNavigate()
  const clientSlug = useOptionalTenant()?.tenantOrg?.subdomain ?? null

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('games.newType.title')}
      className="fixed inset-0 z-80 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-2xl rounded-lg p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-foreground text-sm font-bold">{t('games.newType.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common:close')}
            className="hover:bg-muted rounded-nm-md flex size-[26px] items-center justify-center"
          >
            <IconClose className="size-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NEW_GAME_TYPES.map(({ type, labelKey, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onClose()
                navigate(orgPath(clientSlug, `/admin/games/new?type=${type}`))
              }}
              className="bg-nm-yellow text-nm-charcoal flex flex-col items-center gap-2 rounded-md p-5 transition-[filter,transform] hover:-translate-y-0.5 hover:brightness-95"
            >
              <Icon className="size-8" />
              <span className="text-sm font-semibold">{t(labelKey)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
