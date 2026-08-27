import { formatCurrency } from "@/lib/currency"
import type { AccountType } from "@/types/finance"

export type LifecycleAccount = {
  id: string
  name: string
  account_type: AccountType
  currency_code: string
  investment_tracking_mode?: "simple" | "detailed"
  current_balance_minor?: number | null
  native_value_minor?: number | null
  base_value_minor?: number | null
}

export function getArchiveAssessment(account: LifecycleAccount, baseCurrency: string) {
  if (account.account_type !== "investment") {
    const value = account.current_balance_minor
    if (value === null || value === undefined) {
      return { allowed: false, message: "The current represented balance could not be verified. Refresh the account before archiving." }
    }
    if (value !== 0) {
      return {
        allowed: false,
        message: `This account still contains ${formatCurrency(value, account.currency_code)}. Bring its tracked balance to zero before archiving, or permanently delete it only if this is test data.`,
      }
    }
  } else if (account.investment_tracking_mode === "detailed") {
    if (account.native_value_minor === null || account.native_value_minor === undefined) {
      return { allowed: false, message: "The represented value cannot be verified while holding prices are missing. Add prices before archiving, or permanently delete it only if this is test data." }
    }
    if (account.native_value_minor !== 0) {
      return {
        allowed: false,
        message: `This account still contains ${formatCurrency(account.native_value_minor, account.currency_code)}. Bring its represented value to zero before archiving, or permanently delete it only if this is test data.`,
      }
    }
  } else {
    const native = account.native_value_minor
    const base = account.base_value_minor
    if (native === null || native === undefined || base === null || base === undefined) {
      return { allowed: false, message: "The represented investment value could not be verified. Refresh the account before archiving." }
    }
    if (native !== 0 || base !== 0) {
      const value = native !== 0
        ? formatCurrency(native, account.currency_code)
        : formatCurrency(base, baseCurrency)
      return {
        allowed: false,
        message: `This account still contains ${value}. Bring its represented value to zero before archiving, or permanently delete it only if this is test data.`,
      }
    }
  }

  return {
    allowed: true,
    message: "The account will leave active lists and new transaction selectors. Its complete history will be preserved and it can be restored later.",
  }
}
