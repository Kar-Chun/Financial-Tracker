import { NavigationLink } from "@/components/layout/navigation-link"
import {
  primaryNavigation,
  settingsNavigation,
} from "@/components/layout/navigation"
import { UserMenu } from "@/components/layout/user-menu"
import { AppLogo } from "@/components/shared/app-logo"
import { Separator } from "@/components/ui/separator"

export function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
      <div className="px-6 py-6">
        <AppLogo />
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Primary navigation">
        {primaryNavigation.map((item) => (
          <NavigationLink key={item.href} item={item} />
        ))}
      </nav>

      <div className="space-y-3 p-3">
        <NavigationLink item={settingsNavigation} />
        <Separator />
        <UserMenu />
      </div>
    </aside>
  )
}
