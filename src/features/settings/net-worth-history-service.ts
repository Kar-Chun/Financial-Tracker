import { performFinancialMutation } from "@/lib/network"
import { getSupabaseClient } from "@/lib/supabase"

export async function resetNetWorthHistory() {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("reset_net_worth_history")
    if (error) throw error
    return data
  })
}
