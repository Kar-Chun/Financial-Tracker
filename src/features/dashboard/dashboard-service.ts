import { getSupabaseClient } from "@/lib/supabase"
import type { AccountSummaryRow, NetWorthSnapshot } from "@/types/database"
import type { TransactionRecord } from "@/types/finance"

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

type DashboardRpcResult = {
  accounts: AccountSummaryRow[]
  monthly: {
    income_minor: number
    expenses_minor: number
    net_cash_flow_minor: number
  }
  spending_groups: Array<{ label: string; amount_minor: number }>
  recent_transactions: TransactionRecord[]
  snapshots: NetWorthSnapshot[]
}

export async function getDashboardData() {
  const { data, error } = await getSupabaseClient().rpc("get_dashboard_data")
  if (error) throw error
  const result = data as unknown as DashboardRpcResult

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
