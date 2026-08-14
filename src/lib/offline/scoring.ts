// Offline auto-scoring for text games (OFFLINE-1 Stage 4).
//
// Reproduces the server's auto_approve_text_submission verdict on the device,
// using the answer keys downloaded on join (package.ts):
//   choose_answer -> the submitted option id equals the correct option id
//   type_text     -> sha256(btrim(input)) is in the shipped hash set
//
// The hash and trim MUST match the server byte-for-byte or an offline verdict
// would disagree with the authoritative server re-score on sync. The server uses
// Postgres btrim (spaces only) + encode(digest(..., 'sha256'), 'hex').

import type { OfflineAnswerKey } from './package'

/** Postgres btrim(text): strip leading/trailing SPACES only (not tabs/newlines),
 *  matching what the server hashed and what its trigger compares. */
export function btrimSpaces(value: string): string {
  return value.replace(/^ +/, '').replace(/ +$/, '')
}

/** Lowercase hex sha256, identical to encode(digest(x,'sha256'),'hex'). */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Whether a text submission is correct offline, matching the server trigger.
 *  Returns false when there is no answer key (nothing to score against). */
export async function scoreOfflineText(
  mode: 'type_text' | 'choose_answer',
  key: OfflineAnswerKey | undefined,
  submitted: string,
): Promise<boolean> {
  if (!key) return false
  if (mode === 'choose_answer') {
    return Boolean(key.text_correct_answer_id) && submitted === key.text_correct_answer_id
  }
  const hashes = key.text_correct_answer_hashes ?? []
  if (hashes.length === 0) return false
  const submittedHash = await sha256Hex(btrimSpaces(submitted))
  return hashes.includes(submittedHash)
}
