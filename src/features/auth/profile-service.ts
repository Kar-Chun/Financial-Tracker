import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/auth-context"
import { getSupabaseClient } from "@/lib/supabase"
import type { Profile } from "@/types/finance"

export const profileQueryKey = (userId: string) => ["profile", userId] as const

async function getProfile(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from("profiles")
    .select("id, display_name, base_currency, timezone, created_at, updated_at")
    .eq("id", userId)
    .single()

  if (error) throw error
  return data satisfies Profile
}

export function useProfile() {
  const { user } = useAuth()

  return useQuery({
    queryKey: profileQueryKey(user?.id ?? "anonymous"),
    queryFn: () => getProfile(user!.id),
    enabled: Boolean(user),
  })
}

export function useUpdateProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { displayName: string; timezone: string }) => {
      if (!user) throw new Error("Authentication is required.")

      const { data, error } = await getSupabaseClient()
        .from("profiles")
        .update({
          display_name: input.displayName.trim() || null,
          timezone: input.timezone,
        })
        .eq("id", user.id)
        .select("id, display_name, base_currency, timezone, created_at, updated_at")
        .single()

      if (error) throw error
      return data satisfies Profile
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey(profile.id), profile)
    },
  })
}
