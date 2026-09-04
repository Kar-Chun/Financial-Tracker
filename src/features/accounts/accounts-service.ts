import { getSupabaseClient } from "@/lib/supabase"
import { performFinancialMutation } from "@/lib/network"
import { parseRpcResponse } from "@/lib/rpc-validation"
import type { AccountType } from "@/types/finance"
import {
  accountDeletionResultSchema,
  accountSummarySchema,
  archivedAccountSchema,
} from "@/types/rpc-schemas"

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

export type ArchivedAccount = {
  id: string
  name: string
  account_type: AccountType
  institution: string | null
  currency_code: string
  opening_balance_minor: number
  archived_at: string
  investment_tracking_mode: "simple" | "detailed"
  detailed_started_on: string | null
}

export type AccountDeletionResult = {
  account_id: string
  soft_deleted_transactions_purged: number
  investment_valuations_deleted: number
  investment_holdings_deleted: number
  investment_trades_deleted: number
  investment_prices_deleted: number
  investment_cash_events_deleted: number
}

export async function getAccountSummaries() {
  const { data, error } = await getSupabaseClient().rpc("get_account_summaries")
  if (error) throw error
  return parseRpcResponse(accountSummarySchema.array(), data ?? [])
}

export async function getArchivedAccounts() {
  const { data, error } = await getSupabaseClient()
    .from("accounts")
    .select("id,name,account_type,institution,currency_code,opening_balance_minor,archived_at,investment_tracking_mode,detailed_started_on")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false })
  if (error) throw error
  return parseRpcResponse(archivedAccountSchema.array(), data ?? [])
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

export async function restoreAccount(accountId: string) {
  return performFinancialMutation(async () => {
    const { error } = await getSupabaseClient().rpc("restore_account", {
      p_account_id: accountId,
    })
    if (error) throw error
  })
}

export async function deleteAccountPermanently(accountId: string) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("delete_account_permanently", {
      p_account_id: accountId,
    })
    if (error) throw error
    return parseRpcResponse(accountDeletionResultSchema, data)
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
