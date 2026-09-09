export function getTodaySpendingTransactionsHref(localDate: string) {
  const query = new URLSearchParams({
    date: localDate,
    type: "expense",
    eligible: "true",
  })
  return `/transactions?${query.toString()}`
}
