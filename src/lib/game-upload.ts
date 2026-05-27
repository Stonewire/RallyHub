import { uploadAsset } from '@/lib/storage'

export function newGameId() {
  return crypto.randomUUID()
}

export async function uploadGameFile(orgId: string, path: string, file: File) {
  return uploadAsset('game-assets', `${orgId}/${path}`, file)
}
