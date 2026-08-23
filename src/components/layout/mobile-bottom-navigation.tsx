import { ChartNoAxesCombined, CircleGauge, Landmark, Menu, Plus, ReceiptText, Settings, WalletCards } from "lucide-react"
import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"

import { UserMenu } from "@/components/layout/user-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type MobileBottomNavigationProps = {
  onQuickAdd: () => void
}

const primaryItems = [
  { label: "Home", href: "/dashboard", icon: CircleGauge },
  { label: "Transactions", href: "/transactions", icon: ReceiptText },
  { label: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
]

const moreItems = [
  { label: "Accounts", href: "/accounts", icon: WalletCards },
  { label: "Investments", href: "/investments", icon: Landmark },
  { label: "Settings", href: "/settings", icon: Settings },
]

export function MobileBottomNavigation({ onQuickAdd }: MobileBottomNavigationProps) {
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const routeItem = (item: typeof primaryItems[number]) => {
    const active = location.pathname === item.href
    return (
      <NavLink
        key={item.href}
        to={item.href}
        aria-label={item.label}
        className={cn(
          "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.68rem] font-medium text-muted-foreground",
          active && "text-primary",
        )}
      >
        <item.icon className="size-5" aria-hidden="true" />
        <span className="truncate">{item.label}</span>
      </NavLink>
    )
  }

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed right-[max(0.75rem,env(safe-area-inset-right))] bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-40 rounded-2xl bg-surface-elevated/95 px-1 shadow-lg shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-center">
          {routeItem(primaryItems[0])}
          {routeItem(primaryItems[1])}
          <button
            type="button"
            onClick={onQuickAdd}
            aria-label="Quick add transaction"
            className="mx-auto -mt-6 flex size-15 items-center justify-center rounded-full border-[5px] border-background bg-primary text-primary-foreground shadow-lg shadow-black/25 outline-none transition-transform hover:bg-primary/90 active:scale-95 focus-visible:ring-3 focus-visible:ring-ring"
          >
            <Plus className="size-7" aria-hidden="true" />
          </button>
          {routeItem(primaryItems[2])}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More navigation options"
            aria-current={moreItems.some((item) => item.href === location.pathname) ? "page" : undefined}
            className={cn(
              "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.68rem] font-medium text-muted-foreground",
              moreItems.some((item) => item.href === location.pathname) && "text-primary",
            )}
          >
            <Menu className="size-5" aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border/40 bg-popover pb-[env(safe-area-inset-bottom)]">
          <SheetHeader className="border-b border-border/35 text-left">
            <SheetTitle>More</SheetTitle>
            <SheetDescription>Accounts, investments, settings, and your session.</SheetDescription>
          </SheetHeader>
          <nav className="grid gap-2 px-4" aria-label="More navigation">
            {moreItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={() => setMoreOpen(false)}
              className="flex min-h-13 items-center gap-3 rounded-xl bg-surface px-4 text-sm font-medium ring-1 ring-border/25 transition-colors hover:bg-accent"
              >
                <item.icon className="size-5 text-primary" /> {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-border/35 p-4"><UserMenu /></div>
        </SheetContent>
      </Sheet>
    </>
  )
}
