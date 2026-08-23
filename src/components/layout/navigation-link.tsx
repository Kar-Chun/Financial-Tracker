import { NavLink } from "react-router-dom"

import type { NavigationItem } from "@/components/layout/navigation"
import { cn } from "@/lib/utils"

type NavigationLinkProps = {
  item: NavigationItem
  onNavigate?: () => void
}

export function NavigationLink({ item, onNavigate }: NavigationLinkProps) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.href}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
          isActive && "bg-sidebar-accent text-primary ring-1 ring-primary/10",
        )
      }
    >
      <Icon className="size-4.5" aria-hidden="true" />
      {item.label}
    </NavLink>
  )
}
