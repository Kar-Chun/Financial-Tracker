import { getSupabaseClient } from "@/lib/supabase"
import { performFinancialMutation } from "@/lib/network"
import type { Category, FrequentExpenseCategoryRow } from "@/types/database"
import type { TransactionRecord } from "@/types/finance"

export type SaveTransactionInput = {
  id?: string
  transactionType: "expense" | "income" | "transfer"
  amountMinor: number
  accountId: string
  destinationAccountId?: string
  categoryId?: string
  transactionDate: string
  description: string
}

export type TransactionPageFilters = {
  startDate: string | null
  endDate: string | null
  transactionType: TransactionRecord["transaction_type"] | null
  accountId: string | null
  categoryId: string | null
}

export type TransactionCursor = {
  transaction_date: string
  created_at: string
  id: string
}

export type TransactionPage = {
  items: TransactionRecord[]
  has_more: boolean
  next_cursor: TransactionCursor | null
}

export const transactionPageSize = 40

export function getTransactionMonthRange(month: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month)
  if (!match) return { startDate: null, endDate: null }

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const finalDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(finalDay).padStart(2, "0")}`,
  }
}

export async function getCategories() {
  const { data, error } = await getSupabaseClient()
    .from("categories")
    .select("id, user_id, name, parent_id, category_type, created_at, archived_at")
    .order("category_type")
    .order("name")

  if (error) throw error
  return data as Category[]
}

export async function getTransactionsPage(input: {
  filters: TransactionPageFilters
  cursor?: TransactionCursor | null
  pageSize?: number
}) {
  const { filters, cursor = null, pageSize = transactionPageSize } = input
  const { data, error } = await getSupabaseClient().rpc("get_transactions_page", {
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_transaction_type: filters.transactionType,
    p_account_id: filters.accountId,
    p_category_id: filters.categoryId,
    p_limit: pageSize,
    p_cursor_transaction_date: cursor?.transaction_date ?? null,
    p_cursor_created_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null,
  })
  if (error) throw error
  const page = data as unknown as TransactionPage
  return {
    items: page.items ?? [],
    has_more: page.has_more,
    next_cursor: page.next_cursor,
  } satisfies TransactionPage
}

export function flattenTransactionPages(pages: TransactionPage[]) {
  const unique = new Map<string, TransactionRecord>()
  for (const page of pages) {
    for (const transaction of page.items) unique.set(transaction.id, transaction)
  }
  return [...unique.values()]
}

export async function getFrequentExpenseCategories() {
  const { data, error } = await getSupabaseClient().rpc("get_frequent_expense_categories", {
    p_limit: 5,
    p_days: 90,
  })
  if (error) throw error
  return (data ?? []) as FrequentExpenseCategoryRow[]
}

export async function saveTransaction(input: SaveTransactionInput) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("upsert_financial_transaction", {
      p_transaction_id: input.id ?? null,
      p_transaction_type: input.transactionType,
      p_amount_minor: input.amountMinor,
      p_account_id: input.accountId,
      p_destination_account_id: input.destinationAccountId ?? null,
      p_category_id: input.categoryId ?? null,
      p_transaction_date: input.transactionDate,
      p_description: input.description || null,
    })

    if (error) throw error
    return data
  })
}

export async function softDeleteTransaction(transactionId: string) {
  return performFinancialMutation(async () => {
    const { error } = await getSupabaseClient().rpc("soft_delete_transaction", {
      p_transaction_id: transactionId,
    })
    if (error) throw error
  })
}
