import { Landmark } from "lucide-react"
import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"

type AppLogoProps = {
  compact?: boolean
  className?: string
}

export function AppLogo({ compact = false, className }: AppLogoProps) {
  return (
    <Link
      to="/dashboard"
      className={cn("inline-flex items-center gap-3", className)}
      aria-label="Ledgerly dashboard"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
        <Landmark className="size-5" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="text-lg font-semibold tracking-tight">Ledgerly</span>
      )}
    </Link>
  )
}
