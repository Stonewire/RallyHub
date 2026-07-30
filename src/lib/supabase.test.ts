import { describe, expect, it } from 'vitest'

import { acceptsTeamTokenHeader } from '@/lib/supabase'

const BASE = 'https://project.supabase.co'

/**
 * Only Postgres reads x-team-token. Attaching it to an Edge Function or Storage
 * request makes the browser refuse to send the request at all, because their CORS
 * preflight does not allow the header — which is exactly how every photo/video
 * submission broke.
 */
describe('acceptsTeamTokenHeader', () => {
  it('allows REST and RPC requests', () => {
    expect(acceptsTeamTokenHeader(`${BASE}/rest/v1/submissions`)).toBe(true)
    expect(acceptsTeamTokenHeader(`${BASE}/rest/v1/rpc/claim_team_with_inventory_access`)).toBe(
      true,
    )
  })

  it('blocks Edge Function and Storage requests', () => {
    expect(acceptsTeamTokenHeader(`${BASE}/functions/v1/mint-storage-upload-url`)).toBe(false)
    expect(acceptsTeamTokenHeader(`${BASE}/storage/v1/object/upload/sign/game-assets/a.jpg`)).toBe(
      false,
    )
  })

  it('handles URL and Request inputs, not just strings', () => {
    expect(acceptsTeamTokenHeader(new URL(`${BASE}/rest/v1/teams`))).toBe(true)
    expect(acceptsTeamTokenHeader(new Request(`${BASE}/functions/v1/demo-reset`))).toBe(false)
  })
})
