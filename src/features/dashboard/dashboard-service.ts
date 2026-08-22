import { getAccountSummaries } from "@/features/accounts/accounts-service"
import { getCategories, getTransactions } from "@/features/transactions/transactions-service"
import { getSupabaseClient } from "@/lib/supabase"
import type { NetWorthSnapshot } from "@/types/database"

export async function getDashboardData() {
  const client = getSupabaseClient()
  const { error: refreshError } = await client.rpc("refresh_net_worth_snapshot")
  if (refreshError) throw refreshError

  const [accounts, transactions, categories, snapshotsResult] = await Promise.all([
    getAccountSummaries(),
    getTransactions(),
    getCategories(),
    client
      .from("net_worth_snapshots")
      .select("id, user_id, snapshot_date, bank_value_base_minor, cash_value_base_minor, investment_value_base_minor, total_value_base_minor, created_at, updated_at")
      .order("snapshot_date", { ascending: false })
      .limit(90),
  ])

  if (snapshotsResult.error) throw snapshotsResult.error

  return {
    accounts,
    transactions,
    categories,
    snapshots: snapshotsResult.data as NetWorthSnapshot[],
  }
}
