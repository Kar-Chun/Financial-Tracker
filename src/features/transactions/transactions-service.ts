import { getSupabaseClient } from "@/lib/supabase"
import type { Category } from "@/types/database"
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

export async function getCategories() {
  const { data, error } = await getSupabaseClient()
    .from("categories")
    .select("id, user_id, name, parent_id, category_type, created_at, archived_at")
    .is("archived_at", null)
    .order("category_type")
    .order("name")

  if (error) throw error
  return data as Category[]
}

export async function getTransactions() {
  const client = getSupabaseClient()
  const pageSize = 500
  const transactions: TransactionRecord[] = []

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await client
      .from("transactions")
      .select(`
        id,
        transaction_type,
        category_id,
        description,
        transaction_date,
        created_at,
        category:categories (id, name, parent_id, category_type),
        entries:transaction_entries (
          id,
          account_id,
          amount_minor,
          account:accounts (id, name, currency_code, account_type)
        )
      `)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(start, start + pageSize - 1)

    if (error) throw error

    const page = data as unknown as TransactionRecord[]
    transactions.push(...page)
    if (page.length < pageSize) break
  }

  return transactions
}

export async function saveTransaction(input: SaveTransactionInput) {
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
}

export async function softDeleteTransaction(transactionId: string) {
  const { error } = await getSupabaseClient().rpc("soft_delete_transaction", {
    p_transaction_id: transactionId,
  })
  if (error) throw error
}
