import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import { invalidateTransactionFinanceData } from "@/features/transactions/transactions-hooks"

describe("transaction mutation refresh", () => {
  it("invalidates transactions, accounts, dashboard, and analytics after a successful save", async () => {
    const queryClient = new QueryClient()
    const keys = [["transactions"], ["accounts"], ["dashboard"], ["analytics"]] as const
    keys.forEach((queryKey) => queryClient.setQueryData(queryKey, { loaded: true }))

    await invalidateTransactionFinanceData(queryClient)

    keys.forEach((queryKey) => expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true))
  })
})
