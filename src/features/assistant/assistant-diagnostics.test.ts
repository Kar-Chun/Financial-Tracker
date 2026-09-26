import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

import { logAssistantError } from "../../../supabase/functions/financial-assistant/diagnostics.ts"
import {
  GeminiFinancialAIProvider,
  ProviderResponseError,
  ProviderTimeoutError,
} from "../../../supabase/functions/financial-assistant/provider/gemini-provider.ts"

const privateText = "My DBS account balance is S$12,345 and note is SECRET_PRIVATE_TEXT"
const apiKey = ["AI", "zaFakePrivateKeyForTests"].join("")
const token = "Bearer PRIVATE_AUTH_TOKEN"
const prompt = "PRIVATE_USER_PROMPT"
const request = { systemPrompt: "PRIVATE_SYSTEM_CONTEXT", contents: [{ role: "user" as const, parts: [{ text: prompt }] }], tools: [] }

afterEach(() => vi.restoreAllMocks())

describe("assistant operational log privacy", () => {
  it.each([
    [400, "provider_error", false],
    [401, "provider_error", false],
    [429, "quota", true],
    [503, "provider_error", true],
  ] as const)("logs only allowlisted metadata for HTTP %s", async (status, category, retryable) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const raw = { error: { message: `${privateText} ${apiKey} ${token}`, code: privateText, status: prompt }, request }
    const response = new Response(JSON.stringify(raw), { status })
    const readBody = vi.spyOn(response, "text")
    const provider = new GeminiFinancialAIProvider(apiKey, "gemini-test", vi.fn<typeof fetch>().mockResolvedValue(response))
    let caught: unknown
    try { await provider.generate(request) } catch (error) { caught = error }
    expect(caught).toBeInstanceOf(ProviderResponseError)
    expect(logAssistantError(caught, "server-generated-request-id")).toBe(category)
    expect(readBody).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledTimes(1)
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({
      request_id: "server-generated-request-id", category, provider: "gemini", http_status: status, retryable,
    })
    const diagnosticOutput = JSON.stringify([log.mock.calls, caught, caught instanceof Error ? caught.message : null])
    for (const value of [privateText, "SECRET_PRIVATE_TEXT", apiKey, token, prompt, request.systemPrompt, JSON.stringify(raw), JSON.stringify(request)]) {
      expect(diagnosticOutput).not.toContain(value)
    }
  })

  it("does not retain free-form finish reasons from a malformed successful response", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const provider = new GeminiFinancialAIProvider(apiKey, "gemini-test", vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ finishReason: privateText }] })),
    ))
    let caught: unknown
    try { await provider.generate(request) } catch (error) { caught = error }
    expect(caught).toBeInstanceOf(ProviderResponseError)
    expect((caught as Error).message).toBe("AI provider returned an invalid response.")
    logAssistantError(caught, "request-id")
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateText)
  })

  it("keeps timeout classification without logging exception text or stack", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)
    expect(logAssistantError(new ProviderTimeoutError(privateText), "request-id")).toBe("timeout")
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({ request_id: "request-id", category: "timeout" })
  })

  it("projects diagnostics at the log boundary instead of spreading error properties", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const error = new ProviderResponseError(privateText, { httpStatus: 502, retryable: false })
    Object.assign(error.diagnostics!, { providerMessage: privateText, providerCode: token, model: apiKey, request })
    logAssistantError(error, "request-id")
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({
      request_id: "request-id", category: "provider_error", provider: "gemini", http_status: 502, retryable: true,
    })
  })

  it("logs unknown transport errors without free-form details", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)
    logAssistantError(new TypeError(`${privateText} ${apiKey} ${token}`), "request-id")
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({ request_id: "request-id", category: "invalid_request" })
  })

  it("uses this logging boundary in the Edge handler and returns only domain validation messages", () => {
    const handler = readFileSync(resolve("supabase/functions/financial-assistant/index.ts"), "utf8")
    expect(handler).toContain("const category = logAssistantError(error, requestId)")
    expect(handler).toContain('error instanceof AssistantRequestError ? error.message : "The request is invalid."')
    expect(handler).not.toMatch(/gemini_error_message|getProviderHttpDiagnostics|console\.error\(error/)
    expect(handler).toContain("const requestId = crypto.randomUUID()")
  })
})
