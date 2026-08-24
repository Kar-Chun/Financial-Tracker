import type { ConversationMessage } from "./types.ts"

export const MAX_ASSISTANT_BODY_BYTES = 16_384

export class AssistantRequestError extends Error {
  readonly status: 400 | 413

  constructor(message: string, status: 400 | 413 = 400) {
    super(message)
    this.status = status
  }
}

export type ValidatedAssistantRequest = {
  question: string
  history: ConversationMessage[]
  workflow?: "monthly_review"
}

export async function readValidatedAssistantRequest(request: Request): Promise<ValidatedAssistantRequest> {
  const declaredLength = parseContentLength(request.headers.get("Content-Length"))
  if (declaredLength !== undefined && declaredLength > MAX_ASSISTANT_BODY_BYTES) {
    throw new AssistantRequestError("AI request body is too large.", 413)
  }

  const reader = request.body?.getReader()
  if (!reader) return validateAssistantRequestText("", declaredLength)
  const chunks: Uint8Array[] = []
  let byteLength = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    byteLength += value.byteLength
    if (byteLength > MAX_ASSISTANT_BODY_BYTES) {
      await reader.cancel()
      throw new AssistantRequestError("AI request body is too large.", 413)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return validateAssistantRequestText(new TextDecoder().decode(bytes), declaredLength)
}

export function validateAssistantRequestText(text: string, declaredLength?: number): ValidatedAssistantRequest {
  if (declaredLength !== undefined && declaredLength > MAX_ASSISTANT_BODY_BYTES) {
    throw new AssistantRequestError("AI request body is too large.", 413)
  }
  if (new TextEncoder().encode(text).byteLength > MAX_ASSISTANT_BODY_BYTES) {
    throw new AssistantRequestError("AI request body is too large.", 413)
  }
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new AssistantRequestError("AI request body must be valid JSON.") }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AssistantRequestError("AI request body is invalid.")
  const body = value as Record<string, unknown>
  if (body.workflow !== undefined && body.workflow !== "monthly_review") {
    throw new AssistantRequestError("AI workflow is invalid.")
  }
  return {
    question: validateQuestion(body.message),
    history: validateHistory(body.history),
    ...(body.workflow === "monthly_review" ? { workflow: "monthly_review" as const } : {}),
  }
}

function parseContentLength(value: string | null) {
  if (value === null) return undefined
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new AssistantRequestError("Content-Length is invalid.")
  return parsed
}

function validateQuestion(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new AssistantRequestError("Enter a question.")
  if (value.length > 2_000) throw new AssistantRequestError("Keep the question under 2,000 characters.")
  return value.trim()
}

function validateHistory(value: unknown): ConversationMessage[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 6) throw new AssistantRequestError("Conversation context is invalid.")
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new AssistantRequestError("Conversation context is invalid.")
    const message = item as Record<string, unknown>
    if ((message.role !== "user" && message.role !== "assistant") || typeof message.text !== "string" || message.text.length > 2_000) {
      throw new AssistantRequestError("Conversation context is invalid.")
    }
    return { role: message.role, text: message.text }
  })
}
