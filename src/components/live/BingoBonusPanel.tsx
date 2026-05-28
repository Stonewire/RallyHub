import type { CSSProperties } from 'react'

import { STANDBY_ACCENT, textOnAccent } from '@/lib/live-event'
import type { BonusChallenge } from '@/types/game-config'

type BingoBonusPanelProps = {
  challenge: BonusChallenge
  accentColor: string
  revealed: boolean
  selectedAnswerId: string | null
  locked: boolean
  existingAnswerId: string | null | undefined
  onSelect: (answerId: string) => void
  large?: boolean
}

export function BingoBonusPanel({
  challenge,
  accentColor: _accentColor,
  revealed,
  selectedAnswerId,
  locked,
  existingAnswerId,
  onSelect,
  large = false,
}: BingoBonusPanelProps) {
  const answerId = existingAnswerId ?? selectedAnswerId

  return (
    <div className={large ? 'w-full max-w-4xl text-center' : 'mx-auto max-w-lg px-4 pb-24'}>
      <p
        className={`mb-2 font-semibold uppercase tracking-wide opacity-80 ${
          large ? 'font-display text-xl' : 'text-xs'
        }`}
      >
        Bonus challenge
      </p>
      {challenge.questionImageUrl ? (
        <img
          src={challenge.questionImageUrl}
          alt=""
          className={`mx-auto mb-4 rounded-xl object-cover ${
            large ? 'max-h-64' : 'max-h-40 w-full'
          }`}
        />
      ) : null}
      <h2
        className={`font-bold leading-snug ${
          large
            ? 'font-display mb-8 text-3xl md:text-5xl'
            : 'mb-6 text-center text-lg'
        }`}
      >
        {challenge.question}
      </h2>
      <div
        className={
          large ? 'mx-auto grid max-w-3xl gap-3 sm:grid-cols-2' : 'space-y-3'
        }
      >
        {challenge.answers.map((a) => {
          const isCorrect = a.id === challenge.correctAnswerId
          const isMine = a.id === answerId
          let cls = large
            ? 'rounded-2xl px-6 py-5 font-display text-lg font-semibold md:text-xl '
            : 'w-full rounded-xl px-4 py-4 text-left text-sm font-semibold transition-colors '
          let style: CSSProperties | undefined
          if (revealed) {
            if (isCorrect) cls += large ? 'bg-green-600/90 text-white ring-2 ring-green-300' : 'bg-green-600/80 text-white ring-2 ring-green-300'
            else if (isMine) cls += large ? 'bg-red-600/90 text-white' : 'bg-red-600/70 text-white'
            else cls += large ? 'bg-white/15 text-white/50 backdrop-blur-sm' : 'bg-white/10 text-white/50'
          } else if (isMine) {
            cls += large ? 'ring-2 ring-white/40' : 'ring-2 ring-white/40'
            style = {
              backgroundColor: STANDBY_ACCENT,
              color: textOnAccent(STANDBY_ACCENT),
            }
          } else if (locked) {
            cls += 'cursor-not-allowed bg-white/10 text-white/40'
          } else {
            cls += large
              ? 'bg-white/15 backdrop-blur-sm'
              : 'bg-white/15 text-white hover:bg-white/25'
          }
          const inner = large ? (
            <div key={a.id} className={cls} style={style}>
              {a.text}
            </div>
          ) : (
            <button
              key={a.id}
              type="button"
              disabled={locked}
              className={cls}
              style={style}
              onClick={() => onSelect(a.id)}
            >
              {a.text}
            </button>
          )
          return inner
        })}
      </div>
    </div>
  )
}
