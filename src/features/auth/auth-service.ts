import { getSupabaseClient } from "@/lib/supabase"

type SignUpInput = {
  email: string
  password: string
  displayName: string
}

export async function signUp({ email, password, displayName }: SignUpInput) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName.trim() || null,
      },
    },
  })

  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut()
  if (error) throw error
}
