import { describe, expect, it, vi } from "vitest"

import {
  buildGeminiRequestBody,
  GeminiFinancialAIProvider,
  getProviderHttpDiagnostics,
  ProviderConfigurationError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderTimeoutError,
} from "../../../supabase/functions/financial-assistant/provider/gemini-provider.ts"
import { runFinancialAssistant } from "../../../supabase/functions/financial-assistant/orchestrator.ts"
import { createToolRegistry, toolDeclarations } from "../../../supabase/functions/financial-assistant/tools/tool-registry.ts"
import type { ProviderRequest } from "../../../supabase/functions/financial-assistant/provider/financial-ai-provider.ts"

const baseRequest: ProviderRequest = {
  systemPrompt: "trusted",
  contents: [{ role: "user", parts: [{ text: "question" }] }],
  tools: [],
}

describe("Gemini generateContent request transformation", () => {
  it("sends a simple no-tools request without an empty tools declaration", async () => {
    const captured: CapturedRequest[] = []
    const provider = new GeminiFinancialAIProvider("server-secret", "gemini-2.5-flash", responseSequence(captured, textResponse("Hello")))
    await expect(provider.generate(baseRequest)).resolves.toMatchObject({ text: "Hello", functionCalls: [] })

    expect(captured).toHaveLength(1)
    expect(captured[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent")
    expect(captured[0].body.tools).toBeUndefined()
    expect(captured[0].body).toMatchObject({
      systemInstruction: { parts: [{ text: "trusted" }] },
      contents: [{ role: "user", parts: [{ text: "question" }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
    })
  })

  it("serializes one declaration using only Gemini Schema fields", async () => {
    const captured: CapturedRequest[] = []
    const provider = new GeminiFinancialAIProvider("server-secret", "gemini-2.5-flash", responseSequence(captured, textResponse("Okay")))
    await provider.generate({
      ...baseRequest,
      tools: [{
        name: "lookup_budget",
        description: "Read a budget.",
        parameters: {
          type: "object",
          properties: { month: { type: "string", description: "YYYY-MM" } },
          required: ["month"],
          additionalProperties: false,
        },
      }],
    })

    const declaration = captured[0].body.tools?.[0].functionDeclarations[0]
    expect(declaration).toEqual({
      name: "lookup_budget",
      description: "Read a budget.",
      parameters: {
        type: "object",
        properties: { month: { type: "string", description: "YYYY-MM" } },
        required: ["month"],
      },
    })
    expect(JSON.stringify(declaration)).not.toContain("additionalProperties")
  })

  it("serializes the complete Finance Tracker registry without unsupported schema fields", async () => {
    const captured: CapturedRequest[] = []
    const provider = new GeminiFinancialAIProvider("server-secret", "gemini-2.5-flash", responseSequence(captured, textResponse("Ready")))
    await provider.generate({ ...baseRequest, tools: toolDeclarations(createToolRegistry()) })

    const declarations = captured[0].body.tools?.[0].functionDeclarations ?? []
    expect(declarations).toHaveLength(9)
    expect(declarations.map((tool) => tool.name)).toContain("get_financial_overview")
    expect(declarations.map((tool) => tool.name)).toContain("calculate_scenario")
    expect(JSON.stringify(declarations)).not.toContain("additionalProperties")
  })

  it("preserves the model call and returns a matching functionResponse on the second request", async () => {
    const captured: CapturedRequest[] = []
    const provider = new GeminiFinancialAIProvider(
      "server-secret",
      "gemini-2.5-flash",
      responseSequence(
        captured,
        functionCallResponse("get_financial_overview", undefined, "call-1"),
        textResponse("Your grounded overview is ready."),
      ),
    )
    const result = await runFinancialAssistant({
      provider,
      question: "How am I doing?",
      history: [],
      context: {
        localDate: "2026-08-24",
        timezone: "Asia/Singapore",
        baseCurrency: "SGD",
        client: { rpc: async () => ({ data: { net_worth_minor: 100000 }, error: null }) },
      },
    })

    expect(result.answer).toBe("Your grounded overview is ready.")
    expect(captured).toHaveLength(2)
    expect(captured[1].body.contents).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "model", parts: expect.arrayContaining([expect.objectContaining({ functionCall: expect.objectContaining({ id: "call-1", name: "get_financial_overview" }) })]) }),
      { role: "user", parts: [{ functionResponse: { name: "get_financial_overview", response: { result: expect.any(Object) }, id: "call-1" } }] },
    ]))
  })

  it("finds function calls in any response part and defaults omitted zero-argument args to an object", async () => {
    const response = {
      candidates: [{ content: { role: "model", parts: [
        { text: "Checking." },
        { functionCall: { name: "get_financial_overview" } },
        { text: "One moment." },
      ] } }],
    }
    const provider = new GeminiFinancialAIProvider("server-secret", "gemini-2.5-flash", responseSequence([], response))
    const turn = await provider.generate({ ...baseRequest, tools: toolDeclarations(createToolRegistry()) })
    expect(turn.text).toBe("Checking.\nOne moment.")
    expect(turn.functionCalls).toEqual([{ name: "get_financial_overview", args: {} }])
  })
})

