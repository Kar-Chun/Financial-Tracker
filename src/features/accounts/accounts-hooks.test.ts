import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import {
  accountsQueryKey,
  archivedAccountsQueryKey,
  invalidateAccountDependentData,
} from "@/features/accounts/accounts-hooks"

describe("account lifecycle query refresh", () => {
  it("refreshes every current total and selector affected by account lifecycle changes", async () => {
    const queryClient = new QueryClient()
    const keys = [
      accountsQueryKey, archivedAccountsQueryKey,
      ["investments"], ["dashboard"], ["transactions"],
      ["analytics"], ["budgets"], ["goals"],
    ] as const
    keys.forEach((key) => queryClient.setQueryData(key, { loaded: true }))

    await invalidateAccountDependentData(queryClient)

    keys.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true))
  })
})
