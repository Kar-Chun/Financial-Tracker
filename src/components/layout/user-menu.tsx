import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ChevronsUpDown, LogOut, Settings } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/features/auth/auth-context"
import { useProfile } from "@/features/auth/profile-service"
import { signOut } from "@/features/auth/auth-service"
import { getErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

type UserMenuProps = {
  compact?: boolean
}

export function UserMenu({ compact = false }: UserMenuProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const profileQuery = useProfile()
  const displayName = profileQuery.data?.display_name || user?.email || "Your workspace"
  const initials = getInitials(displayName)
  const logoutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.clear()
      navigate("/login", { replace: true })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not sign out. Please try again."))
    },
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring",
          compact && "w-auto",
        )}
        aria-label="Open user menu"
      >
        <Avatar>
          <AvatarFallback className="bg-primary/15 font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{displayName}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {user?.email}
              </span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={compact ? "bottom" : "top"} className="w-56">
        <DropdownMenuLabel>Personal workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut />
          {logoutMutation.isPending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "U"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}
