import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/auth-context"
import {
  enableDailyReminder,
  getNotificationPreference,
  removeCurrentPushSubscription,
  saveDailyReminderPreference,
} from "@/features/notifications/notification-service"

export const notificationPreferenceQueryKey = (userId: string) => ["notification-preference", userId] as const

export function useNotificationPreference() {
  const { user } = useAuth()
  return useQuery({
    queryKey: notificationPreferenceQueryKey(user?.id ?? "anonymous"),
    queryFn: getNotificationPreference,
    enabled: Boolean(user),
  })
}

export function useEnableDailyReminder() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: enableDailyReminder,
    onSuccess: (preference) => {
      queryClient.setQueryData(notificationPreferenceQueryKey(user?.id ?? preference.user_id), preference)
    },
  })
}

export function useSaveDailyReminderPreference() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveDailyReminderPreference,
    onSuccess: (preference) => {
      queryClient.setQueryData(notificationPreferenceQueryKey(user?.id ?? preference.user_id), preference)
    },
  })
}

export function useRemoveCurrentPushSubscription() {
  return useMutation({ mutationFn: removeCurrentPushSubscription })
}
