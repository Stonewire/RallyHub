import { useEffect } from 'react'
import { createPortal } from 'react-dom'
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

/** Reading order asked for: photo, video, puzzle, then text, quiz, bingo. */
const NEW_GAME_TYPES: { type: GameType; label: string; icon: typeof IconPhoto }[] = [
  { type: 'photo', label: 'Photo', icon: IconPhoto },
  { type: 'video', label: 'Video', icon: IconVideo },
  { type: 'puzzle', label: 'Puzzle', icon: IconPuzzle },
  { type: 'text', label: 'Text', icon: IconText },
  { type: 'quiz', label: 'Quiz', icon: IconQuiz },
  { type: 'music_bingo', label: 'Bingo', icon: IconMusicBingo },
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
  const navigate = useNavigate()

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
      aria-label="Select game type"
      className="fixed inset-0 z-80 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="border-nm-slate-800 bg-card w-full max-w-2xl rounded-lg border-2 p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-foreground text-sm font-bold">Select game type</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="hover:bg-muted rounded-nm-md flex size-[26px] items-center justify-center"
          >
            <IconClose className="size-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NEW_GAME_TYPES.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onClose()
                navigate(`/admin/games/new?type=${type}`)
              }}
              className="border-border hover:border-primary hover:bg-primary/5 bg-background flex flex-col items-center gap-2 rounded-md border p-5 transition-[background-color,border-color,transform] hover:-translate-y-0.5"
            >
              {/* Bare icon in the brand yellow. The grey tile it used to sit in
                  put a second shape inside a card that is already a shape. */}
              <Icon className="text-nm-yellow size-8" />
              <span className="text-foreground text-sm font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
