import type { CSSProperties, ReactNode } from 'react'

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
        className="bg-nm-surface border-border max-h-[90vh] w-full max-w-6xl overflow-auto rounded-nm-lg border p-5 shadow-xl"
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
          How this game looks on a computer, a tablet and a phone. Each pane
          scrolls on its own.
        </p>

        {/* Three frames side by side: computer, tablet, phone. Each pane
            scrolls on its own so a long description can be read in the frame
            it will actually appear in, rather than only at the top. */}
        <div className="grid items-start gap-5 lg:grid-cols-[1.35fr_1fr_.62fr]">
          <DeviceFrame label="Computer" bezel="rounded-nm-lg p-2 pb-5" screen="aspect-video rounded-md">
            <ScreenContents
              style={coverStyle}
              title={title}
              question={question}
              options={showOptions ? options : []}
              scale="lg"
            />
          </DeviceFrame>

          <DeviceFrame label="Tablet" bezel="rounded-2xl p-3" screen="aspect-4/3 rounded-lg">
            <ScreenContents
              style={coverStyle}
              title={title}
              question={question}
              options={showOptions ? options : []}
              scale="md"
            />
          </DeviceFrame>

          <DeviceFrame label="Phone" bezel="rounded-[20px] p-2.5" screen="aspect-9/16 rounded-xl">
            <ScreenContents
              style={coverStyle}
              title={title}
              question={question}
              options={showOptions ? options : []}
              scale="sm"
            />
          </DeviceFrame>
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

/** One device: a dark bezel around a scrollable screen, with its name beneath. */
function DeviceFrame({
  label,
  bezel,
  screen,
  children,
}: {
  label: string
  bezel: string
  screen: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className={`bg-[#1c1d21] shadow-lg ${bezel}`}>
        <div className={`bg-nm-slate-200 relative overflow-auto ${screen}`}>{children}</div>
      </div>
      <p className="text-muted-foreground mt-1.5 text-center text-[11px]">{label}</p>
    </div>
  )
}

const SCALE = {
  lg: { title: 'text-sm', body: 'text-xs', option: 'text-[10px]', gap: 'gap-2.5 p-4' },
  md: { title: 'text-[13px]', body: 'text-[11px]', option: 'text-[9px]', gap: 'gap-2 p-3' },
  sm: { title: 'text-[11px]', body: 'text-[9px]', option: 'text-[8px]', gap: 'gap-2 p-2.5' },
} as const

function ScreenContents({
  style,
  title,
  question,
  options,
  scale,
}: {
  style: CSSProperties | undefined
  title: string
  question: string
  options: string[]
  scale: keyof typeof SCALE
}) {
  const size = SCALE[scale]
  return (
    <div className="absolute inset-0" style={style}>
      <div className={`flex min-h-full flex-col items-center justify-center bg-black/45 text-center ${size.gap}`}>
        <p className={`font-bold text-white drop-shadow ${size.title}`}>{title}</p>
        <p className={`text-white/90 drop-shadow ${size.body}`}>{question}</p>
        {options.length > 0 ? (
          <div className={scale === 'sm' ? 'flex w-full flex-col gap-1' : 'grid w-full max-w-64 grid-cols-2 gap-1.5'}>
            {options.slice(0, 4).map((option, index) => (
              <span
                key={option + index}
                className={
                  (index === 1
                    ? 'bg-nm-yellow text-nm-charcoal '
                    : 'text-nm-charcoal bg-white/90 ') +
                  `truncate rounded-nm-sm px-2 py-1 font-semibold ${size.option}`
                }
              >
                {option}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
