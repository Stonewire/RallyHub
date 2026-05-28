/** MCQ answer id, optionally with `|photoOrVideoUrl` for media bonus challenges. */
export function encodeBingoBonusSubmission(answerId: string, mediaProofUrl?: string | null): string {
  if (mediaProofUrl?.trim()) return `${answerId}|${mediaProofUrl.trim()}`
  return answerId
}

export function parseBingoBonusSubmission(mediaUrl: string | null): {
  answerId: string
  mediaProofUrl: string | null
} {
  if (!mediaUrl) return { answerId: '', mediaProofUrl: null }
  const pipe = mediaUrl.indexOf('|')
  if (pipe === -1) return { answerId: mediaUrl, mediaProofUrl: null }
  return {
    answerId: mediaUrl.slice(0, pipe),
    mediaProofUrl: mediaUrl.slice(pipe + 1) || null,
  }
}
