import { describe, expect, it } from "vitest"

import { assistantDestinations, isAssistantResponse } from "@/features/assistant/assistant-types"

describe("assistant response boundary", () => {
  it("accepts only allowlisted navigation destinations", () => {
    expect(isAssistantResponse({ answer: "Grounded answer", used_tools: ["get_budget_status"], suggested_action: { destination: "budgets", label: "View budget" } })).toBe(true)
    expect(isAssistantResponse({ answer: "Unsafe", used_tools: [], suggested_action: { destination: "https://example.com", label: "Leave" } })).toBe(false)
    expect(assistantDestinations.budgets).toBe("/budgets")
  })

  it("rejects malformed provider responses", () => {
    expect(isAssistantResponse({ answer: "Missing tools" })).toBe(false)
    expect(isAssistantResponse({ answer: "Wrong tools", used_tools: [42] })).toBe(false)
  })
})

