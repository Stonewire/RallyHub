import { useState } from 'react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { ChallengeBrief, CHALLENGE_LABEL_CLASS } from '@/components/live/ChallengeBrief'
import { textOnAccent } from '@/lib/live-event'
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
    <div className="pb-4 text-center">
      <h2 className="xp-challenge-title xp-wrap-text mx-auto max-w-md px-4 line-clamp-3">
        {game.name}
      </h2>
      {/* Full bleed like the photo and video briefs: the cover owns the width
          and keeps its own height. */}
      {game.cover_url ? (
        <img src={game.cover_url} alt="" className="mt-4 w-full object-cover" />
      ) : null}
      <ChallengeBrief html={game.description} />

      <div className="mx-auto w-full max-w-lg px-4">
      {cfg.mode === 'type_text' ? (
        <div className="space-y-3">
          <label className={`block ${CHALLENGE_LABEL_CLASS}`}>Your answer:</label>
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
          <p className={CHALLENGE_LABEL_CLASS}>Choose one answer:</p>
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
    </div>
  )
}
