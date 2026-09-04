import { getSupabaseClient } from "@/lib/supabase"
import { parseRpcResponse } from "@/lib/rpc-validation"
import type { AccountSummaryRow, NetWorthSnapshot, TransactionRecord } from "@/types/finance"
import { dashboardRpcSchema } from "@/types/rpc-schemas"

export type DashboardData = {
  accounts: AccountSummaryRow[]
  monthly: {
    incomeMinor: number
    expensesMinor: number
    netCashFlowMinor: number
  }
  spendingGroups: Array<{ label: string; amountMinor: number }>
  transactions: TransactionRecord[]
  snapshots: NetWorthSnapshot[]
}

export async function getDashboardData() {
  const { data, error } = await getSupabaseClient().rpc("get_dashboard_data")
  if (error) throw error
  const result = parseRpcResponse(dashboardRpcSchema, data)

  return {
    accounts: result.accounts ?? [],
    monthly: {
      incomeMinor: result.monthly.income_minor,
      expensesMinor: result.monthly.expenses_minor,
      netCashFlowMinor: result.monthly.net_cash_flow_minor,
    },
    spendingGroups: (result.spending_groups ?? []).map((group) => ({
      label: group.label,
      amountMinor: group.amount_minor,
    })),
    transactions: result.recent_transactions ?? [],
    snapshots: result.snapshots ?? [],
  } satisfies DashboardData
}
