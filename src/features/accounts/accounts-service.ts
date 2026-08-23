import { getSupabaseClient } from "@/lib/supabase"
import { performFinancialMutation } from "@/lib/network"
import type { AccountSummaryRow } from "@/types/database"
import type { AccountType } from "@/types/finance"

export type SaveAccountInput = {
  id?: string
  name: string
  accountType: AccountType
  institution: string
  currencyCode: string
  openingBalanceMinor: number
}

export type SaveValuationInput = {
  accountId: string
  nativeValueMinor: number
  baseValueMinor: number
  valuedAt: string
}

export async function getAccountSummaries() {
  const { data, error } = await getSupabaseClient().rpc("get_account_summaries")
  if (error) throw error
  return (data ?? []) as AccountSummaryRow[]
}

export async function saveAccount(input: SaveAccountInput) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("upsert_account", {
      p_account_id: input.id ?? null,
      p_name: input.name,
      p_account_type: input.accountType,
      p_institution: input.institution || null,
      p_currency_code: input.currencyCode,
      p_opening_balance_minor: input.accountType === "investment" ? 0 : input.openingBalanceMinor,
    })
    if (error) throw error
    return data
  })
}

export async function archiveAccount(accountId: string) {
  return performFinancialMutation(async () => {
    const { error } = await getSupabaseClient().rpc("archive_account", {
      p_account_id: accountId,
    })
    if (error) throw error
  })
}

export async function saveInvestmentValuation(input: SaveValuationInput) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("upsert_investment_valuation", {
      p_account_id: input.accountId,
      p_native_value_minor: input.nativeValueMinor,
      p_base_value_minor: input.baseValueMinor,
      p_valued_at: input.valuedAt,
    })
    if (error) throw error
    return data
  })
}
