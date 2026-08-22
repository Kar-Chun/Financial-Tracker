// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  Select,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

describe("Select value labels", () => {
  it("renders the selected account label instead of its UUID", () => {
    const accountId = "7bdcedf8-08ac-4e60-b9d0-9abb8af156b4"
    const items = [{ value: accountId, label: "DBS Savings" }]

    render(
      <Select items={items} value={accountId}>
        <SelectTrigger>
          <SelectValue placeholder="Select account" />
        </SelectTrigger>
      </Select>,
    )

    expect(screen.getByText("DBS Savings")).toBeInTheDocument()
    expect(screen.queryByText(accountId)).not.toBeInTheDocument()
  })
})
