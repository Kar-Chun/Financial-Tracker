import { z } from "zod"

import { parseCurrencyToMinor } from "@/lib/currency"
import type { AccountSummaryRow } from "@/types/database"

export const goalFormSchema = z.object({
  name: z.string().trim().min(1, "Goal name is required.").max(100, "Use 100 characters or fewer."),
  targetAmount: z.string().trim().min(1, "Target amount is required."),
  targetDate: z.string().refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Choose a valid date."),
  note: z.string().trim().max(500, "Use 500 characters or fewer."),
})

export type GoalFormValues = z.infer<typeof goalFormSchema>

export function parsePositiveGoalTarget(input: string, currencyCode: string) {
  const amountMinor = parseCurrencyToMinor(input, currencyCode)
  if (amountMinor <= 0) throw new Error("Target amount must be greater than zero.")
  return amountMinor
}

export function getGoalProgress(allocatedMinor: number, targetMinor: number) {
  if (!Number.isSafeInteger(allocatedMinor) || !Number.isSafeInteger(targetMinor) || targetMinor <= 0) {
    throw new Error("Goal progress requires safe integer minor units and a positive target.")
  }
  const percentage = Number((BigInt(allocatedMinor) * 1000n + BigInt(targetMinor) / 2n) / BigInt(targetMinor)) / 10
  return {
    percentage,
    visualPercentage: Math.min(Math.max(percentage, 0), 100),
    remainingMinor: Math.max(targetMinor - allocatedMinor, 0),
    reached: allocatedMinor >= targetMinor,
  }
}

export function formatGoalPercent(value: number) {
  return `${new Intl.NumberFormat("en-SG", { maximumFractionDigits: 1 }).format(value)}%`
}

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

export function getRequiredMonthly(input: {
  remainingMinor: number
  targetDate: string | null
  localToday: string
  reached: boolean
}) {
  if (!input.targetDate || input.reached) return { requiredMonthlyMinor: null, monthsRemaining: null, targetDatePassed: false }
  const currentMonthIndex = monthIndex(input.localToday)
  const targetMonthIndex = monthIndex(input.targetDate)
  if (targetMonthIndex < currentMonthIndex) return { requiredMonthlyMinor: null, monthsRemaining: null, targetDatePassed: true }
  const monthsRemaining = targetMonthIndex - currentMonthIndex + 1
  const remaining = BigInt(Math.max(input.remainingMinor, 0))
  const months = BigInt(monthsRemaining)
  return {
    requiredMonthlyMinor: Number((remaining + months - 1n) / months),
    monthsRemaining,
    targetDatePassed: false,
  }
}

function monthIndex(date: string) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date)
  if (!match) throw new Error("A valid calendar date is required.")
  return Number(match[1]) * 12 + Number(match[2]) - 1
}
