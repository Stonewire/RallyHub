import { IconClose } from '@/components/icons'

import { NeoButton } from '@/components/neo-minimal'
import type { GameConfig } from '@/types/game-config'
import type { GameType } from '@/types/database'

type GamePreviewModalProps = {
  open: boolean
  onClose: () => void
  gameType: GameType
  name: string
  coverUrl: string | null
  config: GameConfig
}

const TYPE_PROMPT: Record<GameType, string> = {
  photo: 'Take a photo that matches the brief',
  video: 'Record a short video clip',
  text: 'Type your answer',
  quiz: 'Choose the correct answer',
  music_bingo: 'Listen and mark your card',
  puzzle: 'Solve the puzzle',
}

/** Sample answers when the game has none yet, so the mock is never empty. */
const PLACEHOLDER_OPTIONS = ['Option A', 'Option B', 'Option C', 'Option D']

function previewOptions(gameType: GameType, config: GameConfig): string[] {
  if (gameType === 'quiz') {
    const first = (config.questions ?? [])[0]
    if (first?.answers?.length) return first.answers.map((a) => a.text || 'Answer')
  }
  if (gameType === 'text' && config.text_answer_mode === 'choose_answer') {
    const options = config.text_options ?? []
    if (options.length) return options.map((o) => o.text || 'Option')
  }
  return PLACEHOLDER_OPTIONS
}

function previewQuestion(gameType: GameType, config: GameConfig): string {
  if (gameType === 'quiz') {
    const first = (config.questions ?? [])[0]
    if (first?.text) return first.text
  }
  return TYPE_PROMPT[gameType]
}

/**
 * The design's Preview modal: the host/TV display beside a player's phone, so
 * an organiser can see how a game reads on both surfaces before saving.
 *
 * Deliberately a static mock, not the live player. It renders from the draft
 * being edited (name, cover, first question and its answers) rather than the
 * design's hardcoded planets sample, so the preview reflects the actual game.
 * Wiring the real gameplay surfaces here would mean running live-event code
 * against an unsaved draft.
 */
export function GamePreviewModal({
  open,
  onClose,
  gameType,
  name,
  coverUrl,
  config,
}: GamePreviewModalProps) {
  if (!open) return null

  const title = name.trim() || 'Untitled game'
  const question = previewQuestion(gameType, config)
  const options = previewOptions(gameType, config)
  const showOptions = gameType === 'quiz' || gameType === 'text'
  const coverStyle = coverUrl
    ? {
        backgroundImage: `url(${coverUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${title}`}
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-nm-surface border-border w-full max-w-3xl rounded-nm-lg border p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="text-base font-bold">Live preview: {title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="hover:bg-muted rounded-nm-md flex size-7 shrink-0 items-center justify-center"
          >
            <IconClose className="size-4" />
          </button>
        </div>
        <p className="text-muted-foreground mb-4 text-xs">
          Sample screens: the host display on the left, a player's phone on the
          right. Not interactive.
        </p>

        <div className="flex flex-col items-center justify-center gap-6 sm:flex-row sm:items-start">
          <div className="w-full max-w-sm">
            <div className="rounded-nm-lg bg-[#1c1d21] p-2 pb-5 shadow-lg">
              <div
                className="bg-nm-slate-200 relative aspect-video overflow-hidden rounded-md"
                style={coverStyle}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/45 p-4 text-center">
                  <p className="text-sm font-bold text-white drop-shadow">{title}</p>
                  <p className="text-xs text-white/90 drop-shadow">{question}</p>
                  {showOptions ? (
                    <div className="grid w-full max-w-64 grid-cols-2 gap-1.5">
                      {options.slice(0, 4).map((option, index) => (
                        <span
                          key={option + index}
                          className={
                            index === 1
                              ? 'bg-nm-yellow text-nm-charcoal truncate rounded-nm-sm px-2 py-1 text-[10px] font-semibold'
                              : 'text-nm-charcoal truncate rounded-nm-sm bg-white/90 px-2 py-1 text-[10px] font-semibold'
                          }
                        >
                          {option}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <p className="text-muted-foreground mt-1.5 text-center text-[11px]">
              TV / host display
            </p>
          </div>

          <div className="shrink-0">
            <div className="w-[150px] rounded-[20px] bg-[#1c1d21] p-2.5 shadow-lg">
              <div
                className="bg-nm-slate-200 relative aspect-9/16 overflow-hidden rounded-xl"
                style={coverStyle}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 p-2.5 text-center">
                  <p className="text-[11px] font-bold text-white drop-shadow">{title}</p>
                  <p className="text-[9px] text-white/90 drop-shadow">{question}</p>
                  {showOptions ? (
                    <div className="flex w-full flex-col gap-1">
                      {options.slice(0, 4).map((option, index) => (
                        <span
                          key={option + index}
                          className={
                            index === 1
                              ? 'bg-nm-yellow text-nm-charcoal truncate rounded px-1.5 py-1 text-[8px] font-semibold'
                              : 'text-nm-charcoal truncate rounded bg-white/90 px-1.5 py-1 text-[8px] font-semibold'
                          }
                        >
                          {option}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <p className="text-muted-foreground mt-1.5 text-center text-[11px]">
              Player's phone
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <NeoButton type="button" variant="surface" onClick={onClose}>
            Close
          </NeoButton>
        </div>
      </div>
    </div>
  )
}
