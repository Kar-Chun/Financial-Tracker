import { Outlet, useLocation } from "react-router-dom"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { MobileBottomNavigation, MobileQuickAddButton } from "@/components/layout/mobile-bottom-navigation"
import { MobileHeader } from "@/components/layout/mobile-header"
import { cn } from "@/lib/utils"

export function AppShell() {
  const location = useLocation()
  const isTransactionEntry = location.pathname === "/transactions/new"

  return (
    <div className="min-h-svh bg-background">
      <AppSidebar />
      {!isTransactionEntry && <MobileHeader />}
      <main className="lg:pl-64">
        <div className={cn(
          "mx-auto w-full max-w-[92rem]",
          isTransactionEntry
            ? "lg:px-10 lg:py-9"
            : "pr-[max(1.25rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))] pt-3 pb-[calc(var(--mobile-navigation-height)+var(--mobile-navigation-edge-gap)+var(--mobile-floating-action-gap)+5rem+env(safe-area-inset-bottom))] sm:px-7 sm:pt-6 lg:px-10 lg:py-9",
        )}>
          <Outlet />
        </div>
      </main>
      {!isTransactionEntry && <MobileBottomNavigation />}
      {!isTransactionEntry && <MobileQuickAddButton />}
    </div>
  )
}
