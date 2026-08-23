import { useState } from "react"
import { Outlet } from "react-router-dom"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { MobileBottomNavigation } from "@/components/layout/mobile-bottom-navigation"
import { MobileHeader } from "@/components/layout/mobile-header"
import { QuickAddSheet } from "@/features/transactions/quick-add-sheet"

export function AppShell() {
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  return (
    <div className="min-h-svh bg-background">
      <AppSidebar />
      <MobileHeader />
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-[92rem] pr-[max(1.25rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))] pt-3 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-7 sm:pt-6 lg:px-10 lg:py-9">
          <Outlet />
        </div>
      </main>
      <MobileBottomNavigation onQuickAdd={() => setQuickAddOpen(true)} />
      {quickAddOpen && <QuickAddSheet open onOpenChange={setQuickAddOpen} />}
    </div>
  )
}
