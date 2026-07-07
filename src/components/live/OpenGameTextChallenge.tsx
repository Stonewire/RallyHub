import { useState } from 'react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { RichText } from '@/components/ui/rich-text'
import { gamePointsDisplay, textOnAccent } from '@/lib/live-event'
import { parseTextGameConfig } from '@/lib/text-game'
import type { Tables } from '@/types/helpers'

type OpenGameTextChallengeProps = {
  game: Tables<'games'>
  accentColor: string
  disabled?: boolean
  onSubmit: (mediaUrl: string) => void
}

export function OpenGameTextChallenge({
  game,
  accentColor,
  disabled,
  onSubmit,
}: OpenGameTextChallengeProps) {
  const onAccent = textOnAccent(accentColor)
  const cfg = parseTextGameConfig(game.config)
  const [typed, setTyped] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const canSubmitTyped = typed.length > 0
  const canSubmitChoice = Boolean(selectedId)

  return (
    <div className="space-y-5 pb-4 text-center">
      <h2 className="xp-challenge-title xp-wrap-text mx-auto max-w-md line-clamp-3">
        {game.name}
      </h2>
      <span
        className="inline-flex rounded-full px-4 py-1.5 text-sm font-bold tracking-wide"
        style={{ backgroundColor: accentColor, color: onAccent }}
      >
        {gamePointsDisplay(game)}
      </span>
      {game.cover_url ? (
        <img
          src={game.cover_url}
          alt=""
          className="mx-auto w-full max-h-40 rounded-xl object-cover object-center shadow-lg sm:max-h-48"
        />
      ) : null}
      {game.description ? (
        <RichText
          html={game.description}
          className="xp-challenge-description xp-wrap-text mx-auto max-w-md line-clamp-4"
        />
      ) : null}

      {cfg.mode === 'type_text' ? (
        <div className="space-y-3">
          <label className="block text-left text-sm font-medium text-white/90">
            Your answer
          </label>
          <input
            type="text"
            value={typed}
            disabled={disabled}
            className="xp-field w-full rounded-lg border border-white/25 bg-white/10 px-3 py-3 text-base text-white placeholder:text-white/50"
            placeholder="Type your answer…"
            onChange={(e) => setTyped(e.target.value)}
          />
          <LiveAccentButton
            type="button"
            className="w-full py-4 text-base"
            accentColor={accentColor}
            disabled={disabled || !canSubmitTyped}
            onClick={() => onSubmit(typed)}
          >
            Submit answer
          </LiveAccentButton>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-white/90">Choose one answer</p>
          <div className="space-y-2">
            {(cfg.options ?? []).map((opt) => {
              const selected = selectedId === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled}
                  className={`xp-quiz-option w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
                    selected ? 'ring-2 ring-white/80' : ''
                  }`}
                  style={
                    selected
                      ? { backgroundColor: accentColor, color: onAccent }
                      : { backgroundColor: 'rgb(255 255 255 / 0.15)' }
                  }
                  onClick={() => setSelectedId(opt.id)}
                >
                  {opt.text}
                </button>
              )
            })}
          </div>
          <LiveAccentButton
            type="button"
            className="w-full py-4 text-base"
            accentColor={accentColor}
            disabled={disabled || !canSubmitChoice}
            onClick={() => {
              if (selectedId) onSubmit(selectedId)
            }}
          >
            Submit answer
          </LiveAccentButton>
        </div>
      )}
    </div>
  )
}
