import { AppLogo } from "@/components/shared/app-logo"

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-end border-b bg-background/95 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] pt-[env(safe-area-inset-top)] pb-3 backdrop-blur lg:hidden">
      <AppLogo />
    </header>
  )
}
