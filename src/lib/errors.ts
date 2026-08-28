type ErrorWithMessage = {
  message?: string
}

const friendlyErrors: Array<[string, string]> = [
  ["You're offline.", "You're offline. Reconnect before saving financial changes."],
  ["Invalid login credentials", "The email or password is incorrect."],
  ["Email not confirmed", "Confirm your email before signing in."],
  ["User already registered", "An account already exists for this email."],
  ["Cross-currency transfers", "Cross-currency transfers are not supported in V1."],
  ["Archived accounts", "Archived accounts cannot be used for financial activity."],
  ["Archived categories", "Archived categories cannot be used."],
  ["Account balance must be zero", "Set the account balance to zero before archiving it."],
  ["Set the account value to zero", "Set the account value to zero before archiving it."],
  ["Account represented value must be zero", "Bring the account's represented value to zero before archiving it."],
  ["Account represented value must be available", "Add any missing investment prices so the account value can be verified before archiving."],
  ["Current net worth is incomplete", "We couldn't reset Net Worth history because some current investment values are incomplete. Update the missing price or FX data first."],
  ["future transactions cannot be archived", "Remove or correct future-dated transactions before archiving this account."],
  ["active category with this name", "An active category with this name already exists here."],
  ["Archive its subcategories first", "Archive its subcategories first."],
  ["Restore the parent category first", "Restore the parent category first."],
  ["one parent level", "Categories support only one subcategory level."],
  ["same type as its parent", "A subcategory must have the same type as its parent."],
  ["Archived parents", "Archived categories cannot receive new subcategories."],
  ["Category not found", "The category could not be found."],
  ["budget already exists", "A budget already exists for that month."],
  ["Previous month budget not found", "The previous month does not have a budget to copy."],
  ["parent expense category", "Choose an active parent expense category."],
  ["Allocation cannot be reduced below zero", "You cannot reduce more than the currently allocated amount."],
  ["Archived savings goals", "Restore the savings goal before changing its allocation."],
  ["Savings goal not found", "The savings goal could not be found."],
  ["Goal target must be greater", "Enter a target amount greater than zero."],
]

export function getErrorMessage(error: unknown, fallback: string) {
  const message = (error as ErrorWithMessage | null)?.message

  if (!message) {
    return fallback
  }

  const activeTransactions = message.match(/Account is used by (\d+) active transaction/)
  if (activeTransactions) {
    const count = Number(activeTransactions[1])
    return `This account is used by ${count} active ${count === 1 ? "transaction" : "transactions"}. Delete or correct those transactions first.`
  }

  const friendly = friendlyErrors.find(([needle]) => message.includes(needle))
  return friendly?.[1] ?? fallback
}
