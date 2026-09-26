// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { QueryRefreshNotice } from "@/components/shared/query-refresh-notice"

describe("refresh notice", () => {
  it("labels the previous loaded data while a retry is pending and prevents repeated clicks", () => {
    const query = { data: [], error: new TypeError("Failed to fetch"), isError: true, isFetching: true, refetch: vi.fn() }
    const view = render(<QueryRefreshNotice queries={[query]} />)
    expect(screen.getByRole("status")).toHaveTextContent("Showing the latest loaded data")
    expect(screen.getByRole("button", { name: "Refreshing…" })).toBeDisabled()
    view.rerender(<QueryRefreshNotice queries={[{ ...query, isError: false, isFetching: false, error: null }]} />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})
