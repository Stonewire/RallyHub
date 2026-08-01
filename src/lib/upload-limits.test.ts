import { describe, expect, it } from 'vitest'

import {
  UPLOAD_MAX_AVATAR_BYTES,
  isAllowedImageUploadType,
  validateImageUpload,
} from '@/lib/upload-limits'

function fakeFile(type: string, bytes: number): File {
  const file = new File(['x'], 'upload', { type })
  // File size is read-only, so stub it rather than allocating real bytes.
  Object.defineProperty(file, 'size', { value: bytes })
  return file
}

describe('isAllowedImageUploadType', () => {
  it('accepts the raster formats the buckets allow', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/avif']) {
      expect(isAllowedImageUploadType(fakeFile(type, 10))).toBe(true)
    }
  })

  it('rejects SVG, which is script-bearing and served from a public bucket', () => {
    expect(isAllowedImageUploadType(fakeFile('image/svg+xml', 10))).toBe(false)
  })

  it('rejects non-images and empty types', () => {
    expect(isAllowedImageUploadType(fakeFile('text/html', 10))).toBe(false)
    expect(isAllowedImageUploadType(fakeFile('', 10))).toBe(false)
  })
})

describe('validateImageUpload', () => {
  it('passes a small PNG', () => {
    expect(validateImageUpload(fakeFile('image/png', 1000), 'avatar')).toBeNull()
  })

  it('explains why SVG is refused, before checking size', () => {
    const message = validateImageUpload(fakeFile('image/svg+xml', 10), 'avatar')
    expect(message).toContain('SVG is not supported')
  })

  it('enforces the 2MB avatar cap', () => {
    expect(
      validateImageUpload(fakeFile('image/png', UPLOAD_MAX_AVATAR_BYTES), 'avatar'),
    ).toBeNull()
    expect(
      validateImageUpload(fakeFile('image/png', UPLOAD_MAX_AVATAR_BYTES + 1), 'avatar'),
    ).toContain('2MB or smaller')
  })

  it('allows a logo larger than the avatar cap', () => {
    expect(
      validateImageUpload(fakeFile('image/png', UPLOAD_MAX_AVATAR_BYTES + 1), 'logo'),
    ).toBeNull()
  })
})
