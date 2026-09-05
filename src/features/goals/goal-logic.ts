import { z } from "zod"

import { parseCurrencyToMinor } from "@/lib/currency"

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
