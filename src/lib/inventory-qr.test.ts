import { describe, expect, it } from 'vitest'

import { inventoryCodeFromQrValue } from '@/lib/inventory-qr'

const CODE = '123e4567-e89b-42d3-a456-426614174000'

describe('inventoryCodeFromQrValue', () => {
  it('extracts an inventory item code from a RallyHub-style link', () => {
    expect(
      inventoryCodeFromQrValue(`https://app.rallyhub.games/inventory/item/${CODE}`),
    ).toBe(CODE)
  })

  it('accepts preview-host links but returns only the item code', () => {
    expect(
      inventoryCodeFromQrValue(`https://feature-inventory.vercel.app/inventory/item/${CODE}/`),
    ).toBe(CODE)
  })

  it('rejects unrelated, malformed, and non-UUID QR values', () => {
    expect(inventoryCodeFromQrValue('https://example.com/contact')).toBeNull()
    expect(inventoryCodeFromQrValue('not a URL')).toBeNull()
    expect(inventoryCodeFromQrValue('https://example.com/inventory/item/not-an-id')).toBeNull()
  })
})
