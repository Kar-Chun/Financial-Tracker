import { useSyncExternalStore } from "react"

import { isBrowserOnline, subscribeToOnlineStatus } from "@/lib/network"

export function useOnlineStatus() {
  return useSyncExternalStore(subscribeToOnlineStatus, isBrowserOnline, () => true)
}
