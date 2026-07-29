import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAGE_SIZE = 1000

async function collectPaths(
  admin: SupabaseClient,
  bucket: 'game-assets' | 'organization-logos',
  root: string,
): Promise<string[]> {
  const paths: string[] = []
  const folders = [root]

  while (folders.length > 0) {
    const folder = folders.shift()!
    let offset = 0
    while (true) {
      const { data, error } = await admin.storage.from(bucket).list(folder, {
        limit: PAGE_SIZE,
        offset,
      })
      if (error) throw error
      const entries = data ?? []
      for (const entry of entries) {
        const path = `${folder}/${entry.name}`
        if (entry.id || entry.metadata) paths.push(path)
        else folders.push(path)
      }
      if (entries.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }
  }

  return paths
}

async function removePrefix(
  admin: SupabaseClient,
  bucket: 'game-assets' | 'organization-logos',
  prefix: string,
) {
  const paths = await collectPaths(admin, bucket, prefix)
  for (let start = 0; start < paths.length; start += PAGE_SIZE) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(start, start + PAGE_SIZE))
    if (error) throw error
  }
}

/** Remove every mutable upload owned by the demo before its database snapshot is restored. */
export async function cleanupDemoStorage(admin: SupabaseClient, organizationId: string) {
  const { data: events, error } = await admin
    .from('events')
    .select('id')
    .eq('organization_id', organizationId)
  if (error) throw error

  await Promise.all([
    removePrefix(admin, 'game-assets', organizationId),
    removePrefix(admin, 'organization-logos', organizationId),
    ...(events ?? []).map((event) => removePrefix(admin, 'game-assets', event.id)),
  ])
}

/** Remove any team accounts created during the demo and restore the shared host identity. */
export async function cleanupDemoUsers(
  admin: SupabaseClient,
  organizationId: string,
  demoUserId: string | null,
) {
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id')
    .eq('organization_id', organizationId)
  if (error) throw error

  for (const profile of profiles ?? []) {
    if (profile.id === demoUserId) continue
    const { error: deleteError } = await admin.auth.admin.deleteUser(profile.id)
    if (deleteError) throw deleteError
  }

  if (demoUserId) {
    const { error: updateError } = await admin.auth.admin.updateUserById(demoUserId, {
      email: Deno.env.get('DEMO_ACCOUNT_EMAIL') ?? 'demo@rallyhub.games',
      user_metadata: { rallyhub_demo: true, full_name: 'Demo Host', username: 'demo' },
    })
    if (updateError) throw updateError
  }
}
