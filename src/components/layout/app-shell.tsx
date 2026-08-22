import { Outlet } from "react-router-dom"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { MobileHeader } from "@/components/layout/mobile-header"

export function AppShell() {
  return (
    <div className="min-h-svh bg-muted/30">
      <AppSidebar />
      <MobileHeader />
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-[100rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
