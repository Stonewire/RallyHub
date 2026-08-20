import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { VirtualKeyboard } from '@/components/live/VirtualKeyboard'
import { ChallengeBrief, CHALLENGE_LABEL_CLASS } from '@/components/live/ChallengeBrief'
import {
  StickyChallengeAction,
  CHALLENGE_ACTION_CLASS,
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
  const { t, i18n } = useTranslation('live')
  const onAccent = textOnAccent(accentColor)
  // Bulgarian is the only Cyrillic language in APP_LANGUAGES today; the
  // keyboard simply follows the active UI language.
  const alphabet = i18n.language === 'bg' ? 'cyrillic' : 'latin'
  const cfg = parseTextGameConfig(game.config)
  const [typed, setTyped] = useState('')
  const answerRef = useRef<HTMLDivElement | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Open with the answer field and its keyboard in view rather than on the
  // cover, the same way the puzzles open on their board.
  useEffect(() => {
    const ids = [120, 700].map((delay) =>
      window.setTimeout(() => answerRef.current?.scrollIntoView({ block: 'start' }), delay),
    )
    return () => ids.forEach((id) => window.clearTimeout(id))
  }, [game.id])

  const canSubmitTyped = typed.length > 0
  const canSubmitChoice = Boolean(selectedId)

  return (
    <div
      className={`text-center ${cfg.mode === 'type_text' ? 'pb-[22rem] md:pb-[24rem]' : STICKY_ACTION_SPACER}`}
    >
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
        <div ref={answerRef} className="scroll-mt-3 space-y-3">
          <label className={`block ${CHALLENGE_LABEL_CLASS}`}>{t('join.review.yourAnswer')}:</label>
          {/* The app's own keyboard, so the answer field cannot be covered by
              the device one and the send key is always in the same place. */}
          <p
            className="xp-field min-h-[3.25rem] w-full rounded-lg border border-white/25 bg-white/10 px-3 py-3 text-left text-base break-words text-white"
            aria-live="polite"
          >
            {typed || <span className="text-white/50">{t('join.text.answerPlaceholder')}</span>}
            {/* The field is a paragraph, not an input, because the answer is
                typed on the app's own keyboard. Without a caret it reads as a
                label rather than something that is listening, and teams sat
                waiting for a device keyboard that never comes. */}
            {disabled ? null : (
              <span
                aria-hidden
                className="xp-caret ml-0.5 inline-block h-[1.15em] w-[2px] translate-y-[0.18em] rounded-full bg-white align-middle"
              />
            )}
          </p>
          <VirtualKeyboard
            alphabet={alphabet}
            onKey={(char) => setTyped((current) => current + char)}
            onBackspace={() => setTyped((current) => Array.from(current).slice(0, -1).join(''))}
            onSubmit={() => {
              if (!disabled && canSubmitTyped) onSubmit(typed)
            }}
            submitDisabled={disabled || !canSubmitTyped}
            submitLabel={t('join.chat.send')}
            accentColor={accentColor}
            disabled={disabled}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <p className={CHALLENGE_LABEL_CLASS}>{t('join.text.chooseOneAnswer')}:</p>
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
              className={CHALLENGE_ACTION_CLASS}
              accentColor={accentColor}
              disabled={disabled || !canSubmitChoice}
              onClick={() => {
                if (selectedId) onSubmit(selectedId)
              }}
            >
              {t('join.text.submitAnswer')}
            </LiveAccentButton>
          </StickyChallengeAction>
        </div>
      )}
      </div>
    </div>
  )
}
