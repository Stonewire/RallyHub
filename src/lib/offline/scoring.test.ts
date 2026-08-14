import { describe, it, expect } from 'vitest'

import { btrimSpaces, sha256Hex, scoreOfflineText } from './scoring'

// sha256('RALLYHUB') — verified equal to the server's
// encode(digest(btrim('RALLYHUB'),'sha256'),'hex') on the QA event.
const RALLYHUB_HASH = 'c786125c6b2de01b56331b3a0eb46ce8442d2c0bc38b72798153670dcd6be3c1'

describe('offline text scoring', () => {
  it('sha256Hex matches the known server hash', async () => {
    expect(await sha256Hex('RALLYHUB')).toBe(RALLYHUB_HASH)
  })

  it('btrimSpaces strips only spaces, not tabs/newlines', () => {
    expect(btrimSpaces('  hi  ')).toBe('hi')
    expect(btrimSpaces('\thi\n')).toBe('\thi\n')
  })

  it('type_text: correct answer matches after space-trim', async () => {
    const key = { text_correct_answer_hashes: [RALLYHUB_HASH] }
    expect(await scoreOfflineText('type_text', key, 'RALLYHUB')).toBe(true)
    expect(await scoreOfflineText('type_text', key, '  RALLYHUB  ')).toBe(true)
    expect(await scoreOfflineText('type_text', key, 'rallyhub')).toBe(false) // case-sensitive
    expect(await scoreOfflineText('type_text', key, 'WRONG')).toBe(false)
  })

  it('choose_answer: compares the option id', async () => {
    const key = { text_correct_answer_id: 'opt-2' }
    expect(await scoreOfflineText('choose_answer', key, 'opt-2')).toBe(true)
    expect(await scoreOfflineText('choose_answer', key, 'opt-1')).toBe(false)
  })

  it('no key or empty hashes -> not correct', async () => {
    expect(await scoreOfflineText('type_text', undefined, 'x')).toBe(false)
    expect(await scoreOfflineText('type_text', { text_correct_answer_hashes: [] }, 'x')).toBe(false)
  })
})
