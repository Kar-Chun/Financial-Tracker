import { createContext, useContext } from "react"
import type { Session, User } from "@supabase/supabase-js"

export type AuthContextValue = {
  session: Session | null
  user: User | null
  isLoading: boolean
  configurationError: string | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside AuthProvider.")
  return context
}
