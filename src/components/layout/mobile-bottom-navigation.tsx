import { ChevronRight, ChartNoAxesCombined, CircleGauge, Landmark, Menu, PiggyBank, Plus, ReceiptText, Settings, Sparkles, Target, WalletCards } from "lucide-react"
import { useState } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"

import { UserMenu } from "@/components/layout/user-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const primaryItems = [
  { label: "Home", href: "/dashboard", icon: CircleGauge },
  { label: "Transactions", href: "/transactions", icon: ReceiptText },
  { label: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
]

const moreItems = [
  { label: "AI Assistant", href: "/assistant", icon: Sparkles, group: "Insights" },
  { label: "Budgets", href: "/budgets", icon: PiggyBank, group: "Plan" },
  { label: "Savings Goals", href: "/goals", icon: Target, group: "Plan" },
  { label: "Accounts", href: "/accounts", icon: WalletCards, group: "Money" },
  { label: "Investments", href: "/investments", icon: Landmark, group: "Money" },
  { label: "Settings", href: "/settings", icon: Settings, group: "Account" },
]

export function MobileBottomNavigation() {
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = moreItems.some((item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`))
  const routeItem = (item: typeof primaryItems[number]) => {
    const active = location.pathname === item.href
    return (
      <NavLink
        key={item.href}
        to={item.href}
        aria-label={item.label}
        className={cn(
          "flex h-(--mobile-navigation-row-height) min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[0.66rem] leading-none font-medium text-muted-foreground",
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
        data-layout="edge-bar"
        className="fixed right-0 bottom-0 left-0 z-40 h-(--mobile-navigation-height) w-full border-t border-border/45 bg-surface-elevated/95 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid h-full max-w-lg grid-cols-4 items-start pb-(--mobile-safe-area-bottom)">
          {routeItem(primaryItems[0])}
          {routeItem(primaryItems[1])}
          {routeItem(primaryItems[2])}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More navigation options"
            aria-current={moreActive ? "page" : undefined}
            className={cn(
              "flex h-(--mobile-navigation-row-height) min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[0.66rem] leading-none font-medium text-muted-foreground",
              moreActive && "text-primary",
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
            <SheetDescription>Planning, money, and your account.</SheetDescription>
          </SheetHeader>
          <nav className="space-y-3 px-4" aria-label="More navigation">
            {["Plan", "Money", "Insights", "Account"].map((group) => (
              <section key={group} aria-label={group}>
                <h2 className="section-heading mb-1">{group}</h2>
                {moreItems.filter((item) => item.group === group).map((item) => (
                  <NavLink key={item.href} to={item.href} onClick={() => setMoreOpen(false)}
                    className={({ isActive }) => cn("ledger-interactive flex min-h-12 items-center gap-3 border-b border-border/20 px-1 text-sm font-medium", isActive && "text-primary")}>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-brand-secondary"><item.icon className="size-4" aria-hidden="true" /></span>
                    <span className="flex-1">{item.label}</span><ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </NavLink>
                ))}
              </section>
            ))}
          </nav>
          <div className="border-t border-border/35 p-4"><UserMenu /></div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export function MobileQuickAddButton() {
  const location = useLocation()
  if (location.pathname === "/assistant") return null

  return (
    <Link
      to="/transactions/new"
      state={{ returnTo: `${location.pathname}${location.search}` }}
      aria-label="Quick add transaction"
      className="fixed right-[max(1.25rem,calc(env(safe-area-inset-right)+1rem))] bottom-[calc(var(--mobile-navigation-height)+var(--mobile-floating-action-gap))] z-45 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/25 outline-none transition-transform hover:bg-primary/90 active:scale-95 focus-visible:ring-3 focus-visible:ring-ring lg:hidden"
    >
      <Plus className="size-6" aria-hidden="true" />
    </Link>
  )
}
