import { Outlet, useLocation } from "react-router-dom"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { MobileBottomNavigation, MobileQuickAddButton } from "@/components/layout/mobile-bottom-navigation"
import { cn } from "@/lib/utils"

export function AppShell() {
  const location = useLocation()
  const isFocusedEntry = location.pathname === "/transactions/new" || location.pathname === "/goals/new"

  return (
    <div className="min-h-svh bg-background">
      <AppSidebar />
      <main className="lg:pl-64">
        <div className={cn(
          "mx-auto w-full max-w-[92rem]",
          isFocusedEntry
            ? "lg:px-10 lg:py-9"
            : "pr-[max(1.25rem,env(safe-area-inset-right))] pb-[calc(var(--mobile-navigation-height)+var(--mobile-floating-action-gap)+5rem)] pl-[max(1.25rem,env(safe-area-inset-left))] pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-7 sm:pt-6 lg:px-10 lg:py-9",
        )}>
          <Outlet />
        </div>
      </main>
      {!isFocusedEntry && <MobileBottomNavigation />}
      {!isFocusedEntry && <MobileQuickAddButton />}
    </div>
  )
}
