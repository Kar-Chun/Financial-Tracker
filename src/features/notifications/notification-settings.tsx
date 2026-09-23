import { Bell, LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useEnableDailyReminder,
  useNotificationPreference,
  useRemoveCurrentPushSubscription,
  useSaveDailyReminderPreference,
} from "@/features/notifications/notification-hooks"
import {
  getCurrentPushSubscription,
  getNotificationPermissionStatus,
  type NotificationPermissionStatus,
} from "@/features/notifications/notification-service"
import { getErrorMessage } from "@/lib/errors"

const permissionLabels: Record<NotificationPermissionStatus, string> = {
  allowed: "Allowed",
  not_allowed: "Not allowed",
  blocked: "Blocked",
  unsupported: "Unsupported",
}

export function NotificationSettings() {
  const preferenceQuery = useNotificationPreference()
  const enableMutation = useEnableDailyReminder()
  const saveMutation = useSaveDailyReminderPreference()
  const removeMutation = useRemoveCurrentPushSubscription()
  const [permissionStatus, setPermissionStatus] = useState(getNotificationPermissionStatus)
  const [hasCurrentSubscription, setHasCurrentSubscription] = useState(false)

  useEffect(() => {
    const refreshPermission = () => setPermissionStatus(getNotificationPermissionStatus())
    window.addEventListener("focus", refreshPermission)
    document.addEventListener("visibilitychange", refreshPermission)
    return () => {
      window.removeEventListener("focus", refreshPermission)
      document.removeEventListener("visibilitychange", refreshPermission)
    }
  }, [])

  useEffect(() => {
    let active = true
    if (permissionStatus !== "allowed") {
      return () => { active = false }
    }
    void getCurrentPushSubscription()
      .then((subscription) => { if (active) setHasCurrentSubscription(Boolean(subscription)) })
      .catch(() => { if (active) setHasCurrentSubscription(false) })
    return () => { active = false }
  }, [permissionStatus])

  const preference = preferenceQuery.data
  const enabled = preference?.daily_reminder_enabled ?? false
  const isPending = enableMutation.isPending || saveMutation.isPending || removeMutation.isPending
  const canEnable = permissionStatus === "allowed"

  const enable = () => {
    enableMutation.mutate(undefined, {
      onSuccess: () => {
        setPermissionStatus(getNotificationPermissionStatus())
        setHasCurrentSubscription(true)
        toast.success("Daily reminder enabled.")
      },
      onError: (error) => {
        setPermissionStatus(getNotificationPermissionStatus())
        toast.error(getErrorMessage(error, "Notifications could not be enabled."))
      },
    })
  }

  const disable = () => {
    saveMutation.mutate(false, {
      onSuccess: () => toast.success("Daily reminder disabled."),
      onError: (error) => toast.error(getErrorMessage(error, "The reminder could not be disabled.")),
    })
  }

  const removeDevice = () => {
    removeMutation.mutate(undefined, {
      onSuccess: () => {
        setHasCurrentSubscription(false)
        toast.success("This device was removed from notifications.")
      },
      onError: (error) => toast.error(getErrorMessage(error, "This device could not be removed.")),
    })
  }

  if (preferenceQuery.isLoading) return <Skeleton className="h-72 rounded-xl" />

  return (
    <Card className="rounded-none bg-transparent ring-0">
      <CardHeader className="px-0">
        <CardTitle className="flex items-center gap-2"><Bell className="size-4" /> Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 px-0">
        {preferenceQuery.isError ? (
          <p className="text-sm text-destructive">Notification settings could not be loaded.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Daily transaction reminder</p>
                <p className="mt-1 text-xs text-muted-foreground">Every day at 9:00 PM</p>
              </div>
              <Button
                type="button"
                role="switch"
                aria-label="Daily transaction reminder"
                aria-checked={enabled}
                variant={enabled ? "default" : "outline"}
                size="sm"
                disabled={isPending || (!enabled && !canEnable)}
                onClick={enabled ? disable : enable}
              >
                {isPending && <LoaderCircle className="animate-spin" />}
                {enabled ? "On" : "Off"}
              </Button>
            </div>

            {permissionStatus === "not_allowed" && (
              <Button type="button" onClick={enable} disabled={isPending}>Enable notifications</Button>
            )}

            <p className="text-sm text-muted-foreground">
              Ledgerly will remind you each night to log anything you missed.
            </p>

            <div className="flex items-start justify-between gap-4 border-t border-border/70 pt-4">
              <div>
                <p className="text-sm font-medium">Notification permission</p>
                <p className="mt-1 text-sm text-muted-foreground">{permissionLabels[permissionStatus]}</p>
                {permissionStatus === "unsupported" && (
                  <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">
                    Notifications are available when Ledgerly is installed as a supported Home Screen app.
                  </p>
                )}
                {permissionStatus === "blocked" && (
                  <p className="mt-2 text-xs text-muted-foreground">Notifications are blocked in your device settings.</p>
                )}
              </div>
              {permissionStatus === "allowed" && hasCurrentSubscription && (
                <Button type="button" variant="outline" size="sm" onClick={removeDevice} disabled={isPending}>
                  Remove this device
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
