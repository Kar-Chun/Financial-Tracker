// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { reportReadFailure, reportRouteFailure, safeRouteName } from "@/lib/query-diagnostics"

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); window.history.replaceState(null, "", "/") })

describe("safe diagnostics", () => {
  it("prints only allowlisted metadata, including when query keys and errors contain private data", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    window.history.replaceState(null, "", "/investments/private-account/holdings/private-holding?note=private-note")
    reportReadFailure({ code: "private-code", message: "private-amount", details: "private-token" }, ["transactions", "note-suggestions", "private-user", "private-note"])
    reportRouteFailure(new Error("Failed to fetch dynamically imported module: private-url"), window.location.pathname)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[0][1]).toEqual({ query: "transactions", category: "server", route: "/investments/:accountId/holdings/:holdingId", online: true })
    expect(warn.mock.calls[1][1]).toMatchObject({ category: "chunk-load" })
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private-")
    expect(safeRouteName("/private-path/private-id")).toBe("other")
  })

  it("does not emit diagnostics in production", () => {
    vi.stubEnv("DEV", false)
    const warn = vi.spyOn(console, "warn")
    reportReadFailure(new Error("private"), ["profile"])
    reportRouteFailure(new Error("private"), "/dashboard")
    expect(warn).not.toHaveBeenCalled()
  })
})
