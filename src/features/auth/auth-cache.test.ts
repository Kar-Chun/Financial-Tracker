import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import { clearSensitiveCacheForUserChange } from "@/features/auth/auth-cache"

describe("authenticated query-cache isolation", () => {
  it("preserves the current user's queries during normal session refresh", () => {
    const queryClient = cacheWithDashboardData()

    expect(clearSensitiveCacheForUserChange(queryClient, "user-a", "user-a")).toBe(false)
    expect(queryClient.getQueryData(["dashboard"])).toEqual({ netWorth: 100_000 })
  })

  it("clears sensitive queries on a real user change and logout", () => {
    const queryClient = cacheWithDashboardData()

    expect(clearSensitiveCacheForUserChange(queryClient, "user-a", "user-b")).toBe(true)
    expect(queryClient.getQueryData(["dashboard"])).toBeUndefined()

    queryClient.setQueryData(["accounts"], [{ name: "User B account" }])
    expect(clearSensitiveCacheForUserChange(queryClient, "user-b", null)).toBe(true)
    expect(queryClient.getQueryData(["accounts"])).toBeUndefined()
  })
})

function cacheWithDashboardData() {
  const queryClient = new QueryClient()
  queryClient.setQueryData(["dashboard"], { netWorth: 100_000 })
  return queryClient
}
