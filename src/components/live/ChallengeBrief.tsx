import { useTranslation } from 'react-i18next'

import { RichText } from '@/components/ui/rich-text'

/**
 * The brief, on every game screen: a labelled band between the cover and
 * whatever the team does next, so the instructions read as their own area
 * rather than as caption text under the picture.
 */
/** Section heading on the player screens: "Your task:", "Your answer:", … */
export const CHALLENGE_LABEL_CLASS =
  'text-sm font-black tracking-[0.16em] uppercase opacity-75'

export function ChallengeBrief({ html }: { html?: string | null }) {
  const { t } = useTranslation('live')
  if (!html?.trim()) return null

  return (
    <div className="my-9 space-y-2 px-4">
      <p className={CHALLENGE_LABEL_CLASS}>{t('join.yourTask')}:</p>
      {/* No line clamp: a brief is the instructions for the task, and cutting
          it at four lines with no way to expand meant a longer challenge could
          not be read at all. The screen scrolls; the text does not need to. */}
      <RichText
        html={html}
        className="xp-challenge-description xp-wrap-text mx-auto max-w-md md:max-w-3xl"
      />
    </div>
  )
}
