import { supabase } from '@/lib/supabase'

export type RevealBingoWinnerResult = {
  winnerName: string
  pointsAwarded: number
}

export async function revealBingoWinner(
  eventId: string,
  stageIndex: number,
): Promise<RevealBingoWinnerResult> {
  const { data, error } = await supabase.functions.invoke('reveal-bingo-winner', {
    body: { eventId, stageIndex },
  })
  if (error) throw error
  const body = data as { error?: string } & RevealBingoWinnerResult
  if (body.error) throw new Error(body.error)
  return body
}
