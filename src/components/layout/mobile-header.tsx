import { UserMenu } from "@/components/layout/user-menu"
import { useProfile } from "@/features/auth/profile-service"
import { getGreetingInTimeZone } from "@/lib/dates"

export function MobileHeader() {
  const profileQuery = useProfile()
  const displayName = profileQuery.data?.display_name?.trim() || "Welcome back"
  const greeting = getGreetingInTimeZone(profileQuery.data?.timezone ?? "Asia/Singapore")

  return (
    <header className="sticky top-0 z-20 flex min-h-21 items-end justify-between bg-background/92 pr-[max(1.25rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))] pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur-xl lg:hidden">
      <div className="min-w-0">
        <p className="eyebrow">{greeting}</p>
        <p className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground">{displayName}</p>
      </div>
      <UserMenu compact />
    </header>
  )
}
