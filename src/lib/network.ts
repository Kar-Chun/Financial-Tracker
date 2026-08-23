export const offlineFinancialMutationMessage = "You're offline. Reconnect before saving financial changes."

export class OfflineFinancialMutationError extends Error {
  constructor() {
    super(offlineFinancialMutationMessage)
    this.name = "OfflineFinancialMutationError"
  }
}

export function isBrowserOnline() {
  return typeof navigator === "undefined" || navigator.onLine
}

export async function performFinancialMutation<T>(operation: () => Promise<T>) {
  if (!isBrowserOnline()) throw new OfflineFinancialMutationError()
  return operation()
}

export function subscribeToOnlineStatus(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}
