type ErrorWithMessage = {
  message?: string
}

const friendlyErrors: Array<[string, string]> = [
  ["Invalid login credentials", "The email or password is incorrect."],
  ["Email not confirmed", "Confirm your email before signing in."],
  ["User already registered", "An account already exists for this email."],
  ["Cross-currency transfers", "Cross-currency transfers are not supported in V1."],
  ["Archived accounts", "Archived accounts cannot be used for financial activity."],
  ["Archived categories", "Archived categories cannot be used."],
  ["Account balance must be zero", "Set the account balance to zero before archiving it."],
  ["Set the account value to zero", "Set the account value to zero before archiving it."],
]

export function getErrorMessage(error: unknown, fallback: string) {
  const message = (error as ErrorWithMessage | null)?.message

  if (!message) {
    return fallback
  }

  const friendly = friendlyErrors.find(([needle]) => message.includes(needle))
  return friendly?.[1] ?? fallback
}
