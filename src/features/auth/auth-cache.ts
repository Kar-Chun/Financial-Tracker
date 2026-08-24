export function shouldClearUserCache(previousUserId: string | null | undefined, nextUserId: string | null) {
  return previousUserId !== undefined && previousUserId !== nextUserId
}

export function clearSensitiveCacheForUserChange(
  cache: { clear(): void },
  previousUserId: string | null | undefined,
  nextUserId: string | null,
) {
  if (!shouldClearUserCache(previousUserId, nextUserId)) return false
  cache.clear()
  return true
}
