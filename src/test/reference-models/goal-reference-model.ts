import type { AccountSummaryRow } from "@/types/finance"

export function sumAllocations(amounts: number[]) {
  return amounts.reduce((total, amount) => {
    if (!Number.isSafeInteger(amount)) throw new Error("Allocations must use safe integer minor units.")
    const next = total + amount
    if (!Number.isSafeInteger(next)) throw new Error("Allocation total is too large.")
    return next
  }, 0)
}

export function applyAllocation(currentMinor: number, operation: "allocate" | "reduce", amountMinor: number) {
  if (!Number.isSafeInteger(currentMinor) || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Allocation amount must be a positive safe integer.")
  }
  const result = operation === "allocate" ? currentMinor + amountMinor : currentMinor - amountMinor
  if (result < 0) throw new Error("Allocation cannot be reduced below zero.")
  if (!Number.isSafeInteger(result)) throw new Error("Allocation total is too large.")
  return result
}

export function getAvailableCash(accounts: AccountSummaryRow[], baseCurrency: string) {
  return accounts.reduce((total, account) => {
    const eligible = (account.account_type === "bank" || account.account_type === "cash")
      && account.included_in_net_worth
      && account.currency_code === baseCurrency
    return eligible ? total + (account.current_balance_minor ?? 0) : total
  }, 0)
}

export function getAllocationSummary(availableCashMinor: number, activeAllocations: number[]) {
  const totalAllocatedMinor = sumAllocations(activeAllocations)
  return { totalAllocatedMinor, unallocatedCashMinor: availableCashMinor - totalAllocatedMinor }
}
