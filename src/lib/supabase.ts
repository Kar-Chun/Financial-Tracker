import { createClient } from "@supabase/supabase-js"
import { getAuthReturnKind } from "@/features/auth/auth-redirect"

import type { Database } from "@/types/database"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Read only return metadata before createClient starts processing URL credentials.
export const authReturnKind = typeof window === "undefined" ? null : getAuthReturnKind(window.location.href)

export const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient<Database>(supabaseUrl, supabasePublishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "implicit",
        },
      })
    : null

export const isSupabaseConfigured = supabase !== null

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured for this environment.")
  }

  return supabase
}
