import { describe, expect, it } from 'vitest'

import { formatInvoicePlanLine } from './billing-display'
import { emptyEventForm } from './event-form-utils'

describe('additional-team billing presentation', () => {
  it('starts every new event with the five included teams', () => {
    const form = emptyEventForm()
    expect(form.teamCount).toBe(5)
    expect(form.teams).toHaveLength(5)
  })

  it('itemises additional teams on the invoice', () => {
    expect(formatInvoicePlanLine('arena', 179, 3, 30)).toBe(
      'Starter · €149 event fee · 3 extra teams (€30)',
    )
  })

  it('keeps a five-team invoice free of add-on wording', () => {
    expect(formatInvoicePlanLine('pro', 99)).toBe('Pro · €99 event fee')
  })
})
