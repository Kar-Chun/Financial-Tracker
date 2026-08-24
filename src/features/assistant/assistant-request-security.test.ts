import { describe, expect, it, vi } from "vitest"

import { shouldClearUserCache } from "@/features/auth/auth-cache"
import {
  MAX_ASSISTANT_BODY_BYTES,
  readValidatedAssistantRequest,
  validateAssistantRequestText,
} from "../../../supabase/functions/financial-assistant/request-validation.ts"
import {
  claimAiRequest,
  completeAiRequest,
} from "../../../supabase/functions/financial-assistant/rate-limit.ts"

describe("AI request boundary", () => {
  it("accepts only six bounded conversation messages", () => {
    const history = Array.from({ length: 6 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      text: `message-${index}`,
    }))
    expect(validateAssistantRequestText(JSON.stringify({ message: "Review my month", history }))).toMatchObject({
      question: "Review my month",
      history,
    })
    expect(() => validateAssistantRequestText(JSON.stringify({ message: "Review", history: [...history, history[0]] }))).toThrow("Conversation context")
  })

  it("rejects oversized bytes before provider orchestration", () => {
    expect(() => validateAssistantRequestText("{}", MAX_ASSISTANT_BODY_BYTES + 1)).toThrow("too large")
    const multibyte = JSON.stringify({ message: "界".repeat(MAX_ASSISTANT_BODY_BYTES / 2) })
    expect(() => validateAssistantRequestText(multibyte)).toThrow("too large")
  })

  it("stops reading a streamed body once the byte limit is exceeded", async () => {
    const request = new Request("https://example.test/assistant", {
      method: "POST",
      body: JSON.stringify({ message: "界".repeat(MAX_ASSISTANT_BODY_BYTES) }),
    })
    await expect(readValidatedAssistantRequest(request)).rejects.toThrow("too large")
  })

  it("rejects malformed JSON and invalid message shapes", () => {
    expect(() => validateAssistantRequestText("not json")).toThrow("valid JSON")
    expect(() => validateAssistantRequestText(JSON.stringify({ message: "" }))).toThrow("Enter a question")
    expect(() => validateAssistantRequestText(JSON.stringify({ message: "x".repeat(2_001) }))).toThrow("2,000")
    expect(() => validateAssistantRequestText(JSON.stringify({ message: "Hi", workflow: "untrusted" }))).toThrow("workflow")
  })
})

describe("AI server-side lease response handling", () => {
  it("accepts an authenticated database lease and records completion", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { allowed: true, lease_id: "lease-1" }, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
    const client = { rpc }

    await expect(claimAiRequest(client, "gemini-2.5-flash")).resolves.toEqual({ allowed: true, leaseId: "lease-1" })
    await expect(completeAiRequest(client, "lease-1", "succeeded")).resolves.toBe(true)
    expect(rpc).toHaveBeenNthCalledWith(1, "claim_ai_request_slot", { p_model: "gemini-2.5-flash" })
    expect(rpc).toHaveBeenNthCalledWith(2, "complete_ai_request_slot", { p_lease_id: "lease-1", p_status: "succeeded" })
  })

  it("returns a bounded denial without granting a provider lease", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: { allowed: false, reason: "global", retry_after_seconds: 999_999 }, error: null }) }
    await expect(claimAiRequest(client, "gemini-2.5-flash")).resolves.toEqual({
      allowed: false,
      reason: "global",
      retryAfterSeconds: 86_400,
    })
  })

  it("fails closed when the abuse-control RPC is unavailable or malformed", async () => {
    await expect(claimAiRequest({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "failed" } }) }, "model")).rejects.toThrow("protection is unavailable")
    await expect(claimAiRequest({ rpc: vi.fn().mockResolvedValue({ data: { allowed: true }, error: null }) }, "model")).rejects.toThrow("invalid response")
  })
})

describe("authenticated-user cache isolation", () => {
  it("clears cached server data on logout and direct user switches", () => {
    expect(shouldClearUserCache(undefined, "user-a")).toBe(false)
    expect(shouldClearUserCache("user-a", "user-a")).toBe(false)
    expect(shouldClearUserCache("user-a", null)).toBe(true)
    expect(shouldClearUserCache("user-a", "user-b")).toBe(true)
  })
})
