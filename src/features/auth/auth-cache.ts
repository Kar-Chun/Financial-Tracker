export function shouldClearUserCache(previousUserId: string | null | undefined, nextUserId: string | null) {
  return previousUserId !== undefined && previousUserId !== nextUserId
}
