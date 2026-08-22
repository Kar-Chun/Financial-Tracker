import { Menu } from "lucide-react"
import { useState } from "react"

import { NavigationLink } from "@/components/layout/navigation-link"
import {
  primaryNavigation,
  settingsNavigation,
} from "@/components/layout/navigation"
import { UserMenu } from "@/components/layout/user-menu"
import { AppLogo } from "@/components/shared/app-logo"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function MobileHeader() {
  const [open, setOpen] = useState(false)
  const closeNavigation = () => setOpen(false)

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden">
      <AppLogo />
      <div className="flex items-center gap-1">
        <UserMenu compact />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="inline-flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-[19rem] max-w-[85vw] gap-0 p-0">
            <SheetHeader className="border-b px-5 py-5 text-left">
              <SheetTitle>
                <AppLogo />
              </SheetTitle>
              <SheetDescription className="sr-only">
                Navigate around Ledgerly
              </SheetDescription>
            </SheetHeader>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Mobile navigation">
              {primaryNavigation.map((item) => (
                <NavigationLink
                  key={item.href}
                  item={item}
                  onNavigate={closeNavigation}
                />
              ))}
            </nav>
            <div className="space-y-3 p-3">
              <NavigationLink item={settingsNavigation} onNavigate={closeNavigation} />
              <Separator />
              <UserMenu />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
