import { describe, expect, it } from "vitest"

import { getArchiveAssessment } from "@/features/accounts/account-lifecycle-logic"

describe("account archive eligibility presentation", () => {
  it("allows only zero bank and cash balances", () => {
    expect(getArchiveAssessment({
      id: "bank", name: "Bank", account_type: "bank", currency_code: "SGD", current_balance_minor: 0,
    }, "SGD").allowed).toBe(true)

    const nonZero = getArchiveAssessment({
      id: "cash", name: "Cash", account_type: "cash", currency_code: "SGD", current_balance_minor: 1_000,
    }, "SGD")
    expect(nonZero.allowed).toBe(false)
    expect(nonZero.message).toContain("$10.00")
  })

  it("checks both native and represented base values for Simple investments", () => {
    expect(getArchiveAssessment({
      id: "simple-zero", name: "Simple", account_type: "investment", currency_code: "USD",
      investment_tracking_mode: "simple", native_value_minor: 0, base_value_minor: 0,
    }, "SGD").allowed).toBe(true)

    expect(getArchiveAssessment({
      id: "simple-base", name: "Simple", account_type: "investment", currency_code: "USD",
      investment_tracking_mode: "simple", native_value_minor: 0, base_value_minor: 15_000,
    }, "SGD").allowed).toBe(false)
  })

  it("uses the Detailed represented native value and blocks unknown prices", () => {
    expect(getArchiveAssessment({
      id: "detailed-zero", name: "Detailed", account_type: "investment", currency_code: "USD",
      investment_tracking_mode: "detailed", native_value_minor: 0, base_value_minor: null,
    }, "SGD").allowed).toBe(true)

    expect(getArchiveAssessment({
      id: "detailed-value", name: "Detailed", account_type: "investment", currency_code: "USD",
      investment_tracking_mode: "detailed", native_value_minor: 10_000, base_value_minor: 13_500,
    }, "SGD").allowed).toBe(false)

    expect(getArchiveAssessment({
      id: "detailed-unknown", name: "Detailed", account_type: "investment", currency_code: "USD",
      investment_tracking_mode: "detailed", native_value_minor: null, base_value_minor: null,
    }, "SGD").message).toContain("prices are missing")
  })
})
