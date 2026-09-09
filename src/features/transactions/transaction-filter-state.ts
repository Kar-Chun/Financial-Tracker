import { getTransactionMonthRange, type TransactionPageFilters } from "@/features/transactions/transactions-service"
import { isValidIsoCalendarDate } from "@/lib/dates"

export type TransactionFilterState = {
  accountFilter: string
  categoryFilter: string
  eligibleSpending: boolean
  exactDate: string | null
  month: string
  typeFilter: string
}

export function getInitialTransactionFilterState(searchParams: URLSearchParams, fallbackMonth: string): TransactionFilterState {
  const requestedDate = searchParams.get("date")
  const exactDate = isValidIsoCalendarDate(requestedDate) ? requestedDate : null
  const eligibleSpending = exactDate !== null && searchParams.get("eligible") === "true"
  const requestedType = searchParams.get("type")
  const typeFilter = eligibleSpending
    ? "expense"
    : requestedType === "expense" || requestedType === "income" || requestedType === "transfer"
      ? requestedType
      : "all"

  return {
    accountFilter: "all",
    categoryFilter: "all",
    eligibleSpending,
    exactDate,
    month: exactDate?.slice(0, 7) ?? fallbackMonth,
    typeFilter,
  }
}

export function buildTransactionPageFilters(state: TransactionFilterState): TransactionPageFilters {
  const range = state.exactDate
    ? { startDate: state.exactDate, endDate: state.exactDate }
    : getTransactionMonthRange(state.month)

  return {
    ...range,
    transactionType: state.typeFilter === "all"
      ? null
      : state.typeFilter as TransactionPageFilters["transactionType"],
    accountId: state.accountFilter === "all" ? null : state.accountFilter,
    categoryId: state.categoryFilter === "all" ? null : state.categoryFilter,
    eligibleSpending: state.eligibleSpending,
  }
}
