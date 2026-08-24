import type { FinancialAIProvider, ProviderRequest } from "./financial-ai-provider.ts"
import type { FunctionCall, ProviderContent, ProviderTurn, ToolDeclaration } from "../types.ts"

type GeminiError = { code?: number | string; message?: string; status?: string }
type GeminiResponse = {
  candidates?: Array<{ content?: ProviderContent; finishReason?: string }>
  error?: GeminiError
}

type GeminiRequestBody = {
  systemInstruction: { parts: Array<{ text: string }> }
  contents: ProviderContent[]
  tools?: Array<{ functionDeclarations: ToolDeclaration[] }>
  generationConfig: { temperature: number; maxOutputTokens: number }
}

export type ProviderHttpDiagnostics = {
  httpStatus: number
  providerStatus?: string
  providerCode?: number | string
  providerMessage?: string
  model: string
}

export class ProviderConfigurationError extends Error {}
export class ProviderTimeoutError extends Error {}
export class ProviderResponseError extends Error {
  readonly diagnostics?: ProviderHttpDiagnostics
  constructor(message: string, diagnostics?: ProviderHttpDiagnostics) {
    super(message)
    this.diagnostics = diagnostics
  }
}
export class ProviderRateLimitError extends ProviderResponseError {}

export class GeminiFinancialAIProvider implements FinancialAIProvider {
  private readonly apiKey: string
  private readonly model: string
  private readonly fetcher: typeof fetch
  private readonly timeoutMs: number

  constructor(apiKey: string, model: string, fetcher: typeof fetch = fetch, timeoutMs = 15_000) {
    if (!apiKey || !model) throw new ProviderConfigurationError("AI provider is not configured.")
    this.apiKey = apiKey
    this.model = model
    this.fetcher = fetcher
    this.timeoutMs = timeoutMs
  }

  async generate(request: ProviderRequest): Promise<ProviderTurn> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
          signal: controller.signal,
          body: JSON.stringify(buildGeminiRequestBody(request)),
        },
      )
      const payload = await readGeminiResponse(response)
      if (!response.ok) {
        const diagnostics = getHttpDiagnostics(response.status, payload.error, this.model)
        if (response.status === 429) throw new ProviderRateLimitError("AI provider quota is temporarily unavailable.", diagnostics)
        throw new ProviderResponseError(`AI provider returned status ${response.status}.`, diagnostics)
      }

      const candidate = payload.candidates?.[0]
      const content = candidate?.content
      if (!content || !Array.isArray(content.parts)) {
        const finishReason = sanitizeProviderMessage(candidate?.finishReason)
        throw new ProviderResponseError(finishReason ? `AI provider returned no content (${finishReason}).` : "AI provider returned an invalid response.")
      }
      const text = content.parts
        .map((part) => typeof part.text === "string" ? part.text : "")
        .filter(Boolean)
        .join("\n")
        .trim()
      const functionCalls = content.parts
        .map((part) => parseFunctionCall(part.functionCall))
        .filter((call): call is FunctionCall => call !== null)
      return { text: text || undefined, functionCalls, content }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw new ProviderTimeoutError("AI provider timed out.")
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function buildGeminiRequestBody(request: ProviderRequest): GeminiRequestBody {
  const body: GeminiRequestBody = {
    systemInstruction: { parts: [{ text: request.systemPrompt }] },
    contents: request.contents,
    generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
  }
  if (request.tools.length > 0) {
    body.tools = [{
      functionDeclarations: request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: toGeminiSchema(tool.parameters),
      })),
    }]
  }
  return body
}

export function getProviderHttpDiagnostics(error: unknown): ProviderHttpDiagnostics | undefined {
  return error instanceof ProviderResponseError ? error.diagnostics : undefined
}

async function readGeminiResponse(response: Response): Promise<GeminiResponse> {
  const responseText = await response.text()
  if (!responseText) return {}
  try {
    const value = JSON.parse(responseText) as unknown
    return value && typeof value === "object" ? value as GeminiResponse : {}
  } catch {
    return {}
  }
}

function getHttpDiagnostics(httpStatus: number, error: GeminiError | undefined, model: string): ProviderHttpDiagnostics {
  return {
    httpStatus,
    providerStatus: sanitizeProviderMessage(error?.status),
    providerCode: typeof error?.code === "number" || typeof error?.code === "string" ? error.code : undefined,
    providerMessage: sanitizeProviderMessage(error?.message),
    model,
  }
}

function sanitizeProviderMessage(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined
  return value
    .replace(/AIza[0-9A-Za-z_-]+/g, "[REDACTED_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:key|api_key)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500)
}

function parseFunctionCall(value: unknown): FunctionCall | null {
  if (!value || typeof value !== "object") return null
  const call = value as Record<string, unknown>
  if (typeof call.name !== "string" || !call.name) return null
  return {
    name: call.name,
    args: call.args && typeof call.args === "object" && !Array.isArray(call.args) ? call.args : {},
    ...(typeof call.id === "string" ? { id: call.id } : {}),
  }
}

const supportedSchemaFields = new Set([
  "type", "format", "title", "description", "nullable", "enum", "maxItems", "minItems",
  "required", "minProperties", "maxProperties", "minLength", "maxLength", "pattern", "example",
  "propertyOrdering", "default", "minimum", "maximum",
])

function toGeminiSchema(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { type: "object" }
  const source = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(source)) {
    if (key === "properties" && item && typeof item === "object" && !Array.isArray(item)) {
      result.properties = Object.fromEntries(Object.entries(item as Record<string, unknown>).map(([name, schema]) => [name, toGeminiSchema(schema)]))
    } else if (key === "items") {
      result.items = toGeminiSchema(item)
    } else if (key === "anyOf" && Array.isArray(item)) {
      result.anyOf = item.map(toGeminiSchema)
    } else if (supportedSchemaFields.has(key)) {
      if (key === "required" && Array.isArray(item) && item.length === 0) continue
      result[key] = item
    }
  }
  return result
}