describe("Gemini provider failure diagnostics", () => {
  it("fails clearly when secrets are missing", () => {
    expect(() => new GeminiFinancialAIProvider("", "model")).toThrow(ProviderConfigurationError)
  })

  it("retains sanitized non-2xx diagnostics for Edge Function logs", async () => {
    const payload = { error: { code: 400, status: "INVALID_ARGUMENT", message: "Unknown field additionalProperties\nkey=AIzaNotARealKey123456789" } }
    const provider = new GeminiFinancialAIProvider("server-secret", "gemini-2.5-flash", responseSequence([], payload, 400))
    let caught: unknown
    try { await provider.generate(baseRequest) } catch (error) { caught = error }
    expect(caught).toBeInstanceOf(ProviderResponseError)
    expect(getProviderHttpDiagnostics(caught)).toEqual({
      httpStatus: 400,
      providerStatus: "INVALID_ARGUMENT",
      providerCode: 400,
      providerMessage: "Unknown field additionalProperties key=[REDACTED_KEY]",
      model: "gemini-2.5-flash",
    })
  })

  it("classifies quota responses", async () => {
    const provider = new GeminiFinancialAIProvider("server-secret", "gemini-2.5-flash", responseSequence([], { error: { status: "RESOURCE_EXHAUSTED" } }, 429))
    await expect(provider.generate(baseRequest)).rejects.toThrow(ProviderRateLimitError)
  })

  it("rejects malformed successful responses", async () => {
    const provider = new GeminiFinancialAIProvider("server-secret", "gemini-2.5-flash", responseSequence([], { candidates: [] }))
    await expect(provider.generate(baseRequest)).rejects.toThrow(ProviderResponseError)
  })

  it("classifies timeouts", async () => {
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
    })) as unknown as typeof fetch
    const provider = new GeminiFinancialAIProvider("server-secret", "gemini-2.5-flash", fetcher, 5)
    await expect(provider.generate(baseRequest)).rejects.toThrow(ProviderTimeoutError)
  })
})

type CapturedRequest = {
  url: string
  body: ReturnType<typeof buildGeminiRequestBody>
}

function responseSequence(captured: CapturedRequest[], ...responses: Array<Record<string, unknown> | number>): typeof fetch {
  let index = 0
  const defaultStatus = typeof responses.at(-1) === "number" ? responses.pop() as number : 200
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(input), body: JSON.parse(String(init?.body)) as ReturnType<typeof buildGeminiRequestBody> })
    const payload = responses[Math.min(index, responses.length - 1)] as Record<string, unknown>
    index += 1
    return new Response(JSON.stringify(payload), { status: defaultStatus })
  }) as unknown as typeof fetch
}

function textResponse(text: string) {
  return { candidates: [{ content: { role: "model", parts: [{ text }] } }] }
}

function functionCallResponse(name: string, args?: Record<string, unknown>, id?: string) {
  return { candidates: [{ content: { role: "model", parts: [{ functionCall: { name, ...(args ? { args } : {}), ...(id ? { id } : {}) } }] } }] }
}
