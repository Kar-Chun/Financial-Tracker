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
]

export function getErrorMessage(error: unknown, fallback: string) {
  const message = (error as ErrorWithMessage | null)?.message

  if (!message) {
    return fallback
  }

  const friendly = friendlyErrors.find(([needle]) => message.includes(needle))
  return friendly?.[1] ?? fallback
}
