import { questionMedia } from '@/lib/quiz-media'
import { youtubeEmbedUrl } from '@/lib/youtube'
import type { QuizQuestion } from '@/types/game-config'

/**
 * A question's photo, video or audio, in the room the question screen leaves
 * between the wording and the answers. It takes whatever height is going and
 * no more, so the answers never move.
 */
export function QuizQuestionMedia({
  question,
  accentColor,
}: {
  question: QuizQuestion
  accentColor: string
}) {
  const { kind, url } = questionMedia(question)
  if (!url || kind === 'none') return null

  if (kind === 'photo') {
    return (
      <img
        src={url}
        alt=""
        className="mx-auto max-h-full w-auto rounded-xl object-contain shadow-lg"
      />
    )
  }

  if (kind === 'video') {
    const embed = youtubeEmbedUrl(url)
    return embed ? (
      <div className="mx-auto aspect-video max-h-full w-full overflow-hidden rounded-xl shadow-lg">
        <iframe
          src={embed}
          title="Question video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      </div>
    ) : (
      <video
        src={url}
        controls
        playsInline
        controlsList="nodownload"
        className="mx-auto max-h-full w-full rounded-xl shadow-lg"
      />
    )
  }

  // Audio has nothing to look at, so it gets a band the size of its controls
  // rather than a player floating in the middle of the screen.
  return (
    <div
      className="mx-auto flex w-full max-w-md items-center rounded-xl px-3 py-2 shadow-lg"
      style={{ backgroundColor: `${accentColor}26` }}
    >
      <audio src={url} controls controlsList="nodownload" className="w-full" />
    </div>
  )
}
