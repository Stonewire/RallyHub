import { RichText } from '@/components/ui/rich-text'

/**
 * The brief, on every game screen: a labelled band between the cover and
 * whatever the team does next, so the instructions read as their own area
 * rather than as caption text under the picture.
 */
export function ChallengeBrief({ html }: { html?: string | null }) {
  if (!html?.trim()) return null

  return (
    <div className="my-9 space-y-2 px-4">
      <p className="text-sm font-black tracking-[0.16em] uppercase opacity-75">
        Your task:
      </p>
      <RichText
        html={html}
        className="xp-challenge-description xp-wrap-text mx-auto line-clamp-4 max-w-md md:max-w-3xl"
      />
    </div>
  )
}
