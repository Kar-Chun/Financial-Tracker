import { describe, expect, it } from "vitest"

import { assistantErrorMessage } from "@/features/assistant/assistant-service"

describe("AI rate-limit messaging", () => {
  it("shows per-user and project-wide 429 messages without quota internals", async () => {
    await expect(assistantErrorMessage({
      context: new Response(JSON.stringify({ code: "rate_limited", internal_count: 30 }), { status: 429 }),
    })).resolves.toBe("You've made several AI requests recently. Try again later.")
    await expect(assistantErrorMessage({
      context: new Response(JSON.stringify({ code: "global_rate_limited", internal_count: 500 }), { status: 429 }),
    })).resolves.toBe("AI usage is temporarily unavailable. Your normal finance features still work.")
  })

  it("uses a generic failure for malformed provider errors", async () => {
    await expect(assistantErrorMessage({ context: new Response("not json", { status: 503 }) })).resolves.toContain("temporarily unavailable")
  })
})
