export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value) {
  return UUID_RE.test(value)
}

/** Org UUIDs from argv (index 2+); ignores flags and non-UUID tokens. */
export function parseOrgIdsFromArgv(argv, defaultOrgs) {
  const uuids = argv.slice(2).filter((arg) => !arg.startsWith('--') && isUuid(arg))
  return uuids.length > 0 ? uuids : defaultOrgs
}

export function hasApplyFlag(argv) {
  return argv.slice(2).includes('--apply')
}
