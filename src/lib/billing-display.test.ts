import { describe, expect, it } from 'vitest'

import { sumUnpaidDue } from './billing-display'

// P6.4: a recurring restart supersedes the finished run's invoice. Superseded
// rows are always settled by the restart's own guard, but the display sums must
// never count one as owed even if a row were forced unpaid by staff later.
describe('sumUnpaidDue', () => {
  it('sums only unpaid invoices', () => {
    expect(
      sumUnpaidDue([
        { status: 'unpaid', amount_due: 150 },
        { status: 'paid', amount_due: 50 },
        { status: 'comped', amount_due: 0 },
        { status: 'refunded', amount_due: 100 },
      ]),
    ).toBe(150)
  })

  it('ignores superseded invoices from earlier runs of a recurring event', () => {
    expect(
      sumUnpaidDue([
        { status: 'unpaid', amount_due: 150, superseded: true },
        { status: 'unpaid', amount_due: 80, superseded: false },
      ]),
    ).toBe(80)
  })

  it('treats a missing superseded flag as not superseded', () => {
    expect(sumUnpaidDue([{ status: 'unpaid', amount_due: 60 }])).toBe(60)
  })
})
