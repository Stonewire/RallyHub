import { useEffect, useRef, useState } from 'react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { ChallengeBrief, CHALLENGE_LABEL_CLASS } from '@/components/live/ChallengeBrief'
import {
  StickyChallengeAction,
  STICKY_ACTION_SPACER,
} from '@/components/live/StickyChallengeAction'
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

  const inputRef = useRef<HTMLInputElement>(null)

  // Nothing else to do on this screen, so the field is ready to type in
  // without a tap. iOS only opens its keyboard for focus inside a user
  // gesture, so there the field is focused and the keyboard follows the first
  // tap; Android opens straight away.
  useEffect(() => {
    if (cfg.mode === 'type_text') inputRef.current?.focus()
  }, [cfg.mode, game.id])

  const canSubmitTyped = typed.length > 0
  const canSubmitChoice = Boolean(selectedId)

  return (
    <div className={`text-center ${STICKY_ACTION_SPACER}`}>
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
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!disabled && canSubmitTyped) onSubmit(typed)
          }}
        >
          <label className={`block ${CHALLENGE_LABEL_CLASS}`}>Your answer:</label>
          <input
            ref={inputRef}
            type="text"
            value={typed}
            disabled={disabled}
            // Typing is the only thing to do here, so the field takes focus on
            // open and the keyboard's action key sends the answer.
            autoFocus
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="off"
            className="xp-field w-full rounded-lg border border-white/25 bg-white/10 px-3 py-3 text-base text-white placeholder:text-white/50"
            placeholder="Type your answer…"
            onChange={(e) => setTyped(e.target.value)}
          />
          <StickyChallengeAction>
            <LiveAccentButton
              type="submit"
              className="mx-auto w-full max-w-sm py-4 text-base"
              accentColor={accentColor}
              disabled={disabled || !canSubmitTyped}
            >
              Submit answer
            </LiveAccentButton>
          </StickyChallengeAction>
        </form>
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
          <StickyChallengeAction>
            <LiveAccentButton
              type="button"
              className="mx-auto w-full max-w-sm py-4 text-base"
              accentColor={accentColor}
              disabled={disabled || !canSubmitChoice}
              onClick={() => {
                if (selectedId) onSubmit(selectedId)
              }}
            >
              Submit answer
            </LiveAccentButton>
          </StickyChallengeAction>
        </div>
      )}
      </div>
    </div>
  )
}
