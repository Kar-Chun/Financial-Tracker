// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RouteErrorPage } from "@/app/route-error-page"

describe("RouteErrorPage", () => {
  afterEach(() => vi.restoreAllMocks())

  it("replaces raw rendering errors with a safe application error screen", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const router = createMemoryRouter([{
      path: "/",
      element: <BrokenRoute />,
      errorElement: <RouteErrorPage />,
    }])

    render(<RouterProvider router={router} />)

    expect(await screen.findByRole("heading", { name: "Something went wrong" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Return home" })).toBeInTheDocument()
    expect(screen.queryByText("sensitive database details")).not.toBeInTheDocument()
  })
})

function BrokenRoute(): never {
  throw new Error("sensitive database details")
}
