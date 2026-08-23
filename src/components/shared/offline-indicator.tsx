import { WifiOff } from "lucide-react"

import { useOnlineStatus } from "@/hooks/use-online-status"

export function OfflineIndicator() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null

  return (
    <div
      role="status"
      className="fixed top-[calc(env(safe-area-inset-top)+0.5rem)] left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-300/25 bg-slate-950/95 px-3 py-2 text-xs font-medium text-amber-100 shadow-xl backdrop-blur"
    >
      <WifiOff className="size-3.5" />
      Offline · financial changes are disabled
    </div>
  )
}
